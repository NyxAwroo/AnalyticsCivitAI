import {
  BarChart3,
  Eye,
  FileText,
  Gauge,
  LineChart,
  Settings as SettingsIcon
} from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

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

export default function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <main className="flex h-[600px] max-h-[600px] min-h-[500px] min-w-[420px] flex-col bg-civitai-bg text-gray-50">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold leading-tight">AnalyticsCivitAI</h1>
            <p className="text-xs text-gray-400">Portfolio CivitAI local</p>
          </div>
          <span className="rounded bg-violet-600 px-2 py-1 text-xs font-medium">Phase 5</span>
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

      <section className="min-h-0 flex-1 overflow-y-auto">{renderTab(activeTab)}</section>
    </main>
  );
}
