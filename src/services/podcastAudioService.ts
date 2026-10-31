import { normalizeForSpeech, splitIntoSentences } from '../shared/audioTextNormalizer';
import type { PodcastAudioState } from '../shared/types';

type Listener = (state: PodcastAudioState) => void;

class PodcastAudioService {
  private state: PodcastAudioState = {
    isPlaying: false,
    isBuffering: false,
    title: '',
    subtitle: '',
    currentSentenceIndex: 0,
    totalSentences: 0,
    currentPositionMs: 0,
    durationMs: 0,
    playbackSpeed: 1.0,
    selectedVoiceURI: '',
    selectedVoiceName: 'Voz Padrão PT-BR',
    isMiniPlayerVisible: false,
    isFullPlayerOpen: false,
    error: null
  };

  private sentences: string[] = [];
  private listeners = new Set<Listener>();
  private progressTimer: number | null = null;
  private isPausedManually = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.ensureBestDefaultVoice();
      };
      this.ensureBestDefaultVoice();
    }
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const all = window.speechSynthesis.getVoices();
    const ptVoices = all.filter((v) => v.lang.toLowerCase().startsWith('pt'));
    return ptVoices.length > 0 ? ptVoices : all;
  }

  private ensureBestDefaultVoice(): void {
    const voices = this.getAvailableVoices();
    if (voices.length === 0) return;
    if (this.state.selectedVoiceURI && voices.some((v) => v.voiceURI === this.state.selectedVoiceURI)) {
      return;
    }
    const preferred =
      voices.find((v) => /francisca|antonio|maria|natural|neural|google português/i.test(v.name)) ||
      voices.find((v) => v.lang.toLowerCase() === 'pt-br') ||
      voices[0];

    if (preferred) {
      this.updateState({
        selectedVoiceURI: preferred.voiceURI,
        selectedVoiceName: preferred.name
      });
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): PodcastAudioState {
    return this.state;
  }

  private updateState(partial: Partial<PodcastAudioState>): void {
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) {
      l(this.state);
    }
  }

  playContent(title: string, subtitle: string, rawText: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.updateState({
        error: 'Síntese de voz não disponível neste ambiente.',
        isMiniPlayerVisible: true
      });
      return;
    }

    this.stopInternal(true);
    this.ensureBestDefaultVoice();

    const normalized = normalizeForSpeech(rawText);
    const chunks = splitIntoSentences(normalized, 360);
    if (chunks.length === 0) {
      this.updateState({
        title: title || 'Artigo sem texto',
        subtitle,
        isMiniPlayerVisible: true,
        error: 'Nenhum conteúdo textual encontrado para leitura em áudio.'
      });
      return;
    }

    this.sentences = chunks;
    const words = normalized.split(/\s+/).length;
    const estimatedDurationMs = Math.max(5000, Math.round((words / 145) * 60000));

    this.updateState({
      isPlaying: true,
      isBuffering: false,
      title: title || 'Artigo do Navegador',
      subtitle: subtitle || 'Podcastify • Tessera',
      currentSentenceIndex: 0,
      totalSentences: chunks.length,
      currentPositionMs: 0,
      durationMs: estimatedDurationMs,
      isMiniPlayerVisible: true,
      error: null
    });

    this.setupMediaSession(title, subtitle);
    this.speakFromIndex(0);
  }

  private speakFromIndex(startIndex: number): void {
    if (startIndex >= this.sentences.length) {
      this.stopProgressTimer();
      this.updateState({
        isPlaying: false,
        currentSentenceIndex: this.sentences.length,
        currentPositionMs: this.state.durationMs
      });
      return;
    }

    window.speechSynthesis.cancel();
    this.isPausedManually = false;

    const voices = this.getAvailableVoices();
    const chosenVoice = voices.find((v) => v.voiceURI === this.state.selectedVoiceURI) || voices[0];

    const utterance = new SpeechSynthesisUtterance(this.sentences[startIndex]);
    utterance.lang = chosenVoice?.lang || 'pt-BR';
    if (chosenVoice) utterance.voice = chosenVoice;
    utterance.rate = this.state.playbackSpeed;

    utterance.onstart = () => {
      const ratio = this.sentences.length > 0 ? startIndex / this.sentences.length : 0;
      this.updateState({
        isPlaying: true,
        currentSentenceIndex: startIndex,
        currentPositionMs: Math.round(ratio * this.state.durationMs)
      });
      this.startProgressTimer();
    };

    utterance.onend = () => {
      if (this.isPausedManually) return;
      this.speakFromIndex(startIndex + 1);
    };

    utterance.onerror = () => {
      if (this.isPausedManually) return;
      this.stopProgressTimer();
      this.updateState({ isPlaying: false });
    };

    window.speechSynthesis.speak(utterance);
  }

  togglePlayPause(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  pause(): void {
    this.isPausedManually = true;
    this.stopProgressTimer();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.updateState({ isPlaying: false });
  }

  resume(): void {
    if (this.sentences.length === 0) return;
    const idx =
      this.state.currentSentenceIndex >= this.sentences.length ? 0 : this.state.currentSentenceIndex;
    this.speakFromIndex(idx);
  }

  seekBySentences(delta: number): void {
    if (this.sentences.length === 0) return;
    const nextIdx = Math.max(0, Math.min(this.sentences.length - 1, this.state.currentSentenceIndex + delta));
    const ratio = nextIdx / this.sentences.length;
    this.updateState({
      currentSentenceIndex: nextIdx,
      currentPositionMs: Math.round(ratio * this.state.durationMs)
    });
    if (this.state.isPlaying) {
      this.speakFromIndex(nextIdx);
    }
  }

  setSpeed(speed: number): void {
    const clamped = Math.max(0.75, Math.min(2.0, Number(speed.toFixed(2))));
    this.updateState({ playbackSpeed: clamped });
    if (this.state.isPlaying) {
      this.speakFromIndex(this.state.currentSentenceIndex);
    }
  }

  cycleSpeed(): void {
    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.85];
    const idx = speeds.findIndex((s) => Math.abs(s - this.state.playbackSpeed) < 0.05);
    const next = speeds[(idx + 1) % speeds.length];
    this.setSpeed(next);
  }

  selectVoice(voiceURI: string): void {
    const voices = this.getAvailableVoices();
    const found = voices.find((v) => v.voiceURI === voiceURI);
    if (!found) return;
    this.updateState({
      selectedVoiceURI: found.voiceURI,
      selectedVoiceName: found.name
    });
    if (this.state.isPlaying) {
      this.speakFromIndex(this.state.currentSentenceIndex);
    }
  }

  setFullPlayerOpen(open: boolean): void {
    this.updateState({ isFullPlayerOpen: open });
  }

  dismiss(): void {
    this.stopInternal(false);
  }

  private stopInternal(keepMiniPlayer: boolean): void {
    this.isPausedManually = true;
    this.stopProgressTimer();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.updateState({
      isPlaying: false,
      isBuffering: false,
      isMiniPlayerVisible: keepMiniPlayer,
      isFullPlayerOpen: keepMiniPlayer ? this.state.isFullPlayerOpen : false
    });
  }

  private startProgressTimer(): void {
    this.stopProgressTimer();
    this.progressTimer = window.setInterval(() => {
      if (!this.state.isPlaying) return;
      const nextPos = Math.min(
        this.state.durationMs,
        this.state.currentPositionMs + Math.round(250 * this.state.playbackSpeed)
      );
      this.updateState({ currentPositionMs: nextPos });
    }, 250);
  }

  private stopProgressTimer(): void {
    if (this.progressTimer !== null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private setupMediaSession(title: string, subtitle: string): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title || 'Podcastify Tessera',
          artist: subtitle || 'Tessera Browser',
          album: 'Modo Leitura & Áudio'
        });
        navigator.mediaSession.setActionHandler('play', () => this.resume());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.seekBySentences(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => this.seekBySentences(1));
      } catch {
        // Ignore unsupported handlers
      }
    }
  }
}

export const podcastAudioService = new PodcastAudioService();
