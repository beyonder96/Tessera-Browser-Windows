/**
 * Scripts DOM herdados de com.tessera.browser.ui.TesseraBrowserScreen (Android v3.4.1)
 * Adaptados para retornar resultados diretamente via webview.executeJavaScript(...)
 */

export const COSMETIC_ADBLOCK_SCRIPT = `
(function() {
  try {
    var selectors = [
      'ins.adsbygoogle', '.adsbygoogle',
      'div[id^="google_ads"]', 'div[id^="div-gpt-ad"]',
      '.ad-container', '.ad-box', '.ad-wrapper', '.ad-banner',
      '.advertisement', '.advertising', '.ad-slot', '.ad_unit',
      '[class*="sponsored-post"]', '[data-ad-unit]', '[data-ad-client]',
      '.taboola', '.outbrain', '.trc_related_container',
      'iframe[src*="doubleclick"]', 'iframe[src*="googleads"]',
      'iframe[src*="amazon-adsystem"]', 'iframe[id*="google_ads"]'
    ];
    var style = document.getElementById('tessera-cosmetic-adblock');
    if (!style) {
      style = document.createElement('style');
      style.id = 'tessera-cosmetic-adblock';
      style.textContent = selectors.join(', ') + ' { display: none !important; height: 0 !important; min-height: 0 !important; visibility: hidden !important; margin: 0 !important; padding: 0 !important; }';
      (document.head || document.documentElement).appendChild(style);
    }
  } catch (e) {}
})();
`;

export const COOKIE_BANNER_BLOCKER_SCRIPT = `
(function() {
  try {
    var cookieSelectors = [
      '#onetrust-banner-sdk', '#onetrust-consent-sdk', '.onetrust-pc-dark-filter',
      '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay',
      '.cc-window', '.cc-banner', '#cookie-law-info-bar', '#cookie-notice',
      '.cookie-banner', '.cookie-consent', '.cookies-banner', '#cookies-banner',
      '[id*="cookie-consent"]', '[class*="cookie-banner"]', '.fc-consent-root',
      '.qc-cmp2-container', '#sp_message_container'
    ];
    var style = document.getElementById('tessera-cookie-blocker');
    if (!style) {
      style = document.createElement('style');
      style.id = 'tessera-cookie-blocker';
      style.textContent = cookieSelectors.join(', ') + ' { display: none !important; opacity: 0 !important; pointer-events: none !important; }';
      (document.head || document.documentElement).appendChild(style);
      if (document.body && document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
    }
  } catch (e) {}
})();
`;

export const READER_EXTRACTION_SCRIPT = `
(function() {
  try {
    var domain = (window.location.hostname || '').replace(/^www\\./, '');

    var title = '';
    var metaOg = document.querySelector('meta[property="og:title"]');
    var metaTw = document.querySelector('meta[name="twitter:title"]');
    var h1 = document.querySelector('h1');
    if (metaOg && metaOg.content) {
      title = metaOg.content.trim();
    } else if (metaTw && metaTw.content) {
      title = metaTw.content.trim();
    } else if (h1) {
      title = (h1.innerText || h1.textContent || '').trim();
    } else {
      title = document.title || 'Artigo';
    }
    title = title.replace(/\\s*[-–—|]\\s*(Wikipédia.*|Wikipedia.*|G1.*|UOL.*|Folha.*|TechCrunch.*|Medium.*|CNN.*|BBC.*|[^-–—|]{3,30})$/i, '').trim();

    var author = '';
    var authorMeta = document.querySelector('meta[name="author"], meta[property="article:author"], meta[name="byl"], meta[property="og:article:author"]');
    var authorEl = document.querySelector('[rel="author"], .byline, .author, .c-byline__item, .author-name, .article__author, [itemprop="author"]');
    if (authorMeta && authorMeta.content) {
      author = authorMeta.content.trim();
    } else if (authorEl) {
      author = (authorEl.innerText || authorEl.textContent || '').trim();
    }
    if (author.length > 50) author = author.substring(0, 50);

    var dateStr = '';
    var timeMeta = document.querySelector('meta[property="article:published_time"], meta[name="pubdate"], meta[name="date"]');
    var timeEl = document.querySelector('time, [property="article:published_time"], .date, .published, .datetime, [itemprop="datePublished"]');
    if (timeMeta && timeMeta.content) {
      dateStr = timeMeta.content.trim();
    } else if (timeEl) {
      dateStr = (timeEl.getAttribute('datetime') || timeEl.innerText || timeEl.textContent || '').trim();
    }
    if (dateStr.length > 30) dateStr = dateStr.substring(0, 30);

    function isClutter(el) {
      if (!el || el.nodeType !== 1) return true;
      var badTags = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, IFRAME: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, SVG: 1, CANVAS: 1, NAV: 1, FOOTER: 1, HEADER: 1 };
      if (badTags[el.tagName]) return true;

      var cur = el;
      var depth = 0;
      while (cur && cur !== document.body && depth < 12) {
        var cName = (typeof cur.className === 'string') ? cur.className.toLowerCase() : '';
        var cId = (typeof cur.id === 'string') ? cur.id.toLowerCase() : '';
        var role = (cur.getAttribute && cur.getAttribute('role')) ? cur.getAttribute('role').toLowerCase() : '';

        if (cName.indexOf('infobox') !== -1 || cName.indexOf('navbox') !== -1 || cName.indexOf('sidebar') !== -1 ||
            cName.indexOf('vertical-navbox') !== -1 || cName.indexOf('mw-references-wrap') !== -1 ||
            cName.indexOf('reflist') !== -1 || cName.indexOf('catlinks') !== -1 || cName.indexOf('mw-editsection') !== -1 ||
            cName.indexOf('cookie-banner') !== -1 || cName.indexOf('cookie-notice') !== -1 ||
            cName.indexOf('share-buttons') !== -1 || cName.indexOf('social-share') !== -1 ||
            cId === 'toc' || cName.indexOf('vector-toc') !== -1 || cName.indexOf('mw-jump-link') !== -1 ||
            cName.indexOf('hatnote') !== -1 || cName.indexOf('ambox') !== -1 || cName.indexOf('sistersitebox') !== -1 ||
            cName.indexOf('ad-container') !== -1 || cName.indexOf('advertisement') !== -1 ||
            cName.indexOf('auth') !== -1 || cName.indexOf('login') !== -1 || cName.indexOf('register') !== -1 ||
            cName.indexOf('user-menu') !== -1 || cName.indexOf('account') !== -1 || cName.indexOf('top-bar') !== -1 ||
            cId.indexOf('google_ads') !== -1 || cName.indexOf('google_ads') !== -1) {
          return true;
        }
        if (role === 'navigation' || role === 'dialog') {
          return true;
        }
        cur = cur.parentElement;
        depth++;
      }
      return false;
    }

    var bestContainer = null;
    var maxScore = -1;

    var wikiMain = document.querySelector('#mw-content-text .mw-parser-output, #mw-content-text, #bodyContent, .mw-body-content');
    if (wikiMain && (wikiMain.innerText || wikiMain.textContent || '').length > 200) {
      bestContainer = wikiMain;
    } else {
      var candidateSelectors = [
        'article', '[itemprop="articleBody"]', 'main article', '[role="main"] article',
        '.article-body', '.article__body', '.post-content', '.entry-content', '.story-body',
        '.content-article', '.caas-body', '#article-body', '#story', '.noticia-texto',
        '.materia-conteudo', '.post_content', '.articleContent', 'main', '[role="main"]',
        '#main-content', '.main-content', '#content'
      ];

      for (var c = 0; c < candidateSelectors.length; c++) {
        var els = document.querySelectorAll(candidateSelectors[c]);
        for (var e = 0; e < els.length; e++) {
          var el = els[e];
          if (el.offsetWidth === 0 && el.offsetHeight === 0 && !el.getClientRects().length) continue;
          if (isClutter(el)) continue;

          var pList = el.querySelectorAll('p');
          var fullText = (el.innerText || el.textContent || '').trim();
          var links = el.querySelectorAll('a');
          var linkTextLen = 0;
          for (var l = 0; l < links.length; l++) {
            linkTextLen += (links[l].innerText || links[l].textContent || '').length;
          }
          var substantiveTextLen = Math.max(0, fullText.length - linkTextLen);
          var score = pList.length * 250 + substantiveTextLen;
          if (score > maxScore && substantiveTextLen > 150) {
            maxScore = score;
            bestContainer = el;
          }
        }
      }
    }

    if (!bestContainer) {
      bestContainer = document.body || document.documentElement;
    }

    var blocks = [];
    var seenTexts = new Set();
    var stopSections = /^(ver também|referências|referencias|fontes|bibliografia|ligações externas|links externos|notas|créditos|leia também|mais sobre|compartilhe|comentários|see also|references|external links)$/i;
    var stopped = false;

    var items = bestContainer.querySelectorAll('h1, h2, h3, h4, h5, h6, p, blockquote, ul, ol, img');

    for (var i = 0; i < items.length; i++) {
      if (stopped) break;
      var node = items[i];
      if (isClutter(node)) continue;

      var tag = node.tagName.toLowerCase();

      if (tag === 'img') {
        var rawSrc = node.currentSrc || node.getAttribute('data-src') || node.getAttribute('data-lazy-src') || node.getAttribute('data-original') || node.src || '';
        if (rawSrc && !rawSrc.startsWith('data:') && !rawSrc.includes('icon') && !rawSrc.includes('logo') && !rawSrc.includes('avatar') && !rawSrc.includes('pixel') && !rawSrc.includes('tracking')) {
          try {
            var absUrl = new URL(rawSrc, document.baseURI).href;
            var caption = (node.getAttribute('alt') || node.getAttribute('title') || '').trim();
            if (!caption) {
              var fig = node.closest('figure');
              if (fig) {
                var figCap = fig.querySelector('figcaption');
                if (figCap) caption = (figCap.innerText || figCap.textContent || '').trim();
              }
            }
            if (!seenTexts.has(absUrl)) {
              seenTexts.add(absUrl);
              blocks.push({ type: 'IMAGE', text: '', imageUrl: absUrl, caption: caption });
            }
          } catch (uErr) {}
        }
        continue;
      }

      if (tag === 'ul' || tag === 'ol') {
        if (node.parentElement && (node.parentElement.tagName.toLowerCase() === 'li' || isClutter(node.parentElement))) continue;
        for (var liChild = 0; liChild < node.children.length; liChild++) {
          var liNode = node.children[liChild];
          if (!liNode.tagName || liNode.tagName.toLowerCase() !== 'li' || isClutter(liNode)) continue;
          var liText = (liNode.innerText || liNode.textContent || '').trim().replace(/\\[\\d+\\]|\\[editar.*?\\]/gi, '').trim();
          if (/^(registrar|registro|login|entrar|cadastre-se|assine|newsletter|compartilhe|comentários|início|home)$/i.test(liText)) continue;
          if (liText.length > 5 && !seenTexts.has(liText)) {
            seenTexts.add(liText);
            blocks.push({ type: 'LIST_ITEM', text: '•  ' + liText });
          }
        }
        continue;
      }

      var rawText = (node.innerText || node.textContent || '').trim();
      var cleanText = rawText
        .replace(/\\[editar.*?\\]/gi, '')
        .replace(/\\[edit.*?\\]/gi, '')
        .replace(/\\[\\d+\\]/g, '')
        .replace(/\\[nota\\s*\\d+\\]/gi, '')
        .replace(/\\[carece\\s*de\\s*fontes.*?\\]/gi, '')
        .trim();

      if (!cleanText || cleanText.length < 10) continue;

      if ((tag === 'h2' || tag === 'h3' || tag === 'h1') && stopSections.test(cleanText)) {
        stopped = true;
        break;
      }

      if (seenTexts.has(cleanText)) continue;
      seenTexts.add(cleanText);

      if (tag === 'h1') {
        if (cleanText.toLowerCase() !== title.toLowerCase()) {
          blocks.push({ type: 'H1', text: cleanText });
        }
      } else if (tag === 'h2') {
        blocks.push({ type: 'H2', text: cleanText });
      } else if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        blocks.push({ type: 'H3', text: cleanText });
      } else if (tag === 'blockquote') {
        blocks.push({ type: 'BLOCKQUOTE', text: cleanText });
      } else if (tag === 'p') {
        blocks.push({ type: 'PARAGRAPH', text: cleanText });
      }
    }

    if (blocks.length < 2) {
      var allPs = (document.body || document.documentElement).querySelectorAll('p');
      for (var pIdx = 0; pIdx < allPs.length; pIdx++) {
        var pNode = allPs[pIdx];
        if (isClutter(pNode)) continue;
        var pText = (pNode.innerText || pNode.textContent || '').trim().replace(/\\[\\d+\\]/g, '').replace(/\\[editar.*?\\]/gi, '');
        if (pText.length > 30 && !seenTexts.has(pText)) {
          seenTexts.add(pText);
          blocks.push({ type: 'PARAGRAPH', text: pText });
        }
      }
    }

    var plainParts = [];
    var totalWords = 0;
    for (var b = 0; b < blocks.length; b++) {
      if (blocks[b].text) {
        plainParts.push(blocks[b].text);
        totalWords += (blocks[b].text.match(/\\S+/g) || []).length;
      }
    }
    var readTime = Math.max(1, Math.round(totalWords / 190));

    return JSON.stringify({
      title: title || document.title || 'Artigo',
      author: author,
      publishDate: dateStr,
      domain: domain,
      readingTimeMinutes: readTime,
      blocks: blocks,
      plainText: plainParts.join('\\n\\n')
    });
  } catch (err) {
    var emergencyText = (document.body ? document.body.innerText : '').substring(0, 6000).trim();
    return JSON.stringify({
      title: document.title || 'Artigo',
      author: '',
      publishDate: '',
      domain: (window.location.hostname || '').replace(/^www\\./, ''),
      readingTimeMinutes: 2,
      blocks: emergencyText ? [{ type: 'PARAGRAPH', text: emergencyText }] : [],
      plainText: emergencyText
    });
  }
})();
`;

export const SUMMARY_EXTRACTION_SCRIPT = `
(function() {
  try {
    var domain = (window.location.hostname || '').replace(/^www\\./, '');
    var title = '';
    var metaOg = document.querySelector('meta[property="og:title"]');
    var metaTw = document.querySelector('meta[name="twitter:title"]');
    var h1 = document.querySelector('h1');
    if (metaOg && metaOg.content) title = metaOg.content.trim();
    else if (metaTw && metaTw.content) title = metaTw.content.trim();
    else if (h1 && (h1.innerText || h1.textContent || '').trim().length > 3) title = (h1.innerText || h1.textContent).trim();
    else title = document.title || '';
    title = title.replace(/\\s*[-–—|]\\s*[^-–—|]+$/, '').trim();

    var ignoreSelector = 'nav, footer, header, form, button, input, select, textarea, script, style, noscript, iframe, svg, canvas, .ad, .ads, .advertisement, [id*="google_ads"], [class*="google_ads"], [id*="banner"], [class*="banner"], .sidebar, .widget, .share, .social, #comments, .comments, .cookie-banner, .cookie-notice, .modal, .popup';
    var candidateSelectors = [
      'article', '[itemprop="articleBody"]', 'main article', '[role="main"] article',
      '.article-body', '.article__body', '.post-content', '.entry-content', '.story-body',
      '.content-article', '.caas-body', '#article-body', '#story', '.noticia-texto',
      '.materia-conteudo', 'main', '[role="main"]', '#main-content', '.main-content', '#content'
    ];

    var bestContainer = null;
    var maxScore = -1;
    for (var c = 0; c < candidateSelectors.length; c++) {
      var els = document.querySelectorAll(candidateSelectors[c]);
      for (var e = 0; e < els.length; e++) {
        var el = els[e];
        if (el.offsetWidth === 0 && el.offsetHeight === 0 && !el.getClientRects().length) continue;
        var pList = el.querySelectorAll('p');
        var text = (el.innerText || el.textContent || '').trim();
        var score = pList.length * 100 + text.length;
        if (score > maxScore && text.length > 150) {
          maxScore = score;
          bestContainer = el;
        }
      }
      if (bestContainer && maxScore > 500) break;
    }
    if (!bestContainer) bestContainer = document.body;

    var parts = [];
    var seen = new Set();
    var elements = bestContainer.querySelectorAll('h1, h2, h3, h4, p, blockquote, li');
    for (var i = 0; i < elements.length; i++) {
      var node = elements[i];
      if (node.closest(ignoreSelector)) continue;
      var t = (node.innerText || node.textContent || '').trim();
      if (t.length < 15 || seen.has(t)) continue;
      seen.add(t);
      parts.push(t);
    }

    var fullText = parts.join('\\n\\n');
    if (!fullText && document.body) {
      fullText = (document.body.innerText || '').trim();
    }
    if (fullText.length > 10000) fullText = fullText.substring(0, 10000);

    return JSON.stringify({
      title: title || document.title || 'Página Atual',
      domain: domain,
      url: window.location.href,
      content: fullText
    });
  } catch (e) {
    return JSON.stringify({
      title: document.title || 'Página Atual',
      domain: (window.location.hostname || '').replace(/^www\\./, ''),
      url: window.location.href,
      content: (document.body ? (document.body.innerText || '').substring(0, 6000) : '')
    });
  }
})();
`;

export const PAGE_METADATA_DETECTION_SCRIPT = `
(function() {
  try {
    var lang = (document.documentElement.lang || '').trim().toLowerCase();
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    var themeColor = themeMeta ? (themeMeta.getAttribute('content') || '') : '';
    var pCount = document.querySelectorAll('article p, main p, p').length;
    var textLen = document.body ? (document.body.innerText || '').length : 0;
    var readerAvailable = pCount >= 3 && textLen > 650;
    return JSON.stringify({
      lang: lang,
      themeColor: themeColor,
      readerAvailable: readerAvailable
    });
  } catch (e) {
    return JSON.stringify({ lang: '', themeColor: '', readerAvailable: false });
  }
})();
`;

export const INLINE_DOM_TRANSLATE_SCRIPT = `
(function() {
  function doTranslate() {
    var combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = 'pt';
      combo.dispatchEvent(new Event('change'));
      return true;
    }
    return false;
  }
  if (doTranslate()) return 'ok';

  document.cookie = 'googtrans=/auto/pt; path=/; domain=' + window.location.hostname;
  document.cookie = 'googtrans=/auto/pt; path=/;';

  var hideStyle = document.getElementById('tessera-translate-style');
  if (!hideStyle) {
    hideStyle = document.createElement('style');
    hideStyle.id = 'tessera-translate-style';
    hideStyle.textContent = '.goog-te-banner-frame, .skiptranslate, #goog-gt-tt, .goog-te-balloon-frame { display: none !important; } body { top: 0px !important; }';
    (document.head || document.documentElement).appendChild(hideStyle);
  }

  window.googleTranslateElementInit = function() {
    new google.translate.TranslateElement({
      pageLanguage: 'auto',
      includedLanguages: 'pt,en,es,fr,de,it,ja,zh-CN,ru',
      autoDisplay: false
    }, 'google_translate_element');
    setTimeout(doTranslate, 400);
  };

  var elem = document.getElementById('google_translate_element');
  if (!elem) {
    elem = document.createElement('div');
    elem.id = 'google_translate_element';
    elem.style.display = 'none';
    (document.body || document.documentElement).appendChild(elem);
  }

  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  (document.head || document.documentElement).appendChild(s);
  return 'injected';
})();
`;

export const REVERT_DOM_TRANSLATE_SCRIPT = `
(function() {
  document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
  document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  var combo = document.querySelector('.goog-te-combo');
  if (combo) {
    combo.value = '';
    combo.dispatchEvent(new Event('change'));
  }
  window.location.reload();
})();
`;

export const SMART_FORCE_DARK_CSS = `
html, body {
  background-color: #121214 !important;
  color: #e4e4e7 !important;
  color-scheme: dark !important;
}

/* Force dark on all containers, headers, navbars, sidebars, and sections */
header, nav, aside, main, article, section, footer,
#header, .header, #top_bar, .top_bar, #menu, .menu, .navbar, .nav,
[class*="header"], [class*="navbar"], [class*="topbar"], [class*="nav-bar"],
[role="banner"], [role="navigation"], [id*="header"], [id*="nav"] {
  background-color: #18181b !important;
  background-image: none !important;
  color: #f4f4f5 !important;
  border-color: #27272a !important;
}

/* Headings and text */
h1, h2, h3, h4, h5, h6, p, span, li, a {
  color: inherit !important;
}
a {
  color: #60a5fa !important;
}
a:visited {
  color: #a78bfa !important;
}

/* Form controls */
input, textarea, select, button {
  background-color: #27272a !important;
  color: #f4f4f5 !important;
  border-color: #3f3f46 !important;
}

/* Tables */
table, tr, td, th {
  background-color: #18181b !important;
  color: #e4e4e7 !important;
  border-color: #27272a !important;
}

/* Whitelist media: DO NOT alter photos, videos, icons, canvases, SVGs, or embeds */
img, video, canvas, svg, iframe, [style*="background-image"], picture {
  filter: none !important;
}
`;
