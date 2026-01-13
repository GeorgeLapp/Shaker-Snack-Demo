import { ICON_EMPTY_DATA_URL } from '../assets/icon/iconEmpty';

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const DATA_URL_PATTERN = /^data:/i;

const SNACK_API_BASE_URL = (
  import.meta.env.VITE_APP_SNACK_API_URL || 'http://localhost:4000'
).replace(/\/+$/, '');
const RAW_MEDIA_PREFIX = import.meta.env.VITE_APP_SNACK_MEDIA_PREFIX ?? '/media';

const isMediaPrefixAbsolute = ABSOLUTE_URL_PATTERN.test(RAW_MEDIA_PREFIX);

const normalizePrefixBase = () => {
  if (isMediaPrefixAbsolute) {
    return RAW_MEDIA_PREFIX.replace(/\/+$/, '');
  }

  const withLeadingSlash = RAW_MEDIA_PREFIX.startsWith('/')
    ? RAW_MEDIA_PREFIX
    : `/${RAW_MEDIA_PREFIX}`;
  return `${SNACK_API_BASE_URL}${withLeadingSlash}`.replace(/\/+$/, '');
};

const MEDIA_BASE_URL = normalizePrefixBase();

const relativePrefixSegment = isMediaPrefixAbsolute
  ? ''
  : RAW_MEDIA_PREFIX.replace(/^\/+/, '').replace(/\/+$/, '');

const trimPrefixFromPath = (value: string) => {
  if (!value) return value;
  const clean = value.replace(/^\/+/, '');

  if (!relativePrefixSegment) {
    return clean;
  }

  if (clean === relativePrefixSegment) {
    return '';
  }

  if (clean.startsWith(`${relativePrefixSegment}/`)) {
    return clean.slice(relativePrefixSegment.length + 1);
  }

  return clean;
};

const appendCacheBust = (url: string, cacheBust?: string | number): string => {
  if (!url || cacheBust === undefined || cacheBust === null) {
    return url;
  }

  if (DATA_URL_PATTERN.test(url)) {
    return url;
  }

  const [base, hash] = url.split('#');
  const separator = base.includes('?') ? '&' : '?';
  const withBust = `${base}${separator}v=${encodeURIComponent(String(cacheBust))}`;

  return hash ? `${withBust}#${hash}` : withBust;
};

export const buildSnackMediaUrl = (path: string, cacheBust?: string | number): string => {
  if (!path) {
    return path;
  }

  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return appendCacheBust(path, cacheBust);
  }

  const cleanedPath = trimPrefixFromPath(path);
  const normalizedBase = MEDIA_BASE_URL.endsWith('/') ? MEDIA_BASE_URL : `${MEDIA_BASE_URL}/`;
  const normalizedPath = cleanedPath.replace(/^\/+/, '');

  const url = normalizedPath ? `${normalizedBase}${normalizedPath}` : `${normalizedBase}`;
  return appendCacheBust(url, cacheBust);
};

export const buildServiceMenuUrl = (productId: number, path: string): string => {
  if (productId === 0 || !path) {
    return ICON_EMPTY_DATA_URL;
  }

  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return path;
  }

  const normalizedPath = path.replace(/\\/g, '/');
  const cleanedPath = normalizedPath.split('/').at(-1);
  const normalizedBase = MEDIA_BASE_URL.endsWith('/') ? MEDIA_BASE_URL : `${MEDIA_BASE_URL}/`;

  return normalizedBase + cleanedPath;
};
