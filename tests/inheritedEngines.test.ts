import { describe, expect, it } from 'vitest';
import { identifyTracker, isAdOrTracker } from '../src/shared/privacyRules';
import { normalizeForSpeech, splitIntoSentences } from '../src/shared/audioTextNormalizer';
import { extractCleanHost, resolveNavigationInput } from '../src/shared/searchEngines';
import {
  createDefaultPersistedState,
  mergeAndroidCompatibleBackup,
  serializeToAndroidCompatibleBackup
} from '../electron/storageService';

describe('Herdado do Android: PrivacyTrackerEngine', () => {
  it('detecta e categoriza domínios de anúncios e telemetria corretamente', () => {
    expect(isAdOrTracker('pagead2.googlesyndication.com', 'https://pagead2.googlesyndication.com/script.js')).toBe(true);
    expect(isAdOrTracker('connect.facebook.net', 'https://connect.facebook.net/en_US/fbevents.js')).toBe(true);
    expect(isAdOrTracker('pt.wikipedia.org', 'https://pt.wikipedia.org/wiki/Brasil')).toBe(false);

    expect(identifyTracker('doubleclick.net', 'https://doubleclick.net/ad')).toEqual({
      name: 'Google Ads & DoubleClick',
      category: 'ADVERTISING'
    });
    expect(identifyTracker('hotjar.com', 'https://static.hotjar.com/c/hotjar.js')).toEqual({
      name: 'Heatmap & Session Recording',
      category: 'FINGERPRINTING'
    });
  });
});

describe('Herdado do Android: AudioTextNormalizer (Podcastify PT-BR)', () => {
  it('converte valores em reais, porcentagens, unidades e abreviações para fala natural', () => {
    const raw = 'O produto custa R$ 1.250,50 com 15% de desconto! Velocidade de 80 km/h vc tbm vê.';
    const spoken = normalizeForSpeech(raw);
    expect(spoken).toContain('1250 reais e 50 centavos');
    expect(spoken).toContain('15 por cento');
    expect(spoken).toContain('80 quilômetros por hora');
    expect(spoken).toContain('você também');
  });

  it('divide textos longos em blocos respeitando pontuação de sentenças', () => {
    const text = 'Primeira frase completa aqui. Segunda frase importante do artigo! Terceira frase final?';
    const chunks = splitIntoSentences(text, 55);
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toContain('Primeira frase');
    expect(chunks[2]).toContain('Terceira frase');
  });
});

describe('Herdado do Android: SearchEngine & URL Resolution', () => {
  it('diferencia domínios diretos de buscas textuais', () => {
    expect(resolveNavigationInput('github.com/beyonder96', 'google')).toBe('https://github.com/beyonder96');
    expect(resolveNavigationInput('localhost:3000/api', 'google')).toBe('http://localhost:3000/api');
    expect(resolveNavigationInput('notícias tecnologia hoje', 'duckduckgo')).toContain('https://duckduckgo.com/?q=');
    expect(extractCleanHost('https://www.youtube.com/watch?v=123')).toBe('youtube.com');
  });
});

describe('Compatibilidade Bidirecional de Backup JSON (Android <-> Windows)', () => {
  it('importa perfeitamente um arquivo tessera_backup.json gerado pelo Android BrowserViewModel.kt', () => {
    const androidBackupJson = JSON.stringify({
      version: 1,
      timestamp: 1760000000000,
      bookmarks: [
        {
          id: 'bm-1',
          title: 'GitHub Tessera',
          url: 'https://github.com/beyonder96/Tessera-Browser',
          badgeColor: 0xff24292e
        }
      ],
      history: [
        {
          id: 'hist-1',
          title: 'Wikipédia',
          url: 'https://pt.wikipedia.org',
          timestamp: 1760000000000,
          spaceId: 'space_work'
        }
      ],
      spaces: [
        {
          id: 'space_general',
          name: 'Geral',
          iconEmoji: '🌐',
          colorArgb: 0xff0288d1,
          isDefault: true
        },
        {
          id: 'space_study',
          name: 'Estudos',
          iconEmoji: '📚',
          colorArgb: 0xffab47bc,
          isDefault: false
        }
      ],
      settings: {
        isDarkMode: false,
        forceDarkPages: true,
        adBlockEnabled: true,
        cookieBlockerEnabled: true,
        searchEngine: 'DUCKDUCKGO',
        selectedWallpaperId: 'emerald_forest',
        showWeatherWidget: true,
        showQuotesWidget: true
      }
    });

    const initial = createDefaultPersistedState();
    const merged = mergeAndroidCompatibleBackup(initial, androidBackupJson);

    expect(merged.importedBookmarks).toBe(1);
    expect(merged.importedHistory).toBe(1);
    expect(merged.importedSpaces).toBe(2);
    expect(merged.nextState.settings.isDarkMode).toBe(false);
    expect(merged.nextState.settings.forceDarkPages).toBe(true);
    expect(merged.nextState.settings.searchEngine).toBe('duckduckgo');
    expect(merged.nextState.spaces[1].colorHex).toBe('#AB47BC');

    const exportedFromWindows = serializeToAndroidCompatibleBackup(merged.nextState);
    expect(exportedFromWindows.version).toBe(1);
    expect(exportedFromWindows.settings?.searchEngine).toBe('DUCKDUCKGO');
    expect(exportedFromWindows.spaces?.length).toBe(2);
  });
});

describe('Assistente de Voz Tessera & Processamento de Comandos', () => {
  it('identifica wake-words (Ei Tessera, Ok Tessera) e extrai intenções com precisão', () => {
    const parseCommand = (raw: string) => {
      const text = raw.toLowerCase().trim();
      if (/^(?:pesquisar|pesquise|buscar|busque|procure por|procurar)\s+(.+)/i.test(text)) {
        return { type: 'search', query: text.replace(/^(?:pesquisar|pesquise|buscar|busque|procure por|procurar)\s+/i, '') };
      }
      if (/^(?:abrir|abra|vá para|ir para|acesse|acessar)\s+(.+)/i.test(text)) {
        return { type: 'navigate', target: text.replace(/^(?:abrir|abra|vá para|ir para|acesse|acessar)\s+/i, '') };
      }
      if (/^(?:resumir|resuma|faça um resumo|síntese|resumo da página)/i.test(text)) {
        return { type: 'ai_summary' };
      }
      if (/^(?:ler|leia|ouvir|ouça|podcast|tocar áudio|leia a página)/i.test(text)) {
        return { type: 'podcast_read' };
      }
      if (/^(?:pip|picture in picture|destacar vídeo|janela flutuante)/i.test(text)) {
        return { type: 'pip_video' };
      }
      return { type: 'search', query: raw };
    };

    expect(parseCommand('pesquisar smartphones 2026')).toEqual({
      type: 'search',
      query: 'smartphones 2026'
    });
    expect(parseCommand('abrir youtube.com')).toEqual({
      type: 'navigate',
      target: 'youtube.com'
    });
    expect(parseCommand('resuma esta página para mim')).toEqual({
      type: 'ai_summary'
    });
    expect(parseCommand('ler página em voz alta')).toEqual({
      type: 'podcast_read'
    });
    expect(parseCommand('destacar vídeo')).toEqual({
      type: 'pip_video'
    });
  });
});
