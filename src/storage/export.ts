import {
  db,
  saveSettings,
  type ArticleSnapshot,
  type ModelSnapshot,
  type Settings,
  type TagSnapshot,
  type TrackedArticle,
  type TrackedModel,
  type TrackedModelVersion,
  type TrendSnapshot
} from './db';

interface ExportBundle {
  exportedAt: string;
  settings?: Settings;
  trackedModels: TrackedModel[];
  trackedModelVersions: TrackedModelVersion[];
  modelSnapshots: ModelSnapshot[];
  trackedArticles: TrackedArticle[];
  articleSnapshots: ArticleSnapshot[];
  trendSnapshots: TrendSnapshot[];
  tagSnapshots: TagSnapshot[];
}

export interface ImportSummary {
  trackedModels: number;
  modelSnapshots: number;
  trackedArticles: number;
  articleSnapshots: number;
  trendSnapshots: number;
  tagSnapshots: number;
}

function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let text: string;

  if (Array.isArray(value)) {
    text = value.join('|');
  } else if (typeof value === 'object') {
    text = JSON.stringify(value);
  } else if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    text = value.toString();
  } else {
    text = '';
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))
  ];

  return lines.join('\n');
}

export async function exportAllDataAsJson(filename = 'analytics-civitai-export.json'): Promise<void> {
  const bundle: ExportBundle = {
    exportedAt: new Date().toISOString(),
    settings: await db.settings.get('main'),
    trackedModels: await db.trackedModels.toArray(),
    trackedModelVersions: await db.trackedModelVersions.toArray(),
    modelSnapshots: await db.modelSnapshots.toArray(),
    trackedArticles: await db.trackedArticles.toArray(),
    articleSnapshots: await db.articleSnapshots.toArray(),
    trendSnapshots: await db.trendSnapshots.toArray(),
    tagSnapshots: await db.tagSnapshots.toArray()
  };

  downloadTextFile(filename, JSON.stringify(bundle, null, 2), 'application/json');
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsText(file);
  });
}

function isExportBundle(value: unknown): value is ExportBundle {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ExportBundle>;

  return (
    Array.isArray(candidate.trackedModels) &&
    Array.isArray(candidate.trackedModelVersions) &&
    Array.isArray(candidate.modelSnapshots) &&
    Array.isArray(candidate.trackedArticles) &&
    Array.isArray(candidate.articleSnapshots) &&
    Array.isArray(candidate.trendSnapshots) &&
    Array.isArray(candidate.tagSnapshots)
  );
}

export async function importAllDataFromJsonFile(file: File): Promise<ImportSummary> {
  const raw = await readFileAsText(file);
  const parsed: unknown = JSON.parse(raw);

  if (!isExportBundle(parsed)) {
    throw new Error('Fichier JSON AnalyticsCivitAI invalide.');
  }

  await db.trackedModels.clear();
  await db.trackedModelVersions.clear();
  await db.modelSnapshots.clear();
  await db.trackedArticles.clear();
  await db.articleSnapshots.clear();
  await db.trendSnapshots.clear();
  await db.tagSnapshots.clear();

  if (parsed.trackedModels.length > 0) {
    await db.trackedModels.bulkPut(parsed.trackedModels);
  }
  if (parsed.trackedModelVersions.length > 0) {
    await db.trackedModelVersions.bulkPut(parsed.trackedModelVersions);
  }
  if (parsed.modelSnapshots.length > 0) {
    await db.modelSnapshots.bulkPut(parsed.modelSnapshots);
  }
  if (parsed.trackedArticles.length > 0) {
    await db.trackedArticles.bulkPut(parsed.trackedArticles);
  }
  if (parsed.articleSnapshots.length > 0) {
    await db.articleSnapshots.bulkPut(parsed.articleSnapshots);
  }
  if (parsed.trendSnapshots.length > 0) {
    await db.trendSnapshots.bulkPut(parsed.trendSnapshots);
  }
  if (parsed.tagSnapshots.length > 0) {
    await db.tagSnapshots.bulkPut(parsed.tagSnapshots);
  }

  if (parsed.settings) {
    await saveSettings(parsed.settings);
  }

  return {
    trackedModels: parsed.trackedModels.length,
    modelSnapshots: parsed.modelSnapshots.length,
    trackedArticles: parsed.trackedArticles.length,
    articleSnapshots: parsed.articleSnapshots.length,
    trendSnapshots: parsed.trendSnapshots.length,
    tagSnapshots: parsed.tagSnapshots.length
  };
}

export async function exportModelSnapshotsAsCsv(): Promise<void> {
  const snapshots = await db.modelSnapshots.toArray();
  const models = new Map((await db.trackedModels.toArray()).map((model) => [model.modelId, model]));
  const rows = snapshots.map((snapshot) => ({
    modelId: snapshot.modelId,
    modelName: models.get(snapshot.modelId)?.name ?? '',
    versionId: snapshot.versionId ?? '',
    timestamp: new Date(snapshot.timestamp).toISOString(),
    downloads: snapshot.downloads,
    likes: snapshot.likes,
    comments: snapshot.comments,
    rating: snapshot.rating,
    ratingCount: snapshot.ratingCount,
    buzzTipped: snapshot.buzzTipped ?? 0,
    generationCount: snapshot.generationCount ?? 0
  }));

  downloadTextFile('analytics-civitai-model-snapshots.csv', rowsToCsv(rows), 'text/csv');
}
