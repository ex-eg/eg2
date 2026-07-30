/* =========================================================================
   elgoharyX — Consent Mode v2  ·  إدارة موافقة الزائر (شرط أساسي لأدسنس)
   -------------------------------------------------------------------------
   WHY THIS FILE EXISTS
   Google requires a consent signal before an ad request may use cookies or
   personal data. A site that serves AdSense without one gets its ad serving
   limited or blocked outright. This file:

     1. declares the Consent Mode v2 DEFAULT = denied, before any ad code runs;
     2. shows a slim bilingual banner with Accept and Reject given EQUAL
        prominence (Google rejects "accept-only" banners);
     3. on Accept  → update() grants ad storage / user data / personalization;
        on Reject  → everything stays denied, ads still serve NON-personalised;
     4. re-asks after 13 months, the maximum consent lifetime Google allows;
     5. exposes window.ELG_CONSENT so assets/ads.js can wait for a decision.

   LOAD ORDER: this file must be executed before assets/ads.js. Both are
   `defer`, so simply keeping consent.js first in the document is enough.
   ========================================================================= */
(function () {
  'use strict';

  var KEY = 'elg_consent_v2';
  var MAX_AGE = 397 * 24 * 60 * 60 * 1000;   // 13 months
  var listeners = [];

  /* ---------- gtag plumbing ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  /* Default: deny everything that is deniable. `wait_for_update` gives the
     stored decision (read a few lines below) time to land before the first
     ad request goes out. */
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 700
  });

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || !v.at || (Date.now() - v.at) > MAX_AGE) return null;
      if (v.choice !== 'accept' && v.choice !== 'reject') return null;
      return v;
    } catch (e) { return null; }
  }

  function write(choice) {
    try { localStorage.setItem(KEY, JSON.stringify({ choice: choice, at: Date.now(), v: 2 })); }
    catch (e) { /* private mode — the in-memory state below still applies */ }
  }

  var state = { decided: false, personalized: false };

  function announce() {
    state.decided = true;
    var fns = listeners; listeners = [];
    for (var i = 0; i < fns.length; i++) { try { fns[i](state); } catch (e) {} }
  }

  function grant() {
    gtag('consent', 'update', {
      ad_storage: 'granted', ad_user_data: 'granted',
      ad_personalization: 'granted', analytics_storage: 'granted'
    });
    state.personalized = true;
    announce();
  }

  function denyButServe() {
    // Everything stays denied. Google still serves non-personalised ads, which
    // is exactly what a "Reject" must mean — not "no ads at all".
    gtag('consent', 'update', {
      ad_storage: 'denied', ad_user_data: 'denied',
      ad_personalization: 'denied', analytics_storage: 'denied'
    });
    state.personalized = false;
    announce();
  }

  /* ---------- banner ---------- */
  var AR = {
    title: 'ملفات تعريف الارتباط والإعلانات',
    body: 'نستخدم ملفات تعريف الارتباط (cookies) لتشغيل الموقع وعرض إعلانات Google. بالموافقة تصبح الإعلانات مخصّصة لك؛ وبالرفض تظهر إعلانات عامّة غير مخصّصة — والموقع يعمل كاملاً في الحالتين.',
    accept: 'أوافق',
    reject: 'أرفض',
    more: 'سياسة ملفات الارتباط'
  };
  var EN = {
    title: 'Cookies and ads',
    body: 'We use cookies to run the site and to show Google ads. Accepting makes the ads personalised; rejecting shows generic, non-personalised ads — the site works fully either way.',
    accept: 'Accept',
    reject: 'Reject',
    more: 'Cookie policy'
  };

  function lang() {
    try {
      if (window.elgGetLang) return window.elgGetLang();
      var s = localStorage.getItem('apb_lang');
      if (s === 'en' || s === 'ar') return s;
      return /^ar/i.test(navigator.language || '') ? 'ar' : 'en';
    } catch (e) { return 'ar'; }
  }

  function base() {
    return location.pathname.replace(/[^/]*$/, '');
  }

  function banner() {
    if (document.getElementById('elgConsent')) return;
    var L = lang() === 'en' ? EN : AR;
    var rtl = lang() !== 'en';
    var el = document.createElement('div');
    el.id = 'elgConsent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', L.title);
    el.dir = rtl ? 'rtl' : 'ltr';
    el.innerHTML =
      '<div class="elgc-in">' +
        '<div class="elgc-txt"><b>' + L.title + '</b><p>' + L.body +
          ' <a href="' + base() + 'cookies.html">' + L.more + '</a></p></div>' +
        '<div class="elgc-btns">' +
          '<button type="button" class="elgc-btn elgc-no" data-c="reject">' + L.reject + '</button>' +
          '<button type="button" class="elgc-btn elgc-yes" data-c="accept">' + L.accept + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); });

    el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-c]') : null;
      if (!b) return;
      var choice = b.getAttribute('data-c');
      write(choice);
      el.classList.remove('in');
      setTimeout(function () { el.remove(); }, 260);
      if (choice === 'accept') grant(); else denyButServe();
    });
  }

  /* ---------- public API ---------- */
  window.ELG_CONSENT = {
    /** Current decision, or null while undecided. */
    get: function () { return state.decided ? state : null; },
    /** Run `fn(state)` as soon as a decision exists (immediately if it already does). */
    onDecision: function (fn) {
      if (typeof fn !== 'function') return;
      if (state.decided) fn(state); else listeners.push(fn);
    },
    /** Re-open the banner so a visitor can change their mind (used by cookies.html). */
    reopen: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      state.decided = false; state.personalized = false;
      if (document.body) banner(); else document.addEventListener('DOMContentLoaded', banner);
    }
  };

  /* ---------- boot ---------- */
  var saved = read();
  if (saved) {
    if (saved.choice === 'accept') grant(); else denyButServe();
  } else {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner);
    else banner();
  }
})();
