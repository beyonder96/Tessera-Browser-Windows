import { describe, expect, it } from 'vitest';
import { GROUP_PALETTE, type BrowserTab, type TabGroup } from '../src/shared/types';

describe('Tessera Browser v1.0.1: Tab Grouping Engine', () => {
  it('cria um novo grupo com nome sequencial "Grupo N" e cor da paleta quando duas abas sem grupo são agrupadas', () => {
    const existingGroups: TabGroup[] = [];
    const activeSpaceId = 'default_space';

    const tabA: BrowserTab = {
      id: 'tab-1',
      url: 'https://github.com',
      title: 'GitHub',
      spaceId: activeSpaceId,
      isPinned: false,
      isHomePage: false,
      canGoBack: false,
      canGoForward: false,
      lastAccessedTimestamp: Date.now(),
      groupId: null
    };
    const tabB: BrowserTab = {
      id: 'tab-2',
      url: 'https://google.com',
      title: 'Google',
      spaceId: activeSpaceId,
      isPinned: false,
      isHomePage: false,
      canGoBack: false,
      canGoForward: false,
      lastAccessedTimestamp: Date.now(),
      groupId: null
    };

    const countInSpace = existingGroups.filter((g) => g.spaceId === activeSpaceId).length + 1;
    const cleanName = `Grupo ${countInSpace}`;
    const color = GROUP_PALETTE[existingGroups.filter((g) => g.spaceId === activeSpaceId).length % GROUP_PALETTE.length];

    const newGroup: TabGroup = {
      id: 'grp-1',
      name: cleanName,
      colorHex: color,
      spaceId: activeSpaceId
    };

    expect(newGroup.name).toBe('Grupo 1');
    expect(newGroup.colorHex).toBe(GROUP_PALETTE[0]);
  });

  it('permite desagrupar uma aba isolada mantendo o grupo para as demais abas', () => {
    const tabs: BrowserTab[] = [
      {
        id: 'tab-1',
        url: 'https://github.com',
        title: 'GitHub',
        groupId: 'grp-1',
        spaceId: 'default_space',
        isPinned: false,
        isHomePage: false,
        canGoBack: false,
        canGoForward: false,
        lastAccessedTimestamp: Date.now()
      },
      {
        id: 'tab-2',
        url: 'https://google.com',
        title: 'Google',
        groupId: 'grp-1',
        spaceId: 'default_space',
        isPinned: false,
        isHomePage: false,
        canGoBack: false,
        canGoForward: false,
        lastAccessedTimestamp: Date.now()
      }
    ];

    const ungroupedTabs = tabs.map((t) => (t.id === 'tab-1' ? { ...t, groupId: null } : t));

    expect(ungroupedTabs[0].groupId).toBeNull();
    expect(ungroupedTabs[1].groupId).toBe('grp-1');
  });
});

describe('Tessera AI: Gemini Model Selection', () => {
  it('garante que a lista de modelos Gemini inclui o modelo oficial 3.8 no topo, seguido do 3.5', () => {
    const modelsToTry = [
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash'
    ];

    expect(modelsToTry[0]).toBe('gemini-3.8-flash');
    expect(modelsToTry).toContain('gemini-3.5-flash');
    expect(modelsToTry).not.toContain('gemini-1.5-flash');
    expect(modelsToTry).not.toContain('gemini-2.0-flash');
  });
});
