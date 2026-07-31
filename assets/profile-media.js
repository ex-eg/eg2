const POSITION_RE = /^[\d.]+%\s+[\d.]+%$/;

export const safePhotoPosition = value => POSITION_RE.test(value || '') ? value : '50% 50%';

export const safePhotoZoom = value => {
  const number = parseFloat(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(3, number)) : 1;
};

export const photoStyle = data =>
  `object-position:${safePhotoPosition(data.photoPos)};transform:scale(${safePhotoZoom(data.photoZoom)})`;

export const safeUrl = value => {
  const url = String(value == null ? '' : value).replace(/^[\u0000-\u0020]+/, '');
  return /^https?:\/\//i.test(url) ? url : '';
};

export const safeCssUrl = value =>
  String(value || '').replace(/["'()\\<>\s]/g, match => encodeURIComponent(match));

export const youtubeId = value => {
  const source = String(value || '').trim();
  const match = source.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  return match ? match[1] : (/^[\w-]{11}$/.test(source) ? source : '');
};

export const galleryItems = data =>
  Array.isArray(data.gallery) ? data.gallery.filter(value => typeof value === 'string' && value.trim()) : [];

export const videoItems = data =>
  Array.isArray(data.videos) ? data.videos.map(youtubeId).filter(Boolean) : [];
