import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Pin,
  Volume2,
  VolumeX,
  Shield,
  Moon,
  Sun,
  Headphones,
  Search,
  Languages,
  FileDown,
  Terminal,
  QrCode,
  Settings,
  History,
  Download,
  Bookmark,
  BookOpen,
  FolderOpen,
  Upload,
  Check,
  EyeOff,
  Globe,
  Image as ImageIcon,
  Folder,
  FolderPlus,
  Mic,
  ExternalLink,
  Code,
  Copy,
  Sparkles,
  RefreshCw,
  AppWindow
} from 'lucide-react';
import type {
  BrowserSettings,
  BrowserSpace,
  BrowserTab,
  DownloadItem,
  HistoryEntry,
  PrivacyDashboardState,
  SavedPageItem,
  SearchEngineId,
  SiteSettings,
  SpeedDialItem,
  TabGroup
} from '../shared/types';
import {
  AVAILABLE_WALLPAPERS,
  hexToArgb,
  SPACE_PRESET_COLORS,
  SPACE_PRESET_EMOJIS
} from '../shared/wallpapers';
import { SEARCH_ENGINES } from '../shared/searchEngines';

/* ============================================================================
   1. ARC SPACES SWITCHER & CREATOR MODAL (SpacesComponents.kt)
   ============================================================================ */
export const SpacesModal: React.FC<{
  visible: boolean;
  spaces: BrowserSpace[];
  activeSpaceId: string;
  isIncognito: boolean;
  tabs: BrowserTab[];
  onSelectSpace: (spaceId: string) => void;
  onToggleIncognito: () => void;
  onCreateSpace: (name: string, emoji: string, colorHex: string, colorArgb: number) => void;
  onDeleteSpace: (spaceId: string) => void;
  onClose: () => void;
}> = ({
  visible,
  spaces,
  activeSpaceId,
  isIncognito,
  tabs,
  onSelectSpace,
  onToggleIncognito,
  onCreateSpace,
  onDeleteSpace,
  onClose
}) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🚀');
  const [colorHex, setColorHex] = useState('#0288D1');

  if (!visible) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateSpace(name.trim(), emoji, colorHex, hexToArgb(colorHex));
    setName('');
    setCreating(false);
  };

  return (
    <div onClick={onClose} style={backdropStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-animate-in"
        style={{ ...cardModalStyle, width: 460 }}
      >
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700 }}>Espaços de Navegação</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Cada espaço possui cookies, logins e abas 100% isolados no Chromium
            </p>
          </div>
          <button onClick={onClose} style={closeCircleStyle}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {spaces.map((sp) => {
            const active = !isIncognito && sp.id === activeSpaceId;
            const count = tabs.filter((t) => !t.isIncognito && t.spaceId === sp.id).length;
            return (
              <div
                key={sp.id}
                onClick={() => {
                  onSelectSpace(sp.id);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 16,
                  cursor: 'pointer',
                  background: active ? `${sp.colorHex}24` : 'var(--bg-elevated)',
                  border: `1px solid ${active ? sp.colorHex : 'var(--border-hairline)'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ fontSize: 20 }}>{sp.iconEmoji}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{sp.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                      {count} {count === 1 ? 'guia ativa' : 'guias ativas'} • Sessão isolada
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {active && <Check size={16} style={{ color: sp.colorHex }} />}
                  {!sp.isDefault && spaces.length > 1 && (
                    <button
                      title="Excluir espaço"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSpace(sp.id);
                      }}
                      style={{ color: 'var(--text-tertiary)', padding: 4 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Stealth Incognito Space Toggle */}
          <div
            onClick={() => {
              onToggleIncognito();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 16,
              cursor: 'pointer',
              background: isIncognito ? 'rgba(175, 82, 222, 0.22)' : 'var(--bg-elevated)',
              border: `1px solid ${isIncognito ? '#AF52DE' : 'var(--border-hairline)'}`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <EyeOff size={19} style={{ color: '#AF52DE' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Modo Anônimo Stealth</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  Partição em memória • Zero histórico ou cookies salvos
                </div>
              </div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#AF52DE' }}>
              {isIncognito ? 'Sair' : 'Ctrl+Shift+N'}
            </span>
          </div>
        </div>

        {creating ? (
          <form
            onSubmit={handleCreate}
            style={{
              padding: 14,
              borderRadius: 16,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <input
              type="text"
              autoFocus
              placeholder="Nome do Espaço (ex: Faculdade, Projetos)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputFieldStyle}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SPACE_PRESET_EMOJIS.map((em) => (
                <button
                  type="button"
                  key={em}
                  onClick={() => setEmoji(em)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: emoji === em ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    fontSize: 15
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SPACE_PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColorHex(c.hex)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: c.hex,
                    border: colorHex === c.hex ? '2px solid #FFF' : 'none'
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setCreating(false)}
                style={secondaryPillBtn}
              >
                Cancelar
              </button>
              <button type="submit" style={primaryPillBtn}>
                Criar Espaço
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            style={{
              ...primaryPillBtn,
              width: '100%',
              justifyContent: 'center',
              padding: '11px 16px'
            }}
          >
            <Plus size={16} />
            <span>Novo Espaço Isolado</span>
          </button>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   2. TABS & TAB GROUPS GRID MODAL (TabsModal.kt)
   ============================================================================ */
export const TabsModal: React.FC<{
  visible: boolean;
  tabs: BrowserTab[];
  activeTabId: string;
  groups: TabGroup[];
  activeSpace: BrowserSpace;
  isIncognito: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: (groupId?: string | null) => void;
  onTogglePinTab: (id: string) => void;
  onToggleMuteTab: (id: string) => void;
  onCreateGroup?: (name: string, colorHex: string) => void;
  onAssignTabToGroup: (tabId: string, groupId: string | null) => void;
  onGroupTabs?: (sourceTabId: string, targetTabId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onClose: () => void;
}> = ({
  visible,
  tabs,
  activeTabId,
  groups,
  activeSpace,
  isIncognito,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onTogglePinTab,
  onToggleMuteTab,
  onAssignTabToGroup,
  onGroupTabs,
  onDeleteGroup,
  onClose
}) => {
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  if (!visible) return null;

  const spaceGroups = isIncognito ? [] : groups.filter((g) => g.spaceId === activeSpace.id);
  const displayedTabs = selectedGroupFilter
    ? tabs.filter((t) => t.groupId === selectedGroupFilter)
    : tabs;

  return (
    <div onClick={onClose} style={backdropStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-animate-in"
        style={{ ...cardModalStyle, width: 780, maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{isIncognito ? '🕶️' : activeSpace.iconEmoji}</span>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                {isIncognito ? 'Guias Anônimas' : `Guias • ${activeSpace.name}`} ({tabs.length})
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Arraste uma guia sobre outra para criar ou juntar em um grupo • Ctrl+T nova guia
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                onNewTab(selectedGroupFilter);
                onClose();
              }}
              style={primaryPillBtn}
            >
              <Plus size={15} />
              <span>Nova Guia</span>
            </button>
            <button onClick={onClose} style={closeCircleStyle}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Group Filter Pills & Drop Targets */}
        {spaceGroups.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <button
              onClick={() => setSelectedGroupFilter(null)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedTabId) {
                  onAssignTabToGroup(draggedTabId, null);
                  setDraggedTabId(null);
                }
              }}
              title="Clique para filtrar ou solte uma guia aqui para desagrupar"
              style={{
                ...secondaryPillBtn,
                background: selectedGroupFilter === null ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: selectedGroupFilter === null ? '#FFF' : 'var(--text-secondary)'
              }}
            >
              Todas ({tabs.length})
            </button>
            {spaceGroups.map((g) => (
              <div
                key={g.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTabId) {
                    onAssignTabToGroup(draggedTabId, g.id);
                    setDraggedTabId(null);
                  }
                }}
                title="Clique para filtrar ou solte uma guia aqui para adicionar ao grupo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: selectedGroupFilter === g.id ? g.colorHex : 'var(--bg-elevated)',
                  border: `1.5px solid ${g.colorHex}`,
                  color: selectedGroupFilter === g.id ? '#FFF' : 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => setSelectedGroupFilter(g.id)}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: selectedGroupFilter === g.id ? '#FFF' : g.colorHex
                  }}
                />
                <span>{g.name}</span>
                <span style={{ fontSize: 11, opacity: 0.75 }}>
                  ({tabs.filter((t) => t.groupId === g.id).length})
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedGroupFilter === g.id) setSelectedGroupFilter(null);
                    onDeleteGroup(g.id);
                  }}
                  title="Desfazer grupo"
                  style={{ color: 'inherit', opacity: 0.7, marginLeft: 2 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tabs Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12
          }}
        >
          {displayedTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const tabGroup = spaceGroups.find((g) => g.id === tab.groupId);
            const isBeingDragged = draggedTabId === tab.id;
            const isDragTarget = dragOverTabId === tab.id;

            return (
              <div
                key={tab.id}
                draggable={!isIncognito}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', tab.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedTabId(tab.id);
                }}
                onDragEnd={() => {
                  setDraggedTabId(null);
                  setDragOverTabId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (draggedTabId && draggedTabId !== tab.id && dragOverTabId !== tab.id) {
                    setDragOverTabId(tab.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (dragOverTabId === tab.id) setDragOverTabId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTabId && draggedTabId !== tab.id) {
                    if (onGroupTabs) {
                      onGroupTabs(draggedTabId, tab.id);
                    } else if (tab.groupId) {
                      onAssignTabToGroup(draggedTabId, tab.groupId);
                    }
                  }
                  setDraggedTabId(null);
                  setDragOverTabId(null);
                }}
                onClick={() => {
                  onSelectTab(tab.id);
                  onClose();
                }}
                className="squircle-press"
                style={{
                  position: 'relative',
                  borderRadius: 18,
                  padding: 12,
                  background: 'var(--bg-elevated)',
                  border: `1.5px solid ${
                    isDragTarget
                      ? 'var(--accent-primary)'
                      : isActive
                      ? 'var(--accent-primary)'
                      : tabGroup
                      ? tabGroup.colorHex
                      : 'var(--border-hairline)'
                  }`,
                  boxShadow: isDragTarget ? '0 0 18px rgba(59, 130, 246, 0.45)' : 'none',
                  cursor: 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                  opacity: isBeingDragged ? 0.35 : 1,
                  transform: isDragTarget ? 'scale(1.025)' : 'none',
                  transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {/* Visual Feedback Overlay when dragged over another tab (Edge-style) */}
                {isDragTarget && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 17,
                      background: 'rgba(59, 130, 246, 0.28)',
                      backdropFilter: 'blur(3px)',
                      border: '2px dashed var(--accent-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      zIndex: 10,
                      pointerEvents: 'none'
                    }}
                  >
                    <FolderPlus size={26} style={{ color: 'var(--accent-primary)' }} />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#FFF',
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                      }}
                    >
                      {tab.groupId ? 'Juntar ao Grupo' : 'Solte para Criar Grupo'}
                    </span>
                  </div>
                )}

                {/* Thumbnail or Minimalist Preview */}
                <div
                  style={{
                    height: 104,
                    borderRadius: 12,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-hairline)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {tab.thumbnailDataUrl && !tab.isHomePage ? (
                    <img
                      src={tab.thumbnailDataUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: 'var(--text-tertiary)' }}>
                      {tab.isHomePage ? 'TESSERA INÍCIO' : tab.title.slice(0, 18).toUpperCase()}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    {tab.favicon ? (
                      <img src={tab.favicon} alt="" style={{ width: 14, height: 14, borderRadius: 3 }} />
                    ) : (
                      <Globe size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    )}
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {tab.title || 'Nova Guia'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <button
                      title={tab.isPinned ? 'Desafixar' : 'Fixar guia'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePinTab(tab.id);
                      }}
                      style={{
                        padding: 4,
                        color: tab.isPinned ? 'var(--accent-primary)' : 'var(--text-tertiary)'
                      }}
                    >
                      <Pin size={13} />
                    </button>
                    {!tab.isHomePage && (
                      <button
                        title={tab.isMuted ? 'Ativar som da guia' : 'Silenciar guia'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMuteTab(tab.id);
                        }}
                        style={{
                          padding: 4,
                          color: tab.isMuted ? '#FF9500' : 'var(--text-tertiary)'
                        }}
                      >
                        {tab.isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                      </button>
                    )}
                    {!tab.isPinned && (
                      <button
                        title="Fechar guia"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(tab.id);
                        }}
                        style={{ padding: 4, color: 'var(--text-tertiary)' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {tabGroup && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: `${tabGroup.colorHex}22`,
                      border: `1px solid ${tabGroup.colorHex}55`,
                      color: tabGroup.colorHex,
                      fontSize: 11,
                      fontWeight: 700,
                      alignSelf: 'flex-start'
                    }}
                  >
                    <Folder size={11} />
                    <span>{tabGroup.name}</span>
                    <button
                      title="Desagrupar guia"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignTabToGroup(tab.id, null);
                      }}
                      style={{ color: 'inherit', marginLeft: 3, padding: 1, opacity: 0.8 }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}

                {spaceGroups.length > 0 && !isIncognito && (
                  <select
                    value={tab.groupId || ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onAssignTabToGroup(tab.id, e.target.value || null)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-hairline)',
                      color: 'var(--text-secondary)',
                      fontSize: 11
                    }}
                  >
                    <option value="">Sem grupo</option>
                    {spaceGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        Grupo: {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   3. QUICK SETTINGS PANEL (QuickSettingsPanel.kt)
   ============================================================================ */
export const QuickSettingsPanel: React.FC<{
  visible: boolean;
  settings: BrowserSettings;
  isWebPageActive: boolean;
  isIncognito: boolean;
  onUpdateSettings: (partial: Partial<BrowserSettings>) => void;
  onPickCustomWallpaper: () => void;
  onOpenHub: (initialTab: number) => void;
  onOpenPrivacyDashboard: () => void;
  onOpenReaderMode: () => void;
  onListenPodcast: () => void;
  onOpenFindInPage: () => void;
  onTriggerTranslate: () => void;
  onExportPdf: () => void;
  onOpenDevTools: () => void;
  onOpenQrBridge: () => void;
  onToggleIncognito: () => void;
  onOpenFullSettings: () => void;
  onClose: () => void;
}> = ({
  visible,
  settings,
  isWebPageActive,
  isIncognito,
  onUpdateSettings,
  onPickCustomWallpaper,
  onOpenHub,
  onOpenPrivacyDashboard,
  onOpenReaderMode,
  onListenPodcast,
  onOpenFindInPage,
  onTriggerTranslate,
  onExportPdf,
  onOpenDevTools,
  onOpenQrBridge,
  onToggleIncognito,
  onOpenFullSettings,
  onClose
}) => {
  if (!visible) return null;

  return (
    <div onClick={onClose} style={backdropStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-animate-in"
        style={{
          ...cardModalStyle,
          width: 470,
          maxHeight: '85vh',
          overflowY: 'auto'
        }}
      >
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ fontSize: 16.5, fontWeight: 700 }}>Configuração Fácil</h3>
            <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              Personalização imediata e ferramentas da página
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                onClose();
                onOpenFullSettings();
              }}
              title="Todas as Configurações"
              style={secondaryPillBtn}
            >
              <Settings size={14} />
              <span>Ajustes</span>
            </button>
            <button onClick={onClose} style={closeCircleStyle}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Hub Quick Shortcuts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { icon: <Bookmark size={16} />, label: 'Favoritos', tab: 0 },
            { icon: <History size={16} />, label: 'Histórico', tab: 1 },
            { icon: <Download size={16} />, label: 'Downloads', tab: 2 },
            { icon: <BookOpen size={16} />, label: 'Salvos', tab: 3 }
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => {
                onClose();
                onOpenHub(item.tab);
              }}
              className="squircle-press"
              style={{
                padding: '11px 6px',
                borderRadius: 16,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 600
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Appearance Switches */}
        <div style={sectionBoxStyle}>
          <div style={sectionLabelStyle}>APARÊNCIA & LAYOUT</div>
          <ToggleRow
            icon={settings.isDarkMode ? <Moon size={15} /> : <Sun size={15} />}
            title={settings.isDarkMode ? 'Ambiente Escuro (Pure OLED)' : 'Ambiente Claro (Modo Journal)'}
            checked={settings.isDarkMode}
            onChange={(v) => onUpdateSettings({ isDarkMode: v })}
          />
          <ToggleRow
            icon={<Moon size={15} />}
            title="Forçar páginas escuras (Blink AutoDark)"
            checked={settings.forceDarkPages}
            onChange={(v) => onUpdateSettings({ forceDarkPages: v })}
          />
          <ToggleRow
            icon={<Globe size={15} />}
            title={`Posição da AirBar: ${settings.airBarPosition === 'bottom' ? 'Base (Padrão)' : 'Topo'}`}
            checked={settings.airBarPosition === 'top'}
            onChange={(v) => onUpdateSettings({ airBarPosition: v ? 'top' : 'bottom' })}
          />
          <ToggleRow
            icon={<Bookmark size={15} />}
            title="Barra de pílulas de abas acima da AirBar"
            checked={settings.showPillTabsBar}
            onChange={(v) => onUpdateSettings({ showPillTabsBar: v })}
          />
          <ToggleRow
            icon={<Bookmark size={15} />}
            title="Barra rápida de favoritos"
            checked={settings.showFavoritesBar}
            onChange={(v) => onUpdateSettings({ showFavoritesBar: v })}
          />
          <ToggleRow
            icon={<AppWindow size={15} />}
            title={
              settings.windowControlsMode === 'top-bar'
                ? 'Controles da Janela: Faixa Superior Fixa (28px)'
                : 'Controles da Janela: Auto-ocultar (Aparece ao passar o mouse)'
            }
            checked={settings.windowControlsMode === 'top-bar'}
            onChange={(v) => onUpdateSettings({ windowControlsMode: v ? 'top-bar' : 'auto-hide' })}
          />
          <ToggleRow
            icon={<Mic size={15} style={{ color: settings.voiceActivationEnabled ? '#34C759' : undefined }} />}
            title="Ativação por voz contínua ('Ei Tessera')"
            checked={settings.voiceActivationEnabled}
            onChange={(v) => onUpdateSettings({ voiceActivationEnabled: v })}
          />
        </div>

        {/* Wallpapers Horizontal Gallery */}
        <div style={sectionBoxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ ...sectionLabelStyle, marginBottom: 0 }}>PAPEL DE PAREDE DA START PAGE</span>
            <CupertinoGlassToggle
              checked={settings.showWallpaper}
              onChange={(val) => onUpdateSettings({ showWallpaper: val })}
            />
          </div>
          {settings.showWallpaper && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {AVAILABLE_WALLPAPERS.map((wp) => {
                const selected = !settings.customWallpaperDataUrl && settings.selectedWallpaperId === wp.id;
                return (
                  <button
                    key={wp.id}
                    onClick={() =>
                      onUpdateSettings({ selectedWallpaperId: wp.id, customWallpaperDataUrl: null })
                    }
                    style={{
                      width: 74,
                      height: 50,
                      borderRadius: 12,
                      flexShrink: 0,
                      background: wp.imageUrl ? `url("${wp.imageUrl}") center/cover` : wp.cssGradient,
                      border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-hairline)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    title={wp.name}
                  />
                );
              })}
              <button
                onClick={onPickCustomWallpaper}
                title="Enviar imagem personalizada"
                style={{
                  width: 74,
                  height: 50,
                  borderRadius: 12,
                  flexShrink: 0,
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ImageIcon size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Privacy & Shield */}
        <div style={sectionBoxStyle}>
          <div style={sectionLabelStyle}>PRIVACIDADE & SEGURANÇA</div>
          <ToggleRow
            icon={<Shield size={15} style={{ color: '#34C759' }} />}
            title="Escudo AdBlock & Anti-Rastreadores"
            checked={settings.adBlockEnabled}
            onChange={(v) => onUpdateSettings({ adBlockEnabled: v })}
          />
          <ToggleRow
            icon={<Shield size={15} />}
            title="Bloqueador de banners de cookies"
            checked={settings.cookieBlockerEnabled}
            onChange={(v) => onUpdateSettings({ cookieBlockerEnabled: v })}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              onClick={() => {
                onClose();
                onOpenPrivacyDashboard();
              }}
              style={{ ...secondaryPillBtn, flex: 1, justifyContent: 'center' }}
            >
              <Shield size={14} />
              <span>Relatório de Privacidade</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onToggleIncognito();
              }}
              style={{ ...secondaryPillBtn, flex: 1, justifyContent: 'center' }}
            >
              <EyeOff size={14} />
              <span>{isIncognito ? 'Sair do Anônimo' : 'Modo Anônimo'}</span>
            </button>
          </div>
        </div>

        {/* Page Actions Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <ActionTile
            icon={<QrCode size={16} />}
            label="Ponte Android"
            onClick={() => {
              onClose();
              onOpenQrBridge();
            }}
          />
          {isWebPageActive && (
            <>
              <ActionTile
                icon={<BookOpen size={16} />}
                label="Modo Leitura"
                onClick={() => {
                  onClose();
                  onOpenReaderMode();
                }}
              />
              <ActionTile
                icon={<Headphones size={16} />}
                label="Podcastify"
                onClick={() => {
                  onClose();
                  onListenPodcast();
                }}
              />
              <ActionTile
                icon={<Search size={16} />}
                label="Buscar (Ctrl+F)"
                onClick={() => {
                  onClose();
                  onOpenFindInPage();
                }}
              />
              <ActionTile
                icon={<Languages size={16} />}
                label="Traduzir Página"
                onClick={() => {
                  onClose();
                  onTriggerTranslate();
                }}
              />
              <ActionTile
                icon={<FileDown size={16} />}
                label="Exportar PDF"
                onClick={() => {
                  onClose();
                  onExportPdf();
                }}
              />
              <ActionTile
                icon={<Terminal size={16} />}
                label="DevTools (F12)"
                onClick={() => {
                  onClose();
                  onOpenDevTools();
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   4. FULL SETTINGS & ANDROID BACKUP SYNC MODAL (TesseraSettingsScreen.kt)
   ============================================================================ */
export const FullSettingsModal: React.FC<{
  visible: boolean;
  settings: BrowserSettings;
  isDefaultBrowser: boolean;
  onUpdateSettings: (partial: Partial<BrowserSettings>) => void;
  onSetDefaultBrowser: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onOpenQrBridge: () => void;
  onOpenOnboarding?: () => void;
  onClose: () => void;
}> = ({
  visible,
  settings,
  isDefaultBrowser,
  onUpdateSettings,
  onSetDefaultBrowser,
  onExportBackup,
  onImportBackup,
  onOpenQrBridge,
  onOpenOnboarding,
  onClose
}) => {
  const [pinDraft, setPinDraft] = useState('');
  const [showDevOptions, setShowDevOptions] = useState(false);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [systemInfo, setSystemInfo] = useState<{
    appVersion: string;
    chromeVersion: string;
    electronVersion: string;
    nodeVersion: string;
    arch: string;
    isPackaged: boolean;
  }>({
    appVersion: '1.0.4',
    chromeVersion: '156.0.8078.75',
    electronVersion: '45.2.1',
    nodeVersion: '24.22.1',
    arch: 'Windows x64',
    isPackaged: true
  });
  const [updateCheckStatus, setUpdateCheckStatus] = useState<
    'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error'
  >('idle');
  const [updateDetails, setUpdateDetails] = useState<{
    latestVersion?: string;
    releaseNotes?: string;
    downloadUrl?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (visible && window.tesseraApi?.getSystemInfo) {
      window.tesseraApi.getSystemInfo().then(setSystemInfo).catch(() => {});
    }
  }, [visible]);

  const handleCheckForUpdates = async () => {
    if (!window.tesseraApi?.checkForUpdates || updateCheckStatus === 'checking') return;
    setUpdateCheckStatus('checking');
    try {
      const res = await window.tesseraApi.checkForUpdates();
      if (res.status === 'update-available') {
        setUpdateCheckStatus('update-available');
        setUpdateDetails({
          latestVersion: res.latestVersion,
          releaseNotes: res.releaseNotes,
          downloadUrl: res.downloadUrl
        });
      } else if (res.status === 'up-to-date') {
        setUpdateCheckStatus('up-to-date');
        setUpdateDetails({ latestVersion: res.latestVersion });
        setTimeout(() => setUpdateCheckStatus('idle'), 5000);
      } else {
        setUpdateCheckStatus('error');
        setUpdateDetails({ error: res.error });
      }
    } catch (err: any) {
      setUpdateCheckStatus('error');
      setUpdateDetails({ error: err?.message || 'Erro ao checar atualizações' });
    }
  };

  if (!visible) return null;

  return (
    <div onClick={onClose} style={backdropStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-animate-in"
        style={{ ...cardModalStyle, width: 560, maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Configurações do Tessera Browser</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Tessera Browser for Windows v{systemInfo.appVersion} • Motor Chromium
            </p>
          </div>
          <button onClick={onClose} style={closeCircleStyle}>
            <X size={16} />
          </button>
        </div>

        {/* Default Browser Card */}
        <div
          style={{
            ...sectionBoxStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Navegador Padrão do Windows</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {isDefaultBrowser
                ? 'O Tessera já é o seu navegador padrão para links HTTP/HTTPS.'
                : 'Abra links externos do Windows diretamente no Tessera Browser.'}
            </div>
          </div>
          {!isDefaultBrowser && (
            <button onClick={onSetDefaultBrowser} style={primaryPillBtn}>
              Definir Padrão
            </button>
          )}
        </div>

        {/* Onboarding Welcome Wizard Shortcut */}
        {onOpenOnboarding && (
          <div
            style={{
              ...sectionBoxStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Tour de Boas-Vindas & Vínculo Google</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Reabrir o assistente inicial de importação de favoritos e personalização.
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenOnboarding();
              }}
              style={{
                ...primaryPillBtn,
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-hairline)'
              }}
            >
              Abrir Tour
            </button>
          </div>
        )}

        {/* Search Engine Selector */}
        <div style={sectionBoxStyle}>
          <div style={sectionLabelStyle}>MECANISMO DE BUSCA PADRÃO</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((id) => {
              const eng = SEARCH_ENGINES[id];
              const active = settings.searchEngine === id;
              return (
                <button
                  key={id}
                  onClick={() => onUpdateSettings({ searchEngine: id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 13px',
                    borderRadius: 14,
                    background: active ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    color: active ? '#FFF' : 'var(--text-primary)',
                    border: '1px solid var(--border-hairline)',
                    fontSize: 12.5,
                    fontWeight: 600
                  }}
                >
                  <img src={eng.iconAsset} alt="" style={{ width: 15, height: 15 }} />
                  <span>{eng.displayName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Widgets & Minimalism */}
        <div style={sectionBoxStyle}>
          <div style={sectionLabelStyle}>START PAGE & INTELIGÊNCIA ARTIFICIAL</div>
          <ToggleRow
            icon={<Sparkles size={15} style={{ color: settings.tesseraAiEnabled ? 'var(--accent-primary)' : undefined }} />}
            title="Ativar Tessera AI (Assistente inteligente, Resumos e Podcastify)"
            checked={settings.tesseraAiEnabled}
            onChange={(v) => onUpdateSettings({ tesseraAiEnabled: v })}
          />
          <ToggleRow
            icon={<Sun size={15} />}
            title="Modo Minimalismo Digital Zen (Ocultar widgets da Home)"
            checked={settings.digitalMinimalismMode}
            onChange={(v) => onUpdateSettings({ digitalMinimalismMode: v })}
          />
          <ToggleRow
            icon={<Sun size={15} />}
            title="Widget de Clima em Tempo Real"
            checked={settings.showWeatherWidget}
            onChange={(v) => onUpdateSettings({ showWeatherWidget: v })}
          />
          <ToggleRow
            icon={<Sun size={15} />}
            title="Widget de Mercado & Câmbio (USD, EUR, BTC)"
            checked={settings.showQuotesWidget}
            onChange={(v) => onUpdateSettings({ showQuotesWidget: v })}
          />
          <ToggleRow
            icon={<Globe size={15} />}
            title="Recolher AirBar automaticamente ao rolar páginas"
            checked={settings.autoHideAirBar}
            onChange={(v) => onUpdateSettings({ autoHideAirBar: v })}
          />
          <ToggleRow
            icon={<Shield size={15} />}
            title="Sugestões rápidas de IA ao selecionar texto na página"
            checked={settings.aiTextHighlightPrompts}
            onChange={(v) => onUpdateSettings({ aiTextHighlightPrompts: v })}
          />
          <ToggleRow
            icon={<Mic size={15} style={{ color: settings.voiceActivationEnabled ? '#34C759' : undefined }} />}
            title="Ativação por voz contínua ('Ei Tessera' / 'Ok Tessera')"
            checked={settings.voiceActivationEnabled}
            onChange={(v) => onUpdateSettings({ voiceActivationEnabled: v })}
          />
        </div>

        {/* Incognito PIN Protection */}
        <div style={sectionBoxStyle}>
          <div style={sectionLabelStyle}>PROTEÇÃO DO MODO ANÔNIMO (PIN)</div>
          <ToggleRow
            icon={<EyeOff size={15} />}
            title="Exigir PIN ao entrar no Modo Anônimo"
            checked={settings.incognitoPinLockEnabled}
            onChange={(v) => {
              if (!v) {
                onUpdateSettings({ incognitoPinLockEnabled: false, incognitoPinHash: null });
              } else if (settings.incognitoPinHash) {
                onUpdateSettings({ incognitoPinLockEnabled: true });
              }
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="password"
              placeholder="Definir novo PIN (ex: 1234)"
              value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value)}
              style={{ ...inputFieldStyle, flex: 1 }}
            />
            <button
              onClick={async () => {
                if (!pinDraft.trim()) return;
                const hashed = (await window.tesseraApi?.pinHash?.(pinDraft.trim())) || btoa(pinDraft.trim());
                onUpdateSettings({
                  incognitoPinLockEnabled: true,
                  incognitoPinHash: hashed
                });
                setPinDraft('');
              }}
              style={secondaryPillBtn}
            >
              Salvar PIN
            </button>
          </div>
        </div>

        {/* Cross-Platform Android <-> Windows Backup */}
        <div style={sectionBoxStyle}>
          <div style={sectionLabelStyle}>SINCRONIZAÇÃO & BACKUP (COMPATÍVEL COM ANDROID)</div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Exporte ou restaure arquivos <code>tessera_backup_*.json</code> gerados no Tessera Android ou Windows:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={onExportBackup} style={secondaryPillBtn}>
              <FileDown size={14} />
              <span>Exportar Backup JSON</span>
            </button>
            <button onClick={onImportBackup} style={secondaryPillBtn}>
              <Upload size={14} />
              <span>Importar Backup JSON</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenQrBridge();
              }}
              style={primaryPillBtn}
            >
              <QrCode size={14} />
              <span>Sincronizar via Wi-Fi QR</span>
            </button>
          </div>
        </div>

        {/* Sobre o Tessera Browser com Novo Logotipo */}
        <div style={{ ...sectionBoxStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img
            src="./assets/icon.png"
            alt="Tessera Browser Logo"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              objectFit: 'contain',
              flexShrink: 0
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Tessera Browser for Windows</div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--accent-primary)',
                  color: '#FFFFFF'
                }}
              >
                v{systemInfo.appVersion}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Edição Desktop • Motor Chromium com AdBlock nativo & Spaces isolados
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Desenvolvido pelo Tessera Ecosystem • Código aberto sob licença MIT
            </div>
          </div>
        </div>

        {/* Developer Options Card (Tessera Android Style) */}
        <div style={sectionBoxStyle}>
          <div
            onClick={() => setShowDevOptions(!showDevOptions)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(10, 132, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0A84FF'
                }}
              >
                <Code size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Opções do Desenvolvedor</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  {showDevOptions
                    ? 'Ocultar painel de engenharia'
                    : 'Avatar do autor, métricas do motor e flags experimentais'}
                </div>
              </div>
            </div>
            <button
              type="button"
              style={{
                ...secondaryPillBtn,
                padding: '4px 12px',
                fontSize: 11.5
              }}
            >
              {showDevOptions ? 'Recolher' : 'Abrir'}
            </button>
          </div>

          {showDevOptions && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid var(--border-hairline)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14
              }}
            >
              {/* Developer Avatar Floating Showcase */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 14,
                  borderRadius: 16,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-hairline)'
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 64,
                    height: 64,
                    flexShrink: 0
                  }}
                >
                  <img
                    src="./assets/ic_developer_avatar.png"
                    alt="Developer Avatar"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      border: '2px solid var(--border-hairline)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                      objectFit: 'cover'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#34C759',
                      border: '2px solid var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFF',
                      fontSize: 10
                    }}
                  >
                    ✓
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Sobre o Desenvolvedor</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Criado com foco em privacidade radical, design editorial e desempenho nativo no Windows.
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Arquiteto: <b>Kennedy Oliveira (beyonder96)</b> • Tessera Ecosystem
                  </div>
                </div>
              </div>

              {/* Technical System Specs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  fontSize: 11.5
                }}
              >
                <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-elevated)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Motor Chromium:</span>{' '}
                  <b>{systemInfo.chromeVersion}</b>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-elevated)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Electron Runtime:</span>{' '}
                  <b>v{systemInfo.electronVersion}</b>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-elevated)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Node.js:</span>{' '}
                  <b>v{systemInfo.nodeVersion}</b>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-elevated)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Arquitetura:</span>{' '}
                  <b>{systemInfo.arch}</b>
                </div>
              </div>

              {/* Real Official Update Checker Card */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} className={updateCheckStatus === 'checking' ? 'spin' : ''} />
                    <span>Atualizações do Tessera</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {updateCheckStatus === 'checking' && 'Consultando GitHub Releases e servidores oficiais...'}
                    {updateCheckStatus === 'up-to-date' &&
                      `✓ Seu navegador está na versão mais recente (v${systemInfo.appVersion})`}
                    {updateCheckStatus === 'update-available' &&
                      `▲ Nova versão v${updateDetails?.latestVersion} pronta no GitHub!`}
                    {updateCheckStatus === 'error' &&
                      `Erro: ${updateDetails?.error || 'Não foi possível verificar agora'}`}
                    {updateCheckStatus === 'idle' &&
                      `Canal estável oficial (GitHub: beyonder96/Tessera-Browser-Windows)`}
                  </div>
                </div>

                {updateCheckStatus === 'update-available' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (updateDetails?.downloadUrl) {
                        window.tesseraApi?.openExternalUrl(updateDetails.downloadUrl);
                      } else {
                        window.tesseraApi?.quitAndInstallUpdate();
                      }
                    }}
                    style={{
                      ...primaryPillBtn,
                      fontSize: 11.5,
                      padding: '6px 14px',
                      background: '#34C759',
                      color: '#FFF'
                    }}
                  >
                    <span>Baixar v{updateDetails?.latestVersion}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={updateCheckStatus === 'checking'}
                    onClick={handleCheckForUpdates}
                    style={{
                      ...secondaryPillBtn,
                      fontSize: 11.5,
                      padding: '6px 14px',
                      opacity: updateCheckStatus === 'checking' ? 0.7 : 1
                    }}
                  >
                    <RefreshCw size={13} className={updateCheckStatus === 'checking' ? 'spin' : ''} />
                    <span>{updateCheckStatus === 'checking' ? 'Verificando...' : 'Verificar Atualizações'}</span>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    const diag = `=== TESSERA BROWSER DIAGNOSTICS ===\nApp: Tessera Browser v${systemInfo.appVersion} (${systemInfo.arch})\nElectron: ${systemInfo.electronVersion}\nChromium: ${systemInfo.chromeVersion}\nNode: ${systemInfo.nodeVersion}\nPacote Instalado: ${systemInfo.isPackaged ? 'Sim (NSIS)' : 'Não (Local/Dev)'}\nTheme: ${settings.isDarkMode ? 'Dark' : 'Light'}\nAdBlock: ${settings.adBlockEnabled}\nSearch: ${settings.searchEngine}\nTimestamp: ${new Date().toISOString()}`;
                    navigator.clipboard.writeText(diag);
                    setCopiedDiagnostics(true);
                    setTimeout(() => setCopiedDiagnostics(false), 2000);
                  }}
                  style={{ ...secondaryPillBtn, fontSize: 11.5 }}
                >
                  <Copy size={13} />
                  <span>{copiedDiagnostics ? 'Diagnóstico Copiado!' : 'Copiar Diagnóstico'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.tesseraApi?.clearBrowsingData) {
                      window.tesseraApi.clearBrowsingData();
                    }
                    setCacheCleared(true);
                    setTimeout(() => setCacheCleared(false), 2000);
                  }}
                  style={{ ...secondaryPillBtn, fontSize: 11.5 }}
                >
                  <Trash2 size={13} />
                  <span>{cacheCleared ? 'Caches Limpos!' : 'Limpar Caches & Cookies'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.tesseraApi?.openExternalUrl) {
                      window.tesseraApi.openExternalUrl('https://github.com/beyonder96/Tessera-Browser-Windows');
                    }
                  }}
                  style={{ ...secondaryPillBtn, fontSize: 11.5 }}
                >
                  <ExternalLink size={13} />
                  <span>Repositório GitHub</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   5. UNIFIED HUB MODAL: FAVORITES, HISTORY, DOWNLOADS, SAVED PAGES
   ============================================================================ */
export const HubModal: React.FC<{
  visible: boolean;
  initialTab: number;
  favorites: SpeedDialItem[];
  history: HistoryEntry[];
  downloads: DownloadItem[];
  savedPages: SavedPageItem[];
  onOpenUrl: (url: string) => void;
  onOpenSavedArticle: (item: SavedPageItem) => void;
  onDeleteFavorite: (id: string) => void;
  onClearHistory: () => void;
  onDeleteSavedPage: (id: string) => void;
  onClose: () => void;
}> = ({
  visible,
  initialTab,
  favorites,
  history,
  downloads,
  savedPages,
  onOpenUrl,
  onOpenSavedArticle,
  onDeleteFavorite,
  onClearHistory,
  onDeleteSavedPage,
  onClose
}) => {
  const [tab, setTab] = useState(initialTab);
  const [filter, setFilter] = useState('');

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab, visible]);

  if (!visible) return null;

  const q = filter.toLowerCase();

  return (
    <div onClick={onClose} style={backdropStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-animate-in"
        style={{
          ...cardModalStyle,
          width: 660,
          height: '76vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { idx: 0, label: `Favoritos (${favorites.length})` },
              { idx: 1, label: `Histórico (${history.length})` },
              { idx: 2, label: `Downloads (${downloads.length})` },
              { idx: 3, label: `Salvos Offline (${savedPages.length})` }
            ].map((t) => (
              <button
                key={t.idx}
                onClick={() => setTab(t.idx)}
                style={{
                  padding: '7px 13px',
                  borderRadius: 999,
                  background: tab === t.idx ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: tab === t.idx ? '#FFF' : 'var(--text-secondary)',
                  fontSize: 12.5,
                  fontWeight: 600
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={closeCircleStyle}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Filtrar itens..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ ...inputFieldStyle, flex: 1 }}
          />
          {tab === 1 && history.length > 0 && (
            <button onClick={onClearHistory} style={{ ...secondaryPillBtn, color: '#FF3B30' }}>
              <Trash2 size={14} />
              <span>Limpar Histórico</span>
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tab === 0 &&
            favorites
              .filter((f) => f.title.toLowerCase().includes(q) || f.url.toLowerCase().includes(q))
              .map((fav) => (
                <div key={fav.id} style={listItemStyle}>
                  <div
                    onClick={() => {
                      onOpenUrl(fav.url);
                      onClose();
                    }}
                    style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{fav.title}</div>
                    <div style={subUrlStyle}>{fav.url}</div>
                  </div>
                  <button
                    onClick={() => onDeleteFavorite(fav.id)}
                    style={{ color: 'var(--text-tertiary)', padding: 6 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

          {tab === 1 &&
            history
              .filter((h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q))
              .map((h) => (
                <div
                  key={h.id}
                  onClick={() => {
                    onOpenUrl(h.url);
                    onClose();
                  }}
                  style={{ ...listItemStyle, cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{h.title || h.url}</div>
                    <div style={subUrlStyle}>{h.url}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {new Date(h.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}

          {tab === 2 &&
            downloads
              .filter((d) => d.fileName.toLowerCase().includes(q))
              .map((d) => (
                <div key={d.id} style={listItemStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{d.fileName}</div>
                    <div style={subUrlStyle}>
                      {d.status === 'COMPLETED'
                        ? `Concluído • ${(d.receivedBytes / (1024 * 1024)).toFixed(2)} MB`
                        : d.status}
                    </div>
                  </div>
                  {d.status === 'COMPLETED' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => window.tesseraApi.openDownloadedFile(d.savePath)}
                        style={secondaryPillBtn}
                      >
                        Abrir
                      </button>
                      <button
                        title="Mostrar no Explorer"
                        onClick={() => window.tesseraApi.showDownloadedInFolder(d.savePath)}
                        style={secondaryPillBtn}
                      >
                        <FolderOpen size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

          {tab === 3 &&
            savedPages
              .filter((s) => s.title.toLowerCase().includes(q))
              .map((s) => (
                <div key={s.id} style={listItemStyle}>
                  <div
                    onClick={() => {
                      onOpenSavedArticle(s);
                      onClose();
                    }}
                    style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.title}</div>
                    <div style={subUrlStyle}>
                      {s.domain} • {s.article.readingTimeMinutes} min de leitura offline
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteSavedPage(s.id)}
                    style={{ color: 'var(--text-tertiary)', padding: 6 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   6. PRIVACY DASHBOARD & SITE SETTINGS MODALS
   ============================================================================ */
export const PrivacyDashboardModal: React.FC<{
  visible: boolean;
  privacy: PrivacyDashboardState;
  adBlockEnabled: boolean;
  onToggleAdBlock: (v: boolean) => void;
  onClose: () => void;
}> = ({ visible, privacy, adBlockEnabled, onToggleAdBlock, onClose }) => {
  if (!visible) return null;

  const mbSaved = (privacy.estimatedBytesSaved / (1024 * 1024)).toFixed(2);
  const secSaved = (privacy.estimatedTimeSavedMs / 1000).toFixed(1);

  return (
    <div onClick={onClose} style={backdropStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-animate-in"
        style={{ ...cardModalStyle, width: 520, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} style={{ color: '#34C759' }} />
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>Escudo de Privacidade Tessera</h3>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Interceptação em tempo real na camada de rede do Chromium
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeCircleStyle}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="Bloqueados" value={privacy.totalBlockedCount.toLocaleString('pt-BR')} color="#34C759" />
          <StatCard label="Dados Salvos" value={`${mbSaved} MB`} color="#0A84FF" />
          <StatCard label="Tempo Salvo" value={`${secSaved} s`} color="#FF9500" />
        </div>

        <div style={sectionBoxStyle}>
          <ToggleRow
            icon={<Shield size={15} style={{ color: '#34C759' }} />}
            title="Proteção Ativa contra Anúncios e Rastreadores"
            checked={adBlockEnabled}
            onChange={onToggleAdBlock}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, fontSize: 12 }}>
            <div>Anúncios: <b>{privacy.byCategory.ADVERTISING}</b></div>
            <div>Analytics: <b>{privacy.byCategory.ANALYTICS}</b></div>
            <div>Social Pixels: <b>{privacy.byCategory.SOCIAL}</b></div>
            <div>Fingerprinting: <b>{privacy.byCategory.FINGERPRINTING}</b></div>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          RASTREADORES INTERCEPTADOS RECENTEMENTE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {privacy.recentTrackers.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: 12 }}>
              Nenhum rastreador detectado nesta sessão ainda.
            </div>
          ) : (
            privacy.recentTrackers.slice(0, 15).map((t) => (
              <div key={t.id} style={listItemStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {t.host} • em {t.pageOrigin}
                  </div>
                </div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'rgba(52, 199, 89, 0.16)',
                    color: '#34C759',
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {t.count}x
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const SiteSettingsModal: React.FC<{
  visible: boolean;
  origin: string;
  config: SiteSettings;
  onUpdate: (next: SiteSettings) => void;
  onClose: () => void;
}> = ({ visible, origin, config, onUpdate, onClose }) => {
  if (!visible || !origin) return null;

  return (
    <div onClick={onClose} style={backdropStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-animate-in"
        style={{ ...cardModalStyle, width: 410 }}
      >
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Permissões do Site</h3>
            <p style={{ fontSize: 12, color: 'var(--accent-primary)' }}>{origin}</p>
          </div>
          <button onClick={onClose} style={closeCircleStyle}>
            <X size={16} />
          </button>
        </div>

        <div style={sectionBoxStyle}>
          <ToggleRow
            icon={<Shield size={15} />}
            title="Pausar AdBlock neste site (Lista Branca)"
            checked={config.adBlockWhitelisted}
            onChange={(v) => onUpdate({ ...config, adBlockWhitelisted: v })}
          />
          <ToggleRow
            icon={<Globe size={15} />}
            title="Permitir Câmera"
            checked={config.cameraAllowed}
            onChange={(v) => onUpdate({ ...config, cameraAllowed: v })}
          />
          <ToggleRow
            icon={<Volume2 size={15} />}
            title="Permitir Microfone"
            checked={config.microphoneAllowed}
            onChange={(v) => onUpdate({ ...config, microphoneAllowed: v })}
          />
          <ToggleRow
            icon={<Globe size={15} />}
            title="Permitir Localização"
            checked={config.geolocationAllowed}
            onChange={(v) => onUpdate({ ...config, geolocationAllowed: v })}
          />
          <ToggleRow
            icon={<Globe size={15} />}
            title="Permitir Notificações"
            checked={config.notificationsAllowed}
            onChange={(v) => onUpdate({ ...config, notificationsAllowed: v })}
          />
          <ToggleRow
            icon={<ExternalLink size={15} />}
            title="Permitir Janelas Pop-up & Diálogos"
            checked={config.popupsAllowed}
            onChange={(v) => onUpdate({ ...config, popupsAllowed: v })}
          />
        </div>
      </div>
    </div>
  );
};

/* Apple Glassmorphism Toggle Switch (Cupertino) */
export const CupertinoGlassToggle: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onChange(!checked);
    }}
    style={{
      width: 44,
      height: 24,
      borderRadius: 999,
      background: checked
        ? 'linear-gradient(135deg, #34C759 0%, #28CD41 100%)'
        : 'rgba(255, 255, 255, 0.14)',
      boxShadow: checked
        ? '0 0 14px rgba(52, 199, 89, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
        : 'inset 0 1px 3px rgba(0, 0, 0, 0.3)',
      border: checked ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.18)',
      position: 'relative',
      cursor: disabled ? 'not-allowed' : 'pointer',
      padding: 2,
      transition: 'background 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease',
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0
    }}
  >
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#FFFFFF',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.38)',
        transform: checked ? 'translateX(20px)' : 'translateX(1px)',
        transition: 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    />
  </button>
);

/* Helpers */
const ToggleRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ icon, title, checked, onChange }) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 2px',
      cursor: 'pointer',
      fontSize: 13,
      userSelect: 'none'
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>{icon}</span>
      <span>{title}</span>
    </div>
    <CupertinoGlassToggle checked={checked} onChange={onChange} />
  </div>
);

const ActionTile: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({
  icon,
  label,
  onClick
}) => (
  <button
    onClick={onClick}
    className="squircle-press"
    style={{
      padding: '11px 8px',
      borderRadius: 15,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-hairline)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      fontWeight: 600
    }}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const StatCard: React.FC<{ label: string; value: string; color: string }> = ({
  label,
  value,
  color
}) => (
  <div
    style={{
      padding: '14px 12px',
      borderRadius: 18,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-hairline)',
      textAlign: 'center'
    }}
  >
    <div style={{ fontSize: 19, fontWeight: 700, color, marginBottom: 3 }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
  </div>
);

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 190,
  background: 'var(--modal-backdrop)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20
};

const cardModalStyle: React.CSSProperties = {
  maxWidth: 'calc(100vw - 32px)',
  padding: 22,
  borderRadius: 26,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-hairline)',
  boxShadow: 'var(--shadow-floating)'
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16
};

const closeCircleStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: 'var(--bg-elevated)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const sectionBoxStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 18,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-hairline)',
  marginBottom: 12
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 1,
  color: 'var(--text-tertiary)',
  marginBottom: 6
};

const inputFieldStyle: React.CSSProperties = {
  padding: '9px 13px',
  borderRadius: 12,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-hairline)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none'
};

const primaryPillBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 999,
  background: 'var(--accent-primary)',
  color: '#FFFFFF',
  fontSize: 12.5,
  fontWeight: 600
};

const secondaryPillBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 13px',
  borderRadius: 999,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-hairline)',
  color: 'var(--text-primary)',
  fontSize: 12.5,
  fontWeight: 600
};

const listItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 14,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-hairline)'
};

const subUrlStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--text-tertiary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};
