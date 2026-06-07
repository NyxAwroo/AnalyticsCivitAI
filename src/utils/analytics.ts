import type { ModelSnapshot } from '../storage/db';

export type HealthStatus = 'growing' | 'stable' | 'declining' | 'unknown';
export type PeriodFilter = 7 | 30 | 90 | 'all';
export type LifecyclePhase = 'launch' | 'growth' | 'plateau' | 'decline' | 'unknown';

export interface ModelVelocity {
  downloadsDelta: number;
  likesDelta: number;
  commentsDelta: number;
  downloadsPerDay: number;
}

export interface LatestDelta {
  downloads: number;
  likes: number;
  comments: number;
  ratingCount: number;
  buzzTipped: number;
}

export interface PeriodDelta {
  downloads: number;
  likes: number;
  comments: number;
  ratingCount: number;
  buzzTipped: number;
}

export interface VelocityComparison {
  currentDownloadsPerDay: number;
  previousDownloadsPerDay: number;
  changePercent: number;
}

export interface DownloadSpike {
  timestamp: number;
  downloadsDelta: number;
  averageDelta: number;
}

export function getLatestSnapshot(snapshots: ModelSnapshot[]): ModelSnapshot | undefined {
  return [...snapshots].sort((a, b) => b.timestamp - a.timestamp)[0];
}

export function getPreviousSnapshot(snapshots: ModelSnapshot[]): ModelSnapshot | undefined {
  return [...snapshots].sort((a, b) => b.timestamp - a.timestamp)[1];
}

export function filterSnapshotsByPeriod(
  snapshots: ModelSnapshot[],
  period: PeriodFilter
): ModelSnapshot[] {
  if (period === 'all') {
    return [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  }

  const cutoff = Date.now() - period * 86_400_000;
  return snapshots
    .filter((snapshot) => snapshot.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function calculateVelocity(snapshots: ModelSnapshot[]): ModelVelocity {
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];

  if (!first || !latest || first.timestamp === latest.timestamp) {
    return {
      downloadsDelta: 0,
      likesDelta: 0,
      commentsDelta: 0,
      downloadsPerDay: 0
    };
  }

  const elapsedDays = Math.max((latest.timestamp - first.timestamp) / 86_400_000, 1 / 24);
  const downloadsDelta = latest.downloads - first.downloads;

  return {
    downloadsDelta,
    likesDelta: latest.likes - first.likes,
    commentsDelta: latest.comments - first.comments,
    downloadsPerDay: downloadsDelta / elapsedDays
  };
}

export function calculateLatestDelta(snapshots: ModelSnapshot[]): LatestDelta {
  const latest = getLatestSnapshot(snapshots);
  const previous = getPreviousSnapshot(snapshots);

  if (!latest || !previous) {
    return {
      downloads: 0,
      likes: 0,
      comments: 0,
      ratingCount: 0,
      buzzTipped: 0
    };
  }

  return {
    downloads: latest.downloads - previous.downloads,
    likes: latest.likes - previous.likes,
    comments: latest.comments - previous.comments,
    ratingCount: latest.ratingCount - previous.ratingCount,
    buzzTipped: (latest.buzzTipped ?? 0) - (previous.buzzTipped ?? 0)
  };
}

function getBaselineSnapshot(snapshots: ModelSnapshot[], cutoff: number): ModelSnapshot | undefined {
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  return [...sorted].reverse().find((snapshot) => snapshot.timestamp <= cutoff) ?? sorted[0];
}

export function calculateDeltaForPeriod(snapshots: ModelSnapshot[], days: number): PeriodDelta {
  const latest = getLatestSnapshot(snapshots);
  if (!latest) {
    return {
      downloads: 0,
      likes: 0,
      comments: 0,
      ratingCount: 0,
      buzzTipped: 0
    };
  }

  const baseline = getBaselineSnapshot(snapshots, Date.now() - days * 86_400_000);

  return {
    downloads: Math.max(0, latest.downloads - (baseline?.downloads ?? latest.downloads)),
    likes: Math.max(0, latest.likes - (baseline?.likes ?? latest.likes)),
    comments: Math.max(0, latest.comments - (baseline?.comments ?? latest.comments)),
    ratingCount: Math.max(0, latest.ratingCount - (baseline?.ratingCount ?? latest.ratingCount)),
    buzzTipped: Math.max(0, (latest.buzzTipped ?? 0) - (baseline?.buzzTipped ?? 0))
  };
}

export function calculateVelocityComparison(
  snapshots: ModelSnapshot[],
  windowDays = 7
): VelocityComparison {
  const now = Date.now();
  const currentStart = now - windowDays * 86_400_000;
  const previousStart = now - windowDays * 2 * 86_400_000;
  const latest = getLatestSnapshot(snapshots);
  const currentBaseline = getBaselineSnapshot(snapshots, currentStart);
  const previousBaseline = getBaselineSnapshot(snapshots, previousStart);

  if (!latest || !currentBaseline || !previousBaseline) {
    return {
      currentDownloadsPerDay: 0,
      previousDownloadsPerDay: 0,
      changePercent: 0
    };
  }

  const currentDownloads = Math.max(0, latest.downloads - currentBaseline.downloads);
  const previousDownloads = Math.max(0, currentBaseline.downloads - previousBaseline.downloads);
  const currentDownloadsPerDay = currentDownloads / windowDays;
  const previousDownloadsPerDay = previousDownloads / windowDays;
  const changePercent =
    previousDownloadsPerDay > 0
      ? ((currentDownloadsPerDay - previousDownloadsPerDay) / previousDownloadsPerDay) * 100
      : currentDownloadsPerDay > 0
        ? 100
        : 0;

  return {
    currentDownloadsPerDay,
    previousDownloadsPerDay,
    changePercent
  };
}

export function calculateEngagementRate(snapshot: ModelSnapshot | undefined): number {
  if (!snapshot || snapshot.downloads <= 0) {
    return 0;
  }

  return (snapshot.likes / snapshot.downloads) * 100;
}

export function detectDownloadSpikes(snapshots: ModelSnapshot[], multiplier = 3): DownloadSpike[] {
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const deltas = sorted.slice(1).map((snapshot, index) => ({
    timestamp: snapshot.timestamp,
    downloadsDelta: Math.max(0, snapshot.downloads - sorted[index].downloads)
  }));

  if (deltas.length < 4) {
    return [];
  }

  return deltas
    .map((delta, index) => {
      const previousDeltas = deltas.slice(Math.max(0, index - 5), index);
      const averageDelta =
        previousDeltas.length > 0
          ? previousDeltas.reduce((total, item) => total + item.downloadsDelta, 0) /
            previousDeltas.length
          : 0;

      return { ...delta, averageDelta };
    })
    .filter(
      (delta) =>
        delta.averageDelta > 0 &&
        delta.downloadsDelta >= delta.averageDelta * multiplier &&
        delta.downloadsDelta >= 10
    );
}

export function calculateLongevityScore(snapshots: ModelSnapshot[]): number {
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];

  if (!first || !latest || first.timestamp === latest.timestamp) {
    return 0;
  }

  const firstWindowEnd = first.timestamp + 30 * 86_400_000;
  const lastWindowStart = latest.timestamp - 30 * 86_400_000;
  const firstWindowEndSnapshot =
    [...sorted].reverse().find((snapshot) => snapshot.timestamp <= firstWindowEnd) ?? first;
  const lastWindowStartSnapshot =
    [...sorted].reverse().find((snapshot) => snapshot.timestamp <= lastWindowStart) ?? first;
  const firstThirtyDownloads = Math.max(1, firstWindowEndSnapshot.downloads - first.downloads);
  const lastThirtyDownloads = Math.max(0, latest.downloads - lastWindowStartSnapshot.downloads);

  return Math.min(100, Math.round((lastThirtyDownloads / firstThirtyDownloads) * 100));
}

export function calculateHealthScore(snapshots: ModelSnapshot[]): number {
  const latest = getLatestSnapshot(snapshots);
  if (!latest) {
    return 0;
  }

  const velocity = calculateVelocity(snapshots);
  const engagementRatio = latest.downloads > 0 ? latest.likes / latest.downloads : 0;
  const commentRate = velocity.commentsDelta;

  return Math.round(
    velocity.downloadsPerDay * 0.4 + engagementRatio * 100 * 0.3 + commentRate * 0.3
  );
}

export function getHealthStatus(snapshots: ModelSnapshot[]): HealthStatus {
  if (snapshots.length < 2) {
    return 'unknown';
  }

  const velocity = calculateVelocity(snapshots);
  if (velocity.downloadsPerDay > 20) {
    return 'growing';
  }

  if (velocity.downloadsPerDay < 1) {
    return 'declining';
  }

  return 'stable';
}

export function hasSharpDownloadDrop(snapshots: ModelSnapshot[]): boolean {
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length < 3) {
    return false;
  }

  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const beforePrevious = sorted[sorted.length - 3];

  const previousDelta = previous.downloads - beforePrevious.downloads;
  const latestDelta = latest.downloads - previous.downloads;

  if (previousDelta <= 0) {
    return false;
  }

  return latestDelta <= previousDelta * 0.7;
}

export function detectLifecyclePhase(snapshots: ModelSnapshot[]): LifecyclePhase {
  if (snapshots.length === 0) {
    return 'unknown';
  }

  if (snapshots.length < 3) {
    return 'launch';
  }

  if (hasSharpDownloadDrop(snapshots)) {
    return 'decline';
  }

  const velocity = calculateVelocity(snapshots);
  if (velocity.downloadsPerDay >= 20) {
    return 'growth';
  }

  if (velocity.downloadsPerDay <= 1) {
    return 'decline';
  }

  return 'plateau';
}

export function getLifecycleLabel(phase: LifecyclePhase): string {
  switch (phase) {
    case 'launch':
      return 'Lancement';
    case 'growth':
      return 'Croissance';
    case 'plateau':
      return 'Plateau';
    case 'decline':
      return 'Déclin';
    case 'unknown':
      return 'Inconnu';
  }
}

export function getLifecycleRecommendation(phase: LifecyclePhase): string {
  switch (phase) {
    case 'launch':
      return 'Accumule encore quelques snapshots pour stabiliser le diagnostic.';
    case 'growth':
      return 'Le modèle capte de la traction : surveille les versions et prépare une relance ciblée.';
    case 'plateau':
      return 'Le rythme se tasse : une mise à jour, un article ou un meilleur tag peut relancer la courbe.';
    case 'decline':
      return 'La dynamique baisse : compare les tags récents et vérifie si un concurrent capte la niche.';
    case 'unknown':
      return 'Lance une première collecte pour établir une base.';
  }
}

export function formatRelativeTime(timestamp: number): string {
  if (timestamp <= 0) {
    return 'Jamais';
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return 'À l’instant';
  }

  if (minutes < 60) {
    return `Il y a ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Il y a ${hours} h`;
  }

  return `Il y a ${Math.floor(hours / 24)} j`;
}
