/* elgoharyX — brand system (visual identity).
   -------------------------------------------------------------------------
   One place that owns the logo, the wordmark, the lockups and the favicon, so
   the identity is identical on every page and no page depends on a
   third-party image host that can disappear.

   THE LOGO is the original elgoharyX mark: the EX monogram with the rising
   arrow, deep navy on a light plate. Every raster in assets/brand/ is derived
   from that one source file, so nothing here invents a shape of its own.

     logo-source.png   the untouched original (1024×1024)
     logo.png          trimmed to the mark, transparent background
     logo-light.png    the mark on its light plate — for dark surfaces
     icon-*.png        PWA / apple-touch / favicon sizes
     og.png            1200×630 social card

   USAGE
     import { mark, tile, wordmark, lockup, seal } from './brand.js';
     el.innerHTML = lockup({ variant: 'row' });
   Importing this module also installs the favicons and expands any
   <span data-brand="…"> placeholder into the real markup.                    */

/* ---------- palette (kept in sync with brand.css) ---------- */
export const BRAND = {
  name:   'elgoharyX',
  nameAr: 'الجوهري إكس',
  navy:   '#1B3A63',
  navyLo: '#122A49',
  steel:  '#4C7CB4',
  gold:   '#D0AA4E',
  goldHi: '#ECD08A',
  ink:    '#0A1120',
  inkDeep:'#060B16',
  plate:  '#F7F8FA',
  paper:  '#F0F4FC',
};

/* Absolute base for the asset paths, so a lockup rendered inside a blog that
   is served from a custom domain still points at real files. */
const BASE = (typeof location !== 'undefined')
  ? location.origin + location.pathname.replace(/[^/]*$/, '')
  : '';
export const LOGO_MARK  = BASE + 'assets/brand/logo.png';
export const LOGO_PLATE = BASE + 'assets/brand/logo-light.png';
export const LOGO_ICON  = BASE + 'assets/brand/icon-512.png';
export const LOGO_OG    = BASE + 'assets/brand/og.png';

const attr = s => String(s == null ? '' : s).replace(/"/g, '&quot;');

/**
 * The bare logo mark on a transparent background. Use it where the surface is
 * already light, or inside a container that supplies its own plate.
 * @param {object} [o]
 * @param {number} [o.size=48] rendered px (square)
 * @param {string} [o.cls='']  extra class names
 * @param {string} [o.alt]     accessible name; '' makes it decorative
 */
export function mark(o) {
  o = o || {};
  const size = o.size || 48;
  const alt = o.alt != null ? o.alt : BRAND.name;
  return `<img class="elg-mark${o.cls ? ' ' + o.cls : ''}" src="${LOGO_MARK}"
    width="${size}" height="${size}" alt="${attr(alt)}"
    ${alt === '' ? 'aria-hidden="true" ' : ''}decoding="async" loading="eager"/>`;
}

/**
 * The logo on its light plate — the app-icon form. This is what to use on the
 * dark UI, because the mark itself is deep navy and would disappear.
 * @param {object} [o]
 * @param {number} [o.size=40]
 * @param {number} [o.radius] corner radius in px (defaults to size/3)
 */
export function tile(o) {
  o = o || {};
  const size = o.size || 40;
  const r = o.radius != null ? o.radius : Math.round(size / 3);
  const alt = o.alt != null ? o.alt : BRAND.name;
  return `<img class="elg-tile${o.cls ? ' ' + o.cls : ''}" src="${LOGO_PLATE}"
    width="${size}" height="${size}" alt="${attr(alt)}"
    ${alt === '' ? 'aria-hidden="true" ' : ''}style="border-radius:${r}px"
    decoding="async" loading="eager"/>`;
}

/* ---------- wordmark ----------
   Set in the technical face so the name always looks the same, whatever the
   surrounding page is doing with its own headings. */
export function wordmark(o) {
  o = o || {};
  const size = o.size || 22;
  const tone = o.mono ? 'currentColor' : '';
  return `<span class="elg-wordmark${o.cls ? ' ' + o.cls : ''}"
    style="font-size:${size}px${tone ? ';color:' + tone : ''}">elgohary<b>X</b></span>`;
}

/**
 * Logo + name, the full brand signature.
 * @param {object} [o]
 * @param {'row'|'stack'|'compact'} [o.variant='row']
 * @param {boolean} [o.tagline=false] show the Arabic descriptor line
 * @param {string}  [o.href] wrap the lockup in a link
 */
export function lockup(o) {
  o = o || {};
  const v = o.variant || 'row';
  const showTag = o.tagline === true;
  const inner = v === 'compact'
    ? `${tile({ size: 30, radius: 9, alt: '' })}<b class="elg-lk-name">${BRAND.name}</b>`
    : `${tile({ size: v === 'stack' ? 64 : 42, radius: v === 'stack' ? 20 : 13, alt: '' })}
       <span class="elg-lk-txt">${wordmark({ size: v === 'stack' ? 26 : 21 })}
       ${showTag ? `<small class="elg-lk-tag">${BRAND.nameAr} · بروفايلات ومدوّنات</small>` : ''}</span>`;
  const body = `<span class="elg-lockup elg-lk-${v}">${inner}</span>`;
  return o.href ? `<a class="elg-lockup-link" href="${attr(o.href)}" aria-label="${BRAND.name}">${body}</a>` : body;
}

/** Decorative ring around the mark — certificates, empty states, print. */
export function seal(o) {
  o = o || {};
  const size = o.size || 96;
  return `<span class="elg-seal${o.cls ? ' ' + o.cls : ''}"
    style="width:${size}px;height:${size}px">${mark({ size: Math.round(size * 0.5), alt: '' })}</span>`;
}

/* ---------- install ---------- */
function setLink(rel, href, type, sizes) {
  document.head.querySelectorAll(`link[rel="${rel}"]`).forEach(l => l.remove());
  const l = document.createElement('link');
  l.rel = rel; l.href = href;
  if (type) l.type = type;
  if (sizes) l.sizes = sizes;
  document.head.appendChild(l);
}

let _installed = false;
/** Install the favicons and expand every [data-brand] placeholder. */
export function installBrand() {
  if (_installed) return; _installed = true;
  try {
    setLink('icon', BASE + 'assets/brand/favicon-32.png', 'image/png', '32x32');
    setLink('apple-touch-icon', BASE + 'assets/brand/apple-touch-icon.png');
  } catch (e) { /* a locked-down <head> is not worth failing over */ }

  // <span data-brand="row|stack|compact|mark|tile|seal"> → the real markup
  document.querySelectorAll('[data-brand]').forEach(el => {
    const kind = el.getAttribute('data-brand') || 'row';
    const size = parseInt(el.getAttribute('data-brand-size') || '', 10) || undefined;
    if (kind === 'mark') el.innerHTML = mark({ size });
    else if (kind === 'tile') el.innerHTML = tile({ size });
    else if (kind === 'seal') el.innerHTML = seal({ size });
    else el.innerHTML = lockup({ variant: kind, tagline: el.hasAttribute('data-brand-tagline') });
    el.removeAttribute('data-brand');
  });

  upgradeLegacyLogos();
}

/* Safety net for any leftover reference to the old third-party image host: swap
   it for the local file rather than let a dead image show. */
export function upgradeLegacyLogos(root) {
  const scope = (root && root.querySelectorAll) ? root : document;
  scope.querySelectorAll('img[src*="i.ibb.co/1t1TCvH7"]').forEach(img => {
    const bare = img.closest('.mark, .db-mark, .bt-mono');
    img.src = bare ? LOGO_MARK : LOGO_PLATE;
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installBrand);
  else installBrand();
}
