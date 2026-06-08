import { Activity, AlertTriangle, Database, Download, Heart, MessageCircle, RefreshCw, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import ModelRow from '../components/ModelRow';
import StatCard from '../components/StatCard';
import { collectNow } from '../../storage/collect';
import {
  getLatestModelSnapshots,
  getModelSnapshotsByModelIds,
  getOwnTrackedModels,
  getSettings,
  type ModelSnapshot,
  type TrackedModel
} from '../../storage/db';
import { COLLECTION_PROGRESS_KEY } from '../../utils/constants';
import {
  calculateHealthScore,
  calculateDeltaForPeriod,
  calculateEngagementRate,
  calculateLatestDelta,
  calculateVelocityComparison,
  formatRelativeTime,
  getHealthStatus
} from '../../utils/analytics';

export default function Dashboard(): JSX.Element {
  const [models, setModels] = useState<TrackedModel[]>([]);
  const [snapshots, setSnapshots] = useState<Map<number, ModelSnapshot>>(new Map());
  const [histories, setHistories] = useState<Map<number, ModelSnapshot[]>>(new Map());
  const [lastCollectedAt, setLastCollectedAt] = useState(0);
  const [lastCollectionErrors, setLastCollectionErrors] = useState(0);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionProgress, setCollectionProgress] = useState({ current: 0, total: 0, label: '' });
  const [error, setError] = useState('');

  async function loadData(): Promise<void> {
    const [trackedModels, latestSnapshots, settings] = await Promise.all([
      getOwnTrackedModels(),
      getLatestModelSnapshots(),
      getSettings()
    ]);
    const modelHistories = await getModelSnapshotsByModelIds(
      trackedModels.map((model) => model.modelId)
    );

    setModels(trackedModels);
    setSnapshots(latestSnapshots);
    setHistories(modelHistories);
    setLastCollectedAt(settings.lastCollectedAt);
    setLastCollectionErrors(settings.lastCollectionErrors);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    async function readProgress(): Promise<void> {
      const stored = await chrome.storage.local.get(COLLECTION_PROGRESS_KEY);
      const value = stored[COLLECTION_PROGRESS_KEY] as
        | { isCollecting?: boolean; current?: number; total?: number; label?: string }
        | undefined;

      if (value?.isCollecting) {
        setIsCollecting(true);
        setCollectionProgress({
          current: value.current ?? 0,
          total: value.total ?? 0,
          label: value.label ?? ''
        });
      } else if (!value?.isCollecting && isCollecting) {
        setCollectionProgress({ current: 0, total: 0, label: '' });
      }
    }

    const interval = window.setInterval(() => {
      void readProgress();
    }, 700);

    void readProgress();
    return () => window.clearInterval(interval);
  }, [isCollecting]);

  useEffect(() => {
    function handleRefreshShortcut(): void {
      if (!isCollecting) {
        void handleCollect();
      }
    }

    window.addEventListener('analytics-civitai-refresh', handleRefreshShortcut);
    return () => window.removeEventListener('analytics-civitai-refresh', handleRefreshShortcut);
    // handleCollect is a local command handler; this listener only needs the current collecting flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollecting]);

  const totals = useMemo(() => {
    let downloads = 0;
    let likes = 0;
    let comments = 0;
    let downloadsDelta = 0;
    let likesDelta = 0;
    let weeklyDownloads = 0;
    let weeklyLikes = 0;
    let weeklyVelocityCurrent = 0;
    let weeklyVelocityPrevious = 0;
    let engagementTotal = 0;
    let engagementSamples = 0;
    let healthTotal = 0;
    let healthSamples = 0;

    for (const model of models) {
      const snapshot = snapshots.get(model.modelId);
      if (!snapshot) {
        continue;
      }

      downloads += snapshot.downloads;
      likes += snapshot.likes;
      comments += snapshot.comments;

      if (snapshot.downloads > 0) {
        engagementTotal += calculateEngagementRate(snapshot);
        engagementSamples += 1;
      }
    }

    for (const history of histories.values()) {
      const delta = calculateLatestDelta(history);
      const periodDelta = calculateDeltaForPeriod(history, 7);
      const velocityComparison = calculateVelocityComparison(history, 7);
      downloadsDelta += delta.downloads;
      likesDelta += delta.likes;
      weeklyDownloads += periodDelta.downloads;
      weeklyLikes += periodDelta.likes;
      weeklyVelocityCurrent += velocityComparison.currentDownloadsPerDay;
      weeklyVelocityPrevious += velocityComparison.previousDownloadsPerDay;

      if (history.length > 0) {
        healthTotal += calculateHealthScore(history);
        healthSamples += 1;
      }
    }

    const averageEngagement = engagementSamples > 0 ? engagementTotal / engagementSamples : 0;
    const averageHealth = healthSamples > 0 ? healthTotal / healthSamples : 0;
    const weeklyVelocityChange =
      weeklyVelocityPrevious > 0
        ? ((weeklyVelocityCurrent - weeklyVelocityPrevious) / weeklyVelocityPrevious) * 100
        : weeklyVelocityCurrent > 0
          ? 100
          : 0;
    const creatorScore = Math.round(
      Math.min(100, averageHealth * 0.6 + averageEngagement * 6 + Math.min(weeklyDownloads / 10, 25))
    );

    return {
      downloads,
      likes,
      comments,
      downloadsDelta,
      likesDelta,
      weeklyDownloads,
      weeklyLikes,
      weeklyVelocityCurrent,
      weeklyVelocityPrevious,
      weeklyVelocityChange,
      averageEngagement,
      creatorScore
    };
  }, [histories, models, snapshots]);

  async function handleCollect(): Promise<void> {
    setIsCollecting(true);
    setError('');

    try {
      await collectNow();
      await loadData();
    } catch (collectionError) {
      const message =
        collectionError instanceof Error ? collectionError.message : 'Collecte impossible.';
      setError(message);
    } finally {
      setIsCollecting(false);
      setCollectionProgress({ current: 0, total: 0, label: '' });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Score créateur"
          value={totals.creatorScore}
          icon={<Trophy className="h-4 w-4" />}
          detail="Indice global portfolio"
        />
        <StatCard
          label="Downloads 7j"
          value={totals.weeklyDownloads.toLocaleString('fr-FR')}
          icon={<Activity className="h-4 w-4" />}
          detail={`${totals.weeklyVelocityCurrent.toFixed(1)} DL/j vs ${totals.weeklyVelocityPrevious.toFixed(1)} · ${totals.weeklyVelocityChange >= 0 ? '+' : ''}${Math.round(totals.weeklyVelocityChange)}%`}
        />
        <StatCard
          label="Downloads"
          value={totals.downloads.toLocaleString('fr-FR')}
          icon={<Download className="h-4 w-4" />}
          detail={`${totals.downloadsDelta >= 0 ? '+' : ''}${totals.downloadsDelta.toLocaleString('fr-FR')} depuis la collecte précédente`}
        />
        <StatCard
          label="Likes"
          value={totals.likes.toLocaleString('fr-FR')}
          icon={<Heart className="h-4 w-4" />}
          detail={`+${totals.weeklyLikes.toLocaleString('fr-FR')} sur 7j`}
        />
        <StatCard
          label="Commentaires"
          value={totals.comments.toLocaleString('fr-FR')}
          icon={<MessageCircle className="h-4 w-4" />}
          detail={`${totals.averageEngagement.toFixed(2)}% engagement moyen`}
        />
        <StatCard
          label="Modèles"
          value={models.length}
          icon={<Database className="h-4 w-4" />}
          detail={formatRelativeTime(lastCollectedAt)}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Portfolio</h2>
          <p className="text-xs text-gray-400">Dernière collecte : {formatRelativeTime(lastCollectedAt)}</p>
        </div>
        <button
          type="button"
          onClick={handleCollect}
          disabled={isCollecting}
          title="Rafraîchir maintenant"
          className="inline-flex h-9 items-center gap-2 rounded bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isCollecting ? 'animate-spin' : ''}`} />
          {isCollecting && collectionProgress.total > 0
            ? `${collectionProgress.current}/${collectionProgress.total}`
            : isCollecting
              ? 'Collecte'
              : 'Rafraîchir'}
        </button>
      </div>

      {isCollecting ? (
        <div className="rounded border border-violet-300/30 bg-violet-500/10 p-3 text-sm text-violet-100">
          Collecte en cours
          {collectionProgress.total > 0
            ? ` : ${collectionProgress.current}/${collectionProgress.total}`
            : ''}
          {collectionProgress.label ? ` · ${collectionProgress.label}` : ''}
        </div>
      ) : null}

      {error ? (
        <div className="rounded border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {!error && lastCollectionErrors > 0 ? (
        <div className="flex items-center gap-2 rounded border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Dernière collecte partielle : {lastCollectionErrors} élément
          {lastCollectionErrors > 1 ? 's' : ''} non collecté{lastCollectionErrors > 1 ? 's' : ''}.
        </div>
      ) : null}

      <section className="overflow-hidden rounded border border-white/10 bg-gray-800">
        {models.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Configure ta clé API dans Réglages, puis lance une première collecte.
          </div>
        ) : (
          models.map((model) => {
            const snapshot = snapshots.get(model.modelId);
            const history = histories.get(model.modelId) ?? [];
            const delta = calculateLatestDelta(history);
            const periodDelta = calculateDeltaForPeriod(history, 7);
            const velocityComparison = calculateVelocityComparison(history, 7);

            return (
              <ModelRow
                key={model.modelId}
                name={model.name}
                type={model.type}
                baseModel={model.baseModel}
                downloads={snapshot?.downloads ?? 0}
                likes={snapshot?.likes ?? 0}
                likesDelta={delta.likes}
                comments={snapshot?.comments ?? 0}
                rating={snapshot?.rating ?? 0}
                buzzTipped={snapshot?.buzzTipped ?? 0}
                engagementRate={calculateEngagementRate(snapshot)}
                periodDownloadsDelta={periodDelta.downloads}
                velocityChangePercent={velocityComparison.changePercent}
                status={getHealthStatus(history)}
              />
            );
          })
        )}
      </section>
    </div>
  );
}
