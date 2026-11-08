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
  GOOGLE_AUTH_FIREFOX_UA,
  isAuthProtectedHostname,
  isGoogleAuthHost,
  isGoogleLoginEndpoint
} from '../electron/privacyEngine';

describe('Google Sign-In & Chromium Auth Compatibility', () => {
  it('gera User-Agent Firefox para endpoints de login Google e Chromium reduzido para navegação geral', () => {
    const ua = getStandardChromiumUserAgent();
    expect(ua).not.toMatch(/Electron\//i);
    expect(ua).not.toMatch(/Tessera/i);
    expect(ua).not.toContain('120.0.6099.225');
    expect(ua).toMatch(/Mozilla\/5\.0 \(Windows NT 10\.0; Win64; x64\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/\d+\.0\.0\.0 Safari\/537\.36/);

    expect(GOOGLE_AUTH_FIREFOX_UA).toContain('Firefox');
    expect(GOOGLE_AUTH_FIREFOX_UA).not.toContain('Chrome');
    expect(GOOGLE_AUTH_FIREFOX_UA).not.toContain('Electron');
  });

  it('identifica endpoints de login Google especificamente para contorno seguro do BotGuard', () => {
    expect(isGoogleLoginEndpoint('accounts.google.com')).toBe(true);
    expect(isGoogleLoginEndpoint('accounts.youtube.com')).toBe(true);
    expect(isGoogleLoginEndpoint('myaccount.google.com')).toBe(true);
    expect(isGoogleLoginEndpoint('oauth2.googleapis.com')).toBe(true);
    expect(isGoogleLoginEndpoint('gds.google.com')).toBe(true);
    expect(isGoogleLoginEndpoint('x.com')).toBe(false);
    expect(isGoogleLoginEndpoint('google.com')).toBe(false);
    expect(isGoogleLoginEndpoint('youtube.com')).toBe(false);
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

  it('gera script de compatibilidade Main World preservando o protótipo NavigatorUAData e suprimindo Passkey condicional', () => {
    const script = buildChromeMainWorldCompatScript('132', '132.0.6834.210');
    expect(script).toContain('Object.getPrototypeOf(navigator.userAgentData)');
    expect(script).toContain('132.0.6834.210');
    expect(script).toContain('Google Chrome');
    expect(script).toContain('PublicKeyCredential.isConditionalMediationAvailable');
    expect(script).toContain('return false');
    expect(script).toContain('mediation === \'conditional\'');
    expect(script).toContain('options.identity');
    expect(script).toContain('IdentityCredential');
  });

  it('valida que o script de compatibilidade desativa mediação condicional do WebAuthn', async () => {
    const script = buildChromeMainWorldCompatScript('156', '156.0.8078.75');
    class MockUAData {}
    const mockWindow: any = {
      PublicKeyCredential: {
        isConditionalMediationAvailable: async () => true
      },
      IdentityCredential: function() {},
      navigator: {
        userAgentData: new MockUAData(),
        credentials: {
          get: vi.fn()
        }
      }
    };

    const fn = new Function('window', 'navigator', `${script}`);
    fn(mockWindow, mockWindow.navigator);

    expect(await mockWindow.PublicKeyCredential.isConditionalMediationAvailable()).toBe(false);
    expect(mockWindow.IdentityCredential).toBeUndefined();

    // Testa chamada de mediação condicional interceptada retornando null (sem travar a página)
    const conditionalPromise = mockWindow.navigator.credentials.get({ mediation: 'conditional' });
    expect(mockWindow.navigator.credentials.get).toBeDefined();
    expect(conditionalPromise).toBeInstanceOf(Promise);
    expect(await conditionalPromise).toBeNull();

    // Testa chamada com identity (FedCM) rejeitada com NotSupportedError para ativar fallback de popup
    await expect(mockWindow.navigator.credentials.get({ identity: {} })).rejects.toThrow(
      /Federated credential mediation is not supported/
    );
  });

  it('não injeta mocks de window.chrome nem modifica protótipos em accounts.google.com', () => {
    const script = buildChromeMainWorldCompatScript('156', '156.0.8078.75');
    class MockUAData {}
    const mockWindow: any = {
      location: { hostname: 'accounts.google.com' },
      chrome: { csi: () => {}, app: {} },
      navigator: {
        userAgentData: new MockUAData()
      }
    };

    const fn = new Function('window', 'navigator', `${script}`);
    fn(mockWindow, mockWindow.navigator);

    expect(mockWindow.chrome).toBeUndefined();
    expect(mockWindow.IdentityCredential).toBeUndefined();
    expect(mockWindow.navigator.userAgentData).toBeUndefined();
  });
});
