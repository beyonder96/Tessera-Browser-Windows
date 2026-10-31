import React, { useState } from 'react';
import {
  ArrowLeft,
  Headphones,
  Sparkles,
  Highlighter,
  Type,
  Image as ImageIcon,
  FileDown,
  BookmarkPlus,
  Copy,
  Check,
  Trash2
} from 'lucide-react';
import type {
  BrowserSettings,
  ReaderArticle,
  ReaderFontFamily,
  ReaderTheme
} from '../shared/types';

interface TesseraReaderScreenProps {
  article: ReaderArticle;
  settings: BrowserSettings;
  highlights: Record<number, string>;
  onClose: () => void;
  onUpdateSettings: (partial: Partial<BrowserSettings>) => void;
  onToggleHighlight: (blockIndex: number, color: string) => void;
  onClearHighlights: () => void;
  onListenPodcast: () => void;
  onSummarizeAi: () => void;
  onSaveOffline: () => void;
  onExportPdf: () => void;
}

const HIGHLIGHT_COLORS = [
  { hex: '#FEF08A', label: 'Amarelo' },
  { hex: '#BBF7D0', label: 'Verde' },
  { hex: '#BAE6FD', label: 'Azul' },
  { hex: '#FBCFE8', label: 'Rosa' }
];

const THEME_PALETTES: Record<
  ReaderTheme,
  { bg: string; sheet: string; text: string; secondary: string; border: string }
> = {
  LIGHT: {
    bg: '#F7F4EB',
    sheet: '#FDFBF5',
    text: '#18181A',
    secondary: '#57534E',
    border: '#DDD8CB'
  },
  SEPIA: {
    bg: '#EFE4CE',
    sheet: '#F6EEDC',
    text: '#2B2118',
    secondary: '#6B5847',
    border: '#DFCFAE'
  },
  DARK: {
    bg: '#121214',
    sheet: '#18181C',
    text: '#ECEAE2',
    secondary: '#A1A1AA',
    border: '#2C2C32'
  },
  AMOLED: {
    bg: '#000000',
    sheet: '#08080A',
    text: '#F4F4F6',
    secondary: '#8E8E93',
    border: '#1F1F24'
  }
};

export const TesseraReaderScreen: React.FC<TesseraReaderScreenProps> = ({
  article,
  settings,
  highlights,
  onClose,
  onUpdateSettings,
  onToggleHighlight,
  onClearHighlights,
  onListenPodcast,
  onSummarizeAi,
  onSaveOffline,
  onExportPdf
}) => {
  const [showAppearancePopover, setShowAppearancePopover] = useState(false);
  const [highlighterMode, setHighlighterMode] = useState(false);
  const [activeColor, setActiveColor] = useState('#FEF08A');
  const [copied, setCopied] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const palette = THEME_PALETTES[settings.readerTheme] || THEME_PALETTES.SEPIA;
  const fontFamilyCss =
    settings.readerFontFamily === 'SERIF'
      ? 'var(--font-serif)'
      : settings.readerFontFamily === 'MONOSPACE'
        ? 'var(--font-mono)'
        : 'var(--font-sans)';

  const handleCopyText = () => {
    void navigator.clipboard.writeText(`${article.title}\n\n${article.plainText}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 85,
        background: palette.bg,
        color: palette.text,
        overflowY: 'auto',
        padding: '32px 24px 128px'
      }}
    >
      {/* Floating Top Editorial Toolbar */}
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto 28px',
          padding: '10px 14px',
          borderRadius: 20,
          background: palette.sheet,
          border: `1px solid ${palette.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          position: 'sticky',
          top: 8,
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              background: palette.bg,
              border: `1px solid ${palette.border}`,
              color: palette.text,
              fontSize: 12.5,
              fontWeight: 600
            }}
          >
            <ArrowLeft size={15} />
            <span>Sair da Leitura</span>
          </button>
          <span style={{ fontSize: 12, color: palette.secondary }}>
            {article.domain} • {article.readingTimeMinutes} min de leitura
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onListenPodcast}
            title="Ouvir artigo com Podcastify"
            style={readerToolBtn(palette, false)}
          >
            <Headphones size={15} />
            <span>Ouvir</span>
          </button>

          <button
            onClick={onSummarizeAi}
            title="Resumir com Tessera AI"
            style={readerToolBtn(palette, false)}
          >
            <Sparkles size={15} style={{ color: '#0A84FF' }} />
            <span>Resumir IA</span>
          </button>

          <button
            onClick={() => setHighlighterMode((v) => !v)}
            title="Marca-texto nos parágrafos"
            style={readerToolBtn(palette, highlighterMode)}
          >
            <Highlighter size={15} />
          </button>

          <button
            onClick={() => setShowAppearancePopover((v) => !v)}
            title="Tipografia e Tema"
            style={readerToolBtn(palette, showAppearancePopover)}
          >
            <Type size={15} />
          </button>

          <button
            onClick={() => {
              onSaveOffline();
              setSavedToast(true);
              setTimeout(() => setSavedToast(false), 1800);
            }}
            title="Salvar página para leitura offline"
            style={readerToolBtn(palette, savedToast)}
          >
            {savedToast ? <Check size={15} /> : <BookmarkPlus size={15} />}
          </button>

          <button onClick={handleCopyText} title="Copiar texto limpo" style={readerToolBtn(palette, copied)}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>

          <button onClick={onExportPdf} title="Exportar para PDF" style={readerToolBtn(palette, false)}>
            <FileDown size={15} />
          </button>
        </div>
      </div>

      {/* Highlighter Color Strip */}
      {highlighterMode && (
        <div
          style={{
            maxWidth: 760,
            margin: '-14px auto 22px',
            padding: '10px 16px',
            borderRadius: 16,
            background: palette.sheet,
            border: `1px solid ${palette.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>
              Clique em qualquer parágrafo para destacar:
            </span>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.hex}
                title={c.label}
                onClick={() => setActiveColor(c.hex)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: c.hex,
                  border: activeColor === c.hex ? '2px solid #0A84FF' : '1px solid rgba(0,0,0,0.2)'
                }}
              />
            ))}
          </div>
          {Object.keys(highlights).length > 0 && (
            <button
              onClick={onClearHighlights}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: '#FF3B30'
              }}
            >
              <Trash2 size={13} />
              <span>Limpar destaques</span>
            </button>
          )}
        </div>
      )}

      {/* Typography & Theme Popover */}
      {showAppearancePopover && (
        <div
          style={{
            maxWidth: 760,
            margin: '-14px auto 22px',
            padding: 16,
            borderRadius: 18,
            background: palette.sheet,
            border: `1px solid ${palette.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          {/* Themes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(
              [
                { id: 'LIGHT', label: 'Jornal', bg: '#F7F4EB', fg: '#18181A' },
                { id: 'SEPIA', label: 'Sépia', bg: '#EFE4CE', fg: '#2B2118' },
                { id: 'DARK', label: 'Escuro', bg: '#18181C', fg: '#ECEAE2' },
                { id: 'AMOLED', label: 'OLED', bg: '#000000', fg: '#FFFFFF' }
              ] as Array<{ id: ReaderTheme; label: string; bg: string; fg: string }>
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => onUpdateSettings({ readerTheme: t.id })}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: t.bg,
                  color: t.fg,
                  border:
                    settings.readerTheme === t.id
                      ? '2px solid #0A84FF'
                      : `1px solid ${palette.border}`,
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Fonts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(
              [
                { id: 'SERIF', label: 'Editorial Serif' },
                { id: 'SANS_SERIF', label: 'Sans' },
                { id: 'MONOSPACE', label: 'Mono' }
              ] as Array<{ id: ReaderFontFamily; label: string }>
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => onUpdateSettings({ readerFontFamily: f.id })}
                style={{
                  padding: '6px 11px',
                  borderRadius: 10,
                  background: settings.readerFontFamily === f.id ? '#0A84FF' : palette.bg,
                  color: settings.readerFontFamily === f.id ? '#FFF' : palette.text,
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Font size & images */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() =>
                onUpdateSettings({ readerFontSizePx: Math.max(15, settings.readerFontSizePx - 1) })
              }
              style={readerToolBtn(palette, false)}
            >
              A-
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{settings.readerFontSizePx}px</span>
            <button
              onClick={() =>
                onUpdateSettings({ readerFontSizePx: Math.min(28, settings.readerFontSizePx + 1) })
              }
              style={readerToolBtn(palette, false)}
            >
              A+
            </button>
            <button
              onClick={() => onUpdateSettings({ readerShowImages: !settings.readerShowImages })}
              title="Mostrar/Ocultar imagens do artigo"
              style={readerToolBtn(palette, settings.readerShowImages)}
            >
              <ImageIcon size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Editorial Article Sheet */}
      <article
        className="selectable-text"
        style={{
          maxWidth: 740,
          margin: '0 auto',
          padding: '44px 48px',
          borderRadius: 26,
          background: palette.sheet,
          border: `1px solid ${palette.border}`,
          fontFamily: fontFamilyCss
        }}
      >
        <header style={{ marginBottom: 30, borderBottom: `1px solid ${palette.border}`, paddingBottom: 22 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: '#0A84FF',
              marginBottom: 10,
              fontFamily: 'var(--font-sans)'
            }}
          >
            {article.domain}
          </div>
          <h1
            style={{
              fontSize: Math.round(settings.readerFontSizePx * 1.75),
              lineHeight: 1.25,
              fontWeight: 700,
              marginBottom: 12
            }}
          >
            {article.title}
          </h1>
          {(article.author || article.publishDate) && (
            <div style={{ fontSize: 13.5, color: palette.secondary, fontFamily: 'var(--font-sans)' }}>
              {[article.author, article.publishDate].filter(Boolean).join(' • ')}
            </div>
          )}
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {article.blocks.map((block, idx) => {
            const hlColor = highlights[idx];
            const clickableProps = highlighterMode
              ? {
                  onClick: () => onToggleHighlight(idx, activeColor),
                  style: { cursor: 'pointer' }
                }
              : {};

            if (block.type === 'IMAGE') {
              if (!settings.readerShowImages || !block.imageUrl) return null;
              return (
                <figure key={idx} style={{ margin: '10px 0' }}>
                  <img
                    src={block.imageUrl}
                    alt={block.caption || ''}
                    style={{
                      width: '100%',
                      maxHeight: 440,
                      objectFit: 'contain',
                      borderRadius: 16,
                      background: palette.bg
                    }}
                  />
                  {block.caption && (
                    <figcaption
                      style={{
                        fontSize: 12.5,
                        color: palette.secondary,
                        textAlign: 'center',
                        marginTop: 8
                      }}
                    >
                      {block.caption}
                    </figcaption>
                  )}
                </figure>
              );
            }

            if (block.type === 'H1' || block.type === 'H2' || block.type === 'H3') {
              const mult = block.type === 'H1' ? 1.45 : block.type === 'H2' ? 1.3 : 1.15;
              return (
                <h2
                  key={idx}
                  {...clickableProps}
                  style={{
                    fontSize: Math.round(settings.readerFontSizePx * mult),
                    fontWeight: 700,
                    marginTop: 14,
                    lineHeight: 1.35,
                    background: hlColor ? `${hlColor}55` : 'transparent',
                    borderRadius: 8,
                    padding: hlColor ? '4px 8px' : 0,
                    cursor: highlighterMode ? 'pointer' : 'text'
                  }}
                >
                  {block.text}
                </h2>
              );
            }

            if (block.type === 'BLOCKQUOTE') {
              return (
                <blockquote
                  key={idx}
                  {...clickableProps}
                  style={{
                    borderLeft: '3px solid #0A84FF',
                    paddingLeft: 18,
                    fontStyle: 'italic',
                    color: palette.secondary,
                    fontSize: settings.readerFontSizePx,
                    lineHeight: 1.7
                  }}
                >
                  {block.text}
                </blockquote>
              );
            }

            return (
              <p
                key={idx}
                onClick={highlighterMode ? () => onToggleHighlight(idx, activeColor) : undefined}
                style={{
                  fontSize: settings.readerFontSizePx,
                  lineHeight: 1.76,
                  background: hlColor
                    ? settings.readerTheme === 'DARK' || settings.readerTheme === 'AMOLED'
                      ? `${hlColor}38`
                      : hlColor
                    : 'transparent',
                  color:
                    hlColor && (settings.readerTheme === 'LIGHT' || settings.readerTheme === 'SEPIA')
                      ? '#18181A'
                      : palette.text,
                  borderRadius: 8,
                  padding: hlColor ? '6px 10px' : 0,
                  cursor: highlighterMode ? 'pointer' : 'text',
                  transition: 'background-color 0.16s ease'
                }}
              >
                {block.text}
              </p>
            );
          })}
        </div>
      </article>
    </div>
  );
};

function readerToolBtn(
  palette: { bg: string; text: string; border: string },
  active: boolean
): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 11px',
    borderRadius: 999,
    background: active ? '#0A84FF' : palette.bg,
    color: active ? '#FFFFFF' : palette.text,
    border: `1px solid ${active ? '#0A84FF' : palette.border}`,
    fontSize: 12,
    fontWeight: 600
  };
}
