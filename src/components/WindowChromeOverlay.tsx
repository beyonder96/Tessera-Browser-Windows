import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Download, CheckCircle2, FolderOpen, ArrowUpCircle } from 'lucide-react';
import type { DownloadItem } from '../shared/types';

interface WindowChromeOverlayProps {
  isHomePage: boolean;
  isIncognito: boolean;
  activeDownloadBanner: DownloadItem | null;
  onDismissDownloadBanner: () => void;
  onOpenDownloadsHub: () => void;
}

export const WindowChromeOverlay: React.FC<WindowChromeOverlayProps> = ({
  isHomePage,
  isIncognito,
  activeDownloadBanner,
  onDismissDownloadBanner,
  onOpenDownloadsHub
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    status: string;
    version?: string;
    releaseNotes?: string;
  } | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  useEffect(() => {
    window.tesseraApi?.windowIsMaximized().then(setIsMaximized).catch(() => {});

    if (window.tesseraApi?.onUpdateStatus) {
      const unsub = window.tesseraApi.onUpdateStatus((payload) => {
        if (payload.status === 'downloaded' || payload.status === 'downloading' || payload.status === 'available') {
          setUpdateInfo({ status: payload.status, version: payload.version, releaseNotes: payload.releaseNotes });
        }
      });
      return () => unsub();
    }
  }, []);

  const handleToggleMax = async () => {
    const next = await window.tesseraApi.windowToggleMaximize();
    setIsMaximized(next);
  };

  return (
    <>
      {/* Ultra-slim top drag strip: 26px on StartPage, 6px on WebPages so website headers/navbars remain 100% clickable */}
      <div
        className="app-drag-region"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 132,
          height: isHomePage ? 28 : 6,
          zIndex: 90
        }}
      />

      {/* Discreet Windows Control Pill at top-right */}
      <div
        className="app-no-drag"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed',
          top: 8,
          right: 10,
          zIndex: 95,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '3px 5px',
          borderRadius: 999,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
          boxShadow: hovered ? 'var(--shadow-floating)' : 'none',
          opacity: isHomePage || hovered ? 0.96 : 0.42,
          transition: 'opacity 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        {isIncognito && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: '#D8B4FE',
              padding: '0 7px',
              letterSpacing: 0.4
            }}
          >
            ANÔNIMO
          </span>
        )}

        {/* Antigravity-Style Update Button */}
        {updateInfo && (
          <div style={{ position: 'relative' }}>
            <button
              title="Nova versão do Tessera pronta para instalar"
              onClick={() => setUpdateModalOpen((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent-primary)',
                color: 'var(--text-primary)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                marginRight: 4
              }}
            >
              <span
                style={{
                  width: 6.5,
                  height: 6.5,
                  borderRadius: '50%',
                  background: '#34C759',
                  boxShadow: '0 0 6px #34C759',
                  animation: 'pulse 1.4s infinite'
                }}
              />
              <span>Update</span>
            </button>

            {/* Update Info Popover */}
            {updateModalOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 250,
                  borderRadius: 16,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-hairline)',
                  boxShadow: 'var(--shadow-floating)',
                  backdropFilter: 'blur(32px) saturate(190%)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  zIndex: 9999
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Tessera {updateInfo.version ? `v${updateInfo.version}` : 'Update'}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      color: updateInfo.status === 'downloaded' ? '#34C759' : '#007AFF',
                      background: updateInfo.status === 'downloaded' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 122, 255, 0.15)',
                      padding: '2px 6px',
                      borderRadius: 6
                    }}
                  >
                    {updateInfo.status === 'downloaded' ? 'Pronto' : 'Baixando...'}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {updateInfo.status === 'downloaded'
                    ? 'Uma nova atualização foi baixada e está pronta para ser aplicada.'
                    : 'Baixando atualização em segundo plano...'}
                </p>
                {updateInfo.status === 'downloaded' ? (
                  <button
                    onClick={() => window.tesseraApi?.quitAndInstallUpdate()}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 9,
                      background: 'var(--accent-primary)',
                      color: '#FFF',
                      fontWeight: 600,
                      fontSize: 11.5,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'opacity 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    <ArrowUpCircle size={13} />
                    <span>Reiniciar e Atualizar</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 0' }}>
                    <Download size={13} style={{ animation: 'bounce 1s infinite' }} />
                    <span>Download em andamento...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <button
          title="Minimizar"
          onClick={() => window.tesseraApi.windowMinimize()}
          style={winBtnStyle}
          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Minus size={13} />
        </button>
        <button
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          onClick={handleToggleMax}
          style={winBtnStyle}
          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {isMaximized ? <Copy size={11.5} /> : <Square size={11.5} />}
        </button>
        <button
          title="Fechar"
          onClick={() => window.tesseraApi.windowClose()}
          style={winBtnStyle}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#FF3B30';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'inherit';
          }}
        >
          <X size={13.5} />
        </button>
      </div>

      {/* Download Visual Banner (Inherited from DownloadVisualBanner.kt) */}
      {activeDownloadBanner && (
        <div
          className="modal-animate-in app-no-drag"
          style={{
            position: 'fixed',
            top: 48,
            right: 16,
            zIndex: 110,
            width: 330,
            padding: '12px 14px',
            borderRadius: 18,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            boxShadow: 'var(--shadow-floating)',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background:
                activeDownloadBanner.status === 'COMPLETED'
                  ? 'rgba(52, 199, 89, 0.16)'
                  : 'rgba(10, 132, 255, 0.16)',
              color: activeDownloadBanner.status === 'COMPLETED' ? '#34C759' : 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {activeDownloadBanner.status === 'COMPLETED' ? <CheckCircle2 size={19} /> : <Download size={18} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {activeDownloadBanner.fileName}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              {activeDownloadBanner.status === 'COMPLETED'
                ? 'Download concluído'
                : activeDownloadBanner.totalBytes > 0
                  ? `${Math.round((activeDownloadBanner.receivedBytes / activeDownloadBanner.totalBytes) * 100)}% baixado...`
                  : 'Baixando arquivo...'}
            </div>
          </div>
          {activeDownloadBanner.status === 'COMPLETED' && (
            <button
              title="Mostrar na pasta"
              onClick={() => window.tesseraApi.showDownloadedInFolder(activeDownloadBanner.savePath)}
              style={{
                padding: 6,
                borderRadius: 10,
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)'
              }}
            >
              <FolderOpen size={15} />
            </button>
          )}
          <button
            onClick={onOpenDownloadsHub}
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--accent-primary)',
              padding: '4px 6px'
            }}
          >
            Ver
          </button>
          <button
            onClick={onDismissDownloadBanner}
            style={{ color: 'var(--text-tertiary)', padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
};

const winBtnStyle: React.CSSProperties = {
  width: 26,
  height: 24,
  borderRadius: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.14s ease, color 0.14s ease'
};
