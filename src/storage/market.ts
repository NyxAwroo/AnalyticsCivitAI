import { fetchTrendingModels, type CivitAIModel } from '../api/civitai';
import {
  db,
  getLatestTrendSnapshots,
  getOwnTrackedModels,
  getPreviousTagCounts,
  getSettings,
  type TagSnapshot,
  type TrendSnapshot
} from './db';

export interface MarketFilters {
  type?: string;
  baseModel?: string;
  tag?: string;
  period?: 'Day' | 'Week';
}

export interface TagTrend {
  tag: string;
  count: number;
  previousCount: number;
  changePercent: number;
  velocityScore: number;
}

export interface OpportunityTag {
  tag: string;
  popularity: number;
  growth: number;
  averageEngagement: number;
  opportunityScore: number;
  quadrant: 'strong' | 'crowded' | 'hidden' | 'weak';
}

export interface TrendingModelProfile {
  averageAgeDays: number;
  sweetSpotShare: number;
  averageDescriptionLength: number;
  averageImageCount: number;
  averageVersionCount: number;
  dominantBaseModel: string;
  dominantType: string;
  topCreators: Array<{ creatorUsername: string; count: number; averageEngagement: number }>;
}

function normalizeTags(model: CivitAIModel): string[] {
  return (model.tags ?? []).map((tag) => (typeof tag === 'string' ? tag : tag.name));
}

function getBaseModel(model: CivitAIModel): string {
  return model.modelVersions?.find((version) => version.baseModel)?.baseModel ?? 'Inconnu';
}

function getPublishedAt(model: CivitAIModel): number {
  const versionPublishedAt = model.modelVersions?.find((version) => version.publishedAt)?.publishedAt;
  const date = model.publishedAt ?? versionPublishedAt;
  return date ? Date.parse(date) : Date.now();
}

function toTrendSnapshot(model: CivitAIModel, timestamp: number): TrendSnapshot {
  const images = (model.modelVersions ?? []).flatMap((version) => version.images ?? []);

  return {
    modelId: model.id,
    timestamp,
    name: model.name,
    type: model.type,
    baseModel: getBaseModel(model),
    publishedAt: getPublishedAt(model),
    downloads: model.stats?.downloadCount ?? 0,
    likes: model.stats?.thumbsUpCount ?? 0,
    comments: model.stats?.commentCount ?? 0,
    tags: normalizeTags(model),
    creatorUsername: model.creator?.username,
    descriptionLength: model.description?.replace(/<[^>]+>/g, '').trim().length ?? 0,
    imageCount: images.length,
    versionCount: model.modelVersions?.length ?? 0
  };
}

function toTagSnapshots(trends: TrendSnapshot[], timestamp: number): TagSnapshot[] {
  const counts = new Map<string, number>();

  for (const trend of trends) {
    for (const tag of trend.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()].map(([tag, count]) => ({
    tag,
    count,
    timestamp
  }));
}

export async function collectTrendingNow(filters: MarketFilters = {}): Promise<TrendSnapshot[]> {
  const settings = await getSettings();
  const timestamp = Date.now();
  const response = await fetchTrendingModels(settings.apiKey, filters, settings.apiBaseUrl);
  const trends = response.items.map((model) => toTrendSnapshot(model, timestamp));
  const tagSnapshots = toTagSnapshots(trends, timestamp);

  if (trends.length > 0) {
    await db.trendSnapshots.bulkAdd(trends);
  }

  if (tagSnapshots.length > 0) {
    await db.tagSnapshots.bulkAdd(tagSnapshots);
  }

  return trends;
}

export function calculateTrendVelocity(snapshot: TrendSnapshot): number {
  const ageDays = Math.max((Date.now() - snapshot.publishedAt) / 86_400_000, 1);
  return snapshot.downloads / ageDays;
}

export async function getTagTrends(): Promise<TagTrend[]> {
  const latest = await getLatestTrendSnapshots();
  const previousCounts = await getPreviousTagCounts();
  const latestCounts = new Map<string, number>();

  for (const trend of latest) {
    for (const tag of trend.tags) {
      latestCounts.set(tag, (latestCounts.get(tag) ?? 0) + 1);
    }
  }

  return [...latestCounts.entries()]
    .map(([tag, count]) => {
      const previousCount = previousCounts.get(tag) ?? 0;
      const changePercent =
        previousCount > 0 ? ((count - previousCount) / previousCount) * 100 : count > 0 ? 100 : 0;
      const velocityScore = count * Math.max(1, changePercent + 100);

      return { tag, count, previousCount, changePercent, velocityScore };
    })
    .sort((a, b) => b.velocityScore - a.velocityScore);
}

export async function getGapFinderTags(): Promise<TagTrend[]> {
  const [ownModels, tagTrends] = await Promise.all([getOwnTrackedModels(), getTagTrends()]);
  const ownedTags = new Set(ownModels.flatMap((model) => model.tags.map((tag) => tag.toLowerCase())));

  return tagTrends
    .filter((tagTrend) => !ownedTags.has(tagTrend.tag.toLowerCase()))
    .sort((a, b) => b.velocityScore - a.velocityScore);
}

export async function getOpportunityTags(): Promise<OpportunityTag[]> {
  const [latest, gaps] = await Promise.all([getLatestTrendSnapshots(), getGapFinderTags()]);

  return gaps
    .map((tagTrend) => {
      const matchingModels = latest.filter((trend) =>
        trend.tags.some((tag) => tag.toLowerCase() === tagTrend.tag.toLowerCase())
      );
      const averageEngagement =
        matchingModels.length > 0
          ? matchingModels.reduce((total, model) => {
              const engagement = model.downloads > 0 ? (model.likes / model.downloads) * 100 : 0;
              return total + engagement;
            }, 0) / matchingModels.length
          : 0;
      const dissatisfactionBoost = Math.max(0, 8 - averageEngagement);
      const opportunityScore =
        tagTrend.count * 8 + Math.max(0, tagTrend.changePercent) * 0.35 + dissatisfactionBoost * 5;
      const isHighPotential = tagTrend.changePercent >= 50 || tagTrend.count >= 3;
      const isLowSatisfaction = averageEngagement < 4;
      let quadrant: OpportunityTag['quadrant'] = 'weak';

      if (isHighPotential && isLowSatisfaction) {
        quadrant = 'strong';
      } else if (isHighPotential) {
        quadrant = 'crowded';
      } else if (isLowSatisfaction) {
        quadrant = 'hidden';
      }

      return {
        tag: tagTrend.tag,
        popularity: tagTrend.count,
        growth: tagTrend.changePercent,
        averageEngagement,
        opportunityScore,
        quadrant
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function getMostFrequentValue(values: string[]): string {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'n/a';
}

export async function getTrendingModelProfile(): Promise<TrendingModelProfile> {
  const latest = await getLatestTrendSnapshots();

  if (latest.length === 0) {
    return {
      averageAgeDays: 0,
      sweetSpotShare: 0,
      averageDescriptionLength: 0,
      averageImageCount: 0,
      averageVersionCount: 0,
      dominantBaseModel: 'n/a',
      dominantType: 'n/a',
      topCreators: []
    };
  }

  const creatorStats = new Map<string, { count: number; engagementTotal: number }>();

  for (const trend of latest) {
    if (!trend.creatorUsername) {
      continue;
    }

    const current = creatorStats.get(trend.creatorUsername) ?? { count: 0, engagementTotal: 0 };
    current.count += 1;
    current.engagementTotal += trend.downloads > 0 ? (trend.likes / trend.downloads) * 100 : 0;
    creatorStats.set(trend.creatorUsername, current);
  }

  const ages = latest.map((trend) => Math.max(0, (Date.now() - trend.publishedAt) / 86_400_000));
  const sweetSpotCount = ages.filter((age) => age >= 3 && age <= 14).length;

  return {
    averageAgeDays: ages.reduce((total, age) => total + age, 0) / latest.length,
    sweetSpotShare: (sweetSpotCount / latest.length) * 100,
    averageDescriptionLength:
      latest.reduce((total, trend) => total + (trend.descriptionLength ?? 0), 0) / latest.length,
    averageImageCount:
      latest.reduce((total, trend) => total + (trend.imageCount ?? 0), 0) / latest.length,
    averageVersionCount:
      latest.reduce((total, trend) => total + (trend.versionCount ?? 0), 0) / latest.length,
    dominantBaseModel: getMostFrequentValue(latest.map((trend) => trend.baseModel)),
    dominantType: getMostFrequentValue(latest.map((trend) => trend.type)),
    topCreators: [...creatorStats.entries()]
      .map(([creatorUsername, stats]) => ({
        creatorUsername,
        count: stats.count,
        averageEngagement: stats.engagementTotal / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  };
}
