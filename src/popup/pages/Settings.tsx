import { CheckCircle2, Download, FileJson, KeyRound, Save, ShieldAlert, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { validateApiKey } from '../../api/civitai';
import { getSettings, saveSettings, type Settings as StoredSettings } from '../../storage/db';
import {
  exportAllDataAsJson,
  exportModelSnapshotsAsCsv,
  importAllDataFromJsonFile
} from '../../storage/export';
import { useI18n } from '../../i18n/I18nProvider';

type SaveState = 'idle' | 'saving' | 'success' | 'error';

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<StoredSettings | undefined>();
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<SaveState>('idle');
  const [message, setMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const languageInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage, importTranslations, exportTemplate, t } = useI18n();

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      const stored = await getSettings();
      setSettings(stored);
      setApiKey(stored.apiKey);
    }

    void loadSettings();
  }, []);

  async function rescheduleCollection(): Promise<void> {
    await chrome.runtime.sendMessage({ type: 'RESCHEDULE_COLLECTION' });
  }

  async function handleSave(): Promise<void> {
    if (!settings) {
      return;
    }

    setStatus('saving');
    setMessage('');

    try {
      const user = await validateApiKey(apiKey);
      const nextSettings: StoredSettings = {
        ...settings,
        apiKey: apiKey.trim(),
        username: user.username
      };

      await saveSettings(nextSettings);
      await rescheduleCollection();
      setSettings(nextSettings);
      setStatus('success');
      setMessage(`Connecté en tant que ${user.username}.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation impossible.';
      setStatus('error');
      setMessage(errorMessage);
    }
  }

  async function handleFrequencyChange(value: StoredSettings['collectFrequencyHours']): Promise<void> {
    if (!settings) {
      return;
    }

    const nextSettings: StoredSettings = {
      ...settings,
      collectFrequencyHours: value
    };

    await saveSettings(nextSettings);
    await rescheduleCollection();
    setSettings(nextSettings);
  }

  async function handleRetentionChange(value: number): Promise<void> {
    if (!settings) {
      return;
    }

    const nextSettings: StoredSettings = {
      ...settings,
      snapshotRetentionDays: Math.max(7, Math.min(value, 365))
    };

    await saveSettings(nextSettings);
    setSettings(nextSettings);
  }

  async function handleDarkModeChange(darkMode: boolean): Promise<void> {
    if (!settings) {
      return;
    }

    const nextSettings: StoredSettings = {
      ...settings,
      darkMode
    };

    await saveSettings(nextSettings);
    setSettings(nextSettings);
  }

  async function handleImport(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }

    try {
      const summary = await importAllDataFromJsonFile(file);
      const stored = await getSettings();
      setSettings(stored);
      setApiKey(stored.apiKey);
      setImportMessage(
        `Import OK : ${summary.trackedModels} modèles, ${summary.modelSnapshots} snapshots modèles, ${summary.trackedArticles} articles.`
      );
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Import impossible.');
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  async function handleLanguageImport(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }

    try {
      await importTranslations(file);
      setImportMessage(t('Fichier de langue chargé.'));
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : t('Fichier de langue invalide.'));
    } finally {
      if (languageInputRef.current) {
        languageInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Réglages</h2>
        <p className="text-xs text-gray-400">Connexion API et fréquence de collecte</p>
      </div>

      <section className="rounded border border-white/10 bg-gray-800 p-4">
        <label htmlFor="api-key" className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
          <KeyRound className="h-4 w-4 text-violet-300" />
          Clé API CivitAI
        </label>
        <input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Bearer token CivitAI"
          className="h-10 w-full rounded border border-white/10 bg-gray-950 px-3 text-sm text-white placeholder:text-gray-500"
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving' || apiKey.trim().length === 0}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {status === 'saving' ? 'Validation' : 'Valider'}
        </button>

        {message ? (
          <div
            className={`mt-3 flex items-center gap-2 rounded border p-3 text-sm ${
              status === 'success'
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-400/30 bg-rose-500/10 text-rose-100'
            }`}
          >
            {status === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <ShieldAlert className="h-4 w-4 shrink-0" />
            )}
            {message}
          </div>
        ) : null}
      </section>

      <section className="rounded border border-white/10 bg-gray-800 p-4">
        <label htmlFor="language" className="text-sm font-medium text-white">
          Langue
        </label>
        <select
          id="language"
          value={language}
          onChange={(event) => void setLanguage(event.target.value as StoredSettings['language'])}
          className="mt-2 h-10 w-full rounded border border-white/10 bg-gray-950 px-3 text-sm text-white"
        >
          <option value="fr">Français</option>
          <option value="en">Anglais</option>
          <option value="custom">Personnalisée</option>
        </select>
        <input
          ref={languageInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => void handleLanguageImport(event.target.files?.[0])}
          className="hidden"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => languageInputRef.current?.click()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded border border-white/10 px-3 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
          >
            <Upload className="h-4 w-4" />
            Importer une langue JSON
          </button>
          <button
            type="button"
            onClick={exportTemplate}
            className="inline-flex h-9 items-center justify-center gap-2 rounded border border-white/10 px-3 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
          >
            <FileJson className="h-4 w-4" />
            Exporter le modèle de langue
          </button>
        </div>
      </section>

      <section className="rounded border border-white/10 bg-gray-800 p-4">
        <label htmlFor="frequency" className="text-sm font-medium text-white">
          Fréquence de collecte
        </label>
        <select
          id="frequency"
          value={settings?.collectFrequencyHours ?? 6}
          onChange={(event) =>
            void handleFrequencyChange(Number(event.target.value) as StoredSettings['collectFrequencyHours'])
          }
          className="mt-2 h-10 w-full rounded border border-white/10 bg-gray-950 px-3 text-sm text-white"
        >
          <option value={1}>Toutes les 1 h</option>
          <option value={6}>Toutes les 6 h</option>
          <option value={12}>Toutes les 12 h</option>
          <option value={24}>Toutes les 24 h</option>
        </select>
      </section>

      <section className="rounded border border-white/10 bg-gray-800 p-4">
        <label htmlFor="retention" className="text-sm font-medium text-white">
          Conservation des snapshots
        </label>
        <input
          id="retention"
          type="number"
          min={7}
          max={365}
          value={settings?.snapshotRetentionDays ?? 90}
          onChange={(event) => void handleRetentionChange(Number(event.target.value))}
          className="mt-2 h-10 w-full rounded border border-white/10 bg-gray-950 px-3 text-sm text-white"
        />

        <label className="mt-3 flex items-center justify-between gap-3 text-sm text-gray-300">
          Mode sombre
          <input
            type="checkbox"
            checked={settings?.darkMode ?? true}
            onChange={(event) => void handleDarkModeChange(event.target.checked)}
            className="h-4 w-4 accent-violet-600"
          />
        </label>
      </section>

      <section className="rounded border border-white/10 bg-gray-800 p-4">
        <p className="text-sm font-medium text-white">Exports</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void exportModelSnapshotsAsCsv()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void exportAllDataAsJson()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded border border-white/10 px-3 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
          >
            <FileJson className="h-4 w-4" />
            JSON
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => void handleImport(event.target.files?.[0])}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded border border-white/10 px-3 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
        >
          <Upload className="h-4 w-4" />
          Import JSON
        </button>
        {importMessage ? <p className="mt-2 text-xs text-gray-400">{importMessage}</p> : null}
      </section>

      <section className="rounded border border-white/10 bg-gray-800 p-4 text-sm text-gray-300">
        <p>
          Compte connecté :{' '}
          <span className="font-medium text-white">{settings?.username || 'Non configuré'}</span>
        </p>
      </section>
    </div>
  );
}
