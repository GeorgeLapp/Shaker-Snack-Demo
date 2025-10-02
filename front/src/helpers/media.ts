const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

const SNACK_API_BASE_URL = (import.meta.env.VITE_APP_SNACK_API_URL ?? 'http://147.78.67.179:4000').replace(/\/+$/, '');
const RAW_MEDIA_PREFIX = import.meta.env.VITE_APP_SNACK_MEDIA_PREFIX ?? '/media';

const isMediaPrefixAbsolute = ABSOLUTE_URL_PATTERN.test(RAW_MEDIA_PREFIX);

const normalizePrefixBase = () => {
  if (isMediaPrefixAbsolute) {
    return RAW_MEDIA_PREFIX.replace(/\/+$/, '');
  }

  const withLeadingSlash = RAW_MEDIA_PREFIX.startsWith('/') ? RAW_MEDIA_PREFIX : `/${RAW_MEDIA_PREFIX}`;
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

export const buildSnackMediaUrl = (path: string): string => {
  if (!path) {
    return path;
  }

  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return path;
  }

  const cleanedPath = trimPrefixFromPath(path);
  const normalizedBase = MEDIA_BASE_URL.endsWith('/') ? MEDIA_BASE_URL : `${MEDIA_BASE_URL}/`;
  const normalizedPath = cleanedPath.replace(/^\/+/, '');

  return normalizedPath ? `${normalizedBase}${normalizedPath}` : `${normalizedBase}`;
};
