/* elgoharyX — shared motion layer (loaded on every page).
   - Reveals elements with class "reveal" as they scroll into view.
   - Animates count-up numbers on [data-count] when they enter the viewport.
   - Works with content injected later by app.js (MutationObserver + scroll ticks).
   Rect-based (no IntersectionObserver dependency) so it works everywhere, and
   respects prefers-reduced-motion. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // requestAnimationFrame must be invoked with `this === window`; bind it once.
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window)
    : function (cb) { return setTimeout(cb, 16); };

  function vh() { return window.innerHeight || document.documentElement.clientHeight || 0; }
  function inView(el) {
    var r = el.getBoundingClientRect();
    var h = vh();
    return r.top < h * 0.92 && r.bottom > 0;
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = parseInt(el.getAttribute('data-dur'), 10) || 1500;
    if (reduce) { el.textContent = target.toLocaleString('en-US') + suffix; return; }
    var start = null;
    function step(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target).toLocaleString('en-US') + suffix;
      if (p < 1) raf(step);
      else el.textContent = target.toLocaleString('en-US') + suffix;
    }
    raf(step);
    // guarantee the final value even if rAF is throttled (background / offscreen tab)
    setTimeout(function () { el.textContent = target.toLocaleString('en-US') + suffix; }, dur + 400);
  }

  function tick() {
    var reveals = document.querySelectorAll('.reveal:not(.in)');
    for (var i = 0; i < reveals.length; i++) {
      if (reduce || inView(reveals[i])) reveals[i].classList.add('in');
    }
    var counts = document.querySelectorAll('[data-count]:not(.counted)');
    for (var j = 0; j < counts.length; j++) {
      if (reduce || inView(counts[j])) { counts[j].classList.add('counted'); countUp(counts[j]); }
    }
  }

  var ticking = false;
  function schedule() {
    if (ticking) return;
    ticking = true;
    var run = function () { ticking = false; tick(); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  if (document.readyState !== 'loading') schedule();
  else document.addEventListener('DOMContentLoaded', schedule);

  /* app.js re-renders #app asynchronously — catch new reveal/count nodes */
  if (window.MutationObserver && document.body) {
    var mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* final safety net: never leave content invisible */
  setTimeout(function () {
    var hidden = document.querySelectorAll('.reveal:not(.in)');
    for (var i = 0; i < hidden.length; i++) { if (inView(hidden[i])) hidden[i].classList.add('in'); }
    tick();
  }, 1200);
})();
