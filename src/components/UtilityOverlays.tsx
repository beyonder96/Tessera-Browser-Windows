import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Languages,
  ExternalLink,
  Wifi,
  Smartphone,
  Lock,
  Copy,
  Check
} from 'lucide-react';
import type { LocalBridgeStatus, TranslationState } from '../shared/types';

/* 1. Find In Page Bar (FindInPageBar.kt / Ctrl+F) */
export const FindInPageBar: React.FC<{
  visible: boolean;
  query: string;
  activeMatch: number;
  totalMatches: number;
  onQueryChange: (q: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}> = ({
  visible,
  query,
  activeMatch,
  totalMatches,
  onQueryChange,
  onNext,
  onPrev,
  onClose
}) => {
  if (!visible) return null;

  return (
    <div
      className="modal-animate-in app-no-drag"
      style={{
        position: 'fixed',
        top: 46,
        right: 18,
        zIndex: 125,
        padding: '8px 12px',
        borderRadius: 999,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-hairline)',
        boxShadow: 'var(--shadow-floating)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
    >
      <Search size={14} style={{ color: 'var(--text-tertiary)', marginLeft: 4 }} />
      <input
        type="text"
        autoFocus
        placeholder="Localizar na página..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (e.shiftKey) onPrev();
            else onNext();
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        style={{
          width: 190,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-primary)',
          fontSize: 13
        }}
      />
      {query && (
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', minWidth: 38 }}>
          {totalMatches > 0 ? `${activeMatch}/${totalMatches}` : '0/0'}
        </span>
      )}
      <button onClick={onPrev} title="Anterior (Shift+Enter)" style={smallBtn}>
        <ChevronUp size={15} />
      </button>
      <button onClick={onNext} title="Próximo (Enter)" style={smallBtn}>
        <ChevronDown size={15} />
      </button>
      <button onClick={onClose} title="Fechar (Esc)" style={smallBtn}>
        <X size={15} />
      </button>
    </div>
  );
};

/* 2. Inline Google DOM Translate Bar (TranslateBar.kt) */
export const TranslateBar: React.FC<{
  state: TranslationState;
  onTranslate: () => void;
  onRevert: () => void;
  onDismiss: () => void;
}> = ({ state, onTranslate, onRevert, onDismiss }) => {
  if (!state.isBannerVisible) return null;

  return (
    <div
      className="modal-animate-in app-no-drag"
      style={{
        position: 'fixed',
        top: 46,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 115,
        padding: '8px 14px',
        borderRadius: 999,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-hairline)',
        boxShadow: 'var(--shadow-floating)',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
    >
      <Languages size={16} style={{ color: 'var(--accent-primary)' }} />
      <span style={{ fontSize: 12.5, fontWeight: 500 }}>
        {state.isTranslated
          ? 'Página traduzida para Português'
          : `Idioma detectado (${state.detectedLang.toUpperCase()}). Traduzir página?`}
      </span>
      {state.isTranslated ? (
        <button
          onClick={onRevert}
          style={{
            padding: '5px 12px',
            borderRadius: 999,
            background: 'var(--bg-elevated)',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          Mostrar Original
        </button>
      ) : (
        <button
          onClick={onTranslate}
          disabled={state.isTranslating}
          style={{
            padding: '5px 12px',
            borderRadius: 999,
            background: 'var(--accent-primary)',
            color: '#FFF',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          {state.isTranslating ? 'Traduzindo...' : 'Traduzir'}
        </button>
      )}
      <button onClick={onDismiss} style={{ color: 'var(--text-tertiary)' }}>
        <X size={14} />
      </button>
    </div>
  );
};

/* 3. Arc-style Peek Preview Modal (Alt + Click on any link — PeekPreviewModal.kt) */
export const PeekPreviewModal: React.FC<{
  peek: { url: string; title: string } | null;
  partition: string;
  onPromoteToTab: (url: string) => void;
  onClose: () => void;
}> = ({ peek, partition, onPromoteToTab, onClose }) => {
  if (!peek) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 180,
        background: 'var(--modal-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 36
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-animate-in"
        style={{
          width: '86vw',
          maxWidth: 1020,
          height: '80vh',
          borderRadius: 24,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
          boxShadow: 'var(--shadow-floating)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Peek Preview • {peek.title}</div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {peek.url}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                onPromoteToTab(peek.url);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 13px',
                borderRadius: 999,
                background: 'var(--accent-primary)',
                color: '#FFF',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              <ExternalLink size={13.5} />
              <span>Abrir em Nova Guia</span>
            </button>
            <button onClick={onClose} style={smallBtn}>
              <X size={16} />
            </button>
          </div>
        </div>
        <webview
          src={peek.url}
          partition={partition}
          style={{ flex: 1, width: '100%', border: 'none' }}
        />
      </div>
    </div>
  );
};

/* 4. QR Code Share & Local Wi-Fi Android <-> Windows Bridge Modal */
export const QrBridgeModal: React.FC<{
  visible: boolean;
  currentUrl: string;
  currentTitle: string;
  bridgeStatus: LocalBridgeStatus;
  onStartBridge: () => void;
  onStopBridge: () => void;
  onClose: () => void;
}> = ({
  visible,
  currentUrl,
  currentTitle,
  bridgeStatus,
  onStartBridge,
  onStopBridge,
  onClose
}) => {
  const [mode, setMode] = useState<'bridge' | 'tab'>('bridge');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const targetQrString =
    mode === 'bridge' ? bridgeStatus.url || '' : currentUrl.startsWith('http') ? currentUrl : 'https://google.com';

  useEffect(() => {
    if (!visible) return;
    if (mode === 'bridge' && !bridgeStatus.running) {
      onStartBridge();
    }
  }, [visible, mode]);

  useEffect(() => {
    if (!visible || !targetQrString) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(targetQrString, {
      width: 220,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [visible, targetQrString]);

  if (!visible) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 205,
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
          width: 440,
          maxWidth: 'calc(100vw - 32px)',
          padding: 26,
          borderRadius: 28,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
          boxShadow: 'var(--shadow-floating)',
          textAlign: 'center'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>Ponte Tessera Android ↔ Windows</span>
          </div>
          <button onClick={onClose} style={smallBtn}>
            <X size={17} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 4,
            borderRadius: 14,
            background: 'var(--bg-elevated)',
            marginBottom: 18
          }}
        >
          <button
            onClick={() => setMode('bridge')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 11,
              background: mode === 'bridge' ? 'var(--accent-primary)' : 'transparent',
              color: mode === 'bridge' ? '#FFF' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 600
            }}
          >
            Ponte Wi-Fi (Links & Backup)
          </button>
          <button
            onClick={() => setMode('tab')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 11,
              background: mode === 'tab' ? 'var(--accent-primary)' : 'transparent',
              color: mode === 'tab' ? '#FFF' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 600
            }}
          >
            QR Direto da Aba Atual
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.45 }}>
          {mode === 'bridge'
            ? 'Escaneie com o seu celular na mesma rede Wi-Fi para enviar abas ao PC ou sincronizar o arquivo tessera_backup.json do Android sem cabos:'
            : `Escaneie para abrir "${currentTitle}" imediatamente no Tessera Android:`}
        </p>

        {/* QR Canvas Card */}
        <div
          style={{
            width: 236,
            height: 236,
            margin: '0 auto 16px',
            borderRadius: 24,
            background: '#FFFFFF',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.22)'
          }}
        >
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code Tessera" style={{ width: 220, height: 220 }} />
          ) : (
            <span style={{ color: '#333', fontSize: 12 }}>Gerando QR Code...</span>
          )}
        </div>

        {targetQrString && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 12,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-hairline)',
              marginBottom: 14
            }}
          >
            <code
              style={{
                fontSize: 11.5,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {targetQrString}
            </code>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(targetQrString);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              style={{ color: 'var(--accent-primary)', flexShrink: 0 }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )}

        {mode === 'bridge' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              color: bridgeStatus.running ? '#34C759' : 'var(--text-tertiary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wifi size={14} />
              <span>
                {bridgeStatus.running
                  ? `Servidor LAN ativo (${bridgeStatus.connectedClients} conexão)`
                  : 'Servidor LAN pausado'}
              </span>
            </div>
            {bridgeStatus.running ? (
              <button
                onClick={onStopBridge}
                style={{ color: '#FF3B30', fontWeight: 600, fontSize: 12 }}
              >
                Encerrar Ponte
              </button>
            ) : (
              <button
                onClick={onStartBridge}
                style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: 12 }}
              >
                Iniciar Ponte
              </button>
            )}
          </div>
        )}

        {currentUrl.startsWith('http') && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={async () => {
                const ok = await window.tesseraApi?.syncSendTabToMobile(currentUrl, currentTitle);
                if (ok) {
                  setSentMessage('✓ Aba enviada para a caixa de entrada do Tessera Android!');
                  setTimeout(() => setSentMessage(null), 3500);
                }
              }}
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-hairline)',
                color: 'var(--text-primary)',
                borderRadius: 12,
                padding: '9px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <Smartphone size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>Enviar Esta Aba para o Tessera Android</span>
            </button>
            {sentMessage && (
              <div style={{ fontSize: 11.5, color: '#34C759', marginTop: 6, fontWeight: 600 }}>
                {sentMessage}
              </div>
            )}
          </div>
        )}

        {bridgeStatus.lastReceivedMessage && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 12,
              background: 'rgba(52, 199, 89, 0.14)',
              color: '#34C759',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {bridgeStatus.lastReceivedMessage}
          </div>
        )}
      </div>
    </div>
  );
};

/* 5. Incognito Lock Overlay (Windows PIN Lock — IncognitoLockOverlay.kt equivalent) */
export const IncognitoLockOverlay: React.FC<{
  visible: boolean;
  expectedPinHash: string | null;
  onUnlocked: () => void;
  onExitIncognito: () => void;
}> = ({ visible, expectedPinHash, onUnlocked, onExitIncognito }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!visible || !expectedPinHash) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = (await window.tesseraApi?.pinVerify?.(pin, expectedPinHash)) || (btoa(pin) === expectedPinHash);
    if (isValid) {
      setPin('');
      setError(false);
      onUnlocked();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 240,
        background: '#090612',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 22,
          background: '#1B1330',
          border: '1px solid rgba(191,90,242,0.4)',
          color: '#AF52DE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18
        }}
      >
        <Lock size={28} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#FFF', marginBottom: 6 }}>
        Modo Anônimo Protegido
      </h2>
      <p style={{ fontSize: 13.5, color: 'rgba(216,180,254,0.75)', marginBottom: 22 }}>
        Digite seu PIN do Tessera para desbloquear suas guias privadas
      </p>

      <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
        <input
          type="password"
          autoFocus
          placeholder="PIN numérico"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{
            height: 44,
            borderRadius: 14,
            background: '#161224',
            border: `1px solid ${error ? '#FF3B30' : 'rgba(191,90,242,0.4)'}`,
            color: '#FFF',
            textAlign: 'center',
            fontSize: 18,
            letterSpacing: 6,
            outline: 'none'
          }}
        />
        {error && (
          <span style={{ fontSize: 12, color: '#FF6B63', textAlign: 'center' }}>
            PIN incorreto. Tente novamente.
          </span>
        )}
        <button
          type="submit"
          style={{
            height: 42,
            borderRadius: 999,
            background: '#AF52DE',
            color: '#FFF',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          Desbloquear
        </button>
        <button
          type="button"
          onClick={onExitIncognito}
          style={{
            height: 38,
            borderRadius: 999,
            color: 'rgba(216,180,254,0.7)',
            fontSize: 12.5
          }}
        >
          Voltar ao Espaço Normal
        </button>
      </form>
    </div>
  );
};

const smallBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-secondary)'
};
