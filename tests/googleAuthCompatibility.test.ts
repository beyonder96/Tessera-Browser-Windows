import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  session: {
    defaultSession: {},
    fromPartition: vi.fn()
  }
}));

import { getStandardChromiumUserAgent, isAuthProtectedHostname } from '../electron/privacyEngine';

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
});
