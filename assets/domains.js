/* =========================================================================
   elgoharyX — custom domains  ·  ربط المدونة بدومين خاص
   -------------------------------------------------------------------------
   WHAT THIS GIVES A BLOG OWNER
   Their blog answers on a domain they own — https://mudawana.com — instead of
   https://ex-eg.github.io/blog.html?blog=aB3xY9z. That matters for three
   reasons: it looks professional, it is portable, and a real domain is what
   Google AdSense expects from a publisher.

   HOW IT WORKS — three independent pieces
   1. OWNERSHIP PROOF (verify)
      The owner adds one TXT record — `_elgoharyx.<domain>` = the token we
      generate — then presses Verify. We read that record straight from the
      browser through DNS-over-HTTPS (Google's resolver, Cloudflare's as a
      fallback); both answer JSON with CORS enabled, so no server is needed.
   2. THE MAP (link/unlink)
      `domains/<key>` → { blog, uid, at, verified }. The key is the hostname
      with dots turned into commas, because a Firebase key may not contain '.'.
      The node is world-readable so an anonymous visitor arriving on the custom
      host can resolve it.
   3. THE ROUTER (resolveHostToBlog)
      When the app boots on a hostname that is not one of ours, it looks the
      host up in that map and renders the matching blog at '/'. Reaching us on
      that hostname is the owner's job — a Cloudflare Worker, a Netlify or
      Vercel rewrite, or a plain registrar redirect. See custom-domain.html.
   ========================================================================= */
import { db, ref, get, child, set, remove } from './firebase.js';
import { shortId } from './core.js';

/* Hostnames that belong to the platform itself — never treated as custom. */
export const PLATFORM_HOSTS = [
  'ex-eg.github.io', 'localhost', '127.0.0.1', '0.0.0.0', '[::1]'
];

export const TXT_PREFIX = '_elgoharyx';
export const TXT_VALUE_PREFIX = 'elgoharyx-verify=';
/** The CNAME / proxy target every connection method points at. */
export const ORIGIN_HOST = 'ex-eg.github.io';

/* ---------- key encoding ----------
   Firebase keys cannot contain . # $ [ ] /  — a hostname only risks the dot. */
export const domainKey = d => String(d || '').trim().toLowerCase()
  .replace(/\.+$/, '').replace(/\./g, ',');
export const keyToDomain = k => String(k || '').replace(/,/g, '.');

/** True when the page is being served from a visitor's own domain. */
export function isCustomHost(host) {
  const h = (host || location.hostname || '').toLowerCase();
  if (!h) return false;
  if (PLATFORM_HOSTS.indexOf(h) !== -1) return false;
  if (/\.github\.io$/.test(h)) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;   // raw IP
  return h.indexOf('.') !== -1;
}

/**
 * Clean up and validate whatever the owner typed into the domain field.
 * Accepts "https://www.Example.COM/blog/" and returns "www.example.com".
 * @returns {{ok:boolean, domain?:string, code?:string}} code is an i18n key
 */
export function normalizeDomain(input) {
  let d = String(input || '').trim().toLowerCase();
  if (!d) return { ok: false, code: 'empty' };
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');   // drop scheme
  d = d.split('/')[0].split('?')[0].split('#')[0]; // drop path/query/hash
  d = d.split('@').pop();                          // drop any user info
  d = d.replace(/:\d+$/, '');                      // drop port
  d = d.replace(/\.+$/, '');                       // drop trailing dot

  if (!d) return { ok: false, code: 'empty' };
  if (d.length > 253) return { ok: false, code: 'tooLong' };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d)) return { ok: false, code: 'isIp' };
  if (d.indexOf('.') === -1) return { ok: false, code: 'needDot' };

  const labels = d.split('.');
  if (labels.length < 2) return { ok: false, code: 'needDot' };
  for (const l of labels) {
    if (!l || l.length > 63) return { ok: false, code: 'badLabel' };
    if (!/^[a-z0-9-]+$/.test(l)) return { ok: false, code: 'badChars' };
    if (l.startsWith('-') || l.endsWith('-')) return { ok: false, code: 'badLabel' };
  }
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || /^\d+$/.test(tld)) return { ok: false, code: 'badTld' };

  if (PLATFORM_HOSTS.indexOf(d) !== -1 || /(^|\.)github\.io$/.test(d)) {
    return { ok: false, code: 'reserved' };
  }
  return { ok: true, domain: d };
}

/** A fresh proof-of-ownership token. Stored on the blog, published in DNS. */
export const newDomainToken = () => shortId(20);
export const txtRecordName = domain => TXT_PREFIX + '.' + domain;
export const txtRecordValue = token => TXT_VALUE_PREFIX + token;

/* ---------- DNS over HTTPS ----------
   Both resolvers below answer JSON and send Access-Control-Allow-Origin: *,
   which is what makes browser-side verification possible at all. */
const DOH = [
  n => 'https://dns.google/resolve?name=' + encodeURIComponent(n) + '&type=TXT',
  n => 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(n) + '&type=TXT&ct=application/dns-json'
];

/**
 * Every TXT string published at `name`, quotes and DNS chunking undone.
 * @returns {Promise<string[]>} empty when the name has no TXT record
 */
export async function lookupTxt(name) {
  for (const build of DOH) {
    try {
      const r = await fetch(build(name), { headers: { accept: 'application/dns-json' } });
      if (!r.ok) continue;
      const j = await r.json();
      // NXDOMAIN (3) is a definite "no record", not a resolver failure
      if (j.Status !== 0 && j.Status !== 3) continue;
      const answers = j.Answer || [];
      const out = [];
      for (const a of answers) {
        if (a.type !== 16) continue;                       // 16 = TXT
        // long values arrive as several quoted chunks: "part1" "part2"
        const joined = String(a.data || '').replace(/"\s+"/g, '').replace(/^"|"$/g, '');
        out.push(joined.trim());
      }
      return out;
    } catch (e) { /* try the next resolver */ }
  }
  return null;                                              // both resolvers failed
}

/**
 * Check whether the domain publishes our token.
 * @returns {Promise<{ok:boolean, code:string, found?:string[]}>}
 *   code: 'verified' | 'missing' | 'mismatch' | 'dnsFail'
 */
export async function verifyDomainOwnership(domain, token) {
  const name = txtRecordName(domain);
  const want = txtRecordValue(token);
  const found = await lookupTxt(name);
  if (found === null) return { ok: false, code: 'dnsFail' };
  if (!found.length) return { ok: false, code: 'missing', found: [] };
  // accept the bare token too — some panels strip the "key=" part
  const hit = found.some(v => v === want || v === token || v.replace(/\s/g, '') === want);
  return hit ? { ok: true, code: 'verified', found }
             : { ok: false, code: 'mismatch', found };
}

/* ---------- the map ---------- */

/** The blog id served on `host`, or null. Used by the boot router. */
export async function resolveHostToBlog(host) {
  const key = domainKey(host || location.hostname);
  if (!key) return null;
  try {
    const snap = await get(child(ref(db), 'domains/' + key));
    if (!snap.exists()) return null;
    const v = snap.val() || {};
    if (v.verified === false) return null;
    return (typeof v.blog === 'string' && v.blog) ? v.blog : null;
  } catch (e) { return null; }
}

/** Who currently owns a domain entry, or null when it is free. */
export async function domainOwner(domain) {
  try {
    const snap = await get(child(ref(db), 'domains/' + domainKey(domain)));
    return snap.exists() ? (snap.val() || {}) : null;
  } catch (e) { return null; }
}

/**
 * Publish the domain → blog mapping. Call only after verifyDomainOwnership
 * succeeded; the database rules additionally require that `uid` owns the blog.
 */
export async function linkDomain(domain, blogId, uid) {
  const key = domainKey(domain);
  await set(ref(db, 'domains/' + key), { blog: blogId, uid, at: Date.now(), verified: true });
  await set(ref(db, 'blogs/' + blogId + '/domain'), domain);
}

/** Remove the mapping and clear the field on the blog. */
export async function unlinkDomain(domain, blogId) {
  const key = domainKey(domain);
  await remove(ref(db, 'domains/' + key)).catch(() => {});
  await remove(ref(db, 'blogs/' + blogId + '/domain')).catch(() => {});
  await remove(ref(db, 'blogs/' + blogId + '/domainToken')).catch(() => {});
}

/**
 * The canonical URL for a blog: its own domain when one is linked, otherwise
 * the platform link. Feeding this to <link rel="canonical"> is what stops
 * Google from seeing the domain and the platform URL as duplicate pages.
 */
export function canonicalBlogUrl(d, id, platformUrl, postIdx) {
  const dom = d && typeof d.domain === 'string' ? d.domain : '';
  if (dom && normalizeDomain(dom).ok) {
    const base = 'https://' + dom + '/';
    return (postIdx != null && postIdx !== '') ? base + '?post=' + encodeURIComponent(postIdx) : base;
  }
  return platformUrl;
}
