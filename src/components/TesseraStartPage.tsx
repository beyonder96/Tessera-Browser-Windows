import React, { useRef, useState } from 'react';
import {
  Shield,
  Sun,
  CloudSun,
  Plus,
  Trash2,
  Sparkles,
  QrCode,
  SlidersHorizontal,
  RefreshCw,
  TrendingUp,
  Search,
  Star,
  ChevronDown
} from 'lucide-react';
import type {
  BrowserSettings,
  BrowserSpace,
  BrowserTab,
  QuotesData,
  SpeedDialItem,
  WeatherData
} from '../shared/types';
import { AVAILABLE_WALLPAPERS, TRENDING_TOPICS } from '../shared/wallpapers';
import { extractCleanHost } from '../shared/searchEngines';
import { SafariSpacesPopover, SafariFavoritesPopover } from './SafariPopovers';

interface TesseraStartPageProps {
  settings: BrowserSettings;
  activeSpace: BrowserSpace;
  spaces: BrowserSpace[];
  tabs: BrowserTab[];
  isIncognito: boolean;
  favorites: SpeedDialItem[];
  weatherData: WeatherData | null;
  quotesData: QuotesData | null;
  totalBlockedCount: number;
  estimatedBytesSaved: number;
  onFocusAirBarSearch: () => void;
  onOpenUrl: (url: string) => void;
  onAddFavorite: (title: string, url: string) => void;
  onDeleteFavorite: (id: string) => void;
  onSelectSpace: (spaceId: string) => void;
  onToggleIncognito: () => void;
  onOpenSpaces: () => void;
  onOpenFavoritesHub?: () => void;
  onOpenPrivacyDashboard: () => void;
  onOpenAiAssistant: () => void;
  onOpenQrBridge: () => void;
  onOpenQuickSettings: () => void;
  onRefreshWeather: () => void;
}

export const TesseraStartPage: React.FC<TesseraStartPageProps> = ({
  settings,
  activeSpace,
  spaces,
  tabs,
  isIncognito,
  favorites,
  weatherData,
  quotesData,
  totalBlockedCount,
  estimatedBytesSaved,
  onFocusAirBarSearch,
  onOpenUrl,
  onAddFavorite,
  onDeleteFavorite,
  onSelectSpace,
  onToggleIncognito,
  onOpenSpaces,
  onOpenFavoritesHub,
  onOpenPrivacyDashboard,
  onOpenAiAssistant,
  onOpenQrBridge,
  onOpenQuickSettings,
  onRefreshWeather
}) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [hoveredFavId, setHoveredFavId] = useState<string | null>(null);
  const [spacesPopoverOpen, setSpacesPopoverOpen] = useState(false);
  const [favPopoverOpen, setFavPopoverOpen] = useState(false);
  const spaceHoverTimerRef = useRef<number | null>(null);
  const favHoverTimerRef = useRef<number | null>(null);

  const handleSpaceMouseEnter = () => {
    if (spaceHoverTimerRef.current) clearTimeout(spaceHoverTimerRef.current);
    spaceHoverTimerRef.current = window.setTimeout(() => {
      setSpacesPopoverOpen(true);
      setFavPopoverOpen(false);
    }, 120);
  };

  const handleSpaceMouseLeave = () => {
    if (spaceHoverTimerRef.current) clearTimeout(spaceHoverTimerRef.current);
    spaceHoverTimerRef.current = window.setTimeout(() => {
      setSpacesPopoverOpen(false);
    }, 180);
  };

  const handleFavMouseEnter = () => {
    if (favHoverTimerRef.current) clearTimeout(favHoverTimerRef.current);
    favHoverTimerRef.current = window.setTimeout(() => {
      setFavPopoverOpen(true);
      setSpacesPopoverOpen(false);
    }, 120);
  };

  const handleFavMouseLeave = () => {
    if (favHoverTimerRef.current) clearTimeout(favHoverTimerRef.current);
    favHoverTimerRef.current = window.setTimeout(() => {
      setFavPopoverOpen(false);
    }, 180);
  };

  const activeWallpaper =
    AVAILABLE_WALLPAPERS.find((w) => w.id === settings.selectedWallpaperId) || AVAILABLE_WALLPAPERS[0];

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';

  const mbSaved = (estimatedBytesSaved / (1024 * 1024)).toFixed(1);

  const backgroundStyle: React.CSSProperties =
    settings.showWallpaper && !isIncognito
      ? settings.customWallpaperDataUrl
        ? {
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.72) 100%), url("${settings.customWallpaperDataUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }
        : activeWallpaper.imageUrl
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.72) 100%), url("${activeWallpaper.imageUrl}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }
          : { background: activeWallpaper.cssGradient }
      : { background: 'var(--bg-canvas)' };

  const forceLightTextOnWallpaper = settings.showWallpaper && !isIncognito;

  const handleSaveShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const formattedUrl = /^https?:\/\//i.test(newUrl.trim()) ? newUrl.trim() : `https://${newUrl.trim()}`;
    const title = newTitle.trim() || extractCleanHost(formattedUrl);
    onAddFavorite(title, formattedUrl);
    setNewTitle('');
    setNewUrl('');
    setShowAddDialog(false);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '38px 28px 130px',
        ...backgroundStyle
      }}
    >
      {/* Top Cupertino Header Bar: Space Capsule + Quick Actions */}
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 42
        }}
      >
        {/* Top Left Cupertino Group: Space Pill + Companion Favorites Pill (Safari Popovers) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          {/* 1. Space Pill com Hover Popover Safari */}
          <div
            onMouseEnter={handleSpaceMouseEnter}
            onMouseLeave={handleSpaceMouseLeave}
            style={{ position: 'relative' }}
          >
            <button
              onClick={() => setSpacesPopoverOpen((v) => !v)}
              className="squircle-press"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 15px',
                borderRadius: 999,
                background: 'var(--bg-surface)',
                border: `1px solid ${isIncognito ? 'rgba(191,90,242,0.5)' : 'var(--border-hairline)'}`,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: 15 }}>{isIncognito ? '🕶️' : activeSpace.iconEmoji}</span>
              <span>{isIncognito ? 'Espaço Anônimo' : activeSpace.name}</span>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: isIncognito ? '#AF52DE' : activeSpace.colorHex
                }}
              />
            </button>

            {spacesPopoverOpen && (
              <SafariSpacesPopover
                spaces={spaces}
                activeSpaceId={activeSpace.id}
                tabs={tabs}
                isIncognito={isIncognito}
                onSelectSpace={(id) => {
                  onSelectSpace(id);
                  setSpacesPopoverOpen(false);
                }}
                onToggleIncognito={onToggleIncognito}
                onOpenNewSpaceDialog={onOpenSpaces}
                onClose={() => setSpacesPopoverOpen(false)}
              />
            )}
          </div>

          {/* 2. Nova Chave de Favoritos ao Lado com Hover Popover Safari */}
          <div
            onMouseEnter={handleFavMouseEnter}
            onMouseLeave={handleFavMouseLeave}
            style={{ position: 'relative' }}
          >
            <button
              onClick={() => setFavPopoverOpen((v) => !v)}
              className="squircle-press"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 14px',
                borderRadius: 999,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Star size={14} style={{ color: '#FF9500' }} />
              <span>Favoritos</span>
              <ChevronDown size={12} style={{ opacity: 0.6 }} />
            </button>

            {favPopoverOpen && (
              <SafariFavoritesPopover
                favorites={favorites}
                onOpenUrl={(url) => {
                  onOpenUrl(url);
                  setFavPopoverOpen(false);
                }}
                onAddFavorite={() => setShowAddDialog(true)}
                onOpenFullHub={onOpenFavoritesHub}
                onClose={() => setFavPopoverOpen(false)}
              />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onOpenQrBridge}
            className="squircle-press"
            title="Ponte Tessera Android ↔ Windows (QR Code)"
            style={headerPillStyle}
          >
            <QrCode size={15} />
            <span>Ponte Android</span>
          </button>
          {settings.tesseraAiEnabled && (
            <button
              onClick={onOpenAiAssistant}
              className="squircle-press"
              title="Tessera Intelligence (Alt+A)"
              style={headerPillStyle}
            >
              <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
              <span>Tessera AI</span>
            </button>
          )}
          <button
            onClick={onOpenQuickSettings}
            className="squircle-press"
            title="Configuração Fácil"
            style={{ ...headerPillStyle, padding: '7px 11px' }}
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* Editorial Hero Wordmark & Greeting — Estilizado fiel ao app mobile Android */}
      <div style={{ textAlign: 'center', marginBottom: 38, maxWidth: 680, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: 2.2,
            textTransform: 'uppercase',
            color: forceLightTextOnWallpaper ? 'rgba(255,255,255,0.78)' : 'var(--text-tertiary)',
            marginBottom: 12
          }}
        >
          {isIncognito ? 'Navegação Privada sem Rastros' : `${greeting} • Edição Desktop`}
        </div>
        <img
          src="./assets/ic_tessera_header_logo.png"
          alt="Tessera"
          style={{
            height: 44,
            objectFit: 'contain',
            filter: forceLightTextOnWallpaper || settings.isDarkMode
              ? 'brightness(0) invert(1)'
              : 'brightness(0) opacity(0.88)',
            userSelect: 'none'
          }}
        />
      </div>

      {/* Safari Squircle Speed Dial Grid */}
      <div
        style={{
          width: '100%',
          maxWidth: 740,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 16,
          marginBottom: 34
        }}
      >
        {favorites.map((fav) => {
          const firstLetter = (fav.title || 'T').trim().charAt(0).toUpperCase();
          return (
            <div
              key={fav.id}
              onMouseEnter={() => setHoveredFavId(fav.id)}
              onMouseLeave={() => setHoveredFavId(null)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8
              }}
            >
              <button
                onClick={() => onOpenUrl(fav.url)}
                className="squircle-press"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
                }}
              >
                {fav.iconAsset ? (
                  <img
                    src={fav.iconAsset}
                    alt={fav.title}
                    style={{ width: 30, height: 30, objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 11,
                      background: fav.badgeColorHex || '#0A84FF',
                      color: '#FFF',
                      fontWeight: 700,
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {firstLetter}
                  </div>
                )}
              </button>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  maxWidth: 92,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: forceLightTextOnWallpaper ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                {fav.title}
              </span>

              {hoveredFavId === fav.id && (
                <button
                  title="Remover atalho"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFavorite(fav.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: 10,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-hairline)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Custom Shortcut Squircle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowAddDialog(true)}
            className="squircle-press"
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-hairline)',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Plus size={22} />
          </button>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: forceLightTextOnWallpaper ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)'
            }}
          >
            Adicionar
          </span>
        </div>
      </div>

      {/* WidgetKit Editorial Cards (Privacy Shield + Optional Weather + Optional Quotes) */}
      {!settings.digitalMinimalismMode && (
        <div
          style={{
            width: '100%',
            maxWidth: 820,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
            gap: 14,
            marginBottom: 24
          }}
        >
          {/* Privacy Shield Card */}
          <button
            onClick={onOpenPrivacyDashboard}
            className="squircle-press"
            style={{
              textAlign: 'left',
              padding: '16px 18px',
              borderRadius: 22,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#34C759', letterSpacing: 0.5 }}>
                ESCUDO DE PRIVACIDADE
              </span>
              <Shield size={16} style={{ color: '#34C759' }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              {totalBlockedCount.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              rastreadores bloqueados • {mbSaved} MB salvos
            </div>
          </button>

          {/* Weather Widget */}
          {settings.showWeatherWidget && weatherData && (
            <div
              style={{
                padding: '16px 18px',
                borderRadius: 22,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0A84FF', letterSpacing: 0.5 }}>
                  {weatherData.cityName.toUpperCase()}
                </span>
                <button
                  onClick={onRefreshWeather}
                  title="Atualizar clima"
                  style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {weatherData.isDay ? <Sun size={15} style={{ color: '#FFCC00' }} /> : <CloudSun size={15} />}
                  <RefreshCw size={12} />
                </button>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                {weatherData.temperature}°C
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {weatherData.conditionText} • Umidade {weatherData.humidity}%
              </div>
            </div>
          )}

          {/* Currency & Crypto Quotes Widget (USD / EUR / BTC) */}
          {settings.showQuotesWidget && quotesData && (
            <div
              style={{
                padding: '16px 18px',
                borderRadius: 22,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#FF9500', letterSpacing: 0.5 }}>
                  MERCADO & CÂMBIO
                </span>
                <TrendingUp size={15} style={{ color: '#FF9500' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {quotesData.items.map((q) => (
                  <div
                    key={q.symbol}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}
                  >
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{q.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{q.value}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: q.isPositive ? '#34C759' : '#FF3B30'
                        }}
                      >
                        {q.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtle Trending Discovery Chips */}
      {!settings.digitalMinimalismMode && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            maxWidth: 740
          }}
        >
          {TRENDING_TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => onOpenUrl(topic)}
              className="squircle-press"
              style={{
                padding: '6px 13px',
                borderRadius: 999,
                fontSize: 12,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)',
                color: 'var(--text-secondary)'
              }}
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      {/* Add Shortcut Modal (AddShortcutDialog.kt equivalent) */}
      {showAddDialog && (
        <div
          onClick={() => setShowAddDialog(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-backdrop)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveShortcut}
            className="modal-animate-in"
            style={{
              width: 380,
              padding: 24,
              borderRadius: 24,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              boxShadow: 'var(--shadow-floating)'
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Novo Atalho Rápido</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              <input
                type="text"
                placeholder="Nome do site (ex: YouTube)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={dialogInputStyle}
              />
              <input
                type="text"
                placeholder="Endereço URL (ex: youtube.com)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                autoFocus
                required
                style={dialogInputStyle}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowAddDialog(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 999,
                  background: 'var(--bg-elevated)',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  padding: '9px 18px',
                  borderRadius: 999,
                  background: 'var(--accent-primary)',
                  color: '#FFF',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const headerPillStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 13px',
  borderRadius: 999,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-hairline)',
  fontSize: 12.5,
  fontWeight: 600
};

const dialogInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 14,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-hairline)',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none'
};
