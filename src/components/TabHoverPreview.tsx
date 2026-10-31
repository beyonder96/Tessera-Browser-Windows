import React from 'react';
import { Play, Pause, Volume2, VolumeX, PictureInPicture2, X, Globe } from 'lucide-react';
import type { BrowserTab } from '../shared/types';
import { extractCleanHost } from '../shared/searchEngines';

interface TabHoverPreviewProps {
  tab: BrowserTab;
  spaceColorHex?: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onTogglePlayPause: (tabId: string) => void;
  onToggleMute: (tabId: string) => void;
  onTriggerPiP: (tabId: string) => void;
}

export const TabHoverPreview: React.FC<TabHoverPreviewProps> = ({
  tab,
  spaceColorHex = '#3B82F6',
  onSelectTab,
  onCloseTab,
  onTogglePlayPause,
  onToggleMute,
  onTriggerPiP
}) => {
  const domain = tab.isHomePage ? 'Página Inicial' : extractCleanHost(tab.url);

  return (
    <div
      onClick={() => onSelectTab(tab.id)}
      style={{
        position: 'relative',
        width: 240,
        borderRadius: 16,
        background: 'rgba(26, 26, 30, 0.92)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0,0,0,0.3)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
        pointerEvents: 'auto',
        cursor: 'pointer',
        animation: 'fadeInUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Header: Favicon + Domain + Close Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: spaceColorHex,
              flexShrink: 0
            }}
          />
          {tab.favicon ? (
            <img src={tab.favicon} alt="" style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0 }} />
          ) : (
            <Globe size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          )}
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {domain}
          </span>
        </div>

        <button
          title="Fechar guia"
          onClick={(e) => {
            e.stopPropagation();
            onCloseTab(tab.id);
          }}
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'var(--text-tertiary)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Snapshot Thumbnail Preview */}
      <div
        style={{
          width: '100%',
          height: 120,
          borderRadius: 10,
          overflow: 'hidden',
          background: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {tab.thumbnailDataUrl ? (
          <img
            src={tab.thumbnailDataUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              color: 'var(--text-tertiary)',
              padding: 12,
              textAlign: 'center'
            }}
          >
            <Globe size={28} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: 11 }}>Prévia da Página</span>
          </div>
        )}

        {/* Media Playing Indicator Badge on Snapshot */}
        {tab.isPlayingMedia && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              padding: '3px 7px',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              color: '#34C759',
              border: '1px solid rgba(52, 199, 89, 0.3)'
            }}
          >
            <span className="live-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#34C759' }} />
            ÁUDIO / VÍDEO
          </div>
        )}
      </div>

      {/* Page Title */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: '1.3',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {tab.title || 'Sem título'}
      </div>

      {/* Media Action Toolbar (Play/Pause, Mute, PiP) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: 6,
          marginTop: 2
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            title={tab.isPlayingMedia ? 'Pausar Mídia' : 'Reproduzir Mídia'}
            onClick={() => onTogglePlayPause(tab.id)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: tab.isPlayingMedia ? '#34C759' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {tab.isPlayingMedia ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            title={tab.isMuted ? 'Desmutar Aba' : 'Silenciar Aba'}
            onClick={() => onToggleMute(tab.id)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: tab.isMuted ? '#FF453A' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {tab.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          <button
            title="Destacar Vídeo em Janela Flutuante (Picture-in-Picture)"
            onClick={() => onTriggerPiP(tab.id)}
            style={{
              height: 28,
              padding: '0 8px',
              borderRadius: 8,
              background: 'rgba(52, 199, 89, 0.15)',
              border: '1px solid rgba(52, 199, 89, 0.3)',
              color: '#34C759',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <PictureInPicture2 size={13} />
            <span>PiP</span>
          </button>
        </div>

        <button
          onClick={() => onSelectTab(tab.id)}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--accent-primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 6px'
          }}
        >
          Acessar →
        </button>
      </div>
    </div>
  );
};
