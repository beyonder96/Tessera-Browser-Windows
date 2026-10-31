import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Lock,
  Globe,
  RotateCw,
  X,
  BookOpen,
  Sparkles,
  Star,
  MoreHorizontal,
  Plus,
  Home,
  ArrowUpRight,
  Pin,
  Mic,
  Volume2
} from 'lucide-react';
import type {
  BrowserSettings,
  BrowserSpace,
  BrowserTab,
  SpeedDialItem,
  TabGroup
} from '../shared/types';
import { extractCleanHost } from '../shared/searchEngines';
import { TabHoverPreview } from './TabHoverPreview';

interface TesseraAirBarProps {
  settings: BrowserSettings;
  activeTab: BrowserTab;
  visibleTabs: BrowserTab[];
  activeSpace: BrowserSpace;
  groups?: TabGroup[];
  isIncognito: boolean;
  isBookmarked: boolean;
  isReaderAvailable: boolean;
  isReaderActive: boolean;
  isAutoHidden: boolean;
  externalEditTrigger: number;
  searchSuggestions: string[];
  favorites: SpeedDialItem[];
  onRevealBar: () => void;
  onQueryChange: (q: string) => void;
  onNavigate: (input: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onStopLoading: () => void;
  onGoHome: () => void;
  onToggleBookmark: () => void;
  onToggleReaderMode: () => void;
  onOpenAi: () => void;
  onOpenTabsModal: () => void;
  onOpenSpacesModal: () => void;
  onOpenSiteSettings: () => void;
  onOpenQuickSettings: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onGroupTabs?: (sourceTabId: string, targetTabId: string) => void;
  onTogglePlayPause?: (tabId: string) => void;
  onToggleMute?: (tabId: string) => void;
  onTriggerPiP?: (tabId: string) => void;
  onOpenVoiceAssistant?: () => void;
}

export const TesseraAirBar: React.FC<TesseraAirBarProps> = ({
  settings,
  activeTab,
  visibleTabs,
  activeSpace,
  groups,
  isIncognito,
  isBookmarked,
  isReaderAvailable,
  isReaderActive,
  isAutoHidden,
  externalEditTrigger,
  searchSuggestions,
  favorites,
  onRevealBar,
  onQueryChange,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onStopLoading,
  onGoHome,
  onToggleBookmark,
  onToggleReaderMode,
  onOpenAi,
  onOpenTabsModal,
  onOpenSpacesModal,
  onOpenSiteSettings,
  onOpenQuickSettings,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onGroupTabs,
  onTogglePlayPause,
  onToggleMute,
  onTriggerPiP,
  onOpenVoiceAssistant
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [hoveredTabInfo, setHoveredTabInfo] = useState<{ tab: BrowserTab; rect: DOMRect } | null>(null);
  const [draggedAirTabId, setDraggedAirTabId] = useState<string | null>(null);
  const [dragOverAirTabId, setDragOverAirTabId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const hoverTabTimerRef = useRef<number | null>(null);

  const handleSphereMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      startEditing();
    }, 120);
  };

  const handleSphereMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleBarMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (activeTab.isHomePage && isEditing && !inputText.trim()) {
      setIsEditing(false);
    }
  };

  useEffect(() => {
    if (externalEditTrigger > 0) {
      setInputText(activeTab.isHomePage ? '' : activeTab.url);
      setIsEditing(true);
      onRevealBar();
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
    }
  }, [externalEditTrigger]);

  useEffect(() => {
    if (!isEditing) {
      setInputText(activeTab.isHomePage ? '' : activeTab.url);
    }
  }, [activeTab.url, activeTab.isHomePage, isEditing]);

  const startEditing = () => {
    setInputText(activeTab.isHomePage ? '' : activeTab.url);
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsEditing(false);
    onNavigate(inputText.trim());
  };

  const isBottom = settings.airBarPosition === 'bottom';
  // Morphing rule from Android TesseraAirBar.kt: collapses to 56px search sphere on StartPage when not editing!
  const isHomeCollapsed = activeTab.isHomePage && !isEditing && visibleTabs.length <= 1;
  const hiddenNow = isAutoHidden && !isEditing && !activeTab.isHomePage;

  const cleanHost = activeTab.isHomePage ? 'Início' : extractCleanHost(activeTab.url);
  const isSecure = activeTab.url.startsWith('https://');
  const progress = activeTab.progress ?? 0;
  const showProgress = Boolean(activeTab.isLoading) || (progress > 0 && progress < 1);

  return (
    <>
      {/* Edge Hover Sensor to smoothly reveal AirBar when auto-hidden on scroll */}
      {hiddenNow && (
        <div
          onMouseEnter={onRevealBar}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            [isBottom ? 'bottom' : 'top']: 0,
            height: 22,
            zIndex: 98
          }}
        />
      )}

      <div
        className="app-no-drag"
        style={{
          position: 'fixed',
          left: '50%',
          [isBottom ? 'bottom' : 'top']: isBottom ? 14 : 12,
          transform: `translateX(-50%) translateY(${
            hiddenNow ? (isBottom ? '125%' : '-125%') : '0'
          })`,
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          zIndex: 100,
          display: 'flex',
          flexDirection: isBottom ? 'column' : 'column-reverse',
          alignItems: 'center',
          gap: 7,
          maxWidth: 'calc(100vw - 32px)',
          pointerEvents: 'none'
        }}
      >
        {/* Floating Search Autocomplete Suggestions Card */}
        {isEditing && inputText.trim().length > 0 && searchSuggestions.length > 0 && (
          <div
            className="modal-animate-in"
            style={{
              width: 640,
              maxWidth: 'calc(100vw - 36px)',
              padding: 6,
              borderRadius: 20,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              boxShadow: 'var(--shadow-floating)',
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            {searchSuggestions.map((sug) => (
              <div
                key={sug}
                onClick={() => {
                  setIsEditing(false);
                  onNavigate(sug);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 13,
                  cursor: 'pointer',
                  fontSize: 13.5
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <span>{sug}</span>
                </div>
                <button
                  type="button"
                  title="Preencher na busca"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInputText(sug);
                    onQueryChange(sug);
                    inputRef.current?.focus();
                  }}
                  style={{ color: 'var(--text-tertiary)', padding: 4 }}
                >
                  <ArrowUpRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Optional Favorites Quick Bar */}
        {settings.showFavoritesBar && !isHomeCollapsed && !activeTab.isHomePage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              maxWidth: 680,
              overflowX: 'auto',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              boxShadow: 'var(--shadow-floating)',
              pointerEvents: 'auto'
            }}
          >
            {favorites.slice(0, 8).map((fav) => (
              <button
                key={fav.id}
                onClick={() => onNavigate(fav.url)}
                className="squircle-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'var(--bg-elevated)',
                  fontSize: 11.5,
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
                {fav.iconAsset && <img src={fav.iconAsset} alt="" style={{ width: 13, height: 13 }} />}
                <span>{fav.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Horizontal Pill Tabs Strip (Inherited from HorizontalTabsStrip.kt) */}
        {settings.showPillTabsBar && visibleTabs.length > 1 && !isEditing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              maxWidth: 680,
              overflowX: 'auto',
              padding: '4px 6px',
              pointerEvents: 'auto'
            }}
          >
            {visibleTabs.map((tab) => {
              const isActive = tab.id === activeTab.id;
              const tabGroup = (groups || []).find((g) => g.id === tab.groupId);
              const isBeingDragged = draggedAirTabId === tab.id;
              const isDragTarget = dragOverAirTabId === tab.id;

              return (
                <div
                  key={tab.id}
                  draggable={!isIncognito}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', tab.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedAirTabId(tab.id);
                  }}
                  onDragEnd={() => {
                    setDraggedAirTabId(null);
                    setDragOverAirTabId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (draggedAirTabId && draggedAirTabId !== tab.id && dragOverAirTabId !== tab.id) {
                      setDragOverAirTabId(tab.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dragOverAirTabId === tab.id) setDragOverAirTabId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedAirTabId && draggedAirTabId !== tab.id && onGroupTabs) {
                      onGroupTabs(draggedAirTabId, tab.id);
                    }
                    setDraggedAirTabId(null);
                    setDragOverAirTabId(null);
                  }}
                  onClick={() => onSelectTab(tab.id)}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget;
                    if (hoverTabTimerRef.current) clearTimeout(hoverTabTimerRef.current);
                    hoverTabTimerRef.current = window.setTimeout(() => {
                      const rect = target.getBoundingClientRect();
                      setHoveredTabInfo({ tab, rect });
                    }, 180);
                  }}
                  onMouseLeave={() => {
                    if (hoverTabTimerRef.current) clearTimeout(hoverTabTimerRef.current);
                    hoverTabTimerRef.current = window.setTimeout(() => {
                      setHoveredTabInfo(null);
                    }, 140);
                  }}
                  className="squircle-press"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    height: 32,
                    padding: '0 11px',
                    borderRadius: 16,
                    cursor: 'pointer',
                    background: isActive ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                    border: `1px solid ${
                      isDragTarget
                        ? 'var(--accent-primary)'
                        : isActive
                        ? isIncognito
                          ? '#AF52DE'
                          : activeSpace.colorHex
                        : tabGroup
                        ? tabGroup.colorHex
                        : 'var(--border-hairline)'
                    }`,
                    boxShadow: isDragTarget
                      ? '0 0 14px rgba(59, 130, 246, 0.5)'
                      : '0 4px 14px rgba(0,0,0,0.22)',
                    maxWidth: 175,
                    flexShrink: 0,
                    opacity: isBeingDragged ? 0.35 : 1,
                    transform: isDragTarget ? 'scale(1.06)' : 'none',
                    transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                >
                  {tabGroup && (
                    <span
                      title={`Grupo: ${tabGroup.name}`}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: tabGroup.colorHex,
                        boxShadow: `0 0 6px ${tabGroup.colorHex}`,
                        flexShrink: 0
                      }}
                    />
                  )}
                  {tab.isPinned && <Pin size={10} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
                  {tab.favicon ? (
                    <img src={tab.favicon} alt="" style={{ width: 13, height: 13, borderRadius: 3, flexShrink: 0 }} />
                  ) : (
                    <Globe size={12.5} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  )}

                  {/* Playing Audio/Video Media Indicator on Tab Pill */}
                  {tab.isPlayingMedia && (
                    <button
                      type="button"
                      title={tab.isMuted ? 'Guia silenciada (clique para ativar áudio)' : 'Reproduzindo áudio/vídeo (clique para mutar)'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMute?.(tab.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        color: tab.isMuted ? '#FF453A' : '#34C759',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      <Volume2 size={12} />
                    </button>
                  )}

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {tab.title || 'Nova Guia'}
                  </span>
                  {visibleTabs.length > 1 && !tab.isPinned && (
                    <button
                      title="Fechar guia (Ctrl+W)"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.id);
                      }}
                      style={{
                        color: 'var(--text-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 2
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              title="Nova guia (Ctrl+T)"
              onClick={onNewTab}
              className="squircle-press"
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        {/* Floating Tab Hover Preview Card (Rendered outside overflowX: auto so it never gets clipped!) */}
        {hoveredTabInfo && (
          <div
            style={{
              position: 'fixed',
              left: Math.max(
                130,
                Math.min(window.innerWidth - 130, hoveredTabInfo.rect.left + hoveredTabInfo.rect.width / 2)
              ),
              [isBottom ? 'bottom' : 'top']: isBottom
                ? window.innerHeight - hoveredTabInfo.rect.top + 8
                : hoveredTabInfo.rect.bottom + 8,
              transform: 'translateX(-50%)',
              zIndex: 99999,
              pointerEvents: 'auto'
            }}
            onMouseEnter={() => {
              if (hoverTabTimerRef.current) clearTimeout(hoverTabTimerRef.current);
            }}
            onMouseLeave={() => {
              if (hoverTabTimerRef.current) clearTimeout(hoverTabTimerRef.current);
              hoverTabTimerRef.current = window.setTimeout(() => {
                setHoveredTabInfo(null);
              }, 120);
            }}
          >
            <TabHoverPreview
              tab={hoveredTabInfo.tab}
              spaceColorHex={isIncognito ? '#AF52DE' : activeSpace.colorHex}
              onSelectTab={(id) => {
                setHoveredTabInfo(null);
                onSelectTab(id);
              }}
              onCloseTab={(id) => {
                setHoveredTabInfo(null);
                onCloseTab(id);
              }}
              onTogglePlayPause={onTogglePlayPause || (() => {})}
              onToggleMute={onToggleMute || (() => {})}
              onTriggerPiP={onTriggerPiP || (() => {})}
            />
          </div>
        )}

        {/* MAIN FLOATING MORPHING CAPSULE DOCK (TesseraAirBar.kt) */}
        <div
          className="airbar-morph"
          onMouseLeave={handleBarMouseLeave}
          style={{
            width: isHomeCollapsed ? 56 : 680,
            maxWidth: 'calc(100vw - 32px)',
            height: isHomeCollapsed ? 54 : 56,
            borderRadius: isHomeCollapsed ? 28 : 26,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            boxShadow: 'var(--shadow-floating)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            padding: isHomeCollapsed ? 0 : '0 8px',
            pointerEvents: 'auto'
          }}
        >
          {/* Animated Cyan/Accent Linear Progress Indicator */}
          {showProgress && !isHomeCollapsed && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: 2.5,
                width: `${Math.max(12, Math.round(progress * 100))}%`,
                background: isIncognito ? '#AF52DE' : '#32ADE6',
                transition: 'width 0.25s ease'
              }}
            />
          )}

          {isHomeCollapsed ? (
            /* Collapsed Sphere on StartPage (Tessera Launcher / Android signature + Hover gesture) */
            <button
              onClick={startEditing}
              onMouseEnter={handleSphereMouseEnter}
              onMouseLeave={handleSphereMouseLeave}
              title="Pesquisar ou digitar endereço (Ctrl+L ou passe o mouse)"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Search size={21} />
            </button>
          ) : isEditing ? (
            /* Search / URL Editing Mode */
            <form
              onSubmit={handleSubmit}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={iconCircleBtnStyle}
                title="Cancelar (Esc)"
              >
                <ArrowLeft size={18} />
              </button>

              <div
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 21,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 13px',
                  gap: 9
                }}
              >
                <Search size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    onQueryChange(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditing(false);
                    }
                  }}
                  placeholder={
                    isIncognito ? 'Buscar em modo anônimo...' : 'Pesquisar ou digitar endereço web...'
                  }
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontWeight: 500
                  }}
                />
                {inputText && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('');
                      onQueryChange('');
                      inputRef.current?.focus();
                    }}
                    style={{ color: 'var(--text-tertiary)', display: 'flex' }}
                  >
                    <X size={15} />
                  </button>
                )}

                <button
                  type="button"
                  title="Pesquisa por Voz / Assistente Tessera"
                  onClick={() => onOpenVoiceAssistant?.()}
                  style={{
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Mic size={17} />
                </button>
              </div>

              <button
                type="submit"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            /* Standard Expanded Dock Controls */
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              {/* Space Quick Pill */}
              <button
                onClick={onOpenSpacesModal}
                title={`Espaço: ${isIncognito ? 'Anônimo' : activeSpace.name}`}
                className="squircle-press"
                style={{
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 18,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 14,
                  flexShrink: 0
                }}
              >
                <span>{isIncognito ? '🕶️' : activeSpace.iconEmoji}</span>
              </button>

              {/* Back / Forward / Home */}
              <button
                onClick={onBack}
                disabled={!activeTab.canGoBack && activeTab.isHomePage}
                title="Voltar (Alt+←)"
                style={{
                  ...iconCircleBtnStyle,
                  opacity: activeTab.canGoBack || !activeTab.isHomePage ? 1 : 0.32
                }}
              >
                <ArrowLeft size={17} />
              </button>

              {activeTab.canGoForward && (
                <button onClick={onForward} title="Avançar (Alt+→)" style={iconCircleBtnStyle}>
                  <ArrowRight size={17} />
                </button>
              )}

              {!activeTab.isHomePage && (
                <button onClick={onGoHome} title="Página Inicial" style={iconCircleBtnStyle}>
                  <Home size={16} />
                </button>
              )}

              {/* Central Domain / Omnibar Pill */}
              <div
                onClick={startEditing}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 20,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 10px',
                  cursor: 'text',
                  minWidth: 140
                }}
              >
                <button
                  type="button"
                  title="Permissões e Segurança do Site"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!activeTab.isHomePage) onOpenSiteSettings();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    color: isSecure ? '#34C759' : 'var(--text-tertiary)'
                  }}
                >
                  {activeTab.isHomePage ? <Search size={14} /> : <Lock size={13.5} />}
                </button>

                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    padding: '0 8px'
                  }}
                >
                  {activeTab.isHomePage ? 'Pesquisar ou digitar endereço' : cleanHost}
                </span>

                {!activeTab.isHomePage ? (
                  <button
                    type="button"
                    title={activeTab.isLoading ? 'Parar' : 'Recarregar (Ctrl+R)'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeTab.isLoading) onStopLoading();
                      else onReload();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {activeTab.isLoading ? <X size={14} /> : <RotateCw size={13.5} />}
                  </button>
                ) : (
                  <span style={{ width: 20 }} />
                )}
              </div>

              {/* Reader Mode Button */}
              {!activeTab.isHomePage && (
                <button
                  onClick={onToggleReaderMode}
                  title="Modo Leitura Editorial (Alt+R)"
                  style={{
                    ...iconCircleBtnStyle,
                    background: isReaderActive
                      ? 'var(--accent-primary)'
                      : isReaderAvailable
                        ? 'rgba(10, 132, 255, 0.14)'
                        : 'transparent',
                    color: isReaderActive
                      ? '#FFFFFF'
                      : isReaderAvailable
                        ? 'var(--accent-primary)'
                        : 'var(--text-secondary)'
                  }}
                >
                  <BookOpen size={16.5} />
                </button>
              )}

              {/* Bookmark Toggle */}
              {!activeTab.isHomePage && (
                <button
                  onClick={onToggleBookmark}
                  title={isBookmarked ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
                  style={{
                    ...iconCircleBtnStyle,
                    color: isBookmarked ? '#FFCC00' : 'var(--text-secondary)'
                  }}
                >
                  <Star size={16.5} fill={isBookmarked ? '#FFCC00' : 'none'} />
                </button>
              )}

              {/* Voice Assistant / Microphone Button (Always visible in all tabs!) */}
              <button
                onClick={onOpenVoiceAssistant}
                title="Assistente de Voz / Diga 'Ei Tessera' (Ctrl+Shift+V ou Alt+V)"
                className="squircle-press"
                style={{
                  ...iconCircleBtnStyle,
                  color: 'var(--accent-primary)'
                }}
              >
                <Mic size={17} />
              </button>

              {/* Tessera AI Sparkle Button */}
              {settings.tesseraAiEnabled && settings.aiToolbarButton && (
                <button
                  onClick={onOpenAi}
                  title="Tessera Intelligence — Resumo & Chat IA (Alt+A)"
                  style={{
                    ...iconCircleBtnStyle,
                    color: 'var(--accent-primary)'
                  }}
                >
                  <Sparkles size={17} />
                </button>
              )}

              {/* Squircle Tabs Counter Badge */}
              <button
                onClick={onOpenTabsModal}
                title="Gerenciar Guias e Grupos"
                className="squircle-press"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-hairline)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {visibleTabs.length}
              </button>

              {/* Quick Settings Menu */}
              <button
                onClick={onOpenQuickSettings}
                title="Configuração Fácil & Ferramentas"
                style={iconCircleBtnStyle}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const iconCircleBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'background-color 0.15s ease'
};
