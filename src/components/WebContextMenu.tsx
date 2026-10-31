import React, { useEffect, useRef } from 'react';
import {
  Copy,
  ExternalLink,
  Eye,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Languages,
  Maximize2,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Volume2,
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

  // Ensure menu stays within window boundaries
  const menuWidth = 240;
  const menuHeight = 320;
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
      className="fixed z-[9999] rounded-2xl border border-white/10 bg-[#161618]/95 p-1.5 text-[13px] text-white shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100 select-none w-60"
      style={{ left: clampedX, top: clampedY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. SELEÇÃO DE TEXTO */}
      {hasSelection && (
        <div className="space-y-0.5 border-b border-white/10 pb-1.5 mb-1.5">
          <button
            onClick={() => {
              onAskAi(data.selectionText!.trim(), data.pageUrl);
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left font-medium text-sky-400 hover:bg-sky-500/20 transition-colors"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="truncate">Perguntar à Tessera AI</span>
          </button>
          <button
            onClick={() => {
              const query = encodeURIComponent(data.selectionText!.trim());
              onOpenNewTab(`https://www.google.com/search?q=${query}`);
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <Search className="h-4 w-4 shrink-0 text-neutral-400" />
            <span className="truncate">Pesquisar na Web</span>
          </button>
          <button
            onClick={() => copyToClipboard(data.selectionText!.trim())}
            className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Copy className="h-4 w-4 shrink-0 text-neutral-400" />
              <span>Copiar seleção</span>
            </div>
            <kbd className="text-[11px] text-neutral-500">Ctrl+C</kbd>
          </button>
        </div>
      )}

      {/* 2. LINK CLICADO */}
      {hasLink && (
        <div className="space-y-0.5 border-b border-white/10 pb-1.5 mb-1.5">
          <button
            onClick={() => {
              onOpenNewTab(data.linkURL!);
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <ExternalLink className="h-4 w-4 shrink-0 text-neutral-400" />
            <span>Abrir em nova guia</span>
          </button>
          <button
            onClick={() => {
              onOpenIncognitoTab(data.linkURL!);
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <Eye className="h-4 w-4 shrink-0 text-neutral-400" />
            <span>Abrir em guia anônima</span>
          </button>
          <button
            onClick={() => {
              onPeekLink(data.linkURL!, data.linkText || 'Prévia do Link');
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sky-400 hover:bg-sky-500/15 transition-colors"
          >
            <Maximize2 className="h-4 w-4 shrink-0 text-sky-400" />
            <span>Peek Preview</span>
          </button>
          <button
            onClick={() => copyToClipboard(data.linkURL!)}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <Copy className="h-4 w-4 shrink-0 text-neutral-400" />
            <span>Copiar endereço do link</span>
          </button>
          {onSendTabToMobile && (
            <button
              onClick={() => {
                onSendTabToMobile(data.linkURL!, data.linkText || data.linkURL!);
                onClose();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-emerald-400 hover:bg-emerald-500/15 transition-colors"
            >
              <Share2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Enviar para o Android</span>
            </button>
          )}
        </div>
      )}

      {/* 3. IMAGEM CLICADA */}
      {hasImage && (
        <div className="space-y-0.5 border-b border-white/10 pb-1.5 mb-1.5">
          <button
            onClick={() => {
              onOpenNewTab(data.srcURL!);
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <ImageIcon className="h-4 w-4 shrink-0 text-neutral-400" />
            <span>Abrir imagem em nova guia</span>
          </button>
          <button
            onClick={() => copyToClipboard(data.srcURL!)}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <Copy className="h-4 w-4 shrink-0 text-neutral-400" />
            <span>Copiar link da imagem</span>
          </button>
        </div>
      )}

      {/* 4. CAMPO EDITÁVEL (INPUT / TEXTAREA) */}
      {isEditable && (
        <div className="space-y-0.5 border-b border-white/10 pb-1.5 mb-1.5">
          {data.dictionarySuggestions && data.dictionarySuggestions.length > 0 && (
            <div className="pb-1 border-b border-white/10 mb-1">
              <span className="px-2.5 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                Ortografia
              </span>
              {data.dictionarySuggestions.slice(0, 3).map((sug, i) => (
                <button
                  key={i}
                  onClick={() => {
                    // Substituir palavra
                    onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sky-400 hover:bg-sky-500/15"
                >
                  <CheckSquare className="h-3.5 w-3.5 shrink-0" />
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
            className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Scissors className="h-4 w-4 shrink-0 text-neutral-400" />
              <span>Recortar</span>
            </div>
            <kbd className="text-[11px] text-neutral-500">Ctrl+X</kbd>
          </button>
          <button
            onClick={() => {
              onExecuteEditCommand(data.tabId, 'copy');
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Copy className="h-4 w-4 shrink-0 text-neutral-400" />
              <span>Copiar</span>
            </div>
            <kbd className="text-[11px] text-neutral-500">Ctrl+C</kbd>
          </button>
          <button
            onClick={() => {
              onExecuteEditCommand(data.tabId, 'paste');
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Clipboard className="h-4 w-4 shrink-0 text-neutral-400" />
              <span>Colar</span>
            </div>
            <kbd className="text-[11px] text-neutral-500">Ctrl+V</kbd>
          </button>
          <button
            onClick={() => {
              onExecuteEditCommand(data.tabId, 'selectAll');
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <CheckSquare className="h-4 w-4 shrink-0 text-neutral-400" />
              <span>Selecionar tudo</span>
            </div>
            <kbd className="text-[11px] text-neutral-500">Ctrl+A</kbd>
          </button>
        </div>
      )}

      {/* 5. AÇÕES GERAIS DE NAVEGAÇÃO & PÁGINA */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between px-1 py-1 gap-1 border-b border-white/10 mb-1">
          <button
            onClick={() => {
              onGoBack(data.tabId);
              onClose();
            }}
            title="Voltar"
            className="flex-1 flex items-center justify-center p-1.5 rounded-lg text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              onGoForward(data.tabId);
              onClose();
            }}
            title="Avançar"
            className="flex-1 flex items-center justify-center p-1.5 rounded-lg text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              onReloadTab(data.tabId);
              onClose();
            }}
            title="Recarregar (Ctrl+R)"
            className="flex-1 flex items-center justify-center p-1.5 rounded-lg text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => {
            onToggleReaderMode();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
        >
          <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
          <span>Modo Leitura</span>
        </button>

        <button
          onClick={() => {
            onTranslatePage();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
        >
          <Languages className="h-4 w-4 shrink-0 text-neutral-400" />
          <span>Traduzir página</span>
        </button>

        <button
          onClick={() => {
            onPrintPage();
            onClose();
          }}
          className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Printer className="h-4 w-4 shrink-0 text-neutral-400" />
            <span>Imprimir</span>
          </div>
          <kbd className="text-[11px] text-neutral-500">Ctrl+P</kbd>
        </button>

        <button
          onClick={() => {
            onInspectElement(data.tabId, data.x, data.y);
            onClose();
          }}
          className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-neutral-200 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Code className="h-4 w-4 shrink-0 text-neutral-400" />
            <span>Inspecionar elemento</span>
          </div>
          <kbd className="text-[11px] text-neutral-500">Ctrl+Shift+I</kbd>
        </button>
      </div>
    </div>
  );
};
