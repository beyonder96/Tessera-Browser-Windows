import React, { useEffect, useRef } from 'react';
import {
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Languages,
  Maximize2,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Scissors,
  Clipboard,
  CheckSquare,
  ArrowLeft,
  ArrowRight,
  Code
} from 'lucide-react';

export interface WebContextMenuData {
  x: number;
  y: number;
  linkURL?: string;
  linkText?: string;
  srcURL?: string;
  mediaType?: 'none' | 'image' | 'video' | 'audio';
  selectionText?: string;
  isEditable?: boolean;
  dictionarySuggestions?: string[];
  editFlags?: {
    canCut?: boolean;
    canCopy?: boolean;
    canPaste?: boolean;
    canSelectAll?: boolean;
  };
  tabId: string;
  pageUrl: string;
  pageTitle: string;
}

interface WebContextMenuProps {
  data: WebContextMenuData | null;
  onClose: () => void;
  onOpenNewTab: (url: string, background?: boolean) => void;
  onOpenIncognitoTab: (url: string) => void;
  onPeekLink: (url: string, title: string) => void;
  onSendTabToMobile?: (url: string, title: string) => void;
  onAskAi: (selectedText: string, contextUrl: string) => void;
  onTranslatePage: () => void;
  onToggleReaderMode: () => void;
  onPrintPage: () => void;
  onInspectElement: (tabId: string, x: number, y: number) => void;
  onReloadTab: (tabId: string) => void;
  onGoBack: (tabId: string) => void;
  onGoForward: (tabId: string) => void;
  onExecuteEditCommand: (tabId: string, command: 'cut' | 'copy' | 'paste' | 'selectAll') => void;
}

export const WebContextMenu: React.FC<WebContextMenuProps> = ({
  data,
  onClose,
  onOpenNewTab,
  onOpenIncognitoTab,
  onPeekLink,
  onSendTabToMobile,
  onAskAi,
  onTranslatePage,
  onToggleReaderMode,
  onPrintPage,
  onInspectElement,
  onReloadTab,
  onGoBack,
  onGoForward,
  onExecuteEditCommand
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!data) return null;

  // Keep menu within window boundaries
  const menuWidth = 240;
  const menuHeight = 340;
  const clampedX = Math.min(Math.max(8, data.x), window.innerWidth - menuWidth - 12);
  const clampedY = Math.min(Math.max(8, data.y), window.innerHeight - menuHeight - 12);

  const hasLink = Boolean(data.linkURL && data.linkURL.startsWith('http'));
  const hasImage = Boolean(data.srcURL && (data.mediaType === 'image' || /\.(jpe?g|png|gif|webp|svg)/i.test(data.srcURL)));
  const hasSelection = Boolean(data.selectionText && data.selectionText.trim().length > 0);
  const isEditable = Boolean(data.isEditable);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: clampedX,
        top: clampedY,
        zIndex: 99999,
        width: menuWidth,
        borderRadius: 16,
        border: '1px solid var(--border-hairline)',
        background: 'var(--bg-surface)',
        backdropFilter: 'blur(20px)',
        padding: 6,
        fontSize: 13,
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-floating)',
        userSelect: 'none'
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. SELEÇÃO DE TEXTO */}
      {hasSelection && (
        <div style={sectionStyle}>
          <button
            onClick={() => {
              onAskAi(data.selectionText!.trim(), data.pageUrl);
              onClose();
            }}
            style={{ ...itemStyle, color: 'var(--accent-primary)', fontWeight: 600 }}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span style={truncateStyle}>Perguntar à Tessera AI</span>
          </button>
          <button
            onClick={() => {
              const query = encodeURIComponent(data.selectionText!.trim());
              onOpenNewTab(`https://www.google.com/search?q=${query}`);
              onClose();
            }}
            style={itemStyle}
          >
            <Search size={14} style={iconStyle} />
            <span style={truncateStyle}>Pesquisar na Web</span>
          </button>
          <button
            onClick={() => copyToClipboard(data.selectionText!.trim())}
            style={{ ...itemStyle, justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Copy size={14} style={iconStyle} />
              <span>Copiar seleção</span>
            </div>
            <kbd style={kbdStyle}>Ctrl+C</kbd>
          </button>
        </div>
      )}

      {/* 2. LINK CLICADO */}
      {hasLink && (
        <div style={sectionStyle}>
          <button
            onClick={() => {
              onOpenNewTab(data.linkURL!);
              onClose();
            }}
            style={itemStyle}
          >
            <ExternalLink size={14} style={iconStyle} />
            <span>Abrir em nova guia</span>
          </button>
          <button
            onClick={() => {
              onOpenIncognitoTab(data.linkURL!);
              onClose();
            }}
            style={itemStyle}
          >
            <Eye size={14} style={iconStyle} />
            <span>Abrir em guia anônima</span>
          </button>
          <button
            onClick={() => {
              onPeekLink(data.linkURL!, data.linkText || 'Prévia do Link');
              onClose();
            }}
            style={{ ...itemStyle, color: 'var(--accent-primary)' }}
          >
            <Maximize2 size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span>Peek Preview</span>
          </button>
          <button
            onClick={() => copyToClipboard(data.linkURL!)}
            style={itemStyle}
          >
            <Copy size={14} style={iconStyle} />
            <span>Copiar endereço do link</span>
          </button>
          {onSendTabToMobile && (
            <button
              onClick={() => {
                onSendTabToMobile(data.linkURL!, data.linkText || data.linkURL!);
                onClose();
              }}
              style={{ ...itemStyle, color: '#34C759' }}
            >
              <Share2 size={14} style={{ color: '#34C759', flexShrink: 0 }} />
              <span>Enviar para o Android</span>
            </button>
          )}
        </div>
      )}

      {/* 3. IMAGEM CLICADA */}
      {hasImage && (
        <div style={sectionStyle}>
          <button
            onClick={() => {
              onOpenNewTab(data.srcURL!);
              onClose();
            }}
            style={itemStyle}
          >
            <ImageIcon size={14} style={iconStyle} />
            <span>Abrir imagem em nova guia</span>
          </button>
          <button
            onClick={() => copyToClipboard(data.srcURL!)}
            style={itemStyle}
          >
            <Copy size={14} style={iconStyle} />
            <span>Copiar link da imagem</span>
          </button>
        </div>
      )}

      {/* 4. CAMPO EDITÁVEL (INPUT / TEXTAREA) */}
      {isEditable && (
        <div style={sectionStyle}>
          {data.dictionarySuggestions && data.dictionarySuggestions.length > 0 && (
            <div style={{ paddingBottom: 4, marginBottom: 4, borderBottom: '1px solid var(--border-hairline)' }}>
              <span style={{ padding: '0 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Ortografia
              </span>
              {data.dictionarySuggestions.slice(0, 3).map((sug, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onClose();
                  }}
                  style={{ ...itemStyle, color: 'var(--accent-primary)' }}
                >
                  <CheckSquare size={14} style={{ flexShrink: 0 }} />
                  <span>{sug}</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              onExecuteEditCommand(data.tabId, 'cut');
              onClose();
            }}
            style={{ ...itemStyle, justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Scissors size={14} style={iconStyle} />
              <span>Recortar</span>
            </div>
            <kbd style={kbdStyle}>Ctrl+X</kbd>
          </button>
          <button
            onClick={() => {
              onExecuteEditCommand(data.tabId, 'copy');
              onClose();
            }}
            style={{ ...itemStyle, justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Copy size={14} style={iconStyle} />
              <span>Copiar</span>
            </div>
            <kbd style={kbdStyle}>Ctrl+C</kbd>
          </button>
          <button
            onClick={() => {
              onExecuteEditCommand(data.tabId, 'paste');
              onClose();
            }}
            style={{ ...itemStyle, justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clipboard size={14} style={iconStyle} />
              <span>Colar</span>
            </div>
            <kbd style={kbdStyle}>Ctrl+V</kbd>
          </button>
          <button
            onClick={() => {
              onExecuteEditCommand(data.tabId, 'selectAll');
              onClose();
            }}
            style={{ ...itemStyle, justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckSquare size={14} style={iconStyle} />
              <span>Selecionar tudo</span>
            </div>
            <kbd style={kbdStyle}>Ctrl+A</kbd>
          </button>
        </div>
      )}

      {/* 5. AÇÕES GERAIS DE NAVEGAÇÃO & PÁGINA */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 2, gap: 4, borderBottom: '1px solid var(--border-hairline)', marginBottom: 4 }}>
          <button
            onClick={() => {
              onGoBack(data.tabId);
              onClose();
            }}
            title="Voltar (Alt+Seta Esquerda)"
            style={navBtnStyle}
          >
            <ArrowLeft size={14} />
          </button>
          <button
            onClick={() => {
              onGoForward(data.tabId);
              onClose();
            }}
            title="Avançar (Alt+Seta Direita)"
            style={navBtnStyle}
          >
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => {
              onReloadTab(data.tabId);
              onClose();
            }}
            title="Recarregar (Ctrl+R)"
            style={navBtnStyle}
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <button
          onClick={() => {
            onToggleReaderMode();
            onClose();
          }}
          style={itemStyle}
        >
          <FileText size={14} style={iconStyle} />
          <span>Modo Leitura</span>
        </button>

        <button
          onClick={() => {
            onTranslatePage();
            onClose();
          }}
          style={itemStyle}
        >
          <Languages size={14} style={iconStyle} />
          <span>Traduzir página</span>
        </button>

        <button
          onClick={() => {
            onPrintPage();
            onClose();
          }}
          style={{ ...itemStyle, justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Printer size={14} style={iconStyle} />
            <span>Imprimir</span>
          </div>
          <kbd style={kbdStyle}>Ctrl+P</kbd>
        </button>

        <button
          onClick={() => {
            onInspectElement(data.tabId, data.x, data.y);
            onClose();
          }}
          style={{ ...itemStyle, justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code size={14} style={iconStyle} />
            <span>Inspecionar elemento</span>
          </div>
          <kbd style={kbdStyle}>Ctrl+Shift+I</kbd>
        </button>
      </div>
    </div>
  );
};

const sectionStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border-hairline)',
  paddingBottom: 4,
  marginBottom: 4
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: 10,
  borderRadius: 8,
  padding: '6px 10px',
  textAlign: 'left',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 12.5,
  cursor: 'pointer',
  transition: 'background 0.15s ease'
};

const iconStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  flexShrink: 0
};

const navBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px',
  borderRadius: 6,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  cursor: 'pointer'
};

const kbdStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: 'var(--text-tertiary)',
  background: 'var(--bg-elevated)',
  padding: '2px 5px',
  borderRadius: 4
};

const truncateStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};
