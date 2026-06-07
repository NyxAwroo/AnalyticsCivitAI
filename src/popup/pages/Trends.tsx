import { ClipboardCheck, Radar, RefreshCw, Tags } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  calculateTrendVelocity,
  collectTrendingNow,
  getGapFinderTags,
  getOpportunityTags,
  getTagTrends,
  getTrendingModelProfile,
  type OpportunityTag,
  type TagTrend,
  type TrendingModelProfile
} from '../../storage/market';
import { getLatestTrendSnapshots, type TrendSnapshot } from '../../storage/db';

const typeOptions = ['', 'Checkpoint', 'LORA', 'TextualInversion', 'Controlnet', 'VAE'];
const baseModelOptions = ['', 'SDXL 1.0', 'Flux.1 D', 'Pony', 'Illustrious', 'SD 1.5'];
const periodOptions: Array<{ label: string; value: 'Day' | 'Week' }> = [
  { label: '24h', value: 'Day' },
  { label: '7j', value: 'Week' }
];

function formatChange(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }

  return `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
}

function getQuadrantLabel(quadrant: OpportunityTag['quadrant']): string {
  switch (quadrant) {
    case 'strong':
      return 'Fort potentiel';
    case 'crowded':
      return 'Très demandé';
    case 'hidden':
      return 'Niche à tester';
    case 'weak':
      return 'Signal faible';
  }
}

export default function Trends(): JSX.Element {
  const [models, setModels] = useState<TrendSnapshot[]>([]);
  const [tagTrends, setTagTrends] = useState<TagTrend[]>([]);
  const [gapTags, setGapTags] = useState<TagTrend[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityTag[]>([]);
  const [profile, setProfile] = useState<TrendingModelProfile | undefined>();
  const [typeFilter, setTypeFilter] = useState('');
  const [baseModelFilter, setBaseModelFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'Day' | 'Week'>('Day');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadStoredMarket(): Promise<void> {
    const [latestTrends, latestTags, gaps, opportunityTags, trendingProfile] = await Promise.all([
      getLatestTrendSnapshots(),
      getTagTrends(),
      getGapFinderTags(),
      getOpportunityTags(),
      getTrendingModelProfile()
    ]);

    setModels(latestTrends);
    setTagTrends(latestTags);
    setGapTags(gaps);
    setOpportunities(opportunityTags);
    setProfile(trendingProfile);
  }

  useEffect(() => {
    void loadStoredMarket();
  }, []);

  async function loadTrending(): Promise<void> {
    setIsLoading(true);
    setError('');

    try {
      const response = await collectTrendingNow({
        type: typeFilter || undefined,
        baseModel: baseModelFilter || undefined,
        tag: tagFilter || undefined,
        period: periodFilter
      });
      const [latestTags, gaps, opportunityTags, trendingProfile] = await Promise.all([
        getTagTrends(),
        getGapFinderTags(),
        getOpportunityTags(),
        getTrendingModelProfile()
      ]);
      setModels(response);
      setTagTrends(latestTags);
      setGapTags(gaps);
      setOpportunities(opportunityTags);
      setProfile(trendingProfile);
    } catch (trendError) {
      const message =
        trendError instanceof Error ? trendError.message : 'Lecture des tendances impossible.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredModels = useMemo(() => {
    return models
      .filter((model) => (typeFilter ? model.type === typeFilter : true))
      .filter((model) => (baseModelFilter ? model.baseModel === baseModelFilter : true))
      .filter((model) =>
        tagFilter
          ? model.tags.some((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))
          : true
      )
      .sort((a, b) => calculateTrendVelocity(b) - calculateTrendVelocity(a));
  }, [baseModelFilter, models, tagFilter, typeFilter]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Trending radar</h2>
          <p className="text-xs text-gray-400">Vélocité, tags et gaps marché</p>
        </div>
        <button
          type="button"
          onClick={loadTrending}
          disabled={isLoading}
          title="Charger les tendances"
          className="inline-flex h-9 items-center gap-2 rounded bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Charger
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <select
          value={periodFilter}
          onChange={(event) => setPeriodFilter(event.target.value as 'Day' | 'Week')}
          className="h-9 rounded border border-white/10 bg-gray-950 px-2 text-xs text-white"
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-9 rounded border border-white/10 bg-gray-950 px-2 text-xs text-white"
        >
          {typeOptions.map((option) => (
            <option key={option || 'all'} value={option}>
              {option || 'Tous types'}
            </option>
          ))}
        </select>
        <select
          value={baseModelFilter}
          onChange={(event) => setBaseModelFilter(event.target.value)}
          className="h-9 rounded border border-white/10 bg-gray-950 px-2 text-xs text-white"
        >
          {baseModelOptions.map((option) => (
            <option key={option || 'all'} value={option}>
              {option || 'Toutes bases'}
            </option>
          ))}
        </select>
        <input
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          placeholder="tag"
          className="h-9 rounded border border-white/10 bg-gray-950 px-2 text-xs text-white placeholder:text-gray-500"
        />
      </div>

      {error ? (
        <div className="rounded border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {filteredModels.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded border border-dashed border-white/15 bg-gray-900/60 text-center text-sm text-gray-400">
          <Radar className="mb-3 h-8 w-8 text-violet-300" />
          Charge les tendances CivitAI pour amorcer la veille marché.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-white/10 bg-gray-800">
          {filteredModels.slice(0, 20).map((model) => (
            <div
              key={`${model.modelId}-${model.timestamp}`}
              className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/10 px-3 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{model.name}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {model.type} · {model.baseModel} · {model.tags.slice(0, 3).join(', ') || 'sans tags'}
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="font-semibold text-white">
                  {calculateTrendVelocity(model).toFixed(1)}/j
                </p>
                <p className="text-gray-500">{model.downloads.toLocaleString('fr-FR')} DL</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Tags className="h-4 w-4 text-violet-300" />
            <p className="text-sm font-medium text-white">Tags par vélocité</p>
          </div>
          <div className="space-y-2">
            {tagTrends.slice(0, 8).map((tagTrend) => (
              <div key={tagTrend.tag} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-gray-200">{tagTrend.tag}</span>
                <span className="text-gray-500">
                  {tagTrend.count} · {formatChange(tagTrend.changePercent)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Radar className="h-4 w-4 text-violet-300" />
            <p className="text-sm font-medium text-white">Gap finder</p>
          </div>
          <div className="space-y-2">
            {gapTags.slice(0, 8).map((tagTrend) => (
              <div key={tagTrend.tag} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-gray-200">{tagTrend.tag}</span>
                <span className="text-gray-500">score {tagTrend.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Radar className="h-4 w-4 text-violet-300" />
          <p className="text-sm font-medium text-white">Matrice opportunité</p>
        </div>
        {opportunities.length === 0 ? (
          <p className="text-sm text-gray-400">Charge les tendances pour calculer les niches.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {opportunities.slice(0, 8).map((opportunity) => (
              <div
                key={opportunity.tag}
                className={`rounded border p-2 ${
                  opportunity.quadrant === 'strong'
                    ? 'border-emerald-400/30 bg-emerald-500/10'
                    : opportunity.quadrant === 'crowded'
                      ? 'border-sky-400/30 bg-sky-500/10'
                      : opportunity.quadrant === 'hidden'
                        ? 'border-amber-400/30 bg-amber-500/10'
                        : 'border-white/10 bg-gray-900/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-white">{opportunity.tag}</span>
                  <span className="text-gray-400">{Math.round(opportunity.opportunityScore)}</span>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  {getQuadrantLabel(opportunity.quadrant)} · pop {opportunity.popularity} ·{' '}
                  {formatChange(opportunity.growth)} · eng {opportunity.averageEngagement.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-violet-300" />
          <p className="text-sm font-medium text-white">Profil du modèle qui cartonne</p>
        </div>
        {!profile || models.length === 0 ? (
          <p className="text-sm text-gray-400">Charge le top trending pour extraire une checklist.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded border border-white/10 bg-gray-900/70 p-2">
                <p className="text-[11px] text-gray-400">Âge moyen</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {profile.averageAgeDays.toFixed(1)} j
                </p>
              </div>
              <div className="rounded border border-white/10 bg-gray-900/70 p-2">
                <p className="text-[11px] text-gray-400">Sweet spot 3-14j</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {Math.round(profile.sweetSpotShare)}%
                </p>
              </div>
              <div className="rounded border border-white/10 bg-gray-900/70 p-2">
                <p className="text-[11px] text-gray-400">Base dominante</p>
                <p className="mt-1 truncate text-lg font-semibold text-white">
                  {profile.dominantBaseModel}
                </p>
              </div>
              <div className="rounded border border-white/10 bg-gray-900/70 p-2">
                <p className="text-[11px] text-gray-400">Images moy.</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {profile.averageImageCount.toFixed(1)}
                </p>
              </div>
              <div className="rounded border border-white/10 bg-gray-900/70 p-2">
                <p className="text-[11px] text-gray-400">Versions moy.</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {profile.averageVersionCount.toFixed(1)}
                </p>
              </div>
              <div className="rounded border border-white/10 bg-gray-900/70 p-2">
                <p className="text-[11px] text-gray-400">Type dominant</p>
                <p className="mt-1 truncate text-lg font-semibold text-white">
                  {profile.dominantType}
                </p>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-gray-900/70 p-2">
              <p className="text-xs font-medium text-white">Créateurs qui montent</p>
              <div className="mt-2 space-y-1">
                {profile.topCreators.length === 0 ? (
                  <p className="text-xs text-gray-400">Créateurs indisponibles dans ce snapshot.</p>
                ) : (
                  profile.topCreators.map((creator) => (
                    <div
                      key={creator.creatorUsername}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate text-gray-200">{creator.creatorUsername}</span>
                      <span className="text-gray-500">
                        {creator.count} modèles · {creator.averageEngagement.toFixed(1)}% eng.
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
