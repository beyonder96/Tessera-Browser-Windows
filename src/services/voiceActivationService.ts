import type { VoiceAssistantState, VoiceAssistantStatus } from '../shared/types';

export type VoiceIntent =
  | { type: 'search'; query: string }
  | { type: 'navigate'; target: string }
  | { type: 'ai_summary' }
  | { type: 'ai_question'; question: string }
  | { type: 'podcast_read' }
  | { type: 'new_tab' }
  | { type: 'close_tab' }
  | { type: 'reader_mode' }
  | { type: 'pip_video' }
  | { type: 'toggle_dark' };

type StateListener = (state: VoiceAssistantState) => void;
type IntentListener = (intent: VoiceIntent) => void;
type AudioLevelListener = (level: number) => void;

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
  }
  return window.btoa(binary);
}

class VoiceActivationService {
  private state: VoiceAssistantState = {
    isActive: false,
    status: 'idle',
    transcript: '',
    interimTranscript: '',
    lastResponse: null,
    error: null
  };

  private stateListeners: Set<StateListener> = new Set();
  private intentListeners: Set<IntentListener> = new Set();
  private audioLevelListeners: Set<AudioLevelListener> = new Set();

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activeStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingMimeType = 'audio/webm;codecs=opus';

  private vadAnimId: number | null = null;
  private hasDetectedSpeech = false;
  private lastVoiceTimestamp = 0;
  private listeningStartedAt = 0;
  private isProcessingAudio = false;

  private isContinuousWakeWordRunning = false;
  private wakeWordStream: MediaStream | null = null;
  private wakeWordRecorder: MediaRecorder | null = null;
  private wakeWordChunks: Blob[] = [];
  private wakeWordCheckInProgress = false;
  private wakeWordAnimId: number | null = null;

  private manualTriggerActive = false;
  private commandTimeoutId: number | null = null;

  constructor() {
    // Best available audio mime type
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        this.recordingMimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        this.recordingMimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        this.recordingMimeType = 'audio/ogg;codecs=opus';
      } else {
        this.recordingMimeType = '';
      }
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Generates a sleek 2-tone Apple/Siri style ascending audio chime
   */
  public playWakeChime() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Note 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Note 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0.001, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.24, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);
    } catch {}
  }

  /**
   * Generates a soft success chime
   */
  public playSuccessChime() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now); // C6
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  /**
   * Generates a soft dismiss chime
   */
  public playDismissChime() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  /**
   * Triggered by Mic button in AirBar or shortcut
   */
  public async activateManualListening() {
    this.manualTriggerActive = true;
    this.playWakeChime();

    // Reset previous audio capture state
    this.cleanupRecordingResources();

    this.updateState({
      isActive: true,
      status: 'listening',
      transcript: '',
      interimTranscript: 'Ouvindo sua voz...',
      error: null
    });

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.updateState({
        status: 'error',
        error: 'Microfone não suportado nesta plataforma.'
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.activeStream = stream;
      this.setupRecordingAndVAD(stream);
    } catch (err: any) {
      console.warn('[VoiceActivation] getUserMedia failed:', err);
      let errorMsg = 'Microfone inacessível no Windows.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg =
          'Microfone bloqueado pelo Windows. Vá em Configurações do Windows > Privacidade > Microfone e ative "Permitir que os aplicativos da área de trabalho acessem o microfone".';
      }
      this.updateState({
        status: 'error',
        error: errorMsg
      });
    }
  }

  private setupRecordingAndVAD(stream: MediaStream) {
    try {
      const ctx = this.getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);
      this.analyser = analyser;

      // Initialize MediaRecorder
      const options = this.recordingMimeType ? { mimeType: this.recordingMimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      this.mediaRecorder = recorder;
      this.recordedChunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      recorder.start(100);

      this.hasDetectedSpeech = false;
      this.lastVoiceTimestamp = 0;
      this.listeningStartedAt = Date.now();
      this.isProcessingAudio = false;

      // Start Voice Activity Detection (VAD) & audio level dispatch loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const vadLoop = () => {
        if (!this.state.isActive || this.isProcessingAudio || !this.mediaRecorder) {
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, Math.max(0, avg / 128));

        // Notify audio level visualizer listeners
        for (const listener of this.audioLevelListeners) {
          listener(normalized);
        }

        const now = Date.now();

        // Speech detection threshold
        if (normalized > 0.07) {
          if (!this.hasDetectedSpeech) {
            this.hasDetectedSpeech = true;
            this.updateState({ interimTranscript: 'Ouvindo...' });
          }
          this.lastVoiceTimestamp = now;
        }

        // Auto-finalize when user finishes speaking (1.1s of silence after speaking)
        if (this.hasDetectedSpeech && now - this.lastVoiceTimestamp > 1100) {
          void this.stopAndTranscribe();
          return;
        }

        // 8 seconds timeout without any speech detected
        if (!this.hasDetectedSpeech && now - this.listeningStartedAt > 8000) {
          this.updateState({
            status: 'error',
            error: 'Nenhuma voz ouvida. Toque no microfone e tente falar novamente.'
          });
          this.cleanupRecordingResources();
          return;
        }

        // Hard safety timeout: 14s max duration
        if (now - this.listeningStartedAt > 14000) {
          void this.stopAndTranscribe();
          return;
        }

        this.vadAnimId = requestAnimationFrame(vadLoop);
      };

      this.vadAnimId = requestAnimationFrame(vadLoop);
    } catch (err) {
      console.error('[VoiceActivation] setupRecordingAndVAD error:', err);
    }
  }

  /**
   * Stops recording and executes AI audio transcription
   */
  public async stopAndTranscribe() {
    if (this.isProcessingAudio) return;
    this.isProcessingAudio = true;

    if (this.vadAnimId) {
      cancelAnimationFrame(this.vadAnimId);
      this.vadAnimId = null;
    }

    // Zero out audio levels
    for (const listener of this.audioLevelListeners) {
      listener(0);
    }

    this.updateState({
      status: 'processing',
      interimTranscript: 'Processando com Tessera AI...'
    });

    const recorder = this.mediaRecorder;
    if (!recorder) {
      this.updateState({ status: 'idle' });
      this.isProcessingAudio = false;
      return;
    }

    await new Promise<void>((resolve) => {
      if (recorder.state === 'inactive') {
        resolve();
        return;
      }
      recorder.onstop = () => resolve();
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    const chunks = this.recordedChunks;
    const stream = this.activeStream;
    this.cleanupRecordingResources();

    if (!chunks.length) {
      this.updateState({
        status: 'error',
        error: 'Nenhum áudio capturado. Toque no microfone e tente falar novamente.'
      });
      this.isProcessingAudio = false;
      return;
    }

    try {
      const mime = recorder.mimeType || this.recordingMimeType || 'audio/webm';
      const audioBlob = new Blob(chunks, { type: mime });
      const base64Audio = await blobToBase64(audioBlob);

      if (window.tesseraApi?.aiTranscribeAudio) {
        const text = await window.tesseraApi.aiTranscribeAudio(base64Audio, mime);
        const clean = (text || '').trim();

        if (clean) {
          this.updateState({
            status: 'processing',
            transcript: clean,
            interimTranscript: clean
          });
          this.processRecognizedCommand(clean);
        } else {
          this.updateState({
            status: 'error',
            error: 'Não foi possível reconhecer o comando de voz. Tente falar novamente.'
          });
        }
      } else {
        throw new Error('Serviço de transcrição nativo do Tessera indisponível.');
      }
    } catch (err: any) {
      console.warn('[VoiceActivation] Transcription error:', err);
      this.updateState({
        status: 'error',
        error: err?.message || 'Falha ao processar o áudio com Tessera AI.'
      });
    } finally {
      this.isProcessingAudio = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    }
  }

  /**
   * Finishes recording immediately when the user clicks 'Concluir'
   */
  public finishRecordingManually() {
    void this.stopAndTranscribe();
  }

  /**
   * Executes a command string typed manually or selected via suggestion chip
   */
  public executeManualCommand(command: string) {
    const clean = command.trim();
    if (!clean) return;
    this.manualTriggerActive = true;
    this.cleanupRecordingResources();

    this.updateState({
      isActive: true,
      status: 'processing',
      transcript: clean,
      interimTranscript: clean,
      error: null
    });
    this.processRecognizedCommand(clean);
  }

  public cancel() {
    this.manualTriggerActive = false;
    this.cleanupRecordingResources();
    this.playDismissChime();

    if (this.commandTimeoutId) {
      clearTimeout(this.commandTimeoutId);
      this.commandTimeoutId = null;
    }

    this.updateState({
      isActive: false,
      status: 'idle',
      transcript: '',
      interimTranscript: '',
      error: null
    });
  }

  private cleanupRecordingResources() {
    if (this.vadAnimId) {
      cancelAnimationFrame(this.vadAnimId);
      this.vadAnimId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
    }
    for (const listener of this.audioLevelListeners) {
      listener(0);
    }
  }

  /**
   * Continuous Wake Word ("Ei Tessera") background listener
   */
  public async startContinuousWakeWord() {
    if (this.isContinuousWakeWordRunning) return;
    this.isContinuousWakeWordRunning = true;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      this.wakeWordStream = stream;

      const ctx = this.getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        if (!this.isContinuousWakeWordRunning || !this.wakeWordStream) return;

        // Skip background wake word detection if main overlay is currently open
        if (this.state.isActive) {
          this.wakeWordAnimId = requestAnimationFrame(loop);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = avg / 128;

        // Sound trigger threshold (raised from 0.12 to 0.22 to eliminate ambient noise/typing/breathing)
        if (normalized > 0.22 && !this.wakeWordCheckInProgress) {
          this.captureWakeWordSnippet(stream);
        }

        this.wakeWordAnimId = requestAnimationFrame(loop);
      };

      this.wakeWordAnimId = requestAnimationFrame(loop);
    } catch (err) {
      console.warn('[VoiceActivation] Continuous wake word mic notice:', err);
    }
  }

  private async captureWakeWordSnippet(stream: MediaStream) {
    if (this.wakeWordCheckInProgress || this.state.isActive) return;
    this.wakeWordCheckInProgress = true;

    try {
      const options = this.recordingMimeType ? { mimeType: this.recordingMimeType } : undefined;
      const rec = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      rec.start();
      await new Promise((r) => setTimeout(r, 2200));

      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });

      if (!chunks.length || this.state.isActive) {
        this.wakeWordCheckInProgress = false;
        return;
      }

      const blob = new Blob(chunks, { type: rec.mimeType || this.recordingMimeType });
      const b64 = await blobToBase64(blob);

      if (window.tesseraApi?.aiTranscribeAudio) {
        // Pass true to indicate wake word check (uses unbiased prompt to avoid hallucinating 'Tessera' from noise)
        const text = await window.tesseraApi.aiTranscribeAudio(b64, blob.type, true);
        const raw = (text || '').trim();

        // Strict wake-word regex requiring clear intentional trigger ('ei tessera', 'ok tessera', 'olá tessera', 'hey tessera', 'ouça tessera' or standalone 'tessera')
        // Eliminates false triggers from common words like 'terceira', 'que será', 'disse era', 'de cera', 'tess'
        const wakeWordRegex =
          /(?:^|\b)(?:(?:ei|ok|hey|ol[aá]|ou[çc]a)\s+t[eé]ss?era|t[eé]ss?era\b)[\s,.:!-]*(.*)$/i;

        const match = raw.match(wakeWordRegex);
        if (match) {
          const trailing = match[1]?.trim() || '';
          this.activateManualListening();

          // Only auto-process trailing phrase if it contains a real command (>= 3 chars, not simple fillers)
          if (trailing && trailing.length >= 3 && !/^(?:[ée]|hum|ah|uh|ok|ent[aã]o|hein)$/i.test(trailing)) {
            setTimeout(() => {
              if (this.state.isActive && this.state.status === 'listening') {
                this.processRecognizedCommand(trailing);
              }
            }, 450);
          }
        }
      }
    } catch {}
    this.wakeWordCheckInProgress = false;
  }

  public stopContinuousWakeWord() {
    this.isContinuousWakeWordRunning = false;
    if (this.wakeWordAnimId) {
      cancelAnimationFrame(this.wakeWordAnimId);
      this.wakeWordAnimId = null;
    }
    if (this.wakeWordStream) {
      this.wakeWordStream.getTracks().forEach((track) => track.stop());
      this.wakeWordStream = null;
    }
  }

  private processRecognizedCommand(command: string) {
    if (this.commandTimeoutId) {
      clearTimeout(this.commandTimeoutId);
      this.commandTimeoutId = null;
    }

    this.updateState({
      status: 'processing',
      transcript: command,
      interimTranscript: command
    });

    const parsedIntent = this.parseCommandIntent(command);
    this.playSuccessChime();

    // Notify all registered intent listeners
    for (const listener of this.intentListeners) {
      listener(parsedIntent);
    }

    setTimeout(() => {
      this.updateState({
        isActive: false,
        status: 'idle',
        transcript: '',
        interimTranscript: ''
      });
      this.manualTriggerActive = false;
    }, 1400);
  }

  private parseCommandIntent(raw: string): VoiceIntent {
    const text = raw.toLowerCase().trim();

    // 1. Navigation / Search
    if (/^(?:pesquisar|pesquise|buscar|busque|procure por|procurar)\s+(.+)/i.test(text)) {
      const q = text.replace(/^(?:pesquisar|pesquise|buscar|busque|procure por|procurar)\s+/i, '');
      return { type: 'search', query: q };
    }

    if (/^(?:abrir|abra|vá para|ir para|acesse|acessar)\s+(.+)/i.test(text)) {
      const target = text.replace(/^(?:abrir|abra|vá para|ir para|acesse|acessar)\s+/i, '');
      return { type: 'navigate', target };
    }

    // 2. Tessera AI Summarization
    if (/^(?:resumir|resuma|faça um resumo|síntese|resumo da página)/i.test(text)) {
      return { type: 'ai_summary' };
    }

    // 3. Audio / Podcastify TTS
    if (/^(?:ler|leia|ouvir|ouça|podcast|tocar áudio|leia a página)/i.test(text)) {
      return { type: 'podcast_read' };
    }

    // 4. Tabs Management
    if (/^(?:nova guia|nova aba|abrir guia|abrir aba)/i.test(text)) {
      return { type: 'new_tab' };
    }

    if (/^(?:fechar guia|fechar aba|fecha a aba)/i.test(text)) {
      return { type: 'close_tab' };
    }

    // 5. Reader Mode
    if (/^(?:modo leitor|modo leitura|leitura focada)/i.test(text)) {
      return { type: 'reader_mode' };
    }

    // 6. Picture-in-Picture
    if (/^(?:pip|picture in picture|destacar vídeo|janela flutuante)/i.test(text)) {
      return { type: 'pip_video' };
    }

    // 7. Dark/Light Theme
    if (/^(?:modo escuro|modo claro|tema escuro|tema claro|inverter cores)/i.test(text)) {
      return { type: 'toggle_dark' };
    }

    // 8. Question to Tessera AI (e.g. "o que é X", "quem foi X", "qual a capital de X")
    if (/^(?:o que é|quem foi|quem é|qual|como|por que|quando|onde)\b/i.test(text)) {
      return { type: 'ai_question', question: raw };
    }

    // Fallback: Default to web search for the spoken phrase
    return { type: 'search', query: raw };
  }

  public speakResponse(text: string) {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      this.updateState({ status: 'speaking', lastResponse: text });
      utterance.onend = () => {
        this.updateState({ status: 'idle' });
      };
      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  private updateState(patch: Partial<VoiceAssistantState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
  }

  public getState(): VoiceAssistantState {
    return this.state;
  }

  public subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public subscribeIntent(listener: IntentListener): () => void {
    this.intentListeners.add(listener);
    return () => this.intentListeners.delete(listener);
  }

  public subscribeAudioLevel(listener: AudioLevelListener): () => void {
    this.audioLevelListeners.add(listener);
    return () => this.audioLevelListeners.delete(listener);
  }
}

export const voiceActivationService = new VoiceActivationService();
