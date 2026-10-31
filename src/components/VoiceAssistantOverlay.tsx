import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Sparkles, Volume2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { VoiceAssistantState } from '../shared/types';

interface VoiceAssistantOverlayProps {
  state: VoiceAssistantState;
  onCancel: () => void;
  onExecuteCommandChip: (phrase: string) => void;
}

export const VoiceAssistantOverlay: React.FC<VoiceAssistantOverlayProps> = ({
  state,
  onCancel,
  onExecuteCommandChip
}) => {
  const [manualText, setManualText] = useState('');
  const [realAudioLevel, setRealAudioLevel] = useState(0);
  const [micDeviceAllowed, setMicDeviceAllowed] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Measure real microphone audio volume in real-time via Web Audio API
  useEffect(() => {
    if (!state.isActive) {
      setRealAudioLevel(0);
      setManualText('');
      return;
    }

    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let animId: number | null = null;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => {
          stream = s;
          setMicDeviceAllowed(true);
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) return;

          audioCtx = new AudioContextClass();
          const source = audioCtx.createMediaStreamSource(s);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(1, Math.max(0, avg / 128));
            setRealAudioLevel(normalized);
            animId = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        })
        .catch((err) => {
          console.warn('[VoiceOverlay] getUserMedia notice:', err);
          setMicDeviceAllowed(false);
        });
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        void audioCtx.close();
      }
    };
  }, [state.isActive]);

  // Focus input when overlay becomes active
  useEffect(() => {
    if (state.isActive) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [state.isActive]);

  if (!state.isActive) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualText.trim();
    if (!clean) return;
    onExecuteCommandChip(clean);
    setManualText('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        pointerEvents: 'auto',
        animation: 'fadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Siri macOS Sequoia / Dynamic Island Sleek Capsule */}
      <div
        style={{
          width: 450,
          maxWidth: 'calc(100vw - 32px)',
          borderRadius: 22,
          background: 'var(--bg-elevated)',
          backdropFilter: 'blur(36px) saturate(200%)',
          WebkitBackdropFilter: 'blur(36px) saturate(200%)',
          border: '1px solid var(--border-hairline)',
          boxShadow: 'var(--shadow-floating)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          color: 'var(--text-primary)'
        }}
      >
        {/* Header: Siri Glowing Orb + Dynamic Sound Wave + Status + Close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* Glowing Apple-style Sphere */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background:
                  state.status === 'processing'
                    ? 'linear-gradient(135deg, #AF52DE, #FF2D55)'
                    : state.error || micDeviceAllowed === false
                    ? 'linear-gradient(135deg, #FF9500, #FF3B30)'
                    : 'linear-gradient(135deg, #0A84FF, #30D158)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow:
                  state.status === 'processing'
                    ? '0 0 14px rgba(175, 82, 222, 0.55)'
                    : state.error || micDeviceAllowed === false
                    ? '0 0 14px rgba(255, 59, 48, 0.45)'
                    : '0 0 14px rgba(10, 132, 255, 0.55)',
                animation: 'pulse 1.4s ease-in-out infinite'
              }}
            >
              {state.status === 'processing' ? (
                <Sparkles size={14} color="#FFF" />
              ) : state.error || micDeviceAllowed === false ? (
                <AlertTriangle size={14} color="#FFF" />
              ) : (
                <Mic size={14} color="#FFF" />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.2 }}>
                Assistente Tessera
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                {state.status === 'processing'
                  ? 'Processando comando...'
                  : realAudioLevel > 0.08
                  ? 'Ouvindo sua voz...'
                  : 'Fale ou digite um comando...'}
              </span>
            </div>
          </div>

          {/* Equalizer Waveform in Header (Clean & Integrated) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              height: 20,
              padding: '0 6px'
            }}
          >
            {[0.4, 0.85, 1.0, 0.65, 0.9, 0.5].map((weight, i) => {
              const h =
                state.status === 'processing'
                  ? 12
                  : Math.max(3, Math.min(18, (realAudioLevel * 24 + 3) * weight));

              return (
                <div
                  key={i}
                  style={{
                    width: 3.5,
                    height: `${h}px`,
                    borderRadius: 2,
                    background:
                      state.status === 'processing'
                        ? 'var(--accent-primary)'
                        : realAudioLevel > 0.08
                        ? 'var(--accent-primary)'
                        : 'var(--border-hairline)',
                    transition: 'height 0.07s ease-out, background 0.15s ease'
                  }}
                />
              );
            })}
          </div>

          {/* Close button */}
          <button
            onClick={onCancel}
            title="Fechar (Esc)"
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Live Spoken Transcript display (when voice detected) */}
        {(state.transcript || state.interimTranscript) && (
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'var(--bg-surface)',
              borderRadius: 12,
              padding: '8px 12px',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              lineHeight: 1.4
            }}
          >
            <Volume2 size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span>{state.transcript || state.interimTranscript}</span>
          </div>
        )}

        {/* Permission / Status Banner (if blocked in Windows) */}
        {(state.error || micDeviceAllowed === false) && (
          <div
            style={{
              background: 'rgba(255, 149, 0, 0.12)',
              border: '1px solid rgba(255, 149, 0, 0.3)',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 11,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <AlertTriangle size={14} color="#FF9500" style={{ flexShrink: 0 }} />
            <span>
              {state.error ||
                'Microfone inativo no Windows. Ative "Permitir que aplicativos da área de trabalho acessem o microfone" nas configurações.'}
            </span>
          </div>
        )}

        {/* Seamless Transparent Input Line */}
        <form
          onSubmit={handleManualSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-surface)',
            borderRadius: 12,
            padding: '4px 6px 4px 12px',
            border: '1px solid var(--border-hairline)'
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Digite um comando ou pesquise (Enter)..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 12.5,
              color: 'var(--text-primary)',
              fontFamily: 'inherit'
            }}
          />
          <button
            type="submit"
            disabled={!manualText.trim()}
            title="Executar comando"
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: manualText.trim() ? 'var(--accent-primary)' : 'transparent',
              border: 'none',
              color: manualText.trim() ? '#FFF' : 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: manualText.trim() ? 'pointer' : 'default',
              transition: 'all 0.12s ease'
            }}
          >
            <ArrowRight size={13} />
          </button>
        </form>

        {/* Suggestion Chips */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            overflowX: 'auto',
            paddingBottom: 2
          }}
        >
          {[
            { label: '🔍 Pesquisar', phrase: 'pesquisar notícias de tecnologia' },
            { label: '✨ Resumir', phrase: 'resumir página' },
            { label: '🎧 Ouvir', phrase: 'ler página' },
            { label: '📺 PiP Vídeo', phrase: 'destacar vídeo' },
            { label: '➕ Nova Guia', phrase: 'nova guia' },
            { label: '🌓 Tema', phrase: 'alternar modo escuro' }
          ].map((chip) => (
            <button
              key={chip.phrase}
              onClick={() => onExecuteCommandChip(chip.phrase)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 999,
                padding: '4px 9px',
                fontSize: 10.5,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.12s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
