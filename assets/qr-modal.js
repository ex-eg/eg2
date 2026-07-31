export function createQrModal({ $, t, esc, toast, uploadIcon }) {
  let qrLibraryPromise = null;
  const qrImgSrc = (url, size = 440) => {
    if (window.QRCode && typeof window.QRCode.toDataURL === 'function') return Promise.resolve(window.QRCode.toDataURL(url, { width: size, margin: 2 }));
    if (qrLibraryPromise) return qrLibraryPromise.then(() => window.QRCode.toDataURL(url, { width: size, margin: 2 }));
    qrLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js'; script.async = true;
      script.onload = () => window.QRCode ? resolve() : reject(new Error('QR library unavailable'));
      script.onerror = () => reject(new Error('QR library failed')); document.head.appendChild(script);
    });
    return qrLibraryPromise.then(() => window.QRCode.toDataURL(url, { width: size, margin: 2 }));
  };

  function closeQR() {
    const overlay = $('#qrOv');
    if (overlay) overlay.remove();
  }

  async function openQR(url, label) {
    closeQR();
    const safeLabel = label ? String(label).slice(0, 60) : t('رابط', 'Link');
    const overlay = document.createElement('div');
    overlay.id = 'qrOv';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:18px';
    overlay.innerHTML = `<div class="qr-card" style="background:var(--panel,#fff);color:var(--txt,#111);max-width:400px;width:100%;border-radius:18px;padding:24px 22px;box-shadow:0 20px 60px rgba(0,0,0,.45);position:relative;border:1px solid var(--line,rgba(0,0,0,.12));text-align:center">
      <button id="qrClose" title="${t('إغلاق', 'Close')}" style="position:absolute;top:12px;inset-inline-end:12px;background:none;border:none;font-size:22px;cursor:pointer;color:inherit;line-height:1">✕</button>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;margin:2px 0 4px">${t('رمز QR', 'QR code')}</h3>
      <p class="sub" style="margin-bottom:16px;word-break:break-word">${esc(safeLabel)}</p>
      <div style="background:#fff;border-radius:14px;padding:14px;display:inline-block;box-shadow:0 4px 18px rgba(0,0,0,.12)">
        <img id="qrImg" alt="QR" width="240" height="240" style="display:block;width:240px;height:240px;image-rendering:pixelated"/>
      </div>
      <div style="display:flex;gap:8px;margin:16px 0 10px">
        <input id="qrLink" value="${esc(url)}" readonly dir="ltr" style="flex:1;min-width:0;font-family:monospace;font-size:12px"/>
        <button class="btn ghost" id="qrCopy" style="flex:0 0 auto">${t('نسخ', 'Copy')}</button>
      </div>
      <button class="btn primary" id="qrDl" style="width:100%">${uploadIcon} ${t('تحميل الرمز (PNG)', 'Download code (PNG)')}</button>
      <p class="sub" style="font-size:12px;margin-top:12px;opacity:.8">${t('اطبعه أو ضعه على بطاقتك — أي شخص يصوّره يفتح الرابط مباشرة.', 'Print it or add it to your card — anyone who scans it opens the link instantly.')}</p>
    </div>`;
    document.body.appendChild(overlay);
    try { $('#qrImg').src = await qrImgSrc(url); } catch { $('#qrImg').alt = t('تعذّر إنشاء الرمز', 'Could not create the code'); }

    const close = () => closeQR();
    $('#qrClose').onclick = close;
    overlay.onclick = event => { if (event.target === overlay) close(); };
    const onEscape = event => {
      if (event.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onEscape);
      }
    };
    document.addEventListener('keydown', onEscape);

    $('#qrCopy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const input = $('#qrLink');
        try { input.select(); document.execCommand('copy'); } catch {}
      }
      toast(t('تم نسخ الرابط ✓', 'Link copied ✓'));
    };

    $('#qrDl').onclick = async () => {
      const filename = 'elgoharyX-qr-' + String(safeLabel)
        .replace(/[^\w؀-ۿ-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase() + '.png';
      try {
        const dataUrl = await qrImgSrc(url, 600);
        const blob = await (await fetch(dataUrl)).blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename || 'elgoharyX-qr.png';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
        toast(t('تم تحميل الرمز ✓', 'QR downloaded ✓'));
      } catch {
        toast(t('تعذّر تحميل الرمز', 'Could not download the code'));
      }
    };
  }

  return { openQR, closeQR };
}
