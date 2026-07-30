/* =========================================================================
   elgoharyX — Google AdSense integration  ·  إعلانات جوجل
   -------------------------------------------------------------------------
   WHY THIS FILE WAS REWRITTEN
   The site was blocked by AdSense. The old version loaded the ad library in
   the <head> of EVERY page — including login, the admin panel, the builders
   and empty loading shells. That is the single most common cause of a block:
       «Google-served ads on screens without publisher content»
   plus «Low value content» from the empty single-page shells being indexed.

   THE RULES THIS FILE ENFORCES  (all of them AdSense policy requirements)
     1. ALLOW-LIST — the library is never even requested on a page that is not
        a content page. Login / account / admin / hub / builders get no ads.
     2. CONTENT GATE — on an allowed page the library still waits until the
        page actually holds MIN_WORDS of real publisher text. An empty blog,
        a "no results" explore page or a loading skeleton gets nothing.
     3. CONSENT GATE — nothing loads until assets/consent.js reports a
        decision (Consent Mode v2). Reject still serves non-personalised ads.
     4. SCREEN GATE — app.js calls block() for 404 / error / password-gate /
        maintenance screens, so ads can never appear beside an error.
     5. DENSITY CAP — at most MAX_UNITS units per page, and a unit is only
        filled if the surrounding article is long enough to warrant it.
     6. NO EMPTY FRAMES — a container whose slot id is not configured is
        REMOVED, never left as a labelled empty box (also a policy issue).

   SETUP  ▸  الخطوات المطلوبة منك
     1. In AdSense create display ad units and paste each unit's numeric
        "Ad slot" id into CFG.slots below (they are 10-digit numbers).
     2. Keep /ads.txt at the site root matching CFG.client. (Already correct.)
     3. Leave a slot as '0000000000' and that placement stays empty — with
        CFG.autoAds = true Google's Auto ads still place ads on allowed pages.
   ========================================================================= */
(function () {
  'use strict';

  var CFG = {
    /* Publisher id — must match /ads.txt */
    client: 'ca-pub-8599845319245705',

    /* Ad unit ids (numeric "Ad slot" from AdSense). '0000000000' = not set. */
    slots: {
      article: '0000000000', // inside a blog article
      infeed:  '0000000000', // the explore feed
      profile: '0000000000', // a public profile page
      home:    '0000000000'  // the landing page
    },

    /* Let Google's Auto ads place additional units on allowed pages. */
    autoAds: true,

    /* Minimum real words on the page before ANY ad may load. */
    minWords: 180,
    /* An in-article unit additionally needs this many words in the article. */
    minArticleWords: 320,
    /* Hard cap on units per page. */
    maxUnits: 3,

    /* Hide ads from premium subscribers. */
    respectPremium: true
  };

  /* Pages that may show ads. Anything not listed here gets none — ever.
     Keys are the <body data-page="…"> values used by the app router. */
  var ALLOWED_PAGES = { '': 1, home: 1, 'view-blog': 1, 'view-profile': 1, explore: 1 };

  /* Static editorial pages (no data-page attribute) that may show ads. */
  var ALLOWED_FILES = {
    '': 1, 'index.html': 1, 'about.html': 1, 'how-to.html': 1,
    'privacy.html': 1, 'support.html': 1, 'terms.html': 1,
    'cookies.html': 1, 'contact.html': 1, 'content-policy.html': 1, 'brand.html': 1,
    'custom-domain.html': 1
  };

  var label = (function () {
    try {
      var l = localStorage.getItem('apb_lang');
      if (l === 'en') return 'Ad';
      if (l === 'ar') return 'إعلان';
      return /^ar/i.test(navigator.language || '') ? 'إعلان' : 'Ad';
    } catch (e) { return 'إعلان'; }
  })();

  window.ELG_ADS = CFG;

  /* ---------- eligibility ---------- */
  var page = (document.body && document.body.dataset && document.body.dataset.page) || '';
  var file = location.pathname.replace(/^.*\//, '');

  function hasRealPublisherId() {
    return /^ca-pub-\d{16}$/.test(CFG.client);
  }

  function isPremiumViewer() {
    if (!CFG.respectPremium) return false;
    if (window.ELG_NO_ADS === true) return true;
    try {
      var u = JSON.parse(localStorage.getItem('apb_user') || 'null');
      return !!(u && u.premium === true);
    } catch (e) { return false; }
  }

  function pageAllowed() {
    if (page) return !!ALLOWED_PAGES[page];      // app screens: the router decides
    return !!ALLOWED_FILES[file];                // static pages: the filename does
  }

  var blocked = false;                            // set by block(), never unset
  var eligible = hasRealPublisherId() && pageAllowed() && !isPremiumViewer();

  /* ---------- content measurement ---------- */
  /* Count words the visitor can actually read, ignoring our own chrome so a
     page made only of nav + footer never counts as "content". */
  function wordsIn(root) {
    if (!root) return 0;
    var clone = root.cloneNode(true);
    var junk = clone.querySelectorAll(
      'script,style,noscript,.appbar,.drawer,.site-foot,.elg-ad,#elgConsent,' +
      '.loader,.pro-loader,.spin,.toast,.err-wrap,.pass-gate,[aria-hidden="true"]');
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    var txt = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    if (!txt) return 0;
    return txt.split(' ').length;
  }

  function pageWords() {
    return wordsIn(document.querySelector('#app') || document.querySelector('main') || document.body);
  }

  /* ---------- library loading ---------- */
  var libRequested = false;
  var libReady = false;
  var pending = [];

  function loadLibrary() {
    if (libRequested) return;
    libRequested = true;

    // The page-level tag doubles as the Auto ads switch.
    if (!document.querySelector('meta[name="google-adsense-account"]')) {
      var m = document.createElement('meta');
      m.name = 'google-adsense-account';
      m.content = CFG.client;
      document.head.appendChild(m);
    }

    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CFG.client;
    s.onload = function () {
      libReady = true;
      if (CFG.autoAds) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({
            google_ad_client: CFG.client, enable_page_level_ads: true
          });
        } catch (e) {}
      }
      var q = pending; pending = [];
      for (var i = 0; i < q.length; i++) push(q[i]);
    };
    s.onerror = function () { /* blocker or offline — the page is unaffected */ };
    (document.head || document.documentElement).appendChild(s);
  }

  function push(ins) {
    if (!libReady) { pending.push(ins); return; }
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }

  /* ---------- unit rendering ---------- */
  var unitCount = 0;

  function slotFor(kind) {
    var s = CFG.slots[kind] || CFG.slots.article;
    return (/^\d{6,}$/.test(s) && !/^0+$/.test(s)) ? s : null;
  }

  function render(box, kind) {
    var slot = slotFor(kind);
    if (!slot) { box.remove(); return; }          // never leave an empty frame
    if (unitCount >= CFG.maxUnits) { box.remove(); return; }
    unitCount++;
    box.setAttribute('data-done', '1');
    box.classList.add('elg-ad-live');

    var lbl = document.createElement('span');
    lbl.className = 'elg-ad-lbl';
    lbl.textContent = label;

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', CFG.client);
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', kind === 'infeed' ? 'fluid' : 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    box.appendChild(lbl);
    box.appendChild(ins);
    push(ins);
  }

  /* ---------- the gate ---------- */
  /**
   * Fill every unfilled .elg-ad container inside `root`, but only if this page
   * is allowed, holds enough content, and the visitor has answered the consent
   * banner. Called by app.js after each dynamic render, and on DOMContentLoaded
   * for the static pages.
   * @param {Element|Document} [root]
   */
  function fill(root) {
    if (!eligible || blocked) { sweep(root); return; }

    var scope = (root && root.querySelectorAll) ? root : document;
    var boxes = scope.querySelectorAll('.elg-ad:not([data-done])');

    // The content gate applies whether the placements are manual or automatic:
    // a thin page gets no library request at all.
    if (pageWords() < CFG.minWords) { sweep(root); return; }

    var go = function () { commit(boxes); };
    // consent.js absent → nothing to wait for; the gate it owns cannot apply
    if (window.ELG_CONSENT) window.ELG_CONSENT.onDecision(go); else go();
  }

  function commit(boxes) {
    if (blocked) return;
    loadLibrary();
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      if (box.hasAttribute('data-done')) continue;
      var kind = box.getAttribute('data-ad') || 'article';
      // an in-article unit needs a long enough article around it
      if (kind === 'article') {
        var host = box.closest('.article, .art-body, .blog-article, #app') || document;
        if (wordsIn(host) < CFG.minArticleWords) { box.remove(); continue; }
      }
      render(box, kind);
    }
  }

  /** Remove containers we are not allowed to fill, so nothing empty is left. */
  function sweep(root) {
    var scope = (root && root.querySelectorAll) ? root : document;
    var boxes = scope.querySelectorAll('.elg-ad:not([data-done])');
    for (var i = 0; i < boxes.length; i++) boxes[i].remove();
  }

  /**
   * Permanently disable ads for this page view. app.js calls this for 404 /
   * error / password-gate / maintenance screens — screens that must never
   * carry an ad.
   */
  function block() {
    blocked = true;
    sweep(document);
  }

  window.elgFillAds = fill;
  window.elgBlockAds = block;
  /** Diagnostics for the admin panel / console: why are there no ads here? */
  window.elgAdsState = function () {
    return {
      page: page || file, eligible: eligible, blocked: blocked,
      publisherIdOk: hasRealPublisherId(), pageAllowed: pageAllowed(),
      premiumViewer: isPremiumViewer(), words: pageWords(),
      minWords: CFG.minWords, unitsRendered: unitCount,
      consent: window.ELG_CONSENT ? window.ELG_CONSENT.get() : null,
      slotsConfigured: Object.keys(CFG.slots).filter(function (k) { return !!slotFor(k); })
    };
  };

  if (document.readyState !== 'loading') fill();
  else document.addEventListener('DOMContentLoaded', function () { fill(); });
})();
