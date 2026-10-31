import React from 'react';
import {
  Check,
  Plus,
  FolderOpen
} from 'lucide-react';
import type { BrowserSpace, BrowserTab, SpeedDialItem } from '../shared/types';
import { extractCleanHost } from '../shared/searchEngines';

/* =========================================================
   1. SAFARI-STYLE SPACES POPOVER MENU (Apple Liquid Glass)
   ========================================================= */

interface SafariSpacesPopoverProps {
  spaces: BrowserSpace[];
  activeSpaceId: string;
  tabs: BrowserTab[];
  isIncognito: boolean;
  onSelectSpace: (spaceId: string) => void;
  onToggleIncognito: () => void;
  onOpenNewSpaceDialog: () => void;
  onClose: () => void;
}

export const SafariSpacesPopover: React.FC<SafariSpacesPopoverProps> = ({
  spaces,
  activeSpaceId,
  tabs,
  isIncognito,
  onSelectSpace,
  onToggleIncognito,
  onOpenNewSpaceDialog,
  onClose
}) => {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        width: 250,
        borderRadius: 16,
        background: 'var(--bg-elevated)',
        backdropFilter: 'blur(32px) saturate(190%)',
        WebkitBackdropFilter: 'blur(32px) saturate(190%)',
        border: '1px solid var(--border-hairline)',
        boxShadow: 'var(--shadow-floating)',
        padding: '8px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        zIndex: 9999,
        pointerEvents: 'auto',
        animation: 'fadeInDown 0.16s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Header Label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          padding: '4px 8px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>Espaços</span>
        <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>{spaces.length} ativos</span>
      </div>

      {/* Spaces List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {spaces.map((sp) => {
          const isActive = !isIncognito && sp.id === activeSpaceId;
          const spaceTabsCount = tabs.filter((t) => t.spaceId === sp.id && !t.isIncognito).length;

          return (
            <button
              key={sp.id}
              onClick={() => {
                onSelectSpace(sp.id);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 8px',
                borderRadius: 10,
                background: isActive ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.12s ease'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 15 }}>{sp.iconEmoji}</span>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: isActive ? 600 : 500,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {sp.name}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                    {spaceTabsCount} {spaceTabsCount === 1 ? 'guia' : 'guias'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: sp.colorHex
                  }}
                />
                {isActive && <Check size={13} style={{ color: 'var(--accent-primary)' }} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--border-hairline)', margin: '4px 4px' }} />

      {/* Stealth Incognito Mode */}
      <button
        onClick={() => {
          onToggleIncognito();
          onClose();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 8px',
          borderRadius: 10,
          background: isIncognito ? 'rgba(175, 82, 222, 0.18)' : 'transparent',
          border: 'none',
          color: isIncognito ? '#AF52DE' : 'var(--text-primary)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.12s ease'
        }}
        onMouseEnter={(e) => {
          if (!isIncognito) e.currentTarget.style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isIncognito) e.currentTarget.style.background = 'transparent';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🕶️</span>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Modo Anônimo</span>
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            padding: '2px 5px',
            borderRadius: 5,
            color: 'var(--text-tertiary)'
          }}
        >
          Ctrl+Shift+N
        </span>
      </button>

      {/* New Space Action */}
      <button
        onClick={() => {
          onOpenNewSpaceDialog();
          onClose();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 8px',
          borderRadius: 10,
          background: 'transparent',
          border: 'none',
          color: 'var(--accent-primary)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          textAlign: 'left',
          transition: 'background 0.12s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Plus size={13} />
        <span>Novo Espaço...</span>
      </button>
    </div>
  );
};

/* =========================================================
   2. SAFARI-STYLE FAVORITES POPOVER MENU (Apple Liquid Glass)
   ========================================================= */

interface SafariFavoritesPopoverProps {
  favorites: SpeedDialItem[];
  onOpenUrl: (url: string) => void;
  onAddFavorite: () => void;
  onOpenFullHub?: () => void;
  onClose: () => void;
}

export const SafariFavoritesPopover: React.FC<SafariFavoritesPopoverProps> = ({
  favorites,
  onOpenUrl,
  onAddFavorite,
  onOpenFullHub,
  onClose
}) => {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        width: 250,
        maxHeight: 380,
        borderRadius: 16,
        background: 'var(--bg-elevated)',
        backdropFilter: 'blur(32px) saturate(190%)',
        WebkitBackdropFilter: 'blur(32px) saturate(190%)',
        border: '1px solid var(--border-hairline)',
        boxShadow: 'var(--shadow-floating)',
        padding: '8px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        zIndex: 9999,
        pointerEvents: 'auto',
        animation: 'fadeInDown 0.16s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Header Label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          padding: '4px 8px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>Favoritos</span>
        <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>{favorites.length} salvos</span>
      </div>

      {/* Favorites List (Scrollable) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
          maxHeight: 230,
          paddingRight: 2
        }}
      >
        {favorites.length === 0 ? (
          <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            Nenhum favorito adicionado ainda.
          </div>
        ) : (
          favorites.map((fav) => {
            const firstLetter = (fav.title || 'T').trim().charAt(0).toUpperCase();
            const cleanDomain = extractCleanHost(fav.url);

            return (
              <button
                key={fav.id}
                onClick={() => {
                  onOpenUrl(fav.url);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 10,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {fav.iconAsset ? (
                  <img
                    src={fav.iconAsset}
                    alt=""
                    style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: fav.badgeColorHex || 'var(--accent-primary)',
                      color: '#FFF',
                      fontSize: 9.5,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {firstLetter}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {fav.title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {cleanDomain}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--border-hairline)', margin: '4px 4px' }} />

      {/* Bottom Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 2px' }}>
        <button
          onClick={() => {
            onAddFavorite();
            onClose();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 8px',
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-primary)',
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.12s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Plus size={12} />
          <span>Novo Atalho</span>
        </button>

        {onOpenFullHub && (
          <button
            onClick={() => {
              onOpenFullHub();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 8px',
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.12s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <FolderOpen size={12} />
            <span>Gerenciar</span>
          </button>
        )}
      </div>
    </div>
  );
};
