import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Headphones,
  ChevronUp
} from 'lucide-react';
import type { AirBarPosition, PodcastAudioState } from '../shared/types';
import { podcastAudioService } from '../services/podcastAudioService';

interface PodcastPlayerProps {
  audioState: PodcastAudioState;
  airBarPosition: AirBarPosition;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ audioState, airBarPosition }) => {
  if (!audioState.isMiniPlayerVisible) return null;

  const voices = podcastAudioService.getAvailableVoices();
  const ratio =
    audioState.totalSentences > 0
      ? Math.min(1, audioState.currentSentenceIndex / audioState.totalSentences)
      : 0;

  return (
    <>
      {/* PodcastMiniPlayerCapsule (floats cleanly above/below AirBar) */}
      <div
        className="modal-animate-in app-no-drag"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          [airBarPosition === 'bottom' ? 'bottom' : 'top']: airBarPosition === 'bottom' ? 114 : 112,
          zIndex: 105,
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          padding: '8px 12px',
          borderRadius: 999,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
          boxShadow: 'var(--shadow-floating)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}
      >
        <button
          onClick={() => podcastAudioService.setFullPlayerOpen(true)}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'rgba(10, 132, 255, 0.16)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Headphones size={16} />
        </button>

        <div
          onClick={() => podcastAudioService.setFullPlayerOpen(true)}
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {audioState.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Sentença {Math.min(audioState.currentSentenceIndex + 1, audioState.totalSentences)} de{' '}
            {audioState.totalSentences} • {audioState.playbackSpeed}x
          </div>
        </div>

        <button
          onClick={() => podcastAudioService.cycleSpeed()}
          style={{
            padding: '4px 8px',
            borderRadius: 999,
            background: 'var(--bg-elevated)',
            fontSize: 11,
            fontWeight: 700
          }}
        >
          {audioState.playbackSpeed}x
        </button>

        <button
          onClick={() => podcastAudioService.togglePlayPause()}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {audioState.isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <button
          title="Expandir Player"
          onClick={() => podcastAudioService.setFullPlayerOpen(true)}
          style={{ color: 'var(--text-secondary)', padding: 3 }}
        >
          <ChevronUp size={15} />
        </button>

        <button
          title="Fechar Player"
          onClick={() => podcastAudioService.dismiss()}
          style={{ color: 'var(--text-tertiary)', padding: 3 }}
        >
          <X size={15} />
        </button>
      </div>

      {/* PodcastFullPlayerModal (PodcastFullPlayerModal.kt equivalent) */}
      {audioState.isFullPlayerOpen && (
        <div
          onClick={() => podcastAudioService.setFullPlayerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 210,
            background: 'var(--modal-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-animate-in"
            style={{
              width: 420,
              maxWidth: 'calc(100vw - 32px)',
              padding: 26,
              borderRadius: 28,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              boxShadow: 'var(--shadow-floating)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: 'var(--accent-primary)' }}>
                TESSERA PODCASTIFY
              </span>
              <button
                onClick={() => podcastAudioService.setFullPlayerOpen(false)}
                style={{ color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>
              {audioState.title}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {audioState.subtitle}
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--bg-elevated)',
                  overflow: 'hidden',
                  marginBottom: 8
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(ratio * 100)}%`,
                    background: 'var(--accent-primary)',
                    transition: 'width 0.25s ease'
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11.5,
                  color: 'var(--text-tertiary)'
                }}
              >
                <span>{formatDuration(audioState.currentPositionMs)}</span>
                <span>~{formatDuration(audioState.durationMs)}</span>
              </div>
            </div>

            {/* Transport Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                marginBottom: 22
              }}
            >
              <button
                onClick={() => podcastAudioService.seekBySentences(-1)}
                title="Sentença anterior"
                style={transportBtn}
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={() => podcastAudioService.togglePlayPause()}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {audioState.isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <button
                onClick={() => podcastAudioService.seekBySentences(1)}
                title="Próxima sentença"
                style={transportBtn}
              >
                <SkipForward size={18} />
              </button>
            </div>

            {/* Speed & Windows Voice Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Velocidade</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0.85, 1.0, 1.25, 1.5, 2.0].map((sp) => (
                    <button
                      key={sp}
                      onClick={() => podcastAudioService.setSpeed(sp)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 999,
                        background:
                          Math.abs(audioState.playbackSpeed - sp) < 0.04
                            ? 'var(--accent-primary)'
                            : 'var(--bg-elevated)',
                        color:
                          Math.abs(audioState.playbackSpeed - sp) < 0.04 ? '#FFF' : 'var(--text-secondary)',
                        fontSize: 11.5,
                        fontWeight: 600
                      }}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              </div>

              {voices.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Voz do Sistema Windows
                  </div>
                  <select
                    value={audioState.selectedVoiceURI}
                    onChange={(e) => podcastAudioService.selectVoice(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-hairline)',
                      color: 'var(--text-primary)',
                      fontSize: 12.5,
                      outline: 'none'
                    }}
                  >
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const transportBtn: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: '50%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-hairline)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
