import { ExternalLink, FileHeart, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import HealthBadge from '../components/HealthBadge';
import TimeSeriesChart, { type TimeSeriesLine, type TimeSeriesPoint } from '../components/TimeSeriesChart';
import { searchModels, type CivitAIModel } from '../../api/civitai';
import {
  collectNow,
  collectSingleModel,
  importFavoriteModels,
  trackCompetitorFromInput
} from '../../storage/collect';
import {
  getCompetitorTrackedModels,
  getLatestModelSnapshots,
  getModelSnapshotsByModelIds,
  getOwnTrackedModels,
  getSettings,
  removeTrackedModel,
  updateTrackedModelNotes,
  type ModelSnapshot,
  type TrackedModel
} from '../../storage/db';
import {
  calculateLatestDelta,
  calculateHealthScore,
  calculateVelocity,
  getHealthStatus
} from '../../utils/analytics';

const pageSize = 10;
type CompetitorSort = 'downloads' | 'velocity' | 'health' | 'name';

function getLatestSnapshot(snapshots: ModelSnapshot[]): ModelSnapshot | undefined {
  return [...snapshots].sort((a, b) => b.timestamp - a.timestamp)[0];
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return `${Math.round(value)}%`;
}

function parseCivitAIModelId(input: string | undefined): number | undefined {
  if (!input) {
    return undefined;
  }

  const match = input.match(/civitai\.(?:com|red)\/models\/(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function getModelThumbnail(model: CivitAIModel): string | undefined {
  return model.modelVersions
    ?.flatMap((version) => version.images ?? [])
    .find((image) => image.url)?.url;
}

function getModelBaseModel(model: CivitAIModel): string {
  return model.modelVersions?.find((version) => version.baseModel)?.baseModel ?? 'Inconnu';
}

function toBenchmarkChartData(
  ownHistory: ModelSnapshot[],
  competitorHistory: ModelSnapshot[]
): { data: TimeSeriesPoint[]; lines: TimeSeriesLine[] } {
  const pointsByTimestamp = new Map<number, TimeSeriesPoint>();

  for (const snapshot of ownHistory) {
    pointsByTimestamp.set(snapshot.timestamp, {
      ...(pointsByTimestamp.get(snapshot.timestamp) ?? {
        label: new Date(snapshot.timestamp).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit'
        })
      }),
      ownDownloads: snapshot.downloads,
      ownLikes: snapshot.likes
    });
  }

  for (const snapshot of competitorHistory) {
    pointsByTimestamp.set(snapshot.timestamp, {
      ...(pointsByTimestamp.get(snapshot.timestamp) ?? {
        label: new Date(snapshot.timestamp).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit'
        })
      }),
      competitorDownloads: snapshot.downloads,
      competitorLikes: snapshot.likes
    });
  }

  return {
    data: [...pointsByTimestamp.entries()]
      .sort(([timestampA], [timestampB]) => timestampA - timestampB)
      .map(([, point]) => point),
    lines: [
      { dataKey: 'ownDownloads', label: 'Toi downloads', color: '#A78BFA' },
      { dataKey: 'competitorDownloads', label: 'Concurrent downloads', color: '#38BDF8' },
      { dataKey: 'ownLikes', label: 'Toi likes', color: '#34D399' },
      { dataKey: 'competitorLikes', label: 'Concurrent likes', color: '#FBBF24' }
    ]
  };
}

export default function Competitors(): JSX.Element {
  const [ownModels, setOwnModels] = useState<TrackedModel[]>([]);
  const [competitors, setCompetitors] = useState<TrackedModel[]>([]);
  const [latestSnapshots, setLatestSnapshots] = useState<Map<number, ModelSnapshot>>(new Map());
  const [histories, setHistories] = useState<Map<number, ModelSnapshot[]>>(new Map());
  const [selectedOwnId, setSelectedOwnId] = useState<number | undefined>();
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<number | undefined>();
  const [activeTabModelId, setActiveTabModelId] = useState<number | undefined>();
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CivitAIModel[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingModelId, setRefreshingModelId] = useState<number | undefined>();
  const [pendingRemoveId, setPendingRemoveId] = useState<number | undefined>();
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<CompetitorSort>('downloads');
  const [page, setPage] = useState(1);
  const [groupByCreator, setGroupByCreator] = useState(false);
  const [error, setError] = useState('');

  async function loadCompetitors(): Promise<void> {
    const [trackedOwnModels, trackedCompetitors] = await Promise.all([
      getOwnTrackedModels(),
      getCompetitorTrackedModels()
    ]);
    const modelIds = [
      ...trackedOwnModels.map((model) => model.modelId),
      ...trackedCompetitors.map((model) => model.modelId)
    ];
    const [latest, modelHistories] = await Promise.all([
      getLatestModelSnapshots(),
      getModelSnapshotsByModelIds(modelIds)
    ]);

    setOwnModels(trackedOwnModels);
    setCompetitors(trackedCompetitors);
    setLatestSnapshots(latest);
    setHistories(modelHistories);
    setSelectedOwnId((current) => current ?? trackedOwnModels[0]?.modelId);
    setSelectedCompetitorId((current) => current ?? trackedCompetitors[0]?.modelId);
  }

  useEffect(() => {
    void loadCompetitors();
  }, []);

  useEffect(() => {
    async function detectActiveCivitAIModel(): Promise<void> {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const queryModelId = Number(new URLSearchParams(window.location.search).get('modelId'));
      setActiveTabModelId(
        Number.isInteger(queryModelId) && queryModelId > 0
          ? queryModelId
          : parseCivitAIModelId(tabs[0]?.url)
      );
    }

    void detectActiveCivitAIModel();
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void handleSearch();
    }, 400);

    return () => window.clearTimeout(timer);
    // handleSearch reads the latest query after debounce; the timer is keyed by searchQuery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const totals = useMemo(() => {
    let downloads = 0;
    let likes = 0;
    let downloadsDelta = 0;

    for (const competitor of competitors) {
      const latest = latestSnapshots.get(competitor.modelId);
      const delta = calculateLatestDelta(histories.get(competitor.modelId) ?? []);
      downloads += latest?.downloads ?? 0;
      likes += latest?.likes ?? 0;
      downloadsDelta += delta.downloads;
    }

    return { downloads, likes, downloadsDelta };
  }, [competitors, histories, latestSnapshots]);

  const benchmark = useMemo(() => {
    const ownHistory = selectedOwnId ? (histories.get(selectedOwnId) ?? []) : [];
    const competitorHistory = selectedCompetitorId ? (histories.get(selectedCompetitorId) ?? []) : [];
    const ownLatest = getLatestSnapshot(ownHistory);
    const competitorLatest = getLatestSnapshot(competitorHistory);
    const ownVelocity = calculateVelocity(ownHistory);
    const competitorVelocity = calculateVelocity(competitorHistory);
    const ownEngagement =
      ownLatest && ownLatest.downloads > 0 ? (ownLatest.likes / ownLatest.downloads) * 100 : 0;
    const competitorEngagement =
      competitorLatest && competitorLatest.downloads > 0
        ? (competitorLatest.likes / competitorLatest.downloads) * 100
        : 0;

    return {
      ownLatest,
      competitorLatest,
      ownVelocity,
      competitorVelocity,
      ownEngagement,
      competitorEngagement,
      position:
        competitorLatest && competitorLatest.downloads > 0 && ownLatest
          ? (ownLatest.downloads / competitorLatest.downloads) * 100
          : 0,
      chart: toBenchmarkChartData(ownHistory, competitorHistory)
    };
  }, [histories, selectedCompetitorId, selectedOwnId]);

  async function handleAdd(): Promise<void> {
    setIsAdding(true);
    setError('');

    try {
      await trackCompetitorFromInput(input);
      setInput('');
      await loadCompetitors();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Ajout impossible.');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleAddModelId(modelId: number): Promise<void> {
    setIsAdding(true);
    setError('');

    try {
      await trackCompetitorFromInput(String(modelId));
      await loadCompetitors();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Ajout impossible.');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSearch(): Promise<void> {
    if (searchQuery.trim().length < 2) {
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const settings = await getSettings();
      const response = await searchModels(
        settings.apiKey,
        searchQuery.trim(),
        settings.apiBaseUrl
      );
      setSearchResults(response.items);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Recherche impossible.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleRefresh(): Promise<void> {
    setIsRefreshing(true);
    setError('');

    try {
      await collectNow();
      await loadCompetitors();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Rafraîchissement impossible.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleRefreshModel(modelId: number): Promise<void> {
    setRefreshingModelId(modelId);
    setError('');

    try {
      await collectSingleModel(modelId);
      await loadCompetitors();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Snapshot impossible.');
    } finally {
      setRefreshingModelId(undefined);
    }
  }

  async function handleImportFavorites(): Promise<void> {
    setIsAdding(true);
    setError('');

    try {
      const imported = await importFavoriteModels();
      await loadCompetitors();
      setError(`${imported.length} favoris importés dans la veille.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import favoris impossible.');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleNotesChange(modelId: number, notes: string): Promise<void> {
    setCompetitors((currentCompetitors) =>
      currentCompetitors.map((competitor) =>
        competitor.modelId === modelId ? { ...competitor, notes } : competitor
      )
    );
    await updateTrackedModelNotes(modelId, notes);
  }

  async function handleRemove(modelId: number): Promise<void> {
    setError('');
    await removeTrackedModel(modelId);
    setPendingRemoveId(undefined);
    await loadCompetitors();
  }

  const sortedCompetitors = useMemo(() => {
    return competitors
      .filter((competitor) => {
        const haystack = `${competitor.name} ${competitor.creatorUsername ?? ''} ${competitor.type} ${competitor.baseModel} ${competitor.tags.join(' ')}`.toLowerCase();
        return haystack.includes(filterText.trim().toLowerCase());
      })
      .sort((a, b) => {
        const historyA = histories.get(a.modelId) ?? [];
        const historyB = histories.get(b.modelId) ?? [];

        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }

        if (sortBy === 'health') {
          return calculateHealthScore(historyB) - calculateHealthScore(historyA);
        }

        if (sortBy === 'velocity') {
          return calculateVelocity(historyB).downloadsPerDay - calculateVelocity(historyA).downloadsPerDay;
        }

        return (getLatestSnapshot(historyB)?.downloads ?? 0) - (getLatestSnapshot(historyA)?.downloads ?? 0);
      });
  }, [competitors, filterText, histories, sortBy]);
  const pagedCompetitors = sortedCompetitors.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(sortedCompetitors.length / pageSize));
  const groupedCompetitors = useMemo(() => {
    const groups = new Map<string, TrackedModel[]>();

    for (const competitor of pagedCompetitors) {
      const creator = competitor.creatorUsername ?? 'Créateur inconnu';
      groups.set(creator, [...(groups.get(creator) ?? []), competitor]);
    }

    return [...groups.entries()];
  }, [pagedCompetitors]);

  function renderCompetitor(competitor: TrackedModel): JSX.Element {
    const latest = latestSnapshots.get(competitor.modelId);
    const history = histories.get(competitor.modelId) ?? [];
    const delta = calculateLatestDelta(history);

    return (
      <div
        key={competitor.modelId}
        className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/10 px-3 py-3 last:border-b-0"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-white">{competitor.name}</p>
            <HealthBadge status={getHealthStatus(history)} />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {competitor.type} · {competitor.baseModel} · {competitor.creatorUsername ?? 'n/a'}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Likes {(latest?.likes ?? 0).toLocaleString('fr-FR')} · Comments{' '}
            {(latest?.comments ?? 0).toLocaleString('fr-FR')}
          </p>
          <textarea
            value={competitor.notes ?? ''}
            onChange={(event) => void handleNotesChange(competitor.modelId, event.target.value)}
            placeholder="Note personnelle"
            className="mt-2 min-h-14 w-full resize-y rounded border border-white/10 bg-gray-950 px-2 py-1 text-xs text-white placeholder:text-gray-500"
          />
          {pendingRemoveId === competitor.modelId ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-100">
              <span>Supprimer aussi l'historique ?</span>
              <button
                type="button"
                onClick={() => void handleRemove(competitor.modelId)}
                className="rounded bg-amber-500 px-2 py-1 font-semibold text-gray-950"
              >
                Oui
              </button>
              <button
                type="button"
                onClick={() => setPendingRemoveId(undefined)}
                className="rounded border border-white/10 px-2 py-1 text-gray-200"
              >
                Non
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex items-start gap-2 text-right">
          <div className="text-xs">
            <p className="font-semibold text-white">
              {(latest?.downloads ?? 0).toLocaleString('fr-FR')}
            </p>
            <p className="text-gray-500">
              DL {delta.downloads >= 0 ? '+' : ''}
              {delta.downloads.toLocaleString('fr-FR')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefreshModel(competitor.modelId)}
            disabled={refreshingModelId === competitor.modelId}
            title="Snapshot on-demand"
            className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-gray-400 transition hover:bg-white/5 hover:text-violet-200 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingModelId === competitor.modelId ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setPendingRemoveId(competitor.modelId)}
            title="Retirer"
            className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-gray-400 transition hover:bg-white/5 hover:text-rose-200"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void chrome.tabs.create({ url: `https://civitai.com/models/${competitor.modelId}` })}
            title="Ouvrir sur CivitAI"
            className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-gray-400 transition hover:bg-white/5 hover:text-violet-200"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Veille concurrence</h2>
          <p className="text-xs text-gray-400">Modèles suivis hors portfolio</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || competitors.length === 0}
          title="Rafraîchir les concurrents"
          className="inline-flex h-9 items-center gap-2 rounded bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Concurrents</p>
          <p className="mt-1 text-xl font-semibold text-white">{competitors.length}</p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Downloads</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {totals.downloads.toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-gray-800 p-3">
          <p className="text-xs text-gray-400">Delta DL</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {totals.downloadsDelta >= 0 ? '+' : ''}
            {totals.downloadsDelta.toLocaleString('fr-FR')}
          </p>
        </div>
      </div>

      <section className="rounded border border-white/10 bg-gray-800 p-3">
        <label htmlFor="competitor-url" className="text-sm font-medium text-white">
          Ajouter un modèle concurrent
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="competitor-url"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="https://civitai.com/models/123/..."
            className="h-10 min-w-0 flex-1 rounded border border-white/10 bg-gray-950 px-3 text-sm text-white placeholder:text-gray-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding || input.trim().length === 0}
            title="Ajouter"
            className="inline-flex h-10 items-center gap-2 rounded bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>
      </section>

      <section className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="flex h-9 items-center gap-2 rounded border border-white/10 bg-gray-950 px-3">
            <Search className="h-4 w-4 text-violet-300" />
            <input
              value={filterText}
              onChange={(event) => {
                setFilterText(event.target.value);
                setPage(1);
              }}
              placeholder="Filtrer la veille"
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500"
            />
          </label>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as CompetitorSort)}
            className="h-9 rounded border border-white/10 bg-gray-950 px-2 text-xs text-white"
          >
            <option value="downloads">Downloads ↓</option>
            <option value="velocity">Vélocité ↓</option>
            <option value="health">Santé ↓</option>
            <option value="name">Nom A-Z</option>
          </select>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setGroupByCreator((current) => !current)}
            className="inline-flex h-9 items-center justify-center rounded border border-white/10 px-3 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
          >
            {groupByCreator ? 'Vue plate' : 'Grouper par créateur'}
          </button>
          <button
            type="button"
            onClick={() => void handleImportFavorites()}
            disabled={isAdding}
            className="inline-flex h-9 items-center justify-center gap-2 rounded border border-white/10 px-3 text-xs font-semibold text-gray-200 transition hover:bg-white/5 disabled:opacity-60"
          >
            <FileHeart className="h-4 w-4" />
            Importer favoris
          </button>
        </div>
      </section>

      {activeTabModelId && !competitors.some((competitor) => competitor.modelId === activeTabModelId) ? (
        <section className="flex items-center justify-between gap-3 rounded border border-violet-400/30 bg-violet-500/10 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">Page CivitAI détectée</p>
            <p className="text-xs text-violet-100">Modèle #{activeTabModelId} ouvert dans l’onglet actif</p>
          </div>
          <button
            type="button"
            onClick={() => void handleAddModelId(activeTabModelId)}
            disabled={isAdding}
            className="inline-flex h-9 items-center gap-2 rounded bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Suivre
          </button>
        </section>
      ) : null}

      <section className="rounded border border-white/10 bg-gray-800 p-3">
        <label htmlFor="competitor-search" className="flex items-center gap-2 text-sm font-medium text-white">
          <Search className="h-4 w-4 text-violet-300" />
          Recherche CivitAI
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="competitor-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleSearch();
              }
            }}
            placeholder="Nom du modèle, style, auteur..."
            className="h-10 min-w-0 flex-1 rounded border border-white/10 bg-gray-950 px-3 text-sm text-white placeholder:text-gray-500"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching || searchQuery.trim().length < 2}
            className="inline-flex h-10 items-center gap-2 rounded bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
          >
            <Search className={`h-4 w-4 ${isSearching ? 'animate-pulse' : ''}`} />
            Chercher
          </button>
        </div>
        {searchResults.length > 0 ? (
          <div className="mt-3 space-y-2">
            {searchResults.slice(0, 6).map((model) => {
              const thumbnail = getModelThumbnail(model);
              const isTracked = competitors.some((competitor) => competitor.modelId === model.id);

              return (
                <div
                  key={model.id}
                  className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded border border-white/10 bg-gray-900/70 p-2"
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-700" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{model.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {model.type} · {getModelBaseModel(model)} ·{' '}
                      {(model.stats?.downloadCount ?? 0).toLocaleString('fr-FR')} DL ·{' '}
                      {(model.stats?.thumbsUpCount ?? 0).toLocaleString('fr-FR')} likes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAddModelId(model.id)}
                    disabled={isAdding || isTracked}
                    title={isTracked ? 'Déjà suivi' : 'Suivre'}
                    className="inline-flex h-8 items-center gap-1 rounded bg-violet-600 px-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isTracked ? 'Suivi' : 'Suivre'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="rounded border border-white/10 bg-gray-800 p-3">
        <div className="mb-3">
          <p className="text-sm font-medium text-white">Benchmark side-by-side</p>
          <p className="text-xs text-gray-400">Ton modèle vs un modèle suivi</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={selectedOwnId ?? ''}
            onChange={(event) => setSelectedOwnId(Number(event.target.value))}
            className="h-9 min-w-0 rounded border border-white/10 bg-gray-950 px-2 text-xs text-white"
          >
            {ownModels.length === 0 ? <option value="">Aucun modèle perso</option> : null}
            {ownModels.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.name}
              </option>
            ))}
          </select>
          <select
            value={selectedCompetitorId ?? ''}
            onChange={(event) => setSelectedCompetitorId(Number(event.target.value))}
            className="h-9 min-w-0 rounded border border-white/10 bg-gray-950 px-2 text-xs text-white"
          >
            {competitors.length === 0 ? <option value="">Aucun concurrent</option> : null}
            {competitors.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded border border-white/10 bg-gray-900/70 p-2">
            <p className="text-[11px] text-gray-400">Position</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatRatio(benchmark.position)}</p>
          </div>
          <div className="rounded border border-white/10 bg-gray-900/70 p-2">
            <p className="text-[11px] text-gray-400">DL/j toi</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {benchmark.ownVelocity.downloadsPerDay.toFixed(1)}
            </p>
          </div>
          <div className="rounded border border-white/10 bg-gray-900/70 p-2">
            <p className="text-[11px] text-gray-400">DL/j eux</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {benchmark.competitorVelocity.downloadsPerDay.toFixed(1)}
            </p>
          </div>
          <div className="rounded border border-white/10 bg-gray-900/70 p-2">
            <p className="text-[11px] text-gray-400">Eng. toi</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {benchmark.ownEngagement.toFixed(2)}%
            </p>
          </div>
          <div className="rounded border border-white/10 bg-gray-900/70 p-2">
            <p className="text-[11px] text-gray-400">Eng. eux</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {benchmark.competitorEngagement.toFixed(2)}%
            </p>
          </div>
          <div className="rounded border border-white/10 bg-gray-900/70 p-2">
            <p className="text-[11px] text-gray-400">Gap DL</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {((benchmark.competitorLatest?.downloads ?? 0) - (benchmark.ownLatest?.downloads ?? 0)).toLocaleString('fr-FR')}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <TimeSeriesChart data={benchmark.chart.data} lines={benchmark.chart.lines} />
        </div>
      </section>

      <section className="overflow-hidden rounded border border-white/10 bg-gray-800">
        {competitors.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Ajoute une URL de modèle CivitAI pour commencer le benchmark.
          </div>
        ) : groupByCreator ? (
          groupedCompetitors.map(([creator, creatorModels]) => (
            <div key={creator} className="border-b border-white/10 last:border-b-0">
              <div className="bg-gray-900/70 px-3 py-2 text-xs font-semibold text-violet-100">
                {creator} · {creatorModels.length} modèle{creatorModels.length > 1 ? 's' : ''}
              </div>
              {creatorModels.map(renderCompetitor)}
            </div>
          ))
        ) : (
          pagedCompetitors.map(renderCompetitor)
        )}
        {competitors.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="h-8 rounded border border-white/10 text-xs text-gray-200 disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="h-8 rounded border border-white/10 text-xs text-gray-200 disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
