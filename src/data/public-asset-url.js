const DEPLOYMENT_BASE_URL = import.meta.env?.BASE_URL || '/';

const normalizeBaseUrl = (value) => {
  const baseUrl = String(value || '/');
  const withLeadingSlash = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

export const resolvePublicAssetUrl = (value, baseUrl = DEPLOYMENT_BASE_URL) => {
  const source = String(value || '');
  if (!source.startsWith('/') || source.startsWith('//')) return source;

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (normalizedBaseUrl === '/' || source.startsWith(normalizedBaseUrl)) return source;
  return `${normalizedBaseUrl.slice(0, -1)}${source}`;
};

