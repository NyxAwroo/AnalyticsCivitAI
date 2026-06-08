import { CIVITAI_API_BASE_URL, API_RATE_LIMIT_DELAY_MS } from '../utils/constants';

export interface CivitAIUser {
  id: number;
  username: string;
  image?: string;
}

export interface CivitAIModelStats {
  downloadCount?: number;
  thumbsUpCount?: number;
  thumbsDownCount?: number;
  commentCount?: number;
  rating?: number;
  ratingCount?: number;
  tippedAmountCount?: number;
  generationCount?: number;
}

export interface CivitAIModelVersion {
  id: number;
  name: string;
  baseModel?: string;
  stats?: CivitAIModelStats;
  publishedAt?: string;
  images?: Array<{
    url?: string;
  }>;
}

export interface CivitAITag {
  name: string;
}

export interface CivitAIModel {
  id: number;
  name: string;
  description?: string;
  type: string;
  publishedAt?: string;
  creator?: {
    username?: string;
  };
  tags?: Array<string | CivitAITag>;
  modelVersions?: CivitAIModelVersion[];
  stats?: CivitAIModelStats;
}

export interface CivitAIArticleStats {
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export interface CivitAIArticle {
  id: number;
  title: string;
  publishedAt?: string;
  stats?: CivitAIArticleStats;
}

export interface CivitAIListResponse<T> {
  items: T[];
  metadata?: {
    totalItems?: number;
    currentPage?: number;
    pageSize?: number;
    totalPages?: number;
    nextPage?: string;
  };
}

export class CivitAIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly endpoint?: string
  ) {
    super(message);
    this.name = 'CivitAIError';
  }
}

// ─── Helpers internes ────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function buildHeaders(apiKey: string): HeadersInit {
  const headers: HeadersInit = { Accept: 'application/json' };
  if (apiKey.trim().length > 0) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  return headers;
}

/**
 * Fetch avec timeout + retry automatique sur erreurs transitoires (504, 503, réseau).
 * - Timeout : 20 secondes par tentative
 * - Retry   : 3 tentatives max avec backoff exponentiel (2s → 4s → 6s)
 * - Seuls 504 / 503 / erreurs réseau déclenchent un retry. 401/403/404 = échec immédiat.
 */
async function fetchWithRetry(
  url: string,
  headers: HeadersInit,
  retries = 3,
  timeoutMs = 20_000
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timer);

      // Erreurs définitives : on ne retente pas
      if ([400, 401, 403, 404].includes(response.status)) {
        return response;
      }

      // Erreurs transitoires (504, 503, 429...) : on retente si possible
      if (!response.ok && attempt < retries - 1) {
        const backoff = 2000 * (attempt + 1); // 2s, 4s, 6s
        console.warn(
          `[CivitAI] ${response.status} sur ${url} — retry dans ${backoff / 1000}s (tentative ${attempt + 1}/${retries})`
        );
        await delay(backoff);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timer);

      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const label = isAbort ? `Timeout (${timeoutMs / 1000}s)` : 'Erreur réseau';

      if (attempt < retries - 1) {
        const backoff = 2000 * (attempt + 1);
        console.warn(
          `[CivitAI] ${label} sur ${url} — retry dans ${backoff / 1000}s (tentative ${attempt + 1}/${retries})`
        );
        await delay(backoff);
      } else {
        throw new CivitAIError(
          `${label} après ${retries} tentatives sur ${url}`,
          undefined,
          url
        );
      }
    }
  }

  // Sécurité TypeScript — jamais atteint en pratique
  throw new CivitAIError(`Échec après ${retries} tentatives`, undefined, url);
}

// ─── Requête principale ───────────────────────────────────────────────────────

async function request<T>(
  path: string,
  apiKey: string,
  params?: URLSearchParams,
  apiBaseUrl = CIVITAI_API_BASE_URL
): Promise<T> {
  const url = new URL(`${apiBaseUrl}${path}`);

  if (params) {
    params.forEach((value, key) => url.searchParams.set(key, value));
  }

  const response = await fetchWithRetry(url.toString(), buildHeaders(apiKey));

  if (!response.ok) {
    const endpoint = `${path}${url.search}`;
    const message =
      response.status === 401
        ? 'Clé API invalide ou expirée.'
        : `Erreur CivitAI (${response.status}) sur ${endpoint}.`;
    throw new CivitAIError(message, response.status, endpoint);
  }

  return (await response.json()) as T;
}

// ─── Endpoints publics ────────────────────────────────────────────────────────

export async function validateApiKey(
  apiKey: string,
  apiBaseUrl = CIVITAI_API_BASE_URL
): Promise<CivitAIUser> {
  return request<CivitAIUser>('/me', apiKey, undefined, apiBaseUrl);
}

export async function fetchUserModels(
  apiKey: string,
  username: string,
  apiBaseUrl = CIVITAI_API_BASE_URL
): Promise<CivitAIListResponse<CivitAIModel>> {
  const params = new URLSearchParams({ username, limit: '100', nsfw: 'true' });
  return request<CivitAIListResponse<CivitAIModel>>('/models', apiKey, params, apiBaseUrl);
}

export async function searchModels(
  apiKey: string,
  query: string,
  apiBaseUrl = CIVITAI_API_BASE_URL
): Promise<CivitAIListResponse<CivitAIModel>> {
  const params = new URLSearchParams({
    query,
    limit: '20',
    sort: 'Most Downloaded'
  });

  return request<CivitAIListResponse<CivitAIModel>>('/models', apiKey, params, apiBaseUrl);
}

export async function fetchFavoriteModels(
  apiKey: string,
  apiBaseUrl = CIVITAI_API_BASE_URL
): Promise<CivitAIListResponse<CivitAIModel>> {
  const params = new URLSearchParams({
    favorited: 'true',
    limit: '100',
    nsfw: 'true',
    sort: 'Most Downloaded'
  });

  return request<CivitAIListResponse<CivitAIModel>>('/models', apiKey, params, apiBaseUrl);
}

/**
 * Détail d'un modèle avec délai de politesse AVANT l'appel.
 * Le délai est appliqué ici pour cadencer les appels en batch côté appelant.
 */
export async function fetchModelDetails(
  apiKey: string,
  modelId: number,
  apiBaseUrl = CIVITAI_API_BASE_URL
): Promise<CivitAIModel> {
  await delay(API_RATE_LIMIT_DELAY_MS);
  return request<CivitAIModel>(`/models/${modelId}`, apiKey, undefined, apiBaseUrl);
}

export async function fetchUserArticles(
  apiKey: string,
  username: string,
  apiBaseUrl = CIVITAI_API_BASE_URL
): Promise<CivitAIListResponse<CivitAIArticle>> {
  const params = new URLSearchParams({ username, limit: '100' });
  await delay(API_RATE_LIMIT_DELAY_MS);
  return request<CivitAIListResponse<CivitAIArticle>>('/articles', apiKey, params, apiBaseUrl);
}

export interface TrendingModelFilters {
  type?: string;
  baseModel?: string;
  tag?: string;
  period?: 'Day' | 'Week';
}

export async function fetchTrendingModels(
  apiKey: string,
  filters: TrendingModelFilters = {},
  apiBaseUrl = CIVITAI_API_BASE_URL
): Promise<CivitAIListResponse<CivitAIModel>> {
  const params = new URLSearchParams({
    sort: 'Most Downloaded',
    period: filters.period ?? 'Day',
    limit: '50'
  });

  if (filters.type) {
    params.set('types', filters.type);
  }

  if (filters.baseModel) {
    params.set('baseModels', filters.baseModel);
  }

  if (filters.tag) {
    params.set('tag', filters.tag);
  }

  return request<CivitAIListResponse<CivitAIModel>>('/models', apiKey, params, apiBaseUrl);
}
