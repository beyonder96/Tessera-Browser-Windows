import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isNewerVersion } from '../electron/updateService';

describe('Update Engine & Runtime Specifications', () => {
  describe('Semantic Version Comparison (isNewerVersion)', () => {
    it('detecta corretamente versões superiores remotas', () => {
      expect(isNewerVersion('v1.0.5', '1.0.4')).toBe(true);
      expect(isNewerVersion('1.1.0', '1.0.4')).toBe(true);
      expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
      expect(isNewerVersion('v1.0.4.1', '1.0.4')).toBe(true);
    });

    it('não considera versão igual ou inferior como superior', () => {
      expect(isNewerVersion('1.0.4', '1.0.4')).toBe(false);
      expect(isNewerVersion('v1.0.4', '1.0.4')).toBe(false);
      expect(isNewerVersion('1.0.3', '1.0.4')).toBe(false);
      expect(isNewerVersion('v1.0.1', '1.0.4')).toBe(false);
      expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false);
    });

    it('trata prefixos "v", espaços e múltiplos segmentos sem quebrar', () => {
      expect(isNewerVersion('  v1.0.5  ', '1.0.4')).toBe(true);
      expect(isNewerVersion('1.0.4', '  v1.0.4  ')).toBe(false);
      expect(isNewerVersion('v10.0.0', 'v9.9.9')).toBe(true);
    });
  });

  describe('Auditoria de Versões Dinâmicas no Front-End', () => {
    const modalsPath = path.resolve(__dirname, '../src/components/BrowserModals.tsx');
    const modalsContent = fs.readFileSync(modalsPath, 'utf-8');

    it('não contém mais o badge estático v1.0.1 hardcoded', () => {
      expect(modalsContent).not.toMatch(/>\s*v1\.0\.1\s*</);
    });

    it('não contém mais o motor Chromium 132.0.6834.196 estático', () => {
      expect(modalsContent).not.toContain('132.0.6834.196');
    });

    it('não contém mais o Electron v34.2.0 estático', () => {
      expect(modalsContent).not.toContain('v34.2.0');
    });

    it('utiliza leituras dinâmicas de systemInfo para todas as especificações', () => {
      expect(modalsContent).toContain('systemInfo.appVersion');
      expect(modalsContent).toContain('systemInfo.chromeVersion');
      expect(modalsContent).toContain('systemInfo.electronVersion');
      expect(modalsContent).toContain('systemInfo.nodeVersion');
      expect(modalsContent).toContain('systemInfo.arch');
    });

    it('possui o botão oficial de Verificar Atualizações integrado', () => {
      expect(modalsContent).toContain('handleCheckForUpdates');
      expect(modalsContent).toContain('Atualizações do Tessera');
    });
  });
});
