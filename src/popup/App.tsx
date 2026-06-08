import {
  BarChart3,
  Eye,
  FileText,
  Gauge,
  LineChart,
  Maximize2,
  Settings as SettingsIcon
} from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Trends from './pages/Trends';

const Competitors = lazy(() => import('./pages/Competitors'));
const Models = lazy(() => import('./pages/Models'));
const Articles = lazy(() => import('./pages/Articles'));

type TabId = 'dashboard' | 'models' | 'trends' | 'competitors' | 'articles' | 'settings';

interface TabDefinition {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: TabDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'models', label: 'Modèles', icon: LineChart },
  { id: 'trends', label: 'Trends', icon: BarChart3 },
  { id: 'competitors', label: 'Veille', icon: Eye },
  { id: 'articles', label: 'Articles', icon: FileText },
  { id: 'settings', label: 'Réglages', icon: SettingsIcon }
];

function isTabId(value: string | null): value is TabId {
  return tabs.some((tab) => tab.id === value);
}

function getInitialTab(): TabId {
  const params = new URLSearchParams(window.location.search);
  const queryTab = params.get('tab');
  const storedTab = sessionStorage.getItem('analytics-civitai-active-tab');

  if (isTabId(queryTab)) {
    return queryTab;
  }

  if (isTabId(storedTab)) {
    return storedTab;
  }

  return 'dashboard';
}

function renderTab(tab: TabId): JSX.Element {
  switch (tab) {
    case 'dashboard':
      return <Dashboard />;
    case 'models':
      return (
        <Suspense
          fallback={
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              Chargement des graphiques...
            </div>
          }
        >
          <Models />
        </Suspense>
      );
    case 'trends':
      return <Trends />;
    case 'competitors':
      return (
        <Suspense
          fallback={
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              Chargement de la veille...
            </div>
          }
        >
          <Competitors />
        </Suspense>
      );
    case 'articles':
      return (
        <Suspense
          fallback={
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              Chargement des articles...
            </div>
          }
        >
          <Articles />
        </Suspense>
      );
    case 'settings':
      return <Settings />;
  }
}

interface AppProps {
  isFullPage?: boolean;
}

export default function App({ isFullPage = false }: AppProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

  useEffect(() => {
    sessionStorage.setItem('analytics-civitai-active-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    void chrome.runtime?.sendMessage?.({ type: 'CLEAR_ALERT_BADGE' });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (isFullPage && params.get('print') === 'month') {
      const timer = window.setTimeout(() => window.print(), 1200);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [isFullPage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        return;
      }

      const tabIndex = Number(event.key) - 1;
      if (Number.isInteger(tabIndex) && tabs[tabIndex]) {
        setActiveTab(tabs[tabIndex].id);
        return;
      }

      if (event.key.toLowerCase() === 'r') {
        window.dispatchEvent(new CustomEvent('analytics-civitai-refresh'));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function openFullPage(): void {
    const url = chrome.runtime.getURL(`analytics.html?tab=${activeTab}`);
    void chrome.tabs.create({ url });
  }

  return (
    <main
      className={`flex flex-col bg-civitai-bg text-gray-50 ${
        isFullPage
          ? 'min-h-screen min-w-0'
          : 'h-[600px] max-h-[600px] min-h-[500px] min-w-[420px]'
      }`}
    >
      <header className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold leading-tight">AnalyticsCivitAI</h1>
            <p className="text-xs text-gray-400">Portfolio CivitAI local</p>
          </div>
          <div className="flex items-center gap-2">
            {!isFullPage ? (
              <button
                type="button"
                onClick={openFullPage}
                title="Ouvrir en page complète"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 text-gray-300 transition hover:bg-white/5 hover:text-white"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            ) : null}
            <span className="rounded bg-violet-600 px-2 py-1 text-xs font-medium">Phase 5</span>
          </div>
        </div>
      </header>

      <nav className="grid grid-cols-6 border-b border-white/10 bg-gray-900/70">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              title={tab.label}
              aria-label={tab.label}
              aria-pressed={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex h-14 flex-col items-center justify-center gap-1 border-b-2 text-[11px] transition ${
                isActive
                  ? 'border-violet-400 bg-violet-500/15 text-violet-200'
                  : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <section className={`min-h-0 flex-1 overflow-y-auto ${isFullPage ? 'mx-auto w-full max-w-6xl' : ''}`}>
        {renderTab(activeTab)}
      </section>
    </main>
  );
}
