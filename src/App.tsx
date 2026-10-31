import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AiProviderId,
  BlockedTrackerItem,
  BrowserSettings,
  BrowserSpace,
  BrowserTab,
  DownloadItem,
  LocalBridgeStatus,
  PersistedAppState,
  PodcastAudioState,
  PrivacyDashboardState,
  QuotesData,
  ReaderArticle,
  SavedPageItem,
  SiteSettings,
  SpeedDialItem,
  TesseraAiState,
  TranslationState,
  WeatherData
} from './shared/types';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SPACES,
  DEFAULT_SPEED_DIAL,
  hexToArgb
} from './shared/wallpapers';
import { extractCleanHost, resolveNavigationInput } from './shared/searchEngines';
import {
  fetchLiveQuotes,
  fetchLiveWeather,
  fetchSearchSuggestions
} from './services/widgetsAndSuggestService';
import { podcastAudioService } from './services/podcastAudioService';
import { WindowChromeOverlay } from './components/WindowChromeOverlay';
import { TesseraStartPage } from './components/TesseraStartPage';
import { WebViewStage, type WebViewStageHandle } from './components/WebViewStage';
import { TesseraAirBar } from './components/TesseraAirBar';
import { TesseraReaderScreen } from './components/TesseraReaderScreen';
import { TesseraAiSheet } from './components/TesseraAiSheet';
import { PodcastPlayer } from './components/PodcastPlayer';
import {
  FindInPageBar,
  IncognitoLockOverlay,
  PeekPreviewModal,
  QrBridgeModal,
  TranslateBar
} from './components/UtilityOverlays';
import {
  FullSettingsModal,
  HubModal,
  PrivacyDashboardModal,
  QuickSettingsPanel,
  SiteSettingsModal,
  SpacesModal,
  TabsModal
} from './components/BrowserModals';
import { VoiceAssistantOverlay } from './components/VoiceAssistantOverlay';
import { voiceActivationService, type VoiceIntent } from './services/voiceActivationService';

function createInitialBlankTab(spaceId: string, isIncognito = false, groupId: string | null = null): BrowserTab {
  return {
    id: crypto.randomUUID(),
    url: 'https://www.google.com',
    title: isIncognito ? 'Guia Anônima' : 'Início',
    isHomePage: true,
    canGoBack: false,
    canGoForward: false,
    isPinned: false,
    isIncognito,
    lastAccessedTimestamp: Date.now(),
    groupId,
    spaceId
  };
}

export const App: React.FC = () => {
  const webStageRef = useRef<WebViewStageHandle | null>(null);

  const [isHydrated, setIsHydrated] = useState(false);
  const [webviewPreloadUrl, setWebviewPreloadUrl] = useState('');
  const [isDefaultBrowser, setIsDefaultBrowser] = useState(false);

  // Core Persisted State
  const [spaces, setSpaces] = useState<BrowserSpace[]>(DEFAULT_SPACES);
  const [activeSpaceId, setActiveSpaceId] = useState<string>('space_general');
  const [tabs, setTabs] = useState<BrowserTab[]>([createInitialBlankTab('space_general')]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [closedTabsStack, setClosedTabsStack] = useState<BrowserTab[]>([]);
  const [tabGroups, setTabGroups] = useState<PersistedAppState['tabGroups']>([]);
  const [favorites, setFavorites] = useState<SpeedDialItem[]>(DEFAULT_SPEED_DIAL);
  const [history, setHistory] = useState<PersistedAppState['history']>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [savedPages, setSavedPages] = useState<SavedPageItem[]>([]);
  const [siteSettings, setSiteSettings] = useState<Record<string, SiteSettings>>({});
  const [readerHighlights, setReaderHighlights] = useState<Record<string, Record<number, string>>>({});
  const [settings, setSettings] = useState<BrowserSettings>(DEFAULT_SETTINGS);

  // Ephemeral UI State
  const [isIncognitoMode, setIsIncognitoMode] = useState(false);
  const [isIncognitoLocked, setIsIncognitoLocked] = useState(false);
  const [isAirBarAutoHidden, setIsAirBarAutoHidden] = useState(false);
  const [airBarEditTrigger, setAirBarEditTrigger] = useState(0);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);

  // Widgets
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [quotesData, setQuotesData] = useState<QuotesData | null>(null);

  // Reader Mode
  const [isReaderAvailable, setIsReaderAvailable] = useState(false);
  const [readerArticle, setReaderArticle] = useState<ReaderArticle | null>(null);

  // Podcastify Audio
  const [podcastState, setPodcastState] = useState<PodcastAudioState>(podcastAudioService.getState());

  // Privacy Dashboard
  const [privacyState, setPrivacyState] = useState<PrivacyDashboardState>({
    totalBlockedCount: 0,
    sessionBlockedCount: 0,
    estimatedBytesSaved: 0,
    estimatedTimeSavedMs: 0,
    byCategory: { ADVERTISING: 0, ANALYTICS: 0, SOCIAL: 0, FINGERPRINTING: 0 },
    recentTrackers: []
  });

  // Tessera AI
  const [aiState, setAiState] = useState<TesseraAiState>({
    isVisible: false,
    isSummarizing: false,
    isAnsweringQuestion: false,
    pageTitle: '',
    pageDomain: '',
    pageUrl: '',
    pageContent: '',
    summary: null,
    chatMessages: [],
    error: null,
    activeProvider: 'GEMINI',
    hasGeminiKey: false,
    hasGroqKey: false
  });

  // Modals & Overlays
  const [showSpacesModal, setShowSpacesModal] = useState(false);
  const [showTabsModal, setShowTabsModal] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [showFullSettings, setShowFullSettings] = useState(false);
  const [hubModalState, setHubModalState] = useState<{ open: boolean; tab: number }>({
    open: false,
    tab: 0
  });
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSiteSettingsModal, setShowSiteSettingsModal] = useState(false);
  const [showQrBridgeModal, setShowQrBridgeModal] = useState(false);
  const [peekTarget, setPeekTarget] = useState<{ url: string; title: string } | null>(null);
  const [activeDownloadBanner, setActiveDownloadBanner] = useState<DownloadItem | null>(null);
  const [voiceState, setVoiceState] = useState(voiceActivationService.getState());

  // Find In Page
  const [showFindBar, setShowFindBar] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatchInfo, setFindMatchInfo] = useState({ active: 0, total: 0 });

  // Inline Translation
  const [translationState, setTranslationState] = useState<TranslationState>({
    detectedLang: '',
    targetLang: 'pt',
    isBannerVisible: false,
    isTranslating: false,
    isTranslated: false
  });

  // Local Wi-Fi Bridge
  const [bridgeStatus, setBridgeStatus] = useState<LocalBridgeStatus>({
    running: false,
    url: null,
    token: null,
    port: null,
    connectedClients: 0,
    lastReceivedMessage: null
  });

  // Hydrate initial persisted state from Electron Main Process
  useEffect(() => {
    const unsubPodcast = podcastAudioService.subscribe(setPodcastState);

    if (!window.tesseraApi) {
      console.warn('[Tessera] window.tesseraApi not available, fallback to defaults');
      setIsHydrated(true);
      return () => unsubPodcast();
    }

    Promise.all([
      window.tesseraApi.getWebviewPreloadPath(),
      window.tesseraApi.loadState(),
      window.tesseraApi.aiGetKeyStatus(),
      window.tesseraApi.isDefaultBrowser()
    ])
      .then(([preloadUrl, loaded, keyStatus, defBrowser]) => {
        setWebviewPreloadUrl(preloadUrl);
        setSpaces(loaded.spaces);
        setActiveSpaceId(loaded.activeSpaceId);
        setTabs(loaded.tabs);
        setActiveTabId(loaded.activeTabId || loaded.tabs[0]?.id || '');
        setTabGroups(loaded.tabGroups || []);
        setFavorites(loaded.speedDialItems);
        setHistory(loaded.history || []);
        setDownloads(loaded.downloads || []);
        setSavedPages(loaded.savedPages || []);
        setSiteSettings(loaded.siteSettings || {});
        setReaderHighlights(loaded.readerHighlights || {});
        setSettings(loaded.settings);
        setPrivacyState((prev) => ({
          ...prev,
          totalBlockedCount: loaded.privacyStats.totalBlockedCount,
          estimatedBytesSaved: loaded.privacyStats.estimatedBytesSaved,
          estimatedTimeSavedMs: loaded.privacyStats.estimatedTimeSavedMs,
          byCategory: loaded.privacyStats.byCategory
        }));
        setAiState((prev) => ({
          ...prev,
          activeProvider: loaded.settings.aiProvider,
          hasGeminiKey: keyStatus.hasGeminiKey,
          hasGroqKey: keyStatus.hasGroqKey
        }));
        setIsDefaultBrowser(defBrowser);
        setIsHydrated(true);
      })
      .catch(() => {
        setIsHydrated(true);
      });

    // Fetch live widgets
    fetchLiveWeather().then(setWeatherData).catch(() => {});
    fetchLiveQuotes().then(setQuotesData).catch(() => {});

    return () => {
      unsubPodcast();
    };
  }, []);

  // Filtered tabs for active context (Incognito vs Active Space)
  const visibleTabs = useMemo(() => {
    const filtered = tabs.filter((t) =>
      isIncognitoMode ? Boolean(t.isIncognito) : !t.isIncognito && t.spaceId === activeSpaceId
    );
    return filtered.sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  }, [tabs, isIncognitoMode, activeSpaceId]);

  const activeTab = useMemo(() => {
    return visibleTabs.find((t) => t.id === activeTabId) || visibleTabs[0] || tabs[0];
  }, [visibleTabs, activeTabId, tabs]);

  const activeSpace = useMemo(() => {
    return spaces.find((s) => s.id === activeSpaceId) || spaces[0];
  }, [spaces, activeSpaceId]);

  // Ensure activeTabId always points to a valid tab in current Space / Incognito mode
  useEffect(() => {
    if (!isHydrated) return;
    if (visibleTabs.length === 0) {
      const fresh = createInitialBlankTab(activeSpaceId, isIncognitoMode);
      setTabs((prev) => [...prev, fresh]);
      setActiveTabId(fresh.id);
    } else if (!visibleTabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTabId, activeSpaceId, isIncognitoMode, isHydrated]);

  // Apply OLED Dark / Editorial Journal Light & Incognito attributes to root document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.isDarkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-incognito', isIncognitoMode ? 'true' : 'false');
  }, [settings.isDarkMode, isIncognitoMode]);

  // Sync active tab context to Local Wi-Fi Bridge & reset per-page overlays on tab change
  useEffect(() => {
    if (!activeTab) return;
    window.tesseraApi?.bridgeUpdateContext({
      url: activeTab.isHomePage ? '' : activeTab.url,
      title: activeTab.title
    });
    setReaderArticle(null);
    setIsReaderAvailable(false);
    setTranslationState((prev) => ({
      ...prev,
      isBannerVisible: false,
      isTranslated: false,
      isTranslating: false
    }));
    setIsAirBarAutoHidden(false);
  }, [activeTab?.id, activeTab?.url, activeTab?.isHomePage]);

  // Debounced Persistence Save
  const buildPersistedSnapshot = useCallback((): PersistedAppState => {
    return {
      spaces,
      activeSpaceId,
      tabs: tabs.filter((t) => !t.isIncognito),
      activeTabId,
      tabGroups,
      speedDialItems: favorites,
      history,
      downloads,
      savedPages,
      siteSettings,
      readerHighlights,
      privacyStats: {
        totalBlockedCount: privacyState.totalBlockedCount,
        estimatedBytesSaved: privacyState.estimatedBytesSaved,
        estimatedTimeSavedMs: privacyState.estimatedTimeSavedMs,
        byCategory: privacyState.byCategory
      },
      settings
    };
  }, [
    spaces,
    activeSpaceId,
    tabs,
    activeTabId,
    tabGroups,
    favorites,
    history,
    downloads,
    savedPages,
    siteSettings,
    readerHighlights,
    privacyState,
    settings
  ]);

  useEffect(() => {
    if (!isHydrated || !window.tesseraApi) return;
    const timer = window.setTimeout(() => {
      void window.tesseraApi.saveState(buildPersistedSnapshot());
      void window.tesseraApi.updatePrivacyConfig(settings.adBlockEnabled, siteSettings);
    }, 350);
    return () => clearTimeout(timer);
  }, [buildPersistedSnapshot, isHydrated, settings.adBlockEnabled, siteSettings]);

  // Subscribe to Electron Main Process IPC events (Tracker Blocked, Downloads, External URLs, Wi-Fi Bridge)
  useEffect(() => {
    if (!window.tesseraApi) return;
    const offTracker = window.tesseraApi.onTrackerBlocked((payload) => {
      setPrivacyState((prev) => {
        const existingIdx = prev.recentTrackers.findIndex(
          (t) => t.host === payload.host && t.pageOrigin === payload.pageOrigin
        );
        let updatedRecent: BlockedTrackerItem[];
        if (existingIdx >= 0) {
          updatedRecent = [...prev.recentTrackers];
          updatedRecent[existingIdx] = {
            ...updatedRecent[existingIdx],
            count: updatedRecent[existingIdx].count + 1,
            lastBlockedAt: payload.timestamp
          };
        } else {
          updatedRecent = [
            {
              id: `${payload.host}-${payload.timestamp}`,
              name: payload.name,
              host: payload.host,
              pageOrigin: payload.pageOrigin,
              category: payload.category,
              count: 1,
              lastBlockedAt: payload.timestamp
            },
            ...prev.recentTrackers
          ].slice(0, 35);
        }

        return {
          totalBlockedCount: prev.totalBlockedCount + 1,
          sessionBlockedCount: prev.sessionBlockedCount + 1,
          estimatedBytesSaved: prev.estimatedBytesSaved + payload.bytesSaved,
          estimatedTimeSavedMs: prev.estimatedTimeSavedMs + payload.timeSavedMs,
          byCategory: {
            ...prev.byCategory,
            [payload.category]: (prev.byCategory[payload.category] || 0) + 1
          },
          recentTrackers: updatedRecent
        };
      });
    });

    const offDownload = window.tesseraApi.onDownloadUpdated((item) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((d) => d.id === item.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = item;
          return next;
        }
        return [item, ...prev];
      });
      setActiveDownloadBanner(item);
    });

    const offExtUrl = window.tesseraApi.onOpenExternalUrl((rawUrl) => {
      const targetUrl = resolveNavigationInput(rawUrl, settings.searchEngine);
      const newTab: BrowserTab = {
        ...createInitialBlankTab(activeSpaceId, isIncognitoMode),
        url: targetUrl,
        title: extractCleanHost(targetUrl),
        isHomePage: false
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    });

    const offBridgeStatus = window.tesseraApi.onBridgeStatusChanged(setBridgeStatus);
    const offBridgeImport = window.tesseraApi.onBridgeStateImported(({ nextState }) => {
      setFavorites(nextState.speedDialItems);
      setHistory(nextState.history);
      setSpaces(nextState.spaces);
      setSettings(nextState.settings);
    });

    return () => {
      offTracker();
      offDownload();
      offExtUrl();
      offBridgeStatus();
      offBridgeImport();
    };
  }, [activeSpaceId, isIncognitoMode, settings.searchEngine]);

  // Actions
  const updateTab = useCallback((tabId: string, patch: Partial<BrowserTab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...patch } : t)));
  }, []);

  const navigateActiveTab = useCallback(
    (rawInput: string) => {
      if (!activeTab) return;
      const targetUrl = resolveNavigationInput(rawInput, settings.searchEngine);
      setSearchSuggestions([]);
      setReaderArticle(null);
      updateTab(activeTab.id, {
        url: targetUrl,
        title: extractCleanHost(targetUrl),
        isHomePage: false,
        progress: 0.25,
        isLoading: true
      });
      setTimeout(() => {
        webStageRef.current?.navigateActive(targetUrl);
      }, 0);
    },
    [activeTab, settings.searchEngine, updateTab]
  );

  const openNewTab = useCallback(
    (groupId: string | null = null, initialUrl?: string) => {
      const fresh = createInitialBlankTab(activeSpaceId, isIncognitoMode, groupId);
      if (initialUrl) {
        fresh.url = resolveNavigationInput(initialUrl, settings.searchEngine);
        fresh.title = extractCleanHost(fresh.url);
        fresh.isHomePage = false;
      }
      setTabs((prev) => [...prev, fresh]);
      setActiveTabId(fresh.id);
    },
    [activeSpaceId, isIncognitoMode, settings.searchEngine]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const target = prev.find((t) => t.id === tabId);
        if (!target || target.isPinned) return prev;
        if (!target.isIncognito && !target.isHomePage) {
          setClosedTabsStack((st) => [target, ...st].slice(0, 15));
        }
        const remaining = prev.filter((t) => t.id !== tabId);
        return remaining;
      });
    },
    []
  );

  const groupTabsTogether = useCallback(
    (sourceTabId: string, targetTabId: string) => {
      if (sourceTabId === targetTabId) return;
      const source = tabs.find((t) => t.id === sourceTabId);
      const target = tabs.find((t) => t.id === targetTabId);
      if (!source || !target) return;

      const GROUP_PALETTE = [
        '#3B82F6',
        '#10B981',
        '#F59E0B',
        '#EF4444',
        '#8B5CF6',
        '#EC4899',
        '#06B6D4',
        '#14B8A6'
      ];

      if (target.groupId) {
        // Target is already in a group -> add source to target's group
        setTabs((prev) =>
          prev.map((t) => (t.id === source.id ? { ...t, groupId: target.groupId } : t))
        );
      } else if (source.groupId) {
        // Source is in a group -> add target to source's group
        setTabs((prev) =>
          prev.map((t) => (t.id === target.id ? { ...t, groupId: source.groupId } : t))
        );
      } else {
        // Neither is in a group -> create a new group containing both!
        const newGroupId = crypto.randomUUID();
        const baseTitle = target.isHomePage
          ? source.isHomePage
            ? 'Coleção'
            : extractCleanHost(source.url) || source.title || 'Novo Grupo'
          : extractCleanHost(target.url) || target.title || 'Novo Grupo';
        const cleanName = baseTitle.length > 18 ? `${baseTitle.slice(0, 18)}...` : baseTitle;
        const color =
          GROUP_PALETTE[
            tabGroups.filter((g) => g.spaceId === activeSpaceId).length % GROUP_PALETTE.length
          ];

        setTabGroups((prev) => [
          ...prev,
          { id: newGroupId, name: cleanName, colorHex: color, spaceId: activeSpaceId }
        ]);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === source.id || t.id === target.id ? { ...t, groupId: newGroupId } : t
          )
        );
      }
    },
    [tabs, tabGroups, activeSpaceId]
  );

  const reopenClosedTab = useCallback(() => {
    setClosedTabsStack((prev) => {
      if (prev.length === 0) return prev;
      const [restored, ...rest] = prev;
      const reopened = { ...restored, id: crypto.randomUUID(), spaceId: activeSpaceId };
      setTabs((t) => [...t, reopened]);
      setActiveTabId(reopened.id);
      return rest;
    });
  }, [activeSpaceId]);

  const toggleIncognitoMode = useCallback(() => {
    setIsIncognitoMode((prev) => {
      const next = !prev;
      if (next && settings.incognitoPinLockEnabled && settings.incognitoPinHash) {
        setIsIncognitoLocked(true);
      } else {
        setIsIncognitoLocked(false);
      }
      if (!next) {
        // Purge ephemeral incognito tabs & Chromium session cache on exit
        setTabs((all) => all.filter((t) => !t.isIncognito));
        void window.tesseraApi.clearIncognitoPartition('incognito_session');
      }
      return next;
    });
  }, [settings.incognitoPinHash, settings.incognitoPinLockEnabled]);

  const toggleReaderMode = useCallback(async () => {
    if (readerArticle) {
      setReaderArticle(null);
      return;
    }
    if (!activeTab || activeTab.isHomePage) return;
    const extracted = await webStageRef.current?.extractReaderArticle();
    if (extracted && extracted.blocks.length > 0) {
      setReaderArticle(extracted);
    }
  }, [activeTab, readerArticle]);

  const openAiAssistant = useCallback(
    async (autoSummarize = false, initialQuestion?: string) => {
      let payload = {
        title: activeTab?.title || 'Tessera Browser',
        domain: activeTab?.isHomePage ? '' : extractCleanHost(activeTab?.url || ''),
        url: activeTab?.url || '',
        content: ''
      };

      if (readerArticle) {
        payload = {
          title: readerArticle.title,
          domain: readerArticle.domain,
          url: activeTab?.url || '',
          content: readerArticle.plainText
        };
      } else if (activeTab && !activeTab.isHomePage) {
        const extracted = await webStageRef.current?.extractSummaryPayload();
        if (extracted) payload = extracted;
      }

      setAiState((prev) => ({
        ...prev,
        isVisible: true,
        pageTitle: payload.title,
        pageDomain: payload.domain,
        pageUrl: payload.url,
        pageContent: payload.content,
        summary: prev.pageUrl === payload.url ? prev.summary : null,
        chatMessages: prev.pageUrl === payload.url ? prev.chatMessages : [],
        error: null
      }));

      if (autoSummarize && payload.content) {
        setAiState((prev) => ({ ...prev, isSummarizing: true, error: null }));
        try {
          const summary = await window.tesseraApi.aiGenerateSummary({
            provider: aiState.activeProvider,
            pageTitle: payload.title,
            pageDomain: payload.domain,
            pageContent: payload.content
          });
          setAiState((prev) => ({ ...prev, isSummarizing: false, summary }));
        } catch (err) {
          setAiState((prev) => ({
            ...prev,
            isSummarizing: false,
            error: err instanceof Error ? err.message : 'Falha ao gerar síntese.'
          }));
        }
      } else if (initialQuestion) {
        setAiState((prev) => ({
          ...prev,
          isAnsweringQuestion: true,
          error: null,
          chatMessages: [
            ...prev.chatMessages,
            { id: crypto.randomUUID(), role: 'user', content: initialQuestion, timestamp: Date.now() }
          ]
        }));
        try {
          const answer = await window.tesseraApi.aiAskQuestion({
            provider: aiState.activeProvider,
            pageTitle: payload.title,
            pageDomain: payload.domain,
            pageContent: payload.content,
            conversationHistory: [],
            userQuestion: initialQuestion
          });
          setAiState((prev) => ({
            ...prev,
            isAnsweringQuestion: false,
            chatMessages: [
              ...prev.chatMessages,
              { id: crypto.randomUUID(), role: 'assistant', content: answer, timestamp: Date.now() }
            ]
          }));
        } catch (err) {
          setAiState((prev) => ({
            ...prev,
            isAnsweringQuestion: false,
            error: err instanceof Error ? err.message : 'Falha na consulta IA.'
          }));
        }
      }
    },
    [activeTab, aiState.activeProvider, readerArticle]
  );

  const handleListenCurrentPage = useCallback(async () => {
    if (readerArticle) {
      podcastAudioService.playContent(
        readerArticle.title,
        readerArticle.domain,
        readerArticle.plainText
      );
      return;
    }
    const payload = await webStageRef.current?.extractSummaryPayload();
    if (payload && payload.content) {
      podcastAudioService.playContent(payload.title, payload.domain, payload.content);
    }
  }, [readerArticle]);

  const toggleBookmark = useCallback(() => {
    if (!activeTab || activeTab.isHomePage) return;
    const cleanUrl = activeTab.url.replace(/\/$/, '');
    const alreadyBookmarked = favorites.some((f) => f.url.replace(/\/$/, '') === cleanUrl);
    if (alreadyBookmarked) {
      setFavorites((prev) => prev.filter((f) => f.url.replace(/\/$/, '') !== cleanUrl));
    } else {
      setFavorites((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          title: activeTab.title || extractCleanHost(activeTab.url),
          url: activeTab.url,
          badgeColorHex: activeSpace.colorHex,
          badgeColor: hexToArgb(activeSpace.colorHex)
        }
      ]);
    }
  }, [activeSpace.colorHex, activeTab, favorites]);

  const lastShortcutRef = useRef<{ action: string; time: number }>({ action: '', time: 0 });

  const executeShortcutAction = useCallback(
    (action: string) => {
      const now = Date.now();
      // Throttle identical actions within 250ms to prevent double-firing
      if (lastShortcutRef.current.action === action && now - lastShortcutRef.current.time < 250) {
        return;
      }
      lastShortcutRef.current = { action, time: now };

      switch (action) {
        case 'new-tab':
          openNewTab();
          break;
        case 'reopen-tab':
          reopenClosedTab();
          break;
        case 'close-tab':
          if (activeTab) closeTab(activeTab.id);
          break;
        case 'focus-address-bar':
          setAirBarEditTrigger((n) => n + 1);
          break;
        case 'find-in-page':
          if (activeTab && !activeTab.isHomePage) setShowFindBar(true);
          break;
        case 'next-tab':
          if (visibleTabs.length > 1) {
            const idx = visibleTabs.findIndex((t) => t.id === activeTab?.id);
            const nextIdx = (idx + 1) % visibleTabs.length;
            setActiveTabId(visibleTabs[nextIdx].id);
          }
          break;
        case 'prev-tab':
          if (visibleTabs.length > 1) {
            const idx = visibleTabs.findIndex((t) => t.id === activeTab?.id);
            const prevIdx = (idx - 1 + visibleTabs.length) % visibleTabs.length;
            setActiveTabId(visibleTabs[prevIdx].id);
          }
          break;
        case 'reload':
          if (activeTab && !activeTab.isHomePage) {
            webStageRef.current?.reload();
          }
          break;
        case 'devtools':
          void webStageRef.current?.openActiveDevTools();
          break;
        case 'reader-mode':
          void toggleReaderMode();
          break;
        case 'ai-assistant':
          void openAiAssistant(false);
          break;
        case 'history':
          setHubModalState({ open: true, tab: 1 });
          break;
        case 'downloads':
          setHubModalState({ open: true, tab: 2 });
          break;
        case 'bookmark':
          toggleBookmark();
          break;
        case 'new-incognito-tab':
          toggleIncognitoMode();
          break;
        case 'pip-toggle':
          if (activeTab && !activeTab.isHomePage) {
            void webStageRef.current?.triggerPictureInPicture(activeTab.id);
          }
          break;
        case 'voice-activate':
          voiceActivationService.activateManualListening();
          break;
        default:
          if (action.startsWith('switch-tab-')) {
            const tabNum = Number.parseInt(action.replace('switch-tab-', ''), 10);
            if (!Number.isNaN(tabNum) && tabNum >= 1 && tabNum <= visibleTabs.length) {
              setActiveTabId(visibleTabs[tabNum - 1].id);
            }
          }
          break;
      }
    },
    [
      activeTab,
      closeTab,
      openAiAssistant,
      openNewTab,
      reopenClosedTab,
      toggleBookmark,
      toggleIncognitoMode,
      toggleReaderMode,
      visibleTabs
    ]
  );

  // 1. Electron IPC Global Shortcuts (works in all tabs, even when <webview> guest is focused!)
  useEffect(() => {
    if (!window.tesseraApi?.onShortcut) return;
    const unsub = window.tesseraApi.onShortcut((action) => {
      executeShortcutAction(action);
    });
    return unsub;
  }, [executeShortcutAction]);

  // 2. Window DOM Keyboard Shortcuts (fallback when running outside Electron)
  useEffect(() => {
    // When running inside Electron, Electron's before-input-event intercepts all shortcuts
    // globally across every webview AND the main window. Skip DOM double-binding!
    if (typeof window.tesseraApi?.onShortcut === 'function') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if ((ctrl && key === 'l') || (e.altKey && key === 'd')) {
        e.preventDefault();
        executeShortcutAction('focus-address-bar');
      } else if (ctrl && !e.shiftKey && key === 't') {
        e.preventDefault();
        executeShortcutAction('new-tab');
      } else if (ctrl && e.shiftKey && key === 't') {
        e.preventDefault();
        executeShortcutAction('reopen-tab');
      } else if (ctrl && !e.shiftKey && key === 'w') {
        e.preventDefault();
        executeShortcutAction('close-tab');
      } else if (ctrl && (key === 'n' || key === 'p') && e.shiftKey) {
        e.preventDefault();
        executeShortcutAction('new-incognito-tab');
      } else if (ctrl && e.key === 'Tab') {
        e.preventDefault();
        executeShortcutAction(e.shiftKey ? 'prev-tab' : 'next-tab');
      } else if (ctrl && !e.shiftKey && /^[1-9]$/.test(key)) {
        e.preventDefault();
        executeShortcutAction(`switch-tab-${key}`);
      } else if (ctrl && key === 'f') {
        e.preventDefault();
        executeShortcutAction('find-in-page');
      } else if ((ctrl && key === 'r') || e.key === 'F5') {
        e.preventDefault();
        executeShortcutAction('reload');
      } else if (ctrl && key === 'd') {
        e.preventDefault();
        executeShortcutAction('bookmark');
      } else if (ctrl && key === 'h') {
        e.preventDefault();
        executeShortcutAction('history');
      } else if (ctrl && key === 'j') {
        e.preventDefault();
        executeShortcutAction('downloads');
      } else if (ctrl && e.shiftKey && key === 'x') {
        e.preventDefault();
        executeShortcutAction('pip-toggle');
      } else if ((ctrl && e.shiftKey && key === 'v') || (e.altKey && key === 'v')) {
        e.preventDefault();
        executeShortcutAction('voice-activate');
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        webStageRef.current?.goBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        webStageRef.current?.goForward();
      } else if (e.altKey && key === 'r') {
        e.preventDefault();
        executeShortcutAction('reader-mode');
      } else if (e.altKey && key === 'a') {
        e.preventDefault();
        executeShortcutAction('ai-assistant');
      } else if (e.key === 'F12') {
        e.preventDefault();
        executeShortcutAction('devtools');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [executeShortcutAction]);

  // Voice Assistant Subscriptions & Wake Word Sync
  useEffect(() => {
    const unsubState = voiceActivationService.subscribeState(setVoiceState);
    const unsubIntent = voiceActivationService.subscribeIntent((intent: VoiceIntent) => {
      switch (intent.type) {
        case 'search':
          navigateActiveTab(intent.query);
          break;
        case 'navigate':
          navigateActiveTab(intent.target);
          break;
        case 'ai_summary':
          void openAiAssistant(true);
          break;
        case 'ai_question':
          void openAiAssistant(false, intent.question);
          break;
        case 'podcast_read':
          void handleListenCurrentPage();
          break;
        case 'new_tab':
          openNewTab();
          break;
        case 'close_tab':
          if (activeTab) closeTab(activeTab.id);
          break;
        case 'reader_mode':
          void toggleReaderMode();
          break;
        case 'pip_video':
          if (activeTab && !activeTab.isHomePage) {
            void webStageRef.current?.triggerPictureInPicture(activeTab.id);
          }
          break;
        case 'toggle_dark':
          setSettings((prev) => ({ ...prev, isDarkMode: !prev.isDarkMode }));
          break;
      }
    });

    return () => {
      unsubState();
      unsubIntent();
    };
  }, [
    activeTab,
    closeTab,
    handleListenCurrentPage,
    navigateActiveTab,
    openAiAssistant,
    openNewTab,
    toggleReaderMode
  ]);

  useEffect(() => {
    if (settings.voiceActivationEnabled) {
      voiceActivationService.startContinuousWakeWord();
    } else {
      voiceActivationService.stopContinuousWakeWord();
    }
  }, [settings.voiceActivationEnabled]);

  if (!activeTab) return null;

  const currentOrigin = activeTab.isHomePage ? '' : extractCleanHost(activeTab.url);
  const currentSiteConfig: SiteSettings = siteSettings[currentOrigin] || {
    origin: currentOrigin,
    javascriptEnabled: true,
    adBlockWhitelisted: false,
    cameraAllowed: false,
    microphoneAllowed: false,
    geolocationAllowed: false,
    notificationsAllowed: false,
    popupsAllowed: false
  };

  const isBookmarked =
    !activeTab.isHomePage && favorites.some((f) => f.url.replace(/\/$/, '') === activeTab.url.replace(/\/$/, ''));

  const currentReaderHighlights = readerHighlights[activeTab.url] || {};

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Frameless Window Drag Strip + Discreet Windows Controls + Download Visual Banner */}
      <WindowChromeOverlay
        isHomePage={activeTab.isHomePage}
        isIncognito={isIncognitoMode}
        activeDownloadBanner={activeDownloadBanner}
        onDismissDownloadBanner={() => setActiveDownloadBanner(null)}
        onOpenDownloadsHub={() => {
          setActiveDownloadBanner(null);
          setHubModalState({ open: true, tab: 2 });
        }}
      />

      {/* Main Content Stage: Start Page vs Chromium WebView Pool */}
      <div style={{ width: '100%', height: '100%', display: activeTab.isHomePage ? 'block' : 'none' }}>
        <TesseraStartPage
          settings={settings}
          activeSpace={activeSpace}
          spaces={spaces}
          tabs={tabs}
          isIncognito={isIncognitoMode}
          favorites={favorites}
          weatherData={weatherData}
          quotesData={quotesData}
          totalBlockedCount={privacyState.totalBlockedCount}
          estimatedBytesSaved={privacyState.estimatedBytesSaved}
          onFocusAirBarSearch={() => setAirBarEditTrigger((n) => n + 1)}
          onOpenUrl={navigateActiveTab}
          onSelectSpace={setActiveSpaceId}
          onToggleIncognito={toggleIncognitoMode}
          onOpenFavoritesHub={() => setHubModalState({ open: true, tab: 0 })}
          onAddFavorite={(title, url) => {
            setFavorites((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                title,
                url,
                badgeColorHex: activeSpace.colorHex,
                badgeColor: hexToArgb(activeSpace.colorHex)
              }
            ]);
          }}
          onDeleteFavorite={(id) => setFavorites((prev) => prev.filter((f) => f.id !== id))}
          onOpenSpaces={() => setShowSpacesModal(true)}
          onOpenPrivacyDashboard={() => setShowPrivacyModal(true)}
          onOpenAiAssistant={() => void openAiAssistant(false)}
          onOpenQrBridge={() => setShowQrBridgeModal(true)}
          onOpenQuickSettings={() => setShowQuickSettings(true)}
          onRefreshWeather={() => fetchLiveWeather().then(setWeatherData).catch(() => {})}
        />
      </div>

      <div style={{ width: '100%', height: '100%', display: activeTab.isHomePage ? 'none' : 'block' }}>
        <WebViewStage
          ref={webStageRef}
          tabs={tabs}
          activeTabId={activeTab.id}
          webviewPreloadUrl={webviewPreloadUrl}
          settings={settings}
          siteSettings={siteSettings}
          onUpdateTab={updateTab}
          onRecordHistory={(title, url, spaceId, isIncog) => {
            if (isIncog || !url.startsWith('http')) return;
            setHistory((prev) => {
              if (prev[0]?.url === url) return prev;
              return [
                { id: crypto.randomUUID(), title, url, timestamp: Date.now(), spaceId },
                ...prev
              ].slice(0, 1000);
            });
          }}
          onScrollDirection={(down) => {
            if (settings.autoHideAirBar) setIsAirBarAutoHidden(down);
          }}
          onPeekLink={(url, title) => setPeekTarget({ url, title })}
          onForeignLanguageDetected={(lang) => {
            setTranslationState({
              detectedLang: lang,
              targetLang: 'pt',
              isBannerVisible: true,
              isTranslating: false,
              isTranslated: false
            });
          }}
          onReaderAvailabilityChanged={setIsReaderAvailable}
          onAskAiWithSelection={(text, mode) => {
            const prompt =
              mode === 'explain'
                ? `Explique de forma clara este trecho selecionado:\n"${text}"`
                : `Resuma objetivamente este trecho selecionado:\n"${text}"`;
            void openAiAssistant(false, prompt);
          }}
          onListenSelection={(text) =>
            podcastAudioService.playContent('Trecho Selecionado', currentOrigin, text)
          }
          onFindMatchesUpdated={(active, total) => setFindMatchInfo({ active, total })}
          onOpenNewTab={(url) => openNewTab(null, url)}
        />
      </div>

      {/* Editorial Reader Mode Screen */}
      {readerArticle && (
        <TesseraReaderScreen
          article={readerArticle}
          settings={settings}
          highlights={currentReaderHighlights}
          onClose={() => setReaderArticle(null)}
          onUpdateSettings={(partial) => setSettings((prev) => ({ ...prev, ...partial }))}
          onToggleHighlight={(idx, color) => {
            setReaderHighlights((prev) => {
              const currentForUrl = { ...(prev[activeTab.url] || {}) };
              if (currentForUrl[idx] === color) delete currentForUrl[idx];
              else currentForUrl[idx] = color;
              return { ...prev, [activeTab.url]: currentForUrl };
            });
          }}
          onClearHighlights={() => {
            setReaderHighlights((prev) => {
              const copy = { ...prev };
              delete copy[activeTab.url];
              return copy;
            });
          }}
          onListenPodcast={() =>
            podcastAudioService.playContent(
              readerArticle.title,
              readerArticle.domain,
              readerArticle.plainText
            )
          }
          onSummarizeAi={() => void openAiAssistant(true)}
          onSaveOffline={() => {
            setSavedPages((prev) => [
              {
                id: crypto.randomUUID(),
                title: readerArticle.title,
                url: activeTab.url,
                domain: readerArticle.domain,
                savedAt: Date.now(),
                article: readerArticle
              },
              ...prev.filter((p) => p.url !== activeTab.url)
            ]);
          }}
          onExportPdf={() => void webStageRef.current?.exportActivePagePdf()}
        />
      )}

      {/* Floating Tessera AirBar Dock */}
      <TesseraAirBar
        settings={settings}
        activeTab={activeTab}
        visibleTabs={visibleTabs}
        activeSpace={activeSpace}
        groups={tabGroups}
        isIncognito={isIncognitoMode}
        isBookmarked={isBookmarked}
        isReaderAvailable={isReaderAvailable}
        isReaderActive={Boolean(readerArticle)}
        isAutoHidden={isAirBarAutoHidden}
        externalEditTrigger={airBarEditTrigger}
        searchSuggestions={searchSuggestions}
        favorites={favorites}
        onRevealBar={() => setIsAirBarAutoHidden(false)}
        onQueryChange={(q) => {
          fetchSearchSuggestions(q, settings.searchEngine)
            .then(setSearchSuggestions)
            .catch(() => setSearchSuggestions([]));
        }}
        onNavigate={navigateActiveTab}
        onBack={() => {
          if (activeTab.canGoBack) {
            webStageRef.current?.goBack();
          } else if (!activeTab.isHomePage) {
            updateTab(activeTab.id, { isHomePage: true, title: 'Início' });
          }
        }}
        onForward={() => webStageRef.current?.goForward()}
        onReload={() => webStageRef.current?.reload()}
        onStopLoading={() => webStageRef.current?.stop()}
        onGoHome={() => updateTab(activeTab.id, { isHomePage: true, title: 'Início' })}
        onToggleBookmark={toggleBookmark}
        onToggleReaderMode={() => void toggleReaderMode()}
        onOpenAi={() => void openAiAssistant(false)}
        onOpenTabsModal={async () => {
          if (!activeTab.isHomePage) {
            const thumb = await webStageRef.current?.captureActiveThumbnail();
            if (thumb) updateTab(activeTab.id, { thumbnailDataUrl: thumb });
          }
          setShowTabsModal(true);
        }}
        onOpenSpacesModal={() => setShowSpacesModal(true)}
        onOpenSiteSettings={() => setShowSiteSettingsModal(true)}
        onOpenQuickSettings={() => setShowQuickSettings(true)}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        onNewTab={() => openNewTab()}
        onGroupTabs={groupTabsTogether}
        onTogglePlayPause={(tabId) => void webStageRef.current?.toggleMediaPlayPause(tabId)}
        onToggleMute={(tabId) => webStageRef.current?.toggleMediaMute(tabId)}
        onTriggerPiP={(tabId) => void webStageRef.current?.triggerPictureInPicture(tabId)}
        onOpenVoiceAssistant={() => voiceActivationService.activateManualListening()}
      />

      {/* Podcastify Floating Mini Capsule & Full Player */}
      <PodcastPlayer audioState={podcastState} airBarPosition={settings.airBarPosition} />

      {/* Tessera AI Assistant Floating Side Sheet */}
      <TesseraAiSheet
        aiState={aiState}
        onClose={() => setAiState((prev) => ({ ...prev, isVisible: false }))}
        onSelectProvider={(provider: AiProviderId) => {
          setAiState((prev) => ({ ...prev, activeProvider: provider, error: null }));
          setSettings((prev) => ({ ...prev, aiProvider: provider }));
        }}
        onSaveApiKey={async (provider, key) => {
          const status = await window.tesseraApi.aiSetApiKey(provider, key);
          setAiState((prev) => ({
            ...prev,
            hasGeminiKey: status.hasGeminiKey,
            hasGroqKey: status.hasGroqKey,
            error: null
          }));
        }}
        onGenerateSummary={async () => {
          setAiState((prev) => ({ ...prev, isSummarizing: true, error: null }));
          try {
            let content = aiState.pageContent;
            let title = aiState.pageTitle;
            let domain = aiState.pageDomain;
            if (!content && !activeTab.isHomePage) {
              const extracted = await webStageRef.current?.extractSummaryPayload();
              if (extracted) {
                content = extracted.content;
                title = extracted.title;
                domain = extracted.domain;
              }
            }
            const summary = await window.tesseraApi.aiGenerateSummary({
              provider: aiState.activeProvider,
              pageTitle: title,
              pageDomain: domain,
              pageContent: content || 'Página inicial do Tessera Browser.'
            });
            setAiState((prev) => ({ ...prev, isSummarizing: false, summary, pageContent: content }));
          } catch (err) {
            setAiState((prev) => ({
              ...prev,
              isSummarizing: false,
              error: err instanceof Error ? err.message : 'Erro na síntese.'
            }));
          }
        }}
        onAskQuestion={async (userQuestion) => {
          const historySnapshot = aiState.chatMessages;
          setAiState((prev) => ({
            ...prev,
            isAnsweringQuestion: true,
            error: null,
            chatMessages: [
              ...prev.chatMessages,
              { id: crypto.randomUUID(), role: 'user', content: userQuestion, timestamp: Date.now() }
            ]
          }));
          try {
            const reply = await window.tesseraApi.aiAskQuestion({
              provider: aiState.activeProvider,
              pageTitle: aiState.pageTitle || activeTab.title,
              pageDomain: aiState.pageDomain || currentOrigin,
              pageContent: aiState.pageContent,
              conversationHistory: historySnapshot,
              userQuestion
            });
            setAiState((prev) => ({
              ...prev,
              isAnsweringQuestion: false,
              chatMessages: [
                ...prev.chatMessages,
                { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: Date.now() }
              ]
            }));
          } catch (err) {
            setAiState((prev) => ({
              ...prev,
              isAnsweringQuestion: false,
              error: err instanceof Error ? err.message : 'Erro ao responder.'
            }));
          }
        }}
        onListenText={(title, text) => podcastAudioService.playContent(title, 'Tessera AI', text)}
      />

      {/* Utility Overlays (Find in Page, Inline Translate, Peek Preview, QR Bridge, Incognito PIN Lock) */}
      <FindInPageBar
        visible={showFindBar}
        query={findQuery}
        activeMatch={findMatchInfo.active}
        totalMatches={findMatchInfo.total}
        onQueryChange={(q) => {
          setFindQuery(q);
          if (q.trim()) webStageRef.current?.findInPage(q, true, false);
          else {
            webStageRef.current?.stopFindInPage();
            setFindMatchInfo({ active: 0, total: 0 });
          }
        }}
        onNext={() => webStageRef.current?.findInPage(findQuery, true, true)}
        onPrev={() => webStageRef.current?.findInPage(findQuery, false, true)}
        onClose={() => {
          setShowFindBar(false);
          webStageRef.current?.stopFindInPage();
        }}
      />

      <TranslateBar
        state={translationState}
        onTranslate={() => {
          setTranslationState((p) => ({ ...p, isTranslating: true }));
          void webStageRef.current?.translateActivePage().then(() => {
            setTimeout(() => {
              setTranslationState((p) => ({ ...p, isTranslating: false, isTranslated: true }));
            }, 900);
          });
        }}
        onRevert={() => {
          setTranslationState((p) => ({ ...p, isTranslated: false, isTranslating: false }));
          void webStageRef.current?.revertTranslateActivePage();
        }}
        onDismiss={() => setTranslationState((p) => ({ ...p, isBannerVisible: false }))}
      />

      <PeekPreviewModal
        peek={peekTarget}
        partition={isIncognitoMode ? 'incognito_session' : `persist:${activeSpaceId}`}
        onPromoteToTab={(url) => openNewTab(null, url)}
        onClose={() => setPeekTarget(null)}
      />

      <QrBridgeModal
        visible={showQrBridgeModal}
        currentUrl={activeTab.isHomePage ? '' : activeTab.url}
        currentTitle={activeTab.title}
        bridgeStatus={bridgeStatus}
        onStartBridge={() => {
          window.tesseraApi.bridgeStart().then(setBridgeStatus).catch(() => {});
        }}
        onStopBridge={() => {
          window.tesseraApi.bridgeStop().then(setBridgeStatus).catch(() => {});
        }}
        onClose={() => setShowQrBridgeModal(false)}
      />

      <IncognitoLockOverlay
        visible={isIncognitoMode && isIncognitoLocked}
        expectedPinHash={settings.incognitoPinHash}
        onUnlocked={() => setIsIncognitoLocked(false)}
        onExitIncognito={toggleIncognitoMode}
      />

      {/* Modals (Spaces, Tabs/Groups, QuickSettings, FullSettings, Hub, PrivacyDashboard, SiteSettings) */}
      <SpacesModal
        visible={showSpacesModal}
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        isIncognito={isIncognitoMode}
        tabs={tabs}
        onSelectSpace={(spaceId) => {
          if (isIncognitoMode) setIsIncognitoMode(false);
          void window.tesseraApi.ensurePartition(`persist:${spaceId}`);
          setActiveSpaceId(spaceId);
        }}
        onToggleIncognito={toggleIncognitoMode}
        onCreateSpace={(name, iconEmoji, colorHex, colorArgb) => {
          const newSpace: BrowserSpace = {
            id: `space_${Date.now()}`,
            name,
            iconEmoji,
            colorHex,
            colorArgb,
            isDefault: false
          };
          void window.tesseraApi.ensurePartition(`persist:${newSpace.id}`);
          setSpaces((prev) => [...prev, newSpace]);
          setIsIncognitoMode(false);
          setActiveSpaceId(newSpace.id);
        }}
        onDeleteSpace={(spaceId) => {
          setSpaces((prev) => prev.filter((s) => s.id !== spaceId));
          setTabs((prev) => prev.filter((t) => t.spaceId !== spaceId));
          if (activeSpaceId === spaceId) setActiveSpaceId('space_general');
        }}
        onClose={() => setShowSpacesModal(false)}
      />

      <TabsModal
        visible={showTabsModal}
        tabs={visibleTabs}
        activeTabId={activeTab.id}
        groups={tabGroups}
        activeSpace={activeSpace}
        isIncognito={isIncognitoMode}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        onNewTab={(groupId) => openNewTab(groupId ?? null)}
        onTogglePinTab={(id) =>
          setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isPinned: !t.isPinned } : t)))
        }
        onToggleMuteTab={(id) =>
          setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isMuted: !t.isMuted } : t)))
        }
        onGroupTabs={groupTabsTogether}
        onAssignTabToGroup={(tabId, groupId) => updateTab(tabId, { groupId })}
        onDeleteGroup={(groupId) => {
          setTabGroups((prev) => prev.filter((g) => g.id !== groupId));
          setTabs((prev) => prev.map((t) => (t.groupId === groupId ? { ...t, groupId: null } : t)));
        }}
        onClose={() => setShowTabsModal(false)}
      />

      <QuickSettingsPanel
        visible={showQuickSettings}
        settings={settings}
        isWebPageActive={!activeTab.isHomePage}
        isIncognito={isIncognitoMode}
        onUpdateSettings={(partial) => setSettings((prev) => ({ ...prev, ...partial }))}
        onPickCustomWallpaper={async () => {
          const dataUrl = await window.tesseraApi.pickCustomWallpaper();
          if (dataUrl) {
            setSettings((prev) => ({
              ...prev,
              showWallpaper: true,
              customWallpaperDataUrl: dataUrl
            }));
          }
        }}
        onOpenHub={(tab) => setHubModalState({ open: true, tab })}
        onOpenPrivacyDashboard={() => setShowPrivacyModal(true)}
        onOpenReaderMode={() => void toggleReaderMode()}
        onListenPodcast={() => void handleListenCurrentPage()}
        onOpenFindInPage={() => setShowFindBar(true)}
        onTriggerTranslate={() =>
          setTranslationState({
            detectedLang: 'auto',
            targetLang: 'pt',
            isBannerVisible: true,
            isTranslating: false,
            isTranslated: false
          })
        }
        onExportPdf={() => void webStageRef.current?.exportActivePagePdf()}
        onOpenDevTools={() => void webStageRef.current?.openActiveDevTools()}
        onOpenQrBridge={() => setShowQrBridgeModal(true)}
        onToggleIncognito={toggleIncognitoMode}
        onOpenFullSettings={() => setShowFullSettings(true)}
        onClose={() => setShowQuickSettings(false)}
      />

      <FullSettingsModal
        visible={showFullSettings}
        settings={settings}
        isDefaultBrowser={isDefaultBrowser}
        onUpdateSettings={(partial) => setSettings((prev) => ({ ...prev, ...partial }))}
        onSetDefaultBrowser={async () => {
          const ok = await window.tesseraApi.setDefaultBrowser();
          setIsDefaultBrowser(ok);
        }}
        onExportBackup={() => void window.tesseraApi.exportBackupToFile(buildPersistedSnapshot())}
        onImportBackup={async () => {
          const res = await window.tesseraApi.importBackupFromFile(buildPersistedSnapshot());
          if (res) {
            setFavorites(res.nextState.speedDialItems);
            setHistory(res.nextState.history);
            setSpaces(res.nextState.spaces);
            setSettings(res.nextState.settings);
          }
        }}
        onOpenQrBridge={() => setShowQrBridgeModal(true)}
        onClose={() => setShowFullSettings(false)}
      />

      <HubModal
        visible={hubModalState.open}
        initialTab={hubModalState.tab}
        favorites={favorites}
        history={history}
        downloads={downloads}
        savedPages={savedPages}
        onOpenUrl={navigateActiveTab}
        onOpenSavedArticle={(saved) => setReaderArticle(saved.article)}
        onDeleteFavorite={(id) => setFavorites((prev) => prev.filter((f) => f.id !== id))}
        onClearHistory={() => setHistory([])}
        onDeleteSavedPage={(id) => setSavedPages((prev) => prev.filter((s) => s.id !== id))}
        onClose={() => setHubModalState((p) => ({ ...p, open: false }))}
      />

      <PrivacyDashboardModal
        visible={showPrivacyModal}
        privacy={privacyState}
        adBlockEnabled={settings.adBlockEnabled}
        onToggleAdBlock={(v) => setSettings((prev) => ({ ...prev, adBlockEnabled: v }))}
        onClose={() => setShowPrivacyModal(false)}
      />

      <SiteSettingsModal
        visible={showSiteSettingsModal}
        origin={currentOrigin}
        config={currentSiteConfig}
        onUpdate={(next) => {
          setSiteSettings((prev) => ({ ...prev, [currentOrigin]: next }));
        }}
        onClose={() => setShowSiteSettingsModal(false)}
      />

      {/* Voice Assistant / Wake Word Siri-Style Animated Capsule Overlay */}
      <VoiceAssistantOverlay
        state={voiceState}
        onCancel={() => voiceActivationService.cancel()}
        onExecuteCommandChip={(cmd) => {
          voiceActivationService.executeManualCommand(cmd);
        }}
      />
    </div>
  );
};
