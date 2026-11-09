import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  buildPopupWindowOptions,
  classifyWindowOpen,
  configureGuestWebContents,
  hasPopupFeatures,
  isOAuthPopupUrl,
  type GuestContentsDeps
} from '../electron/guestContents';
import { isGoogleRejectionUrl } from '../src/shared/authUrls';

describe('Guest Contents & Popup Routing (Anti-Loop & Classification)', () => {
  it('classifica corretamente URLs de OAuth para provedores populares e padrões OAuth2', () => {
    expect(
      isOAuthPopupUrl(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=123&response_type=code&redirect_uri=https://x.com'
      )
    ).toBe(true);

    expect(
      isOAuthPopupUrl(
        'https://appleid.apple.com/auth/authorize?client_id=com.example&response_type=code'
      )
    ).toBe(true);

    expect(
      isOAuthPopupUrl(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=abc'
      )
    ).toBe(true);

    expect(
      isOAuthPopupUrl(
        'https://github.com/login/oauth/authorize?client_id=xyz'
      )
    ).toBe(true);

    expect(
      isOAuthPopupUrl(
        'https://my-tenant.auth0.com/authorize?client_id=123&redirect_uri=https://example.com'
      )
    ).toBe(true);

    expect(
      isOAuthPopupUrl(
        'https://accounts.spotify.com/authorize?client_id=123'
      )
    ).toBe(true);

    expect(
      isOAuthPopupUrl(
        'https://api.notion.com/v1/oauth/authorize?client_id=123'
      )
    ).toBe(true);

    expect(isOAuthPopupUrl('https://example.com/news/article-123')).toBe(false);
  });

  it('detecta features de popup que exigem janela auxiliar flutuante', () => {
    expect(hasPopupFeatures('width=600,height=700')).toBe(true);
    expect(hasPopupFeatures('width=500 height=600')).toBe(true);
    expect(hasPopupFeatures('width=500;height=600')).toBe(true);
    expect(hasPopupFeatures('popup=1')).toBe(true);
    expect(hasPopupFeatures('popup=yes')).toBe(true);
    expect(hasPopupFeatures('popup')).toBe(true);
    expect(hasPopupFeatures('toolbar=no,menubar=no')).toBe(true);
    expect(hasPopupFeatures('location=0,status=0,scrollbars=1')).toBe(true);
    expect(hasPopupFeatures('noopener,noreferrer')).toBe(false);
    expect(hasPopupFeatures(undefined)).toBe(false);
  });

  it('classifica destinos do window.open com segurança (popup vs aba vs externo vs bloqueado)', () => {
    // 1. OAuth popup
    expect(
      classifyWindowOpen({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=49625052041',
        disposition: 'new-window',
        features: 'width=590,height=824'
      })
    ).toBe('oauth-popup');

    // 2. Aux popup (scripted dialogs ou ERP popups ou popups com frameName nomeado)
    expect(
      classifyWindowOpen({
        url: 'about:blank',
        disposition: 'new-window'
      })
    ).toBe('aux-popup');

    expect(
      classifyWindowOpen({
        url: 'https://erp.internal/print_receipt.php',
        features: 'width=800,height=600'
      })
    ).toBe('aux-popup');

    // Popup disparado com nome de janela explícito (ex: google_login, auth_popup) sem features explícitas
    expect(
      classifyWindowOpen({
        url: 'https://auth.company.com/login-modal',
        frameName: 'google_login'
      })
    ).toBe('aux-popup');

    // 3. Links comuns com target="_blank" ou window.open simples abrem como abas do navegador
    expect(
      classifyWindowOpen({
        url: 'https://g1.globo.com/',
        disposition: 'foreground-tab'
      })
    ).toBe('tab');

    expect(
      classifyWindowOpen({
        url: 'https://github.com/trending',
        features: 'noopener,noreferrer'
      })
    ).toBe('tab');

    expect(
      classifyWindowOpen({
        url: 'https://github.com/trending',
        frameName: '_blank'
      })
    ).toBe('tab');

    // 4. Esquemas externos delegados para o shell do Windows
    expect(
      classifyWindowOpen({
        url: 'mailto:suporte@tessera.org'
      })
    ).toBe('external');

    expect(
      classifyWindowOpen({
        url: 'whatsapp://send?phone=5511999999999'
      })
    ).toBe('external');

    // 5. Esquemas perigosos / bloqueados
    expect(
      classifyWindowOpen({
        url: 'javascript:alert(1)'
      })
    ).toBe('deny');

    expect(
      classifyWindowOpen({
        url: 'file:///C:/Windows/System32/calc.exe'
      })
    ).toBe('deny');
  });

  it('constrói opções de BrowserWindow adequadas para popups OAuth e auxiliares', () => {
    const mockSession = {} as any;
    const preload = 'C:/dummy/preload.cjs';

    const oauthOpts = buildPopupWindowOptions(
      'oauth-popup',
      { url: 'https://accounts.google.com/o/oauth2/auth' },
      mockSession,
      preload
    );
    expect(oauthOpts.width).toBe(520);
    expect(oauthOpts.height).toBe(640);
    expect(oauthOpts.minWidth).toBe(380);
    expect(oauthOpts.minHeight).toBe(460);
    expect(oauthOpts.frame).toBe(true);
    expect(oauthOpts.center).toBe(true);

    const customOpts = buildPopupWindowOptions(
      'aux-popup',
      { url: 'https://erp.internal/print', features: 'width=750,height=550' },
      mockSession,
      preload
    );
    expect(customOpts.width).toBe(750);
    expect(customOpts.height).toBe(550);
    expect(customOpts.frame).toBe(true);
  });

  it('garante que configureGuestWebContents NUNCA altera o User-Agent em navegações (prevenindo loop de recarregamento)', () => {
    class MockWebContents extends EventEmitter {
      setUserAgent = vi.fn();
      setWindowOpenHandler = vi.fn();
      session = {};
    }

    const wc = new MockWebContents();
    const deps: GuestContentsDeps = {
      getPreloadPath: () => 'C:/dummy/preload.cjs',
      registerShortcuts: vi.fn(),
      openAsTab: vi.fn(),
      openExternal: vi.fn()
    };

    configureGuestWebContents(wc as any, deps);

    expect(deps.registerShortcuts).toHaveBeenCalledWith(wc);
    expect(wc.setWindowOpenHandler).toHaveBeenCalled();

    // Simula navegações do main frame e subframes para accounts.google.com e x.com
    wc.emit('did-start-navigation', {}, 'https://x.com/i/jf/onboarding/web?mode=login', false, true);
    wc.emit(
      'did-start-navigation',
      {},
      'https://accounts.google.com/gsi/button?client_id=123',
      false,
      false
    );
    wc.emit(
      'did-start-navigation',
      {},
      'https://accounts.google.com/o/oauth2/v2/auth',
      false,
      true
    );

    // CRÍTICO: setUserAgent NUNCA deve ser invocado em listeners de navegação!
    expect(wc.setUserAgent).not.toHaveBeenCalled();
  });

  it('isGoogleRejectionUrl avalia com rigor o path da URL e não é enganado por parâmetros de consulta', () => {
    // Páginas reais de rejeição
    expect(isGoogleRejectionUrl('https://accounts.google.com/v3/signin/rejected?flowName=GlifWebSignIn')).toBe(true);
    expect(isGoogleRejectionUrl('https://accounts.google.com/signin/rejected/identifier')).toBe(true);

    // Parâmetro continue= que cita "rejected" não deve causar wipe de cookies no meio de login válido
    expect(
      isGoogleRejectionUrl(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=123&continue=https%3A%2F%2Fmyapp.com%2Frejected-item'
      )
    ).toBe(false);

    expect(isGoogleRejectionUrl('https://x.com/rejected')).toBe(false);
    expect(isGoogleRejectionUrl('https://gemini.google.com/app')).toBe(false);
    expect(isGoogleRejectionUrl('invalid-url')).toBe(false);
  });
});
