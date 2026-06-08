import Dexie, { type Table } from 'dexie';

import {
  DEFAULT_COLLECTION_FREQUENCY_HOURS,
  CIVITAI_API_BASE_URL,
  SETTINGS_KEY,
  SNAPSHOT_RETENTION_DAYS
} from '../utils/constants';

export interface ModelSnapshot {
  id?: number;
  modelId: number;
  versionId?: number;
  timestamp: number;
  downloads: number;
  likes: number;
  comments: number;
  rating: number;
  ratingCount: number;
  buzzTipped?: number;
  generationCount?: number;
}

export interface TrackedModel {
  modelId: number;
  name: string;
  type: string;
  baseModel: string;
  tags: string[];
  isOwn: boolean;
  addedAt: number;
  creatorUsername?: string;
  notes?: string;
}

export interface AccountProfile {
  id: string;
  label: string;
  apiKey: string;
  username: string;
  apiBaseUrl: string;
}

export interface TrackedModelVersion {
  versionId: number;
  modelId: number;
  name: string;
  baseModel: string;
  publishedAt: number;
}

export interface ArticleSnapshot {
  id?: number;
  articleId: number;
  timestamp: number;
  views: number;
  likes: number;
  comments: number;
}

export interface TrackedArticle {
  articleId: number;
  title: string;
  publishedAt: number;
  linkedModelIds: number[];
}

export interface TrendSnapshot {
  id?: number;
  modelId: number;
  timestamp: number;
  name: string;
  type: string;
  baseModel: string;
  publishedAt: number;
  downloads: number;
  likes: number;
  comments: number;
  tags: string[];
  creatorUsername?: string;
  descriptionLength?: number;
  imageCount?: number;
  versionCount?: number;
}

export interface TagSnapshot {
  id?: number;
  tag: string;
  timestamp: number;
  count: number;
}

export interface Settings {
  id: typeof SETTINGS_KEY;
  apiKey: string;
  apiBaseUrl: string;
  username: string;
  collectFrequencyHours: 1 | 6 | 12 | 24;
  lastCollectedAt: number;
  lastCollectionErrors: number;
  darkMode: boolean;
  snapshotRetentionDays: number;
  language: 'fr' | 'en' | 'custom';
  customTranslations: Record<string, string>;
  accountProfiles: AccountProfile[];
  activeProfileId: string;
}

export class AnalyticsCivitAIDatabase extends Dexie {
  modelSnapshots!: Table<ModelSnapshot, number>;
  trackedModels!: Table<TrackedModel, number>;
  trackedModelVersions!: Table<TrackedModelVersion, number>;
  articleSnapshots!: Table<ArticleSnapshot, number>;
  trackedArticles!: Table<TrackedArticle, number>;
  trendSnapshots!: Table<TrendSnapshot, number>;
  tagSnapshots!: Table<TagSnapshot, number>;
  settings!: Table<Settings, string>;

  constructor() {
    super('AnalyticsCivitAI');
    this.version(1).stores({
      modelSnapshots: '++id, modelId, versionId, timestamp, [modelId+timestamp]',
      trackedModels: 'modelId, name, type, baseModel, isOwn, addedAt',
      articleSnapshots: '++id, articleId, timestamp, [articleId+timestamp]',
      trackedArticles: 'articleId, title, publishedAt',
      settings: 'id'
    });
    this.version(2).stores({
      modelSnapshots: '++id, modelId, versionId, timestamp, [modelId+timestamp]',
      trackedModels: 'modelId, name, type, baseModel, isOwn, addedAt',
      trackedModelVersions: 'versionId, modelId, name, baseModel, publishedAt',
      articleSnapshots: '++id, articleId, timestamp, [articleId+timestamp]',
      trackedArticles: 'articleId, title, publishedAt',
      settings: 'id'
    });
    this.version(3).stores({
      modelSnapshots: '++id, modelId, versionId, timestamp, [modelId+timestamp]',
      trackedModels: 'modelId, name, type, baseModel, isOwn, addedAt',
      trackedModelVersions: 'versionId, modelId, name, baseModel, publishedAt',
      articleSnapshots: '++id, articleId, timestamp, [articleId+timestamp]',
      trackedArticles: 'articleId, title, publishedAt',
      trendSnapshots: '++id, modelId, timestamp, type, baseModel, [modelId+timestamp]',
      tagSnapshots: '++id, tag, timestamp, [tag+timestamp]',
      settings: 'id'
    });
    this.version(4).stores({
      modelSnapshots: '++id, modelId, versionId, timestamp, [modelId+timestamp]',
      trackedModels: 'modelId, name, type, baseModel, isOwn, addedAt',
      trackedModelVersions: 'versionId, modelId, name, baseModel, publishedAt',
      articleSnapshots: '++id, articleId, timestamp, [articleId+timestamp]',
      trackedArticles: 'articleId, title, publishedAt',
      trendSnapshots: '++id, modelId, timestamp, type, baseModel, [modelId+timestamp]',
      tagSnapshots: '++id, tag, timestamp, [tag+timestamp]',
      settings: 'id'
    });
    this.version(5).stores({
      modelSnapshots: '++id, modelId, versionId, timestamp, [modelId+timestamp]',
      trackedModels: 'modelId, name, type, baseModel, isOwn, addedAt',
      trackedModelVersions: 'versionId, modelId, name, baseModel, publishedAt',
      articleSnapshots: '++id, articleId, timestamp, [articleId+timestamp]',
      trackedArticles: 'articleId, title, publishedAt',
      trendSnapshots: '++id, modelId, timestamp, type, baseModel, [modelId+timestamp]',
      tagSnapshots: '++id, tag, timestamp, [tag+timestamp]',
      settings: 'id'
    });
    this.version(6).stores({
      modelSnapshots: '++id, modelId, versionId, timestamp, [modelId+timestamp]',
      trackedModels: 'modelId, name, type, baseModel, isOwn, addedAt',
      trackedModelVersions: 'versionId, modelId, name, baseModel, publishedAt',
      articleSnapshots: '++id, articleId, timestamp, [articleId+timestamp]',
      trackedArticles: 'articleId, title, publishedAt',
      trendSnapshots: '++id, modelId, timestamp, type, baseModel, [modelId+timestamp]',
      tagSnapshots: '++id, tag, timestamp, [tag+timestamp]',
      settings: 'id'
    });
  }
}

export const db = new AnalyticsCivitAIDatabase();

export const defaultSettings: Settings = {
  id: SETTINGS_KEY,
  apiKey: '',
  apiBaseUrl: CIVITAI_API_BASE_URL,
  username: '',
  collectFrequencyHours: DEFAULT_COLLECTION_FREQUENCY_HOURS,
  lastCollectedAt: 0,
  lastCollectionErrors: 0,
  darkMode: true,
  snapshotRetentionDays: SNAPSHOT_RETENTION_DAYS,
  language: 'fr',
  customTranslations: {},
  accountProfiles: [],
  activeProfileId: ''
};

function canUseChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Settings>;

  return (
    candidate.id === SETTINGS_KEY &&
    typeof candidate.apiKey === 'string' &&
    typeof candidate.apiBaseUrl === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.collectFrequencyHours === 'number' &&
    typeof candidate.lastCollectedAt === 'number' &&
    typeof candidate.lastCollectionErrors === 'number' &&
    typeof candidate.darkMode === 'boolean' &&
    typeof candidate.snapshotRetentionDays === 'number' &&
    (candidate.language === 'fr' || candidate.language === 'en' || candidate.language === 'custom') &&
    typeof candidate.customTranslations === 'object' &&
    candidate.customTranslations !== null &&
    Array.isArray(candidate.accountProfiles) &&
    typeof candidate.activeProfileId === 'string'
  );
}

function normalizeAccountProfiles(value: unknown): AccountProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((profile): profile is Partial<AccountProfile> => typeof profile === 'object' && profile !== null)
    .map((profile) => ({
      id: typeof profile.id === 'string' && profile.id.length > 0 ? profile.id : crypto.randomUUID(),
      label: typeof profile.label === 'string' && profile.label.length > 0 ? profile.label : 'Compte',
      apiKey: typeof profile.apiKey === 'string' ? profile.apiKey : '',
      username: typeof profile.username === 'string' ? profile.username : '',
      apiBaseUrl:
        typeof profile.apiBaseUrl === 'string' && profile.apiBaseUrl.length > 0
          ? profile.apiBaseUrl
          : CIVITAI_API_BASE_URL
    }));
}

function normalizeSettings(value: Partial<Settings> | undefined): Settings {
  const accountProfiles = normalizeAccountProfiles(value?.accountProfiles);

  return {
    ...defaultSettings,
    ...value,
    id: SETTINGS_KEY,
    apiBaseUrl:
      typeof value?.apiBaseUrl === 'string' && value.apiBaseUrl.length > 0
        ? value.apiBaseUrl
        : defaultSettings.apiBaseUrl,
    lastCollectionErrors:
      typeof value?.lastCollectionErrors === 'number' ? value.lastCollectionErrors : 0,
    language:
      value?.language === 'en' || value?.language === 'custom' || value?.language === 'fr'
        ? value.language
        : defaultSettings.language,
    customTranslations:
      typeof value?.customTranslations === 'object' && value.customTranslations !== null
        ? value.customTranslations
        : {},
    accountProfiles,
    activeProfileId:
      typeof value?.activeProfileId === 'string' &&
      accountProfiles.some((profile) => profile.id === value.activeProfileId)
        ? value.activeProfileId
        : ''
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readSettingsFromChromeStorage(): Promise<Settings | undefined> {
  if (!canUseChromeStorage()) {
    return undefined;
  }

  const stored: unknown = await chrome.storage.local.get(SETTINGS_KEY);
  const value = isRecord(stored) ? stored[SETTINGS_KEY] : undefined;

  return isSettings(value) ? value : undefined;
}

async function writeSettingsToChromeStorage(settings: Settings): Promise<void> {
  if (!canUseChromeStorage()) {
    return;
  }

  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get(SETTINGS_KEY);
  if (existing) {
    const settings = normalizeSettings(existing);
    if (!isSettings(existing)) {
      await saveSettings(settings);
    }
    return settings;
  }

  const chromeStored = await readSettingsFromChromeStorage();
  const settings = normalizeSettings(chromeStored ?? defaultSettings);

  await db.settings.put(settings);
  return settings;
}

/**
 * Sauvegarde les settings dans IndexedDB ET chrome.storage.
 * À appeler toujours HORS d'une transaction Dexie.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const normalizedSettings = normalizeSettings(settings);
  await db.settings.put(normalizedSettings);
  await writeSettingsToChromeStorage(normalizedSettings);
}

export async function purgeOldSnapshots(retentionDays: number): Promise<void> {
  const cutoff = Date.now() - retentionDays * 86_400_000;
  await db.modelSnapshots.where('timestamp').below(cutoff).delete();
  await db.articleSnapshots.where('timestamp').below(cutoff).delete();
  await db.trendSnapshots.where('timestamp').below(cutoff).delete();
  await db.tagSnapshots.where('timestamp').below(cutoff).delete();
}

export async function getOwnTrackedModels(): Promise<TrackedModel[]> {
  const allModels = await db.trackedModels.toArray();
  return allModels.filter((model) => model.isOwn === true);
}

export async function getCompetitorTrackedModels(): Promise<TrackedModel[]> {
  const allModels = await db.trackedModels.toArray();
  return allModels.filter((model) => model.isOwn === false);
}

export async function removeTrackedModel(modelId: number): Promise<void> {
  await db.trackedModels.delete(modelId);
  await db.trackedModelVersions.where('modelId').equals(modelId).delete();
  await db.modelSnapshots.where('modelId').equals(modelId).delete();
}

export async function updateTrackedModelNotes(modelId: number, notes: string): Promise<void> {
  const model = await db.trackedModels.get(modelId);

  if (!model) {
    return;
  }

  await db.trackedModels.put({
    ...model,
    notes
  });
}

function mergeSnapshotIntoModelTotal(
  existing: ModelSnapshot | undefined,
  snapshot: ModelSnapshot
): ModelSnapshot {
  if (!existing) {
    return { ...snapshot };
  }

  return {
    modelId: snapshot.modelId,
    timestamp: Math.max(existing.timestamp, snapshot.timestamp),
    downloads: existing.downloads + snapshot.downloads,
    likes: Math.max(existing.likes, snapshot.likes),
    comments: Math.max(existing.comments, snapshot.comments),
    rating: Math.max(existing.rating, snapshot.rating),
    ratingCount: Math.max(existing.ratingCount, snapshot.ratingCount),
    buzzTipped: Math.max(existing.buzzTipped ?? 0, snapshot.buzzTipped ?? 0),
    generationCount: Math.max(existing.generationCount ?? 0, snapshot.generationCount ?? 0)
  };
}

export async function getModelSnapshots(modelId: number): Promise<ModelSnapshot[]> {
  const snapshots = await db.modelSnapshots.where('modelId').equals(modelId).sortBy('timestamp');
  const snapshotsByTimestamp = new Map<number, ModelSnapshot>();

  for (const snapshot of snapshots) {
    snapshotsByTimestamp.set(
      snapshot.timestamp,
      mergeSnapshotIntoModelTotal(snapshotsByTimestamp.get(snapshot.timestamp), snapshot)
    );
  }

  return [...snapshotsByTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export async function getModelSnapshotsByModelIds(
  modelIds: number[]
): Promise<Map<number, ModelSnapshot[]>> {
  const snapshotsByModel = new Map<number, ModelSnapshot[]>();

  await Promise.all(
    modelIds.map(async (modelId) => {
      snapshotsByModel.set(modelId, await getModelSnapshots(modelId));
    })
  );

  return snapshotsByModel;
}

export async function getTrackedModelVersions(modelId: number): Promise<TrackedModelVersion[]> {
  return db.trackedModelVersions.where('modelId').equals(modelId).sortBy('publishedAt');
}

export async function getModelVersionSnapshots(
  modelId: number
): Promise<Map<number, ModelSnapshot[]>> {
  const snapshots = await db.modelSnapshots.where('modelId').equals(modelId).sortBy('timestamp');
  const snapshotsByVersion = new Map<number, ModelSnapshot[]>();

  for (const snapshot of snapshots) {
    if (!snapshot.versionId) {
      continue;
    }

    const versionSnapshots = snapshotsByVersion.get(snapshot.versionId) ?? [];
    versionSnapshots.push(snapshot);
    snapshotsByVersion.set(snapshot.versionId, versionSnapshots);
  }

  return snapshotsByVersion;
}

export async function getLatestModelSnapshots(): Promise<Map<number, ModelSnapshot>> {
  const snapshots = await db.modelSnapshots.orderBy('timestamp').reverse().toArray();
  const latestTimestampByModel = new Map<number, number>();
  const latestByModel = new Map<number, ModelSnapshot>();

  for (const snapshot of snapshots) {
    const knownTimestamp = latestTimestampByModel.get(snapshot.modelId);

    if (knownTimestamp && knownTimestamp !== snapshot.timestamp) {
      continue;
    }

    latestTimestampByModel.set(snapshot.modelId, snapshot.timestamp);
    latestByModel.set(
      snapshot.modelId,
      mergeSnapshotIntoModelTotal(latestByModel.get(snapshot.modelId), snapshot)
    );
  }

  return latestByModel;
}

export async function getTrackedArticles(): Promise<TrackedArticle[]> {
  return db.trackedArticles.orderBy('publishedAt').reverse().toArray();
}

export async function updateTrackedArticleLinkedModels(
  articleId: number,
  linkedModelIds: number[]
): Promise<void> {
  const article = await db.trackedArticles.get(articleId);

  if (!article) {
    return;
  }

  await db.trackedArticles.put({
    ...article,
    linkedModelIds
  });
}

export async function getArticleSnapshots(articleId: number): Promise<ArticleSnapshot[]> {
  return db.articleSnapshots.where('articleId').equals(articleId).sortBy('timestamp');
}

export async function getLatestArticleSnapshots(): Promise<Map<number, ArticleSnapshot>> {
  const snapshots = await db.articleSnapshots.orderBy('timestamp').reverse().toArray();
  const latestByArticle = new Map<number, ArticleSnapshot>();

  for (const snapshot of snapshots) {
    if (!latestByArticle.has(snapshot.articleId)) {
      latestByArticle.set(snapshot.articleId, snapshot);
    }
  }

  return latestByArticle;
}

export async function getLatestTrendSnapshots(): Promise<TrendSnapshot[]> {
  const snapshots = await db.trendSnapshots.orderBy('timestamp').reverse().toArray();
  const latestTimestamp = snapshots[0]?.timestamp;

  if (!latestTimestamp) {
    return [];
  }

  return snapshots
    .filter((snapshot) => snapshot.timestamp === latestTimestamp)
    .sort((a, b) => b.downloads - a.downloads);
}

export async function getPreviousTagCounts(): Promise<Map<string, number>> {
  const snapshots = await db.tagSnapshots.orderBy('timestamp').reverse().toArray();
  const timestamps = [...new Set(snapshots.map((snapshot) => snapshot.timestamp))];
  const previousTimestamp = timestamps[1];
  const counts = new Map<string, number>();

  if (!previousTimestamp) {
    return counts;
  }

  for (const snapshot of snapshots) {
    if (snapshot.timestamp === previousTimestamp) {
      counts.set(snapshot.tag, snapshot.count);
    }
  }

  return counts;
}
