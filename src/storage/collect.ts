import {
  CivitAIError,
  fetchFavoriteModels,
  fetchModelDetails,
  fetchUserArticles,
  fetchUserModels,
  type CivitAIArticle,
  type CivitAIModel
} from '../api/civitai';
import {
  db,
  getCompetitorTrackedModels,
  getSettings,
  purgeOldSnapshots,
  saveSettings,
  type ArticleSnapshot,
  type ModelSnapshot,
  type TrackedArticle,
  type TrackedModel,
  type TrackedModelVersion
} from './db';
import { COLLECTION_PROGRESS_KEY } from '../utils/constants';

export interface CollectionResult {
  models: number;
  competitors: number;
  articles: number;
  snapshots: number;
  errors: number;
  collectedAt: number;
}

export interface CompetitorNewModelAlert {
  modelId: number;
  name: string;
  creatorUsername: string;
  matchedTags: string[];
}

export interface CollectionProgress {
  isCollecting: boolean;
  current: number;
  total: number;
  label: string;
  startedAt: number;
}

function getBaseModel(model: CivitAIModel): string {
  return model.modelVersions?.find((version) => version.baseModel)?.baseModel ?? 'Inconnu';
}

function normalizeTags(model: CivitAIModel): string[] {
  return (model.tags ?? []).map((tag) => (typeof tag === 'string' ? tag : tag.name));
}

function toTrackedModel(model: CivitAIModel, isOwn: boolean, addedAt = Date.now()): TrackedModel {
  return {
    modelId: model.id,
    name: model.name,
    type: model.type,
    baseModel: getBaseModel(model),
    tags: normalizeTags(model),
    isOwn,
    addedAt,
    creatorUsername: model.creator?.username
  };
}

function canUseChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

async function updateCollectionProgress(progress: CollectionProgress): Promise<void> {
  if (!canUseChromeStorage()) {
    return;
  }

  await chrome.storage.local.set({ [COLLECTION_PROGRESS_KEY]: progress });
}

async function clearCollectionProgress(): Promise<void> {
  if (!canUseChromeStorage()) {
    return;
  }

  await chrome.storage.local.set({
    [COLLECTION_PROGRESS_KEY]: {
      isCollecting: false,
      current: 0,
      total: 0,
      label: '',
      startedAt: 0
    } satisfies CollectionProgress
  });
}

function toTrackedModelVersions(model: CivitAIModel): TrackedModelVersion[] {
  return (model.modelVersions ?? []).map((version) => ({
    versionId: version.id,
    modelId: model.id,
    name: version.name,
    baseModel: version.baseModel ?? getBaseModel(model),
    publishedAt: version.publishedAt ? Date.parse(version.publishedAt) : 0
  }));
}

function toModelSnapshots(model: CivitAIModel, timestamp: number): ModelSnapshot[] {
  const versions = model.modelVersions ?? [];

  if (versions.length === 0) {
    return [
      {
        modelId: model.id,
        timestamp,
        downloads: model.stats?.downloadCount ?? 0,
        likes: model.stats?.thumbsUpCount ?? 0,
        comments: model.stats?.commentCount ?? 0,
        rating: model.stats?.rating ?? 0,
        ratingCount: model.stats?.ratingCount ?? 0,
        buzzTipped: model.stats?.tippedAmountCount ?? 0,
        generationCount: model.stats?.generationCount ?? 0
      }
    ];
  }

  return versions.map((version) => ({
    modelId: model.id,
    versionId: version.id,
    timestamp,
    downloads: version.stats?.downloadCount ?? 0,
    likes: model.stats?.thumbsUpCount ?? 0,
    comments: model.stats?.commentCount ?? 0,
    rating: model.stats?.rating ?? 0,
    ratingCount: model.stats?.ratingCount ?? 0,
    buzzTipped: model.stats?.tippedAmountCount ?? 0,
    generationCount: model.stats?.generationCount ?? 0
  }));
}

function toTrackedArticle(article: CivitAIArticle, linkedModelIds: number[] = []): TrackedArticle {
  return {
    articleId: article.id,
    title: article.title,
    publishedAt: article.publishedAt ? Date.parse(article.publishedAt) : Date.now(),
    linkedModelIds
  };
}

function toArticleSnapshot(article: CivitAIArticle, timestamp: number): ArticleSnapshot {
  return {
    articleId: article.id,
    timestamp,
    views: article.stats?.viewCount ?? 0,
    likes: article.stats?.likeCount ?? 0,
    comments: article.stats?.commentCount ?? 0
  };
}

function parseCivitAIModelId(input: string): number | undefined {
  const trimmedInput = input.trim();
  const directId = Number(trimmedInput);

  if (Number.isInteger(directId) && directId > 0) {
    return directId;
  }

  const match = trimmedInput.match(/civitai\.(?:com|red)\/models\/(\d+)/i);
  if (!match) {
    return undefined;
  }

  return Number(match[1]);
}

function getSourceModelId(model: CivitAIModel | TrackedModel): number {
  return 'id' in model ? model.id : model.modelId;
}

async function fetchModelWithFallback(
  apiKey: string,
  model: CivitAIModel | TrackedModel,
  apiBaseUrl: string
): Promise<CivitAIModel | undefined> {
  const modelId = getSourceModelId(model);

  try {
    return await fetchModelDetails(apiKey, modelId, apiBaseUrl);
  } catch (error) {
    if (error instanceof CivitAIError) {
      console.warn(
        `CivitAI error ${error.status ?? 'unknown'} for model ${modelId}; skipping or using fallback.`,
        error
      );

      if ('id' in model && error.status === 404) {
        return model;
      }

      return undefined;
    }

    throw error;
  }
}

export async function collectNow(): Promise<CollectionResult> {
  const settings = await getSettings();

  if (!settings.apiKey || !settings.username) {
    throw new Error('Configure une clé API valide avant de lancer la collecte.');
  }

  const collectedAt = Date.now();
  let lastCollectionErrors = 0;
  const startedAt = collectedAt;

  // ─── 1. Fetch des modèles ────────────────────────────────────────────────────
  const modelsResponse = await fetchUserModels(
    settings.apiKey,
    settings.username,
    settings.apiBaseUrl
  );
  const detailedModels: CivitAIModel[] = [];
  const competitorModels = await getCompetitorTrackedModels();
  const totalItems = modelsResponse.items.length + competitorModels.length + 1;
  let currentItem = 0;

  await updateCollectionProgress({
    isCollecting: true,
    current: currentItem,
    total: totalItems,
    label: 'Préparation',
    startedAt
  });

  for (const model of modelsResponse.items) {
    currentItem += 1;
    await updateCollectionProgress({
      isCollecting: true,
      current: currentItem,
      total: totalItems,
      label: model.name,
      startedAt
    });
    const detailedModel = await fetchModelWithFallback(settings.apiKey, model, settings.apiBaseUrl);
    if (detailedModel) {
      detailedModels.push(detailedModel);
    } else {
      lastCollectionErrors += 1;
    }
  }

  const detailedCompetitors: Array<{ model: CivitAIModel; addedAt: number }> = [];

  for (const competitor of competitorModels) {
    currentItem += 1;
    await updateCollectionProgress({
      isCollecting: true,
      current: currentItem,
      total: totalItems,
      label: competitor.name,
      startedAt
    });
    const detailedCompetitor = await fetchModelWithFallback(
      settings.apiKey,
      competitor,
      settings.apiBaseUrl
    );
    if (detailedCompetitor) {
      detailedCompetitors.push({ model: detailedCompetitor, addedAt: competitor.addedAt });
    } else {
      lastCollectionErrors += 1;
    }
  }

  // ─── 2. Fetch des articles ───────────────────────────────────────────────────
  let articles: CivitAIArticle[] = [];

  try {
    currentItem += 1;
    await updateCollectionProgress({
      isCollecting: true,
      current: currentItem,
      total: totalItems,
      label: 'Articles',
      startedAt
    });
    const articlesResponse = await fetchUserArticles(
      settings.apiKey,
      settings.username,
      settings.apiBaseUrl
    );
    articles = articlesResponse.items;
  } catch (error) {
    if (error instanceof CivitAIError) {
      console.warn(`CivitAI articles error ${error.status ?? 'unknown'}; skipping articles.`, error);
      lastCollectionErrors += 1;
    } else {
      throw error;
    }
  }

  // ─── 3. Transformation des données ──────────────────────────────────────────
  const trackedModels = [
    ...detailedModels.map((model) => toTrackedModel(model, true)),
    ...detailedCompetitors.map(({ model, addedAt }) => toTrackedModel(model, false, addedAt))
  ];
  const existingTrackedModels = new Map(
    (await db.trackedModels.toArray()).map((model) => [model.modelId, model])
  );
  const trackedModelsWithNotes = trackedModels.map((model) => ({
    ...model,
    notes: existingTrackedModels.get(model.modelId)?.notes
  }));
  const allDetailedModels = [
    ...detailedModels,
    ...detailedCompetitors.map((competitor) => competitor.model)
  ];
  const trackedModelVersions = allDetailedModels.flatMap(toTrackedModelVersions);
  const modelSnapshots = allDetailedModels.flatMap((model) => toModelSnapshots(model, collectedAt));
  const existingArticles = new Map(
    (await db.trackedArticles.toArray()).map((article) => [article.articleId, article])
  );
  const trackedArticles = articles.map((article) =>
    toTrackedArticle(article, existingArticles.get(article.id)?.linkedModelIds ?? [])
  );
  const articleSnapshots = articles.map((article) => toArticleSnapshot(article, collectedAt));

  // ─── 4. Écriture en base — opérations séquentielles SANS transaction englobante
  //
  // POURQUOI PAS db.transaction() ?
  // Dans un service worker Chrome MV3, IDBTransaction se ferme automatiquement
  // dès que la microtask queue est vide entre deux opérations — même sans I/O
  // externe. Dexie lève alors "Transaction committed too early".
  // Chaque bulk operation de Dexie est atomique individuellement : c'est suffisant
  // pour notre cas d'usage (pas besoin de rollback multi-table).
  // ────────────────────────────────────────────────────────────────────────────
  await db.trackedModels.bulkPut(trackedModelsWithNotes);
  if (trackedModelVersions.length > 0) {
    await db.trackedModelVersions.bulkPut(trackedModelVersions);
  }
  await db.modelSnapshots.bulkAdd(modelSnapshots);
  await db.trackedArticles.bulkPut(trackedArticles);
  await db.articleSnapshots.bulkAdd(articleSnapshots);

  // ─── 5. Mise à jour des settings (lastCollectedAt) ──────────────────────────
  // saveSettings gère IndexedDB + chrome.storage — hors transaction, aucun risque.
  const updatedSettings = { ...settings, lastCollectedAt: collectedAt, lastCollectionErrors };
  await saveSettings(updatedSettings);

  // ─── 6. Purge des anciens snapshots ─────────────────────────────────────────
  await purgeOldSnapshots(settings.snapshotRetentionDays);
  await clearCollectionProgress();

  return {
    models: detailedModels.length,
    competitors: detailedCompetitors.length,
    articles: trackedArticles.length,
    snapshots: modelSnapshots.length + articleSnapshots.length,
    errors: lastCollectionErrors,
    collectedAt
  };
}

export async function collectSingleModel(modelId: number): Promise<TrackedModel> {
  const settings = await getSettings();
  const existing = await db.trackedModels.get(modelId);

  if (!settings.apiKey) {
    throw new Error('Configure une clé API valide avant de lancer la collecte.');
  }

  const model = await fetchModelDetails(settings.apiKey, modelId, settings.apiBaseUrl);
  const collectedAt = Date.now();
  const trackedModel = {
    ...toTrackedModel(model, existing?.isOwn ?? true, existing?.addedAt ?? Date.now()),
    notes: existing?.notes
  };
  const trackedModelVersions = toTrackedModelVersions(model);
  const modelSnapshots = toModelSnapshots(model, collectedAt);

  await db.trackedModels.put(trackedModel);
  if (trackedModelVersions.length > 0) {
    await db.trackedModelVersions.bulkPut(trackedModelVersions);
  }
  await db.modelSnapshots.bulkAdd(modelSnapshots);

  return trackedModel;
}

export async function importFavoriteModels(): Promise<TrackedModel[]> {
  const settings = await getSettings();

  if (!settings.apiKey) {
    throw new Error('Configure une clé API valide avant d’importer les favoris.');
  }

  const response = await fetchFavoriteModels(settings.apiKey, settings.apiBaseUrl);
  const existing = new Map((await db.trackedModels.toArray()).map((model) => [model.modelId, model]));
  const trackedModels = response.items.map((model) => ({
    ...toTrackedModel(model, false, existing.get(model.id)?.addedAt ?? Date.now()),
    notes: existing.get(model.id)?.notes
  }));

  if (trackedModels.length > 0) {
    await db.trackedModels.bulkPut(trackedModels);
  }

  return trackedModels;
}

export async function trackCompetitorFromInput(input: string): Promise<TrackedModel> {
  const settings = await getSettings();
  const modelId = parseCivitAIModelId(input);

  if (!modelId) {
    throw new Error('URL CivitAI invalide. Format attendu : https://civitai.com/models/123/...');
  }

  const model = await fetchModelDetails(settings.apiKey, modelId, settings.apiBaseUrl);
  const collectedAt = Date.now();
  const trackedModel = toTrackedModel(model, false);
  const trackedModelVersions = toTrackedModelVersions(model);
  const modelSnapshots = toModelSnapshots(model, collectedAt);

  await db.trackedModels.put(trackedModel);
  if (trackedModelVersions.length > 0) {
    await db.trackedModelVersions.bulkPut(trackedModelVersions);
  }
  await db.modelSnapshots.bulkAdd(modelSnapshots);

  return trackedModel;
}

export async function trackCompetitorByModelId(modelId: number): Promise<TrackedModel> {
  return trackCompetitorFromInput(String(modelId));
}

export async function findNewCompetitorModelsInOwnedNiches(): Promise<CompetitorNewModelAlert[]> {
  const settings = await getSettings();
  const [competitors, ownModels, allTrackedModels] = await Promise.all([
    getCompetitorTrackedModels(),
    db.trackedModels.filter((model) => model.isOwn === true).toArray(),
    db.trackedModels.toArray()
  ]);
  const knownModelIds = new Set(allTrackedModels.map((model) => model.modelId));
  const ownedTags = new Set(
    ownModels.flatMap((model) => model.tags.map((tag) => tag.toLowerCase()))
  );
  const competitorCreators = [
    ...new Set(
      competitors
        .map((competitor) => competitor.creatorUsername)
        .filter((username): username is string => Boolean(username))
    )
  ];
  const alerts: CompetitorNewModelAlert[] = [];

  if (ownedTags.size === 0 || competitorCreators.length === 0) {
    return alerts;
  }

  for (const creatorUsername of competitorCreators) {
    const response = await fetchUserModels(
      settings.apiKey,
      creatorUsername,
      settings.apiBaseUrl
    );

    for (const model of response.items) {
      if (knownModelIds.has(model.id)) {
        continue;
      }

      const matchedTags = normalizeTags(model).filter((tag) => ownedTags.has(tag.toLowerCase()));

      if (matchedTags.length > 0) {
        alerts.push({
          modelId: model.id,
          name: model.name,
          creatorUsername,
          matchedTags
        });
      }
    }
  }

  return alerts;
}

export function getModelAggregateSnapshot(
  modelId: number,
  snapshots: ModelSnapshot[]
): ModelSnapshot {
  const sameModel = snapshots.filter((snapshot) => snapshot.modelId === modelId);

  return sameModel.reduce<ModelSnapshot>(
    (total, snapshot) => ({
      modelId,
      timestamp: Math.max(total.timestamp, snapshot.timestamp),
      downloads: total.downloads + snapshot.downloads,
      likes: Math.max(total.likes, snapshot.likes),
      comments: Math.max(total.comments, snapshot.comments),
      rating: Math.max(total.rating, snapshot.rating),
      ratingCount: Math.max(total.ratingCount, snapshot.ratingCount),
      buzzTipped: Math.max(total.buzzTipped ?? 0, snapshot.buzzTipped ?? 0),
      generationCount: Math.max(total.generationCount ?? 0, snapshot.generationCount ?? 0)
    }),
    {
      modelId,
      timestamp: 0,
      downloads: 0,
      likes: 0,
      comments: 0,
      rating: 0,
      ratingCount: 0,
      buzzTipped: 0,
      generationCount: 0
    }
  );
}
