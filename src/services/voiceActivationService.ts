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
  private recognition: any = null;
  private audioCtx: AudioContext | null = null;
  private isContinuousWakeWordRunning = false;
  private manualTriggerActive = false;
  private commandTimeoutId: number | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      this.state.error = 'Reconhecimento de voz não suportado neste ambiente.';
      return;
    }

    try {
      // Pre-warm audio permissions & devices in Windows
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            stream.getTracks().forEach((track) => track.stop());
          })
          .catch((err) => {
            console.warn('[VoiceActivation] Audio pre-warm notice:', err);
          });
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'pt-BR';

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0].transcript;
          if (item.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        this.handleSpeechResult(final.trim(), interim.trim());
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        console.warn('[VoiceActivation] Speech error:', event.error);
        if (event.error === 'not-allowed') {
          this.updateState({
            status: 'error',
            error: 'Permissão de microfone negada no Windows. Role a página de Privacidade até "Permitir que os aplicativos da área de trabalho acessem o microfone".'
          });
        } else if (event.error === 'network') {
          this.updateState({
            status: 'error',
            error: 'Serviço de voz em nuvem do Chromium indisponível. Você pode digitar seu comando abaixo ou usar as ações rápidas.'
          });
        } else {
          this.updateState({
            status: 'error',
            error: `Status do microfone: ${event.error}. Digite seu comando abaixo.`
          });
        }
      };

      this.recognition.onend = () => {
        // Auto-restart if continuous wake-word mode is active and not manually stopped
        if (this.isContinuousWakeWordRunning && !this.manualTriggerActive) {
          try {
            this.recognition.start();
          } catch {
            // Already active or temporarily busy
          }
        } else if (!this.state.isActive) {
          this.updateState({ status: 'idle' });
        }
      };
    } catch (e) {
      console.error('[VoiceActivation] Initialization failed', e);
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
   * Generates a sleek, futuristic 2-tone Apple/Siri style ascending audio chime
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

  public startContinuousWakeWord() {
    this.isContinuousWakeWordRunning = true;
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch {}
    }
  }

  public stopContinuousWakeWord() {
    this.isContinuousWakeWordRunning = false;
    if (this.recognition && !this.state.isActive) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  /**
   * Triggered by Mic button in AirBar
   */
  public activateManualListening() {
    this.manualTriggerActive = true;
    this.playWakeChime();
    this.updateState({
      isActive: true,
      status: 'listening',
      transcript: '',
      interimTranscript: 'Ouvindo...',
      error: null
    });

    // Check Windows hardware mic permissions via Web Audio
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
        })
        .catch((err) => {
          console.warn('[VoiceActivation] Microphone access error:', err);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            this.updateState({
              error:
                'Microfone bloqueado pelo Windows. Vá em Configurações > Privacidade > Microfone e ative "Permitir que os aplicativos da área de trabalho acessem o microfone".'
            });
          }
        });
    }

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (err) {
        console.warn('[VoiceActivation] Start error:', err);
      }
    }

    this.resetCommandTimeout();
  }

  /**
   * Executes a command string typed manually or selected via suggestion chip
   */
  public executeManualCommand(command: string) {
    const clean = command.trim();
    if (!clean) return;
    this.manualTriggerActive = true;
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

  private resetCommandTimeout() {
    if (this.commandTimeoutId) clearTimeout(this.commandTimeoutId);
    this.commandTimeoutId = window.setTimeout(() => {
      if (this.state.isActive && !this.state.transcript) {
        this.cancel();
      }
    }, 8000);
  }

  private handleSpeechResult(finalText: string, interimText: string) {
    const raw = (finalText || interimText).trim();
    if (!raw) return;

    // 1. Wake word pattern check with PT-BR phonetic tolerance:
    // Matches: "Ei Tessera", "Ok Tessera", "Tessera", "Téssera", "Te serra", "Terceira", "Tess", "Tessa", "Disse era", etc.
    const wakeWordRegex =
      /(?:^|\s)(?:ei|ok|hey|ol[aá]|a[ií]|e\s+a[ií])?\s*(?:t[eé][sc][sc]?[eé]ra|te\s+serra|teceira|terceira|tess|tessa|disse\s+era|de\s+cera|que\s+ser[aá])[\s,.:!-]*(.*)$/i;

    if (!this.state.isActive) {
      const match = raw.match(wakeWordRegex);
      if (match) {
        // Wake word detected!
        this.playWakeChime();
        const trailingCommand = match[1]?.trim() || '';
        this.updateState({
          isActive: true,
          status: 'listening',
          transcript: trailingCommand,
          interimTranscript: trailingCommand || 'Ouvindo...'
        });
        this.resetCommandTimeout();

        if (trailingCommand && finalText) {
          this.processRecognizedCommand(trailingCommand);
        }
      }
      return;
    }

    // 2. Already active in listening mode
    this.resetCommandTimeout();
    this.updateState({
      interimTranscript: interimText || finalText,
      transcript: finalText || this.state.transcript
    });

    if (finalText) {
      // Strip any accidental leading wake word variants
      const cleanCommand = finalText
        .replace(
          /(?:^|\s)(?:ei|ok|hey|ol[aá]|a[ií]|e\s+a[ií])?\s*(?:t[eé][sc][sc]?[eé]ra|te\s+serra|teceira|terceira|tess|tessa|disse\s+era|de\s+cera|que\s+ser[aá])[\s,.:!]*/i,
          ''
        )
        .trim();
      if (cleanCommand) {
        this.processRecognizedCommand(cleanCommand);
      }
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
}

export const voiceActivationService = new VoiceActivationService();
