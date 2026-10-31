import type { TrackerCategory } from './types';

/**
 * Herdado 1:1 de com.tessera.browser.privacy.PrivacyTrackerEngine (Android v3.4.1)
 */
export const BYTES_PER_BLOCKED_REQUEST = 46000; // ~45 KB por script/banner bloqueado
export const TIME_SAVED_PER_BLOCKED_MS = 85;    // ~85 ms de latência economizada

export const KNOWN_AD_BLOCK_HOSTS: ReadonlySet<string> = new Set([
  'doubleclick.net',
  'googleadservices.com',
  'googlesyndication.com',
  'pagead2.googlesyndication.com',
  'adservice.google.com',
  'admob.com',
  'taboola.com',
  'outbrain.com',
  'popads.net',
  'adnxs.com',
  'criteo.com',
  'amazon-adsystem.com',
  'scorecardresearch.com',
  'quantserve.com',
  'zedo.com',
  'advertising.com',
  'rubiconproject.com',
  'pubmatic.com',
  'googletagservices.com',
  'adcolony.com',
  'appsflyer.com',
  'branch.io',
  'chartbeat.com',
  'smartadserver.com',
  'casalemedia.com',
  'criteo.net',
  'yieldmo.com',
  'adroll.com',
  'inmobi.com',
  'unityads.unity3d.com',
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'connect.facebook.net',
  'pixel.facebook.com',
  'hotjar.com',
  'clarity.ms',
  'optimizely.com',
  'mixpanel.com',
  'segment.io',
  'amplitude.com',
  'moatads.com',
  'iasds.com',
  'openx.net',
  'adform.net'
]);

const URL_TRACKER_PATTERNS = [
  '/pagead/',
  '/adservice/',
  '/ads/',
  '/pixel?',
  '/collect?',
  '/analytics.js',
  '/gtm.js',
  '/fbevents.js'
];

export function isAdOrTracker(host: string, url: string): boolean {
  const h = host.toLowerCase().trim();
  const u = url.toLowerCase();

  if (!h) return false;

  for (const blocked of KNOWN_AD_BLOCK_HOSTS) {
    if (h === blocked || h.endsWith(`.${blocked}`)) {
      return true;
    }
  }

  for (const pat of URL_TRACKER_PATTERNS) {
    if (u.includes(pat)) {
      return true;
    }
  }

  return false;
}

export function identifyTracker(host: string, url: string): { name: string; category: TrackerCategory } {
  const h = host.toLowerCase();
  const u = url.toLowerCase();

  if (h.includes('doubleclick') || h.includes('googlead') || h.includes('googlesyndication') || h.includes('admob')) {
    return { name: 'Google Ads & DoubleClick', category: 'ADVERTISING' };
  }
  if (h.includes('google-analytics') || h.includes('googletagmanager') || h.includes('googletagservices')) {
    return { name: 'Google Analytics & GTM', category: 'ANALYTICS' };
  }
  if (h.includes('facebook') || u.includes('fbevents.js')) {
    return { name: 'Meta Pixel & Facebook Tracker', category: 'SOCIAL' };
  }
  if (h.includes('criteo')) {
    return { name: 'Criteo Retargeting', category: 'ADVERTISING' };
  }
  if (h.includes('taboola') || h.includes('outbrain')) {
    return { name: 'Taboola / Outbrain Native Ads', category: 'ADVERTISING' };
  }
  if (h.includes('amazon-adsystem')) {
    return { name: 'Amazon Advertising', category: 'ADVERTISING' };
  }
  if (h.includes('appsflyer') || h.includes('branch.io')) {
    return { name: 'AppsFlyer & Branch Telemetria', category: 'FINGERPRINTING' };
  }
  if (h.includes('chartbeat') || h.includes('scorecardresearch') || h.includes('quantserve')) {
    return { name: 'Audience Analytics', category: 'ANALYTICS' };
  }
  if (h.includes('hotjar') || h.includes('clarity.ms')) {
    return { name: 'Heatmap & Session Recording', category: 'FINGERPRINTING' };
  }
  if (h.includes('mixpanel') || h.includes('segment') || h.includes('amplitude')) {
    return { name: 'Product Analytics Tracker', category: 'ANALYTICS' };
  }
  if (h.includes('rubicon') || h.includes('pubmatic') || h.includes('adnxs') || h.includes('openx')) {
    return { name: 'Ad Exchange RTB Network', category: 'ADVERTISING' };
  }
  if (h.includes('popads') || h.includes('zedo') || h.includes('adcolony') || h.includes('inmobi')) {
    return { name: 'Mobile Ad Network', category: 'ADVERTISING' };
  }

  const cleanHost = h.replace(/^www\./, '').split(':')[0];
  return { name: cleanHost || 'Rastreador Web', category: 'ADVERTISING' };
}
