import { useEffect, useMemo, useState } from 'react';

import TimeSeriesChart, {
  type TimeSeriesLine,
  type TimeSeriesPoint
} from '../components/TimeSeriesChart';
import {
  getModelSnapshots,
  getModelSnapshotsByModelIds,
  getModelVersionSnapshots,
  getOwnTrackedModels,
  getTrackedModelVersions,
  type ModelSnapshot,
  type TrackedModel,
  type TrackedModelVersion
} from '../../storage/db';
import {
  calculateDeltaForPeriod,
  calculateEngagementRate,
  calculateHealthScore,
  calculateLatestDelta,
  calculateLongevityScore,
  calculateVelocity,
  calculateVelocityComparison,
  detectDownloadSpikes,
  detectLifecyclePhase,
  filterSnapshotsByPeriod,
  getLifecycleLabel,
  getLifecycleRecommendation,
  getLatestSnapshot,
  hasSharpDownloadDrop,
  type PeriodFilter
} from '../../utils/analytics';

const periods: Array<{ label: string; value: PeriodFilter }> = [
  { label: '7j', value: 7 },
  { label: '30j', value: 30 },
  { label: '90j', value: 90 },
  { label: 'Tout', value: 'all' }
];

const comparisonColors = ['#A78BFA', '#38BDF8', '#34D399', '#FBBF24', '#FB7185'];

interface VersionRoiSummary {
  versionId: number;
  name: string;
  downloads: number;
  ageDays: number;
  downloadsPerDay: number;
}

interface ActivityCell {
  date: string;
  downloadsDelta: number;
}

function toChartData(snapshots: ModelSnapshot[]): TimeSeriesPoint[] {
  return snapshots.map((snapshot) => ({
    label: new Date(snapshot.timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    }),
    downloads: snapshot.downloads,
    likes: snapshot.likes
  }));
}

function toActivityCells(snapshots: ModelSnapshot[]): ActivityCell[] {
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const deltasByDate = new Map<string, number>();

  for (let index = 1; index < sorted.length; index += 1) {
    const snapshot = sorted[index];
    const previous = sorted[index - 1];
    const key = new Date(snapshot.timestamp).toISOString().slice(0, 10);
    deltasByDate.set(key, (deltasByDate.get(key) ?? 0) + Math.max(0, snapshot.downloads - previous.downloads));
  }

  return [...deltasByDate.entries()]
    .map(([date, downloadsDelta]) => ({ date, downloadsDelta }))
    .slice(-56);
}

function toComparisonData(
  models: TrackedModel[],
  histories: Map<number, ModelSnapshot[]>,
  period: PeriodFilter
): { data: TimeSeriesPoint[]; lines: TimeSeriesLine[] } {
  const topModels = [...models]
    .sort((a, b) => {
      const latestA = getLatestSnapshot(histories.get(a.modelId) ?? []);
      const latestB = getLatestSnapshot(histories.get(b.modelId) ?? []);
      return (latestB?.downloads ?? 0) - (latestA?.downloads ?? 0);
    })
    .slice(0, 5);

  const pointsByTimestamp = new Map<number, TimeSeriesPoint>();

  for (const model of topModels) {
    const snapshots = filterSnapshotsByPeriod(histories.get(model.modelId) ?? [], period);

    for (const snapshot of snapshots) {
      const point = pointsByTimestamp.get(snapshot.timestamp) ?? {
        label: new Date(snapshot.timestamp).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit'
        })
      };

      point[`model_${model.modelId}`] = snapshot.downloads;
      pointsByTimestamp.set(snapshot.timestamp, point);
    }
  }

  return {
    data: [...pointsByTimestamp.entries()]
      .sort(([timestampA], [timestampB]) => timestampA - timestampB)
      .map(([, point]) => point),
    lines: topModels.map((model, index) => ({
      dataKey: `model_${model.modelId}`,
      label: model.name,
      color: comparisonColors[index % comparisonColors.length]
    }))
  };
}

function getVersionName(versionId: number, versions: TrackedModelVersion[]): string {
  return versions.find((version) => version.versionId === versionId)?.name ?? `Version ${versionId}`;
}

function getVersionPublishedAt(versionId: number, versions: TrackedModelVersion[]): number {
  return versions.find((version) => version.versionId === versionId)?.publishedAt ?? 0;
}

function toVersionRoiData(
  versions: TrackedModelVersion[],
  versionSnapshots: Map<number, ModelSnapshot[]>
): { data: TimeSeriesPoint[]; lines: TimeSeriesLine[]; summaries: VersionRoiSummary[] } {
  const pointsByAgeDay = new Map<number, TimeSeriesPoint>();
  const summaries: VersionRoiSummary[] = [];

  for (const [versionId, snapshots] of versionSnapshots.entries()) {
    const sortedSnapshots = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const firstSnapshot = sortedSnapshots[0];
    const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

    if (!firstSnapshot || !latestSnapshot) {
      continue;
    }

    const publishedAt = getVersionPublishedAt(versionId, versions) || firstSnapshot.timestamp;
    const ageDays = Math.max(1, Math.floor((latestSnapshot.timestamp - publishedAt) / 86_400_000));

    summaries.push({
      versionId,
      name: getVersionName(versionId, versions),
      downloads: latestSnapshot.downloads,
      ageDays,
      downloadsPerDay: latestSnapshot.downloads / ageDays
    });

    for (const snapshot of sortedSnapshots) {
      const ageDay = Math.max(0, Math.floor((snapshot.timestamp - publishedAt) / 86_400_000));
      const point = pointsByAgeDay.get(ageDay) ?? { label: `J+${ageDay}` };
      point[`version_${versionId}`] = snapshot.downloads;
      pointsByAgeDay.set(ageDay, point);
    }
  }

  const sortedSummaries = summaries.sort((a, b) => b.downloadsPerDay - a.downloadsPerDay);

  return {
    data: [...pointsByAgeDay.entries()]
      .sort(([ageDayA], [ageDayB]) => ageDayA - ageDayB)
      .map(([, point]) => point),
    lines: sortedSummaries.slice(0, 5).map((summary, index) => ({
      dataKey: `version_${summary.versionId}`,
      label: summary.name,
      color: comparisonColors[index % comparisonColors.length]
    })),
    summaries: sortedSummaries
  };
}

export default function Models(): JSX.Element {
  const [models, setModels] = useState<TrackedModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | undefined>();
  const [period, setPeriod] = useState<PeriodFilter>(30);
  const [snapshots, setSnapshots] = useState<ModelSnapshot[]>([]);
  const [histories, setHistories] = useState<Map<number, ModelSnapshot[]>>(new Map());
  const [versions, setVersions] = useState<TrackedModelVersion[]>([]);
  const [versionSnapshots, setVersionSnapshots] = useState<Map<number, ModelSnapshot[]>>(new Map());

  useEffect(() => {
    async function loadModels(): Promise<void> {
      const trackedModels = await getOwnTrackedModels();
      const trackedHistories = await getModelSnapshotsByModelIds(
        trackedModels.map((model) => model.modelId)
      );

      setModels(trackedModels);
      setHistories(trackedHistories);
      setSelectedModelId(trackedModels[0]?.modelId);
    }

    void loadModels();
  }, []);

  useEffect(() => {
    async function loadSnapshots(): Promise<void> {
      if (!selectedModelId) {
        setSnapshots([]);
        setVersions([]);
        setVersionSnapshots(new Map());
        return;
      }

      const [trackedVersions, snapshotsByVersion] = await Promise.all([
        getTrackedModelVersions(selectedModelId),
        getModelVersionSnapshots(selectedModelId)
      ]);
      const modelSnapshots =
        histories.get(selectedModelId) ?? (await getModelSnapshots(selectedModelId));

      setSnapshots(modelSnapshots);
      setVersions(trackedVersions);
      setVersionSnapshots(snapshotsByVersion);
    }

    void loadSnapshots();
  }, [histories, selectedModelId]);

  const filteredSnapshots = useMemo(
    () => filterSnapshotsByPeriod(snapshots, period),
    [period, snapshots]
  );
  const chartData = useMemo(() => toChartData(filteredSnapshots), [filteredSnapshots]);
  const healthScore = useMemo(() => calculateHealthScore(filteredSnapshots), [filteredSnapshots]);
  const velocity = useMemo(() => calculateVelocity(filteredSnapshots), [filteredSnapshots]);
  const delta = useMemo(() => calculateLatestDelta(snapshots), [snapshots]);
  const periodDelta = useMemo(
    () => calculateDeltaForPeriod(snapshots, period === 'all' ? 3650 : period),
    [period, snapshots]
  );
  const velocityComparison = useMemo(
    () => calculateVelocityComparison(snapshots, 7),
    [snapshots]
  );
  const longevityScore = useMemo(() => calculateLongevityScore(snapshots), [snapshots]);
  const spikes = useMemo(() => detectDownloadSpikes(snapshots), [snapshots]);
  const activityCells = useMemo(() => toActivityCells(snapshots), [snapshots]);
  const maxActivity = Math.max(1, ...activityCells.map((cell) => cell.downloadsDelta));
  const lifecyclePhase = useMemo(() => detectLifecyclePhase(filteredSnapshots), [filteredSnapshots]);
  const lifecycleLabel = getLifecycleLabel(lifecyclePhase);
  const recommendation = getLifecycleRecommendation(lifecyclePhase);
  const hasDrop = hasSharpDownloadDrop(filteredSnapshots);
  const latestSnapshot = getLatestSnapshot(snapshots);
  const engagementRate = calculateEngagementRate(latestSnapshot);
  const comparison = useMemo(
    () => toComparisonData(models, histories, period),
    [histories, models, period]
  );
  const versionRoi = useMemo(
    () => toVersionRoiData(versions, versionSnapshots),
    [versionSnapshots, versions]
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Modèles</h2>
          <p className="text-xs text-gray-400">Historique et premiers scores</p>
        </div>
        <select
          value={selectedModelId ?? ''}
          onChange={(event) => setSelectedModelId(Number(event.target.value))}
          className="h-9 max-w-[190px] rounded border border-white/10 bg-gray-900 px-2 text-xs text-white"
        >
          {models.length === 0 ? <option value="">Aucun modèle</option> : null}
          {models.map((model) => (
            <option key={model.modelId} value={model.modelId}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-4 gap-2 rounded border border-white/10 bg-gray-900/70 p-1">
        {periods.map((option) => {
          const isActive = option.value === period;

          return (
            <button
              key={option.label}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`h-8 rounded text-xs font-medium transition ${
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Score santé</p>
          <p className="mt-1 text-xl font-semibold text-white">{healthScore}</p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Phase</p>
          <p className="mt-1 text-xl font-semibold text-white">{lifecycleLabel}</p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Vitesse période</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {velocity.downloadsPerDay.toFixed(1)}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Delta période</p>
          <p className="mt-1 text-xl font-semibold text-white">
            +{periodDelta.downloads.toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Engagement</p>
          <p className="mt-1 text-xl font-semibold text-white">{engagementRate.toFixed(2)}%</p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">7j vs 7j préc.</p>
          <p
            className={`mt-1 text-xl font-semibold ${
              velocityComparison.changePercent >= 0 ? 'text-emerald-200' : 'text-rose-200'
            }`}
          >
            {velocityComparison.changePercent >= 0 ? '+' : ''}
            {Math.round(velocityComparison.changePercent)}%
          </p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Longévité</p>
          <p className="mt-1 text-xl font-semibold text-white">{longevityScore}</p>
        </div>
      </div>

      <div className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Courbe downloads / likes</p>
          <span className="rounded bg-violet-500/15 px-2 py-1 text-xs text-violet-100">
            {latestSnapshot?.downloads.toLocaleString('fr-FR') ?? 0} DL · dernier{' '}
            {delta.downloads >= 0 ? '+' : ''}
            {delta.downloads.toLocaleString('fr-FR')}
          </span>
        </div>
        <TimeSeriesChart data={chartData} />
        {spikes.length > 0 ? (
          <div className="mt-3 rounded border border-amber-400/30 bg-amber-500/10 p-2">
            <p className="text-xs font-medium text-amber-100">Pics détectés</p>
            <div className="mt-1 space-y-1">
              {spikes.slice(-3).map((spike) => (
                <p key={spike.timestamp} className="text-xs text-amber-50">
                  {new Date(spike.timestamp).toLocaleDateString('fr-FR')} · +
                  {spike.downloadsDelta.toLocaleString('fr-FR')} DL, environ{' '}
                  {(spike.downloadsDelta / spike.averageDelta).toFixed(1)}× la moyenne récente
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3">
          <p className="text-sm font-medium text-white">Heatmap activité</p>
          <p className="text-xs text-gray-400">Intensité downloads par jour de collecte</p>
        </div>
        {activityCells.length === 0 ? (
          <p className="text-sm text-gray-400">Collecte insuffisante pour générer la heatmap.</p>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {activityCells.map((cell) => {
              const intensity = Math.max(0.08, cell.downloadsDelta / maxActivity);

              return (
                <div
                  key={cell.date}
                  title={`${cell.date} : +${cell.downloadsDelta.toLocaleString('fr-FR')} downloads`}
                  className="h-4 rounded border border-white/10"
                  style={{ backgroundColor: `rgba(124, 58, 237, ${intensity})` }}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3">
          <p className="text-sm font-medium text-white">Comparaison portfolio</p>
          <p className="text-xs text-gray-400">Top 5 modèles par downloads</p>
        </div>
        <TimeSeriesChart data={comparison.data} lines={comparison.lines} />
      </div>

      <div
        className={`rounded border p-3 text-sm ${
          hasDrop
            ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
            : 'border-white/10 bg-gray-800 text-gray-300'
        }`}
      >
        {recommendation}
      </div>

      <div className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3">
          <p className="text-sm font-medium text-white">Version ROI</p>
          <p className="text-xs text-gray-400">Downloads cumulés par version depuis publication</p>
        </div>
        <TimeSeriesChart data={versionRoi.data} lines={versionRoi.lines} />

        {versionRoi.summaries.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">
            Les versions apparaîtront ici après une collecte contenant `modelVersions`.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded border border-white/10">
            {versionRoi.summaries.map((summary) => (
              <div
                key={summary.versionId}
                className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/10 px-3 py-2 text-xs last:border-b-0"
              >
                <p className="truncate font-medium text-white">{summary.name}</p>
                <p className="text-right text-gray-300">
                  {summary.downloads.toLocaleString('fr-FR')} DL
                </p>
                <p className="text-right text-gray-400">
                  {summary.downloadsPerDay.toFixed(1)}/j
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
