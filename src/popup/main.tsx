import { createRoot } from 'react-dom/client';

import { I18nProvider } from '../i18n/I18nProvider';
import { getSettings } from '../storage/db';
import './styles.css';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderStartupError(error: unknown): void {
  const root = document.getElementById('root');
  const message = error instanceof Error ? error.message : 'Erreur inconnue au démarrage.';

  if (!root) {
    return;
  }

  root.innerHTML = `
    <div class="box-border flex min-h-[500px] min-w-[420px] flex-col justify-center bg-gray-900 p-6 text-gray-100">
      <h1 class="mb-2 text-base font-semibold text-white">AnalyticsCivitAI</h1>
      <p class="mb-3 text-sm text-rose-200">La popup n’a pas pu démarrer.</p>
      <pre class="whitespace-pre-wrap rounded border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-100">${escapeHtml(message)}</pre>
    </div>
  `;
}

async function bootstrap(): Promise<void> {
  try {
    const root = document.getElementById('root');

    if (!root) {
      throw new Error('Element #root introuvable.');
    }

    const [settings, module] = await Promise.all([getSettings(), import('./App')]);
    document.documentElement.classList.toggle('theme-light', !settings.darkMode);
    document.body.classList.toggle('theme-light', !settings.darkMode);
    const isFullPage = window.location.pathname.endsWith('/analytics.html');
    const { default: App } = module;
    createRoot(root).render(
      <I18nProvider>
        <App isFullPage={isFullPage} />
      </I18nProvider>
    );
  } catch (error) {
    renderStartupError(error);
  }
}

void bootstrap();
