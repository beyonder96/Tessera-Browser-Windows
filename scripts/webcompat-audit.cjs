const { app, BrowserWindow, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Disable FedCM and native Windows passkey modal exactly as in production
app.commandLine.appendSwitch('disable-features', 'FedCm,WebAuthenticationUseNativeWinApi');

const chromeMajor = (process.versions.chrome || '156.0.0.0').split('.')[0];
const standardChromeUa = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;
const GOOGLE_AUTH_FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0';

app.userAgentFallback = standardChromeUa;

const webviewPreloadPath = path.join(__dirname, '..', 'dist-electron', 'webview-preload.cjs');

function isGoogleLoginEndpoint(hostname) {
  const h = (hostname || '').toLowerCase().trim();
  return (
    h === 'accounts.google.com' ||
    h.endsWith('.accounts.google.com') ||
    h === 'accounts.youtube.com' ||
    h.endsWith('.accounts.youtube.com') ||
    h === 'myaccount.google.com' ||
    h === 'oauth2.googleapis.com' ||
    h === 'gds.google.com'
  );
}

const results = [];

function recordResult(name, passed, details) {
  results.push({ name, passed, details, timestamp: new Date().toISOString() });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[AUDIT] ${icon} - ${name}: ${details}`);
}

async function runAudit() {
  console.log('\n=============================================================');
  console.log('  TESSERA BROWSER — AUDITORIA DE COMPATIBILIDADE WEB & POPUPS');
  console.log('  Electron:', process.versions.electron, '| Chromium:', process.versions.chrome);
  console.log('=============================================================\n');

  const ses = session.fromPartition('persist:audit_' + Date.now());
  ses.setUserAgent(standardChromeUa);

  // Network-layer Google login UA delegation (exactly as in privacyEngine.ts)
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    try {
      const u = new URL(details.url);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        const host = u.hostname.toLowerCase();
        if (isGoogleLoginEndpoint(host)) {
          const headers = { ...details.requestHeaders };
          for (const k of Object.keys(headers)) {
            const l = k.toLowerCase();
            if (l === 'user-agent' || l.startsWith('sec-ch-ua')) {
              delete headers[k];
            }
          }
          headers['User-Agent'] = GOOGLE_AUTH_FIREFOX_UA;
          callback({ requestHeaders: headers });
          return;
        }
      }
    } catch {}
    callback({ requestHeaders: details.requestHeaders });
  });

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      session: ses,
      preload: fs.existsSync(webviewPreloadPath) ? webviewPreloadPath : undefined,
      sandbox: true,
      contextIsolation: true
    }
  });

  let popupWindowInstance = null;
  let interceptedPopupUrl = '';
  let interceptedTabUrl = '';

  win.webContents.setWindowOpenHandler((details) => {
    const url = details.url || '';
    const isOAuth =
      /^https:\/\/([^/]+\.)?(accounts\.google\.com|appleid\.apple\.com|login\.microsoftonline\.com|login\.live\.com|github\.com\/login\/oauth)/i.test(
        url
      ) || /[?&](client_id|response_type|redirect_uri)=/i.test(url);

    const hasFeatures = details.features && /(width|height|popup)/i.test(details.features);
    const isPopup = isOAuth || url === 'about:blank' || details.disposition === 'new-window' || hasFeatures;

    if (isPopup) {
      interceptedPopupUrl = url;
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          show: false,
          width: 600,
          height: 720,
          frame: true,
          webPreferences: {
            session: ses,
            preload: fs.existsSync(webviewPreloadPath) ? webviewPreloadPath : undefined,
            sandbox: true,
            contextIsolation: true
          }
        }
      };
    }

    if (/^https?:\/\//i.test(url)) {
      interceptedTabUrl = url;
    }
    return { action: 'deny' };
  });

  app.on('browser-window-created', (_e, popup) => {
    if (popup !== win) {
      popupWindowInstance = popup;
    }
  });

  // Helper to monitor navigations and test page load
  async function testPage(name, url, timeoutMs = 20000, extraCheck = null) {
    let mainNavCount = 0;
    let finishLoaded = false;
    let failedCode = null;

    const navHandler = (_e, navUrl, isInPlace, isMainFrame) => {
      if (isMainFrame && !isInPlace) {
        mainNavCount++;
      }
    };
    const finishHandler = () => { finishLoaded = true; };
    const failHandler = (_e, errorCode, desc, failUrl, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) failedCode = errorCode;
    };

    win.webContents.on('did-start-navigation', navHandler);
    win.webContents.on('did-finish-load', finishHandler);
    win.webContents.on('did-fail-load', failHandler);

    try {
      await win.loadURL(url).catch((err) => {
        const msg = err.message || '';
        if (!msg.includes('ERR_ABORTED') && !msg.includes('-3')) {
          if (!finishLoaded) failedCode = msg;
        }
      });

      // Wait a few seconds to verify no infinite reload loop
      await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 5000)));

      let extraOk = true;
      let extraMsg = '';
      if (extraCheck) {
        try {
          const res = await extraCheck(win);
          extraOk = res.ok;
          extraMsg = res.msg || '';
        } catch (e) {
          extraOk = false;
          extraMsg = e.message;
        }
      }

      const noReloadLoop = mainNavCount <= 3;
      const passed = !failedCode && noReloadLoop && extraOk;
      const msg = `Navs: ${mainNavCount}, Carregou: ${finishLoaded}, Falhas: ${failedCode || 'nenhuma'}${extraMsg ? ' | ' + extraMsg : ''}`;
      recordResult(name, passed, msg);
    } catch (err) {
      recordResult(name, false, `Erro ao carregar: ${err.message}`);
    } finally {
      win.webContents.removeListener('did-start-navigation', navHandler);
      win.webContents.removeListener('did-finish-load', finishHandler);
      win.webContents.removeListener('did-fail-load', failHandler);
    }
  }

  // --- CENÁRIO 1: X.COM LOGIN & GOOGLE POPUP ---
  console.log('\n--- Testando Cenário 1: X.com Google Sign-In & Popup OAuth ---');
  try {
    let xMainNavs = 0;
    const xNavHandler = (_e, _u, inPlace, isMain) => {
      if (isMain && !inPlace) xMainNavs++;
    };
    win.webContents.on('did-start-navigation', xNavHandler);

    await win.loadURL('https://x.com');
    await new Promise((r) => setTimeout(r, 2000));

    // Clica no link de login
    await win.webContents.executeJavaScript(`
      document.querySelector('a[href*="/i/jf/onboarding/web?mode=login"]')?.click();
    `).catch(() => {});

    // Aguarda o frame do GSI
    let gsiFrame = null;
    for (let i = 0; i < 12 && !gsiFrame; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      gsiFrame = win.webContents.mainFrame.frames.find((f) => f.url.includes('accounts.google.com/gsi/button'));
    }

    if (gsiFrame) {
      console.log('   Frame GSI encontrado. Clicando no botão do Google...');
      await gsiFrame.executeJavaScript(`(document.querySelector('div[role="button"]') || document.body).click()`).catch(() => {});
      await new Promise((r) => setTimeout(r, 5000));
    }

    win.webContents.removeListener('did-start-navigation', xNavHandler);

    const xNoLoop = xMainNavs <= 4;
    const popupOpened = !!popupWindowInstance && !popupWindowInstance.isDestroyed();
    const popupUrlOk = interceptedPopupUrl.includes('accounts.google.com');

    let popupContentOk = false;
    if (popupOpened) {
      const popupTitle = popupWindowInstance.webContents.getTitle();
      const popupBody = await popupWindowInstance.webContents.executeJavaScript('document.body.innerText.slice(0, 100)').catch(() => '');
      popupContentOk = popupTitle.includes('Google') || popupBody.includes('Google');
      popupWindowInstance.close();
      popupWindowInstance = null;
    }

    recordResult(
      'X.com Login Flow & Google OAuth Popup',
      xNoLoop && popupOpened && popupUrlOk && popupContentOk,
      `X Navs: ${xMainNavs} (sem loop), Popup aberto: ${popupOpened}, URL OAuth: ${popupUrlOk}, Conteúdo Google: ${popupContentOk}`
    );
  } catch (err) {
    recordResult('X.com Login Flow & Google OAuth Popup', false, err.message);
  }

  // --- CENÁRIO 2: GEMINI ---
  console.log('\n--- Testando Cenário 2: Gemini (SPA & Estabilidade) ---');
  await testPage('Google Gemini (gemini.google.com)', 'https://gemini.google.com', 8000, async (w) => {
    const title = w.webContents.getTitle();
    return { ok: title.length > 0, msg: `Título: "${title}"` };
  });

  // --- CENÁRIO 3: ACCOUNTS.GOOGLE.COM (LOGIN DIRETO) ---
  console.log('\n--- Testando Cenário 3: Google Accounts Direct ---');
  await testPage('Google Accounts (Login Direto)', 'https://accounts.google.com', 8000, async (w) => {
    const url = w.webContents.getURL();
    const title = w.webContents.getTitle();
    const notRejected = !url.includes('rejected');
    return { ok: notRejected && title.includes('Google'), msg: `URL: ${url.slice(0, 50)}...` };
  });

  // --- CENÁRIO 4: YOUTUBE ---
  console.log('\n--- Testando Cenário 4: YouTube ---');
  await testPage('YouTube (youtube.com)', 'https://www.youtube.com', 8000, async (w) => {
    const title = w.webContents.getTitle();
    return { ok: title.toLowerCase().includes('youtube'), msg: `Título: "${title}"` };
  });

  // --- CENÁRIO 5: CHATGPT ---
  console.log('\n--- Testando Cenário 5: ChatGPT ---');
  await testPage('ChatGPT (chatgpt.com)', 'https://chatgpt.com', 8000);

  // --- CENÁRIO 6: GITHUB LOGIN ---
  console.log('\n--- Testando Cenário 6: GitHub Login ---');
  await testPage('GitHub Login (github.com/login)', 'https://github.com/login', 6000, async (w) => {
    const hasInput = await w.webContents.executeJavaScript('!!document.querySelector("input[name=login]")');
    return { ok: hasInput, msg: `Input de login: ${hasInput}` };
  });

  // --- CENÁRIO 7: REDDIT LOGIN ---
  console.log('\n--- Testando Cenário 7: Reddit Login ---');
  await testPage('Reddit Login (reddit.com/login)', 'https://www.reddit.com/login', 8000);

  // --- CENÁRIO 8: WHATSAPP WEB ---
  console.log('\n--- Testando Cenário 8: WhatsApp Web ---');
  await testPage('WhatsApp Web (web.whatsapp.com)', 'https://web.whatsapp.com', 8000, async (w) => {
    const title = w.webContents.getTitle();
    return { ok: title.toLowerCase().includes('whatsapp'), msg: `Título: "${title}"` };
  });

  // --- CENÁRIO 9: TESTE SINTÉTICO DE ROTEAMENTO (POPUP VS ABA) ---
  console.log('\n--- Testando Cenário 9: Roteamento Sintético window.open ---');
  try {
    interceptedPopupUrl = '';
    interceptedTabUrl = '';

    await win.loadURL('data:text/html,<html><body><h1>Teste Roteamento</h1></body></html>');

    // 1. Testa window.open com dimensões -> deve abrir popup
    await win.webContents.executeJavaScript(`(function() { window.open('https://example.com/popup', '_blank', 'width=500,height=400'); return true; })()`);
    await new Promise((r) => setTimeout(r, 600));
    const auxPopupOk = interceptedPopupUrl === 'https://example.com/popup';

    // 2. Testa window.open normal sem dimensões -> deve virar aba (tab)
    await win.webContents.executeJavaScript(`(function() { window.open('https://example.com/tab', '_blank'); return true; })()`);
    await new Promise((r) => setTimeout(r, 600));
    const tabOk = interceptedTabUrl === 'https://example.com/tab';

    if (popupWindowInstance && !popupWindowInstance.isDestroyed()) {
      popupWindowInstance.close();
      popupWindowInstance = null;
    }

    recordResult(
      'Roteamento Sintético (Popup vs Aba)',
      auxPopupOk && tabOk,
      `Popup detectado: ${auxPopupOk}, Aba detectada: ${tabOk}`
    );
  } catch (err) {
    recordResult('Roteamento Sintético (Popup vs Aba)', false, err.message);
  }

  // Finalização e geração de relatório
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n=============================================================');
  console.log(`  RESULTADO DA AUDITORIA: ${passed}/${total} PASSARAM (${failed} falhas)`);
  console.log('=============================================================\n');

  // Grava o relatório em Markdown
  const reportDir = path.join(__dirname, '..', 'audit-reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `webcompat-${Date.now()}.md`);

  const mdContent = `# Relatório de Auditoria de Compatibilidade Web & Popups
Data: ${new Date().toLocaleString('pt-BR')}
Versão Electron: ${process.versions.electron}
Versão Chromium: ${process.versions.chrome}

## Resumo Executivo
- Total de Cenários: ${total}
- Cenários Aprovados: ${passed}
- Cenários Reprovados: ${failed}
- Taxa de Sucesso: ${((passed / total) * 100).toFixed(1)}%

## Detalhamento dos Cenários

| Status | Cenário | Detalhes |
| :---: | :--- | :--- |
${results.map((r) => `| ${r.passed ? '✅ PASS' : '❌ FAIL'} | **${r.name}** | ${r.details} |`).join('\n')}

---
*Gerado automaticamente pelo harness de auditoria do Tessera Browser.*
`;

  fs.writeFileSync(reportPath, mdContent, 'utf8');
  console.log(`Relatório salvo em: ${reportPath}`);

  win.destroy();
  app.exit(failed > 0 ? 1 : 0);
}

app.whenReady().then(runAudit);
