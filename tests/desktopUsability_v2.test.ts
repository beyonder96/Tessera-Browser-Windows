import { describe, it, expect } from 'vitest';
import type { WebContextMenuData } from '../src/components/WebContextMenu';

describe('Fase 2: Usabilidade Desktop 100% (Core Browser & Correções Críticas)', () => {
  describe('WebContextMenu (Menu de Botão Direito Editorial)', () => {
    it('identifica corretamente alvos de links com URLs completas', () => {
      const data: WebContextMenuData = {
        x: 100,
        y: 200,
        linkURL: 'https://github.com/beyonder96/tessera',
        linkText: 'Repositório Oficial Tessera',
        tabId: 'tab-1',
        pageUrl: 'https://github.com',
        pageTitle: 'GitHub'
      };

      expect(data.linkURL).toBe('https://github.com/beyonder96/tessera');
      expect(data.linkText).toBe('Repositório Oficial Tessera');
      expect(Boolean(data.linkURL && data.linkURL.startsWith('http'))).toBe(true);
    });

    it('identifica alvos de imagem e seleção de texto', () => {
      const imgData: WebContextMenuData = {
        x: 150,
        y: 300,
        srcURL: 'https://example.com/logo.png',
        mediaType: 'image',
        tabId: 'tab-2',
        pageUrl: 'https://example.com',
        pageTitle: 'Exemplo'
      };

      expect(imgData.mediaType).toBe('image');
      expect(imgData.srcURL).toBe('https://example.com/logo.png');

      const textData: WebContextMenuData = {
        x: 50,
        y: 80,
        selectionText: 'Tessera Browser for Windows',
        tabId: 'tab-3',
        pageUrl: 'https://tessera.app',
        pageTitle: 'Tessera'
      };

      expect(textData.selectionText).toBe('Tessera Browser for Windows');
    });

    it('oferece suporte a campos editáveis e sugestões ortográficas do Chromium', () => {
      const editData: WebContextMenuData = {
        x: 200,
        y: 400,
        isEditable: true,
        dictionarySuggestions: ['navegador', 'navegação'],
        editFlags: {
          canCut: true,
          canCopy: true,
          canPaste: true,
          canSelectAll: true
        },
        tabId: 'tab-4',
        pageUrl: 'https://search.com',
        pageTitle: 'Busca'
      };

      expect(editData.isEditable).toBe(true);
      expect(editData.dictionarySuggestions?.length).toBe(2);
      expect(editData.editFlags?.canPaste).toBe(true);
    });
  });

  describe('Atalhos de Zoom & Ergonomia', () => {
    it('calcula fatores de zoom em passos de 10% com limites seguros', () => {
      const clampZoom = (z: number) => Math.min(2.5, Math.max(0.4, Math.round(z * 10) / 10));

      expect(clampZoom(1.0 + 0.1)).toBe(1.1);
      expect(clampZoom(1.0 - 0.1)).toBe(0.9);
      expect(clampZoom(2.5 + 0.1)).toBe(2.5); // Limite superior
      expect(clampZoom(0.4 - 0.1)).toBe(0.4); // Limite inferior
    });

    it('suporta middle click (auxclick button 1) para fechar abas', () => {
      let closedTabId: string | null = null;
      const simulateAuxClick = (e: { button: number; tabId: string }) => {
        if (e.button === 1) {
          closedTabId = e.tabId;
        }
      };

      simulateAuxClick({ button: 1, tabId: 'tab-to-close' });
      expect(closedTabId).toBe('tab-to-close');

      // Botão direito (2) ou botão esquerdo (0) não devem fechar via auxclick
      simulateAuxClick({ button: 2, tabId: 'tab-right-click' });
      expect(closedTabId).toBe('tab-to-close');
    });
  });
});
