import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  session: {
    defaultSession: {},
    fromPartition: vi.fn()
  }
}));

import {
  buildChromeClientHintHeaders,
  buildChromeMainWorldCompatScript,
  getStandardChromiumUserAgent,
  isAuthProtectedHostname,
  isGoogleAuthHost
} from '../electron/privacyEngine';

describe('Google Sign-In & Chromium Auth Compatibility', () => {
  it('gera User-Agent Chromium reduzido padrão sem tokens Electron/Tessera e alinhado à versão major', () => {
    const ua = getStandardChromiumUserAgent();
    expect(ua).not.toMatch(/Electron\//i);
    expect(ua).not.toMatch(/Tessera/i);
    expect(ua).not.toContain('120.0.6099.225');
    expect(ua).toMatch(/Mozilla\/5\.0 \(Windows NT 10\.0; Win64; x64\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/\d+\.0\.0\.0 Safari\/537\.36/);
  });

  it('identifica domínios críticos de autenticação OAuth/SSO para proteção contra injeção DOM e falso-positivo de bloqueio', () => {
    expect(isAuthProtectedHostname('accounts.google.com')).toBe(true);
    expect(isAuthProtectedHostname('gds.google.com')).toBe(true);
    expect(isAuthProtectedHostname('oauth2.googleapis.com')).toBe(true);
    expect(isAuthProtectedHostname('ssl.gstatic.com')).toBe(true);
    expect(isAuthProtectedHostname('login.microsoftonline.com')).toBe(true);
    expect(isAuthProtectedHostname('doubleclick.net')).toBe(false);
    expect(isAuthProtectedHostname('example.com')).toBe(false);
  });

  it('identifica hosts de autenticação Google para injeção de Client Hints autênticos do Google Chrome', () => {
    expect(isGoogleAuthHost('accounts.google.com')).toBe(true);
    expect(isGoogleAuthHost('myaccount.google.com')).toBe(true);
    expect(isGoogleAuthHost('apis.google.com')).toBe(true);
    expect(isGoogleAuthHost('ssl.gstatic.com')).toBe(true);
    expect(isGoogleAuthHost('www.google.com')).toBe(true);
    expect(isGoogleAuthHost('youtube.com')).toBe(true);
    expect(isGoogleAuthHost('accounts.youtube.com')).toBe(true);
    expect(isGoogleAuthHost('github.com')).toBe(false);
  });

  it('gera os 11 cabeçalhos Accept-CH de alta entropia do Google Chrome com versões completas de 4 segmentos', () => {
    const high = buildChromeClientHintHeaders('132', '132.0.6834.210', true);
    expect(Object.keys(high)).toHaveLength(11);
    expect(high['sec-ch-ua']).toContain('"Google Chrome";v="132"');
    expect(high['sec-ch-ua-full-version']).toBe('"132.0.6834.210"');
    expect(high['sec-ch-ua-full-version-list']).toContain('"Google Chrome";v="132.0.6834.210"');
    expect(high['sec-ch-ua-form-factors']).toBe('"Desktop"');
    expect(high['sec-ch-ua-wow64']).toBe('?0');

    const low = buildChromeClientHintHeaders('132', '132.0.6834.210', false);
    expect(Object.keys(low)).toHaveLength(3);
  });

  it('gera script de compatibilidade Main World preservando o protótipo NavigatorUAData', () => {
    const script = buildChromeMainWorldCompatScript('132', '132.0.6834.210');
    expect(script).toContain('Object.getPrototypeOf(navigator.userAgentData)');
    expect(script).toContain('132.0.6834.210');
    expect(script).toContain('Google Chrome');
  });
});
