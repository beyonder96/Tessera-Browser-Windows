export type SearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'ecosia';

export type AiProviderId = 'GEMINI' | 'GROQ';

export type AirBarPosition = 'bottom' | 'top';

export type ReaderTheme = 'LIGHT' | 'SEPIA' | 'DARK' | 'AMOLED';
export type ReaderFontFamily = 'SERIF' | 'SANS_SERIF' | 'MONOSPACE';
export type ReaderBlockType = 'H1' | 'H2' | 'H3' | 'PARAGRAPH' | 'BLOCKQUOTE' | 'LIST_ITEM' | 'IMAGE';

export type TrackerCategory = 'ADVERTISING' | 'ANALYTICS' | 'SOCIAL' | 'FINGERPRINTING';

export interface BrowserSpace {
  id: string;
  name: string;
  iconEmoji: string;
  /** Hex color `#RRGGBB` used in UI */
  colorHex: string;
  /** Android-compatible ARGB 32-bit/long integer (e.g. 0xFF0288D1) */
  colorArgb: number;
  isDefault: boolean;
}

export interface TabGroup {
  id: string;
  name: string;
  colorHex: string;
  spaceId: string;
}

export const GROUP_PALETTE = [
  '#0A84FF',
  '#30D158',
  '#FF9F0A',
  '#FF375F',
  '#BF5AF2',
  '#64D2FF',
  '#FFD60A',
  '#AC8E68'
] as const;

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isHomePage: boolean;
  isLoading?: boolean;
  progress?: number;
  canGoBack: boolean;
  canGoForward: boolean;
  isPinned: boolean;
  isMuted?: boolean;
  isPlayingMedia?: boolean;
  isIncognito?: boolean;
  themeColor?: string | null;
  thumbnailDataUrl?: string | null;
  lastAccessedTimestamp: number;
  groupId: string | null;
  spaceId: string;
}

export interface SpeedDialItem {
  id: string;
  title: string;
  url: string;
  iconAsset?: string;
  badgeColorHex: string;
  badgeColor?: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  timestamp: number;
  spaceId: string | null;
}

export type DownloadStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface DownloadItem {
  id: string;
  fileName: string;
  url: string;
  savePath: string;
  mimeType: string;
  receivedBytes: number;
  totalBytes: number;
  status: DownloadStatus;
  timestamp: number;
}

export interface SavedPageItem {
  id: string;
  title: string;
  url: string;
  domain: string;
  savedAt: number;
  article: ReaderArticle;
}

export interface SiteSettings {
  origin: string;
  javascriptEnabled: boolean;
  adBlockWhitelisted: boolean;
  cameraAllowed: boolean;
  microphoneAllowed: boolean;
  geolocationAllowed: boolean;
  notificationsAllowed: boolean;
  popupsAllowed: boolean;
}

export interface BlockedTrackerItem {
  id: string;
  name: string;
  host: string;
  pageOrigin: string;
  category: TrackerCategory;
  count: number;
  lastBlockedAt: number;
}

export interface PrivacyDashboardState {
  totalBlockedCount: number;
  sessionBlockedCount: number;
  estimatedBytesSaved: number;
  estimatedTimeSavedMs: number;
  byCategory: Record<TrackerCategory, number>;
  recentTrackers: BlockedTrackerItem[];
}

export interface ReaderBlock {
  type: ReaderBlockType;
  text: string;
  imageUrl?: string;
  caption?: string;
}

export interface ReaderArticle {
  title: string;
  author?: string;
  publishDate?: string;
  domain: string;
  readingTimeMinutes: number;
  blocks: ReaderBlock[];
  plainText: string;
}

export interface PodcastAudioState {
  isPlaying: boolean;
  isBuffering: boolean;
  title: string;
  subtitle: string;
  currentSentenceIndex: number;
  totalSentences: number;
  currentPositionMs: number;
  durationMs: number;
  playbackSpeed: number;
  selectedVoiceURI: string;
  selectedVoiceName: string;
  isMiniPlayerVisible: boolean;
  isFullPlayerOpen: boolean;
  error: string | null;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TesseraAiState {
  isVisible: boolean;
  isSummarizing: boolean;
  isAnsweringQuestion: boolean;
  pageTitle: string;
  pageDomain: string;
  pageUrl: string;
  pageContent: string;
  summary: string | null;
  chatMessages: AiChatMessage[];
  error: string | null;
  activeProvider: AiProviderId;
  hasGeminiKey: boolean;
  hasGroqKey: boolean;
}

export interface WeatherData {
  cityName: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  conditionText: string;
  weatherCode: number;
  isDay: boolean;
  isLoading: boolean;
  lastUpdated: number;
}

export interface QuoteItem {
  symbol: string;
  name: string;
  value: string;
  change: string;
  isPositive: boolean;
}

export interface QuotesData {
  items: QuoteItem[];
  isLoading: boolean;
  lastUpdated: number;
}

export interface TranslationState {
  detectedLang: string;
  targetLang: string;
  isBannerVisible: boolean;
  isTranslating: boolean;
  isTranslated: boolean;
}

export interface BrowserSettings {
  isDarkMode: boolean;
  forceDarkPages: boolean;
  adBlockEnabled: boolean;
  cookieBlockerEnabled: boolean;
  searchEngine: SearchEngineId;
  showWallpaper: boolean;
  selectedWallpaperId: string;
  customWallpaperDataUrl: string | null;
  showWeatherWidget: boolean;
  showQuotesWidget: boolean;
  digitalMinimalismMode: boolean;
  showFavoritesBar: boolean;
  showPillTabsBar: boolean;
  airBarPosition: AirBarPosition;
  autoHideAirBar: boolean;
  tesseraAiEnabled: boolean;
  aiToolbarButton: boolean;
  aiTextHighlightPrompts: boolean;
  aiProvider: AiProviderId;
  incognitoPinLockEnabled: boolean;
  incognitoPinHash: string | null;
  readerTheme: ReaderTheme;
  readerFontFamily: ReaderFontFamily;
  readerFontSizePx: number;
  readerShowImages: boolean;
  voiceActivationEnabled: boolean;
  voiceWakeWord: string;
}

export type VoiceAssistantStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceAssistantState {
  isActive: boolean;
  status: VoiceAssistantStatus;
  transcript: string;
  interimTranscript: string;
  lastResponse: string | null;
  error: string | null;
}

export interface PersistedAppState {
  spaces: BrowserSpace[];
  activeSpaceId: string;
  tabs: BrowserTab[];
  activeTabId: string;
  tabGroups: TabGroup[];
  speedDialItems: SpeedDialItem[];
  history: HistoryEntry[];
  downloads: DownloadItem[];
  savedPages: SavedPageItem[];
  siteSettings: Record<string, SiteSettings>;
  readerHighlights: Record<string, Record<number, string>>;
  privacyStats: {
    totalBlockedCount: number;
    estimatedBytesSaved: number;
    estimatedTimeSavedMs: number;
    byCategory: Record<TrackerCategory, number>;
  };
  settings: BrowserSettings;
}

/**
 * 100% compatible with Android BrowserViewModel.exportFullBackup / importFullBackup
 */
export interface TesseraAndroidCompatibleBackup {
  version: number;
  timestamp: number;
  platform?: 'android' | 'windows';
  bookmarks: Array<{
    id: string;
    title: string;
    url: string;
    badgeColor?: number;
  }>;
  history: Array<{
    id: string;
    title: string;
    url: string;
    timestamp: number;
    spaceId?: string;
  }>;
  spaces?: Array<{
    id: string;
    name: string;
    iconEmoji: string;
    colorArgb: number;
    isDefault: boolean;
  }>;
  settings?: {
    isDarkMode?: boolean;
    forceDarkPages?: boolean;
    adBlockEnabled?: boolean;
    cookieBlockerEnabled?: boolean;
    searchEngine?: string;
    selectedWallpaperId?: string;
    showWeatherWidget?: boolean;
    showQuotesWidget?: boolean;
  };
}

export interface LocalBridgeStatus {
  running: boolean;
  url: string | null;
  token: string | null;
  port: number | null;
  connectedClients: number;
  lastReceivedMessage: string | null;
}
