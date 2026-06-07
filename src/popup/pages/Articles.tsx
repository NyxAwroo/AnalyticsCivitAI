import { Clock, FileText, Link2, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import TimeSeriesChart, { type TimeSeriesPoint } from '../components/TimeSeriesChart';
import {
  getArticleSnapshots,
  getLatestArticleSnapshots,
  getModelSnapshotsByModelIds,
  getOwnTrackedModels,
  getTrackedArticles,
  updateTrackedArticleLinkedModels,
  type ArticleSnapshot,
  type ModelSnapshot,
  type TrackedModel,
  type TrackedArticle
} from '../../storage/db';

const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const hourBands = ['00-05', '06-11', '12-17', '18-23'];

interface ArticleImpact {
  modelName: string;
  downloads72h: number;
  baselineDownloads: number;
  afterDownloads: number;
  hasEnoughData: boolean;
}

function toChartData(snapshots: ArticleSnapshot[]): TimeSeriesPoint[] {
  return snapshots.map((snapshot) => ({
    label: new Date(snapshot.timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    }),
    views: snapshot.views,
    likes: snapshot.likes,
    comments: snapshot.comments
  }));
}

function formatPublicationSlot(timestamp: number): string {
  if (timestamp <= 0) {
    return 'n/a';
  }

  const date = new Date(timestamp);
  return `${days[date.getDay()]} ${date.getHours().toString().padStart(2, '0')}h`;
}

function getHourBandIndex(timestamp: number): number {
  return Math.min(3, Math.floor(new Date(timestamp).getHours() / 6));
}

function calculateArticleImpact(
  article: TrackedArticle | undefined,
  model: TrackedModel | undefined,
  modelHistory: ModelSnapshot[]
): ArticleImpact | undefined {
  if (!article || !model) {
    return undefined;
  }

  const sortedHistory = [...modelHistory].sort((a, b) => a.timestamp - b.timestamp);
  const baseline =
    [...sortedHistory].reverse().find((snapshot) => snapshot.timestamp <= article.publishedAt) ??
    sortedHistory.find((snapshot) => snapshot.timestamp >= article.publishedAt);
  const impactWindowEnd = article.publishedAt + 72 * 3_600_000;
  const after =
    [...sortedHistory]
      .reverse()
      .find(
        (snapshot) =>
          snapshot.timestamp > (baseline?.timestamp ?? article.publishedAt) &&
          snapshot.timestamp <= impactWindowEnd
      ) ??
    sortedHistory.find((snapshot) => snapshot.timestamp > (baseline?.timestamp ?? article.publishedAt));

  if (!baseline || !after) {
    return {
      modelName: model.name,
      downloads72h: 0,
      baselineDownloads: baseline?.downloads ?? 0,
      afterDownloads: after?.downloads ?? 0,
      hasEnoughData: false
    };
  }

  return {
    modelName: model.name,
    downloads72h: Math.max(0, after.downloads - baseline.downloads),
    baselineDownloads: baseline.downloads,
    afterDownloads: after.downloads,
    hasEnoughData: after.timestamp > baseline.timestamp
  };
}

function toModelImpactChartData(
  article: TrackedArticle | undefined,
  modelHistory: ModelSnapshot[]
): TimeSeriesPoint[] {
  if (!article) {
    return [];
  }

  const start = article.publishedAt - 7 * 86_400_000;
  const end = article.publishedAt + 7 * 86_400_000;

  return modelHistory
    .filter((snapshot) => snapshot.timestamp >= start && snapshot.timestamp <= end)
    .map((snapshot) => ({
      label: new Date(snapshot.timestamp).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit'
      }),
      downloads: snapshot.downloads,
      likes: snapshot.likes
    }));
}

export default function Articles(): JSX.Element {
  const [articles, setArticles] = useState<TrackedArticle[]>([]);
  const [models, setModels] = useState<TrackedModel[]>([]);
  const [modelHistories, setModelHistories] = useState<Map<number, ModelSnapshot[]>>(new Map());
  const [latestSnapshots, setLatestSnapshots] = useState<Map<number, ArticleSnapshot>>(new Map());
  const [selectedArticleId, setSelectedArticleId] = useState<number | undefined>();
  const [snapshots, setSnapshots] = useState<ArticleSnapshot[]>([]);

  useEffect(() => {
    async function loadArticles(): Promise<void> {
      const [trackedArticles, latest, trackedModels] = await Promise.all([
        getTrackedArticles(),
        getLatestArticleSnapshots(),
        getOwnTrackedModels()
      ]);
      const histories = await getModelSnapshotsByModelIds(
        trackedModels.map((model) => model.modelId)
      );

      setArticles(trackedArticles);
      setModels(trackedModels);
      setModelHistories(histories);
      setLatestSnapshots(latest);
      setSelectedArticleId(trackedArticles[0]?.articleId);
    }

    void loadArticles();
  }, []);

  useEffect(() => {
    async function loadSnapshots(): Promise<void> {
      if (!selectedArticleId) {
        setSnapshots([]);
        return;
      }

      setSnapshots(await getArticleSnapshots(selectedArticleId));
    }

    void loadSnapshots();
  }, [selectedArticleId]);

  const totals = useMemo(() => {
    let views = 0;
    let likes = 0;
    let comments = 0;

    for (const snapshot of latestSnapshots.values()) {
      views += snapshot.views;
      likes += snapshot.likes;
      comments += snapshot.comments;
    }

    return { views, likes, comments };
  }, [latestSnapshots]);

  const bestSlots = useMemo(() => {
    return [...articles]
      .map((article) => ({
        article,
        slot: formatPublicationSlot(article.publishedAt),
        score:
          (latestSnapshots.get(article.articleId)?.views ?? 0) +
          (latestSnapshots.get(article.articleId)?.likes ?? 0) * 10
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [articles, latestSnapshots]);

  const chartData = useMemo(() => toChartData(snapshots), [snapshots]);
  const selectedArticle = useMemo(
    () => articles.find((article) => article.articleId === selectedArticleId),
    [articles, selectedArticleId]
  );
  const linkedModelId = selectedArticle?.linkedModelIds[0];
  const linkedModel = useMemo(
    () => models.find((model) => model.modelId === linkedModelId),
    [linkedModelId, models]
  );
  const linkedModelHistory = useMemo(
    () => (linkedModelId ? (modelHistories.get(linkedModelId) ?? []) : []),
    [linkedModelId, modelHistories]
  );
  const impact = useMemo(
    () => calculateArticleImpact(selectedArticle, linkedModel, linkedModelHistory),
    [linkedModel, linkedModelHistory, selectedArticle]
  );
  const impactChartData = useMemo(
    () => toModelImpactChartData(selectedArticle, linkedModelHistory),
    [linkedModelHistory, selectedArticle]
  );

  const heatmap = useMemo(() => {
    const matrix = days.map(() => hourBands.map(() => 0));

    for (const article of articles) {
      const dayIndex = new Date(article.publishedAt).getDay();
      const bandIndex = getHourBandIndex(article.publishedAt);
      const latest = latestSnapshots.get(article.articleId);
      matrix[dayIndex][bandIndex] += (latest?.views ?? 0) + (latest?.likes ?? 0) * 10;
    }

    return matrix;
  }, [articles, latestSnapshots]);

  const maxHeatmapScore = Math.max(1, ...heatmap.flat());

  async function handleLinkedModelChange(modelId: number): Promise<void> {
    if (!selectedArticle) {
      return;
    }

    const linkedModelIds = modelId > 0 ? [modelId] : [];
    await updateTrackedArticleLinkedModels(selectedArticle.articleId, linkedModelIds);
    setArticles((currentArticles) =>
      currentArticles.map((article) =>
        article.articleId === selectedArticle.articleId ? { ...article, linkedModelIds } : article
      )
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Articles</h2>
          <p className="text-xs text-gray-400">Vues, engagement et timing</p>
        </div>
        <select
          value={selectedArticleId ?? ''}
          onChange={(event) => setSelectedArticleId(Number(event.target.value))}
          className="h-9 max-w-[190px] rounded border border-white/10 bg-gray-900 px-2 text-xs text-white"
        >
          {articles.length === 0 ? <option value="">Aucun article</option> : null}
          {articles.map((article) => (
            <option key={article.articleId} value={article.articleId}>
              {article.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Vues</p>
          <p className="mt-1 text-xl font-semibold text-white">{totals.views.toLocaleString('fr-FR')}</p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Likes</p>
          <p className="mt-1 text-xl font-semibold text-white">{totals.likes.toLocaleString('fr-FR')}</p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Articles</p>
          <p className="mt-1 text-xl font-semibold text-white">{articles.length}</p>
        </div>
      </div>

      <div className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-violet-300" />
          <p className="text-sm font-medium text-white">Évolution article</p>
        </div>
        <TimeSeriesChart
          data={chartData}
          lines={[
            { dataKey: 'views', label: 'Vues', color: '#A78BFA' },
            { dataKey: 'likes', label: 'Likes', color: '#38BDF8' },
            { dataKey: 'comments', label: 'Commentaires', color: '#34D399' }
          ]}
        />
      </div>

      <div className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-violet-300" />
              <p className="text-sm font-medium text-white">Impact article → modèle</p>
            </div>
            <p className="mt-1 text-xs text-gray-400">Fenêtre d'analyse : 72 h après publication</p>
          </div>
          <select
            value={linkedModelId ?? ''}
            onChange={(event) => void handleLinkedModelChange(Number(event.target.value))}
            className="h-9 max-w-[180px] rounded border border-white/10 bg-gray-950 px-2 text-xs text-white"
          >
            <option value="">Aucun modèle</option>
            {models.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-white/10 bg-gray-900/70 p-2">
            <p className="text-[11px] text-gray-400">Impact 72 h</p>
            <p className="mt-1 text-lg font-semibold text-white">
              +{(impact?.downloads72h ?? 0).toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="rounded border border-white/10 bg-gray-900/70 p-2">
            <p className="text-[11px] text-gray-400">Avant</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {(impact?.baselineDownloads ?? 0).toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="rounded border border-white/10 bg-gray-900/70 p-2">
            <p className="text-[11px] text-gray-400">Après</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {(impact?.afterDownloads ?? 0).toLocaleString('fr-FR')}
            </p>
          </div>
        </div>

        <p className="mt-2 text-xs text-gray-400">
          {impact?.hasEnoughData
            ? `${impact.modelName} a gagné +${impact.downloads72h.toLocaleString('fr-FR')} downloads dans la fenêtre suivie.`
            : 'Associe un modèle et collecte au moins deux snapshots autour de la publication.'}
        </p>
        <div className="mt-3">
          <TimeSeriesChart data={impactChartData} />
        </div>
      </div>

      <div className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-violet-300" />
          <p className="text-sm font-medium text-white">Meilleurs créneaux observés</p>
        </div>
        {bestSlots.length === 0 ? (
          <p className="text-sm text-gray-400">Collecte des articles nécessaire.</p>
        ) : (
          <div className="space-y-2">
            {bestSlots.map(({ article, slot, score }) => (
              <div key={article.articleId} className="grid grid-cols-[auto_1fr_auto] gap-2 text-xs">
                <span className="font-medium text-violet-200">{slot}</span>
                <span className="truncate text-gray-300">{article.title}</span>
                <span className="text-gray-500">score {score}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-300" />
          <p className="text-sm font-medium text-white">Heatmap publication</p>
        </div>
        <div className="grid grid-cols-[42px_repeat(4,1fr)] gap-1 text-[11px]">
          <span />
          {hourBands.map((band) => (
            <span key={band} className="text-center text-gray-500">
              {band}
            </span>
          ))}
          {days.map((day, dayIndex) => (
            <>
              <span key={`${day}-label`} className="py-1 text-gray-500">
                {day}
              </span>
              {hourBands.map((band, bandIndex) => {
                const score = heatmap[dayIndex][bandIndex];
                const intensity = Math.max(0.08, score / maxHeatmapScore);

                return (
                  <div
                    key={`${day}-${band}`}
                    title={`${day} ${band} : score ${score}`}
                    className="h-6 rounded border border-white/10"
                    style={{ backgroundColor: `rgba(124, 58, 237, ${intensity})` }}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
