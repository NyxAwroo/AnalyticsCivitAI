import { CheckCircle2, Download, FileJson, KeyRound, Printer, Save, ShieldAlert, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { validateApiKey } from '../../api/civitai';
import {
  getSettings,
  saveSettings,
  type AccountProfile,
  type Settings as StoredSettings
} from '../../storage/db';
import {
  exportAllDataAsJson,
  exportModelSnapshotsAsCsv,
  importAllDataFromJsonFile
} from '../../storage/export';
import { useI18n } from '../../i18n/I18nProvider';
import { CIVITAI_API_BASE_URL, CIVITAI_RED_API_BASE_URL } from '../../utils/constants';

type SaveState = 'idle' | 'saving' | 'success' | 'error';

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<StoredSettings | undefined>();
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<SaveState>('idle');
  const [message, setMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [pendingImportFile, setPendingImportFile] = useState<File | undefined>();
  const [profileLabel, setProfileLabel] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const languageInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage, importTranslations, exportTemplate, t } = useI18n();

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      const stored = await getSettings();
      setSettings(stored);
      setApiKey(stored.apiKey);
      setProfileLabel(stored.username || 'Compte CivitAI');
    }

    void loadSettings();
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        cancelImport();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
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
      const user = await validateApiKey(apiKey, settings.apiBaseUrl);
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

  async function handleApiBaseUrlChange(apiBaseUrl: string): Promise<void> {
    if (!settings) {
      return;
    }

    const nextSettings: StoredSettings = {
      ...settings,
      apiBaseUrl
    };

    await saveSettings(nextSettings);
    setSettings(nextSettings);
  }

  async function handleSaveProfile(): Promise<void> {
    if (!settings || !apiKey.trim() || !settings.username) {
      setMessage('Valide une clé API avant d’enregistrer un profil.');
      setStatus('error');
      return;
    }

    const profile: AccountProfile = {
      id: crypto.randomUUID(),
      label: profileLabel.trim() || settings.username,
      apiKey: apiKey.trim(),
      username: settings.username,
      apiBaseUrl: settings.apiBaseUrl
    };
    const nextSettings: StoredSettings = {
      ...settings,
      accountProfiles: [...settings.accountProfiles, profile],
      activeProfileId: profile.id
    };

    await saveSettings(nextSettings);
    setSettings(nextSettings);
    setMessage(`Profil "${profile.label}" enregistré.`);
    setStatus('success');
  }

  async function handleProfileChange(profileId: string): Promise<void> {
    if (!settings) {
      return;
    }

    const profile = settings.accountProfiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      return;
    }

    const nextSettings: StoredSettings = {
      ...settings,
      apiKey: profile.apiKey,
      username: profile.username,
      apiBaseUrl: profile.apiBaseUrl,
      activeProfileId: profile.id
    };

    await saveSettings(nextSettings);
    await rescheduleCollection();
    setSettings(nextSettings);
    setApiKey(profile.apiKey);
    setProfileLabel(profile.label);
    setMessage(`Profil actif : ${profile.label}.`);
    setStatus('success');
  }

  function openMonthlyReport(): void {
    const url = chrome.runtime.getURL('analytics.html?tab=dashboard&print=month');
    void chrome.tabs.create({ url });
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
    document.documentElement.classList.toggle('theme-light', !darkMode);
    document.body.classList.toggle('theme-light', !darkMode);
    setSettings(nextSettings);
  }

  function handleImportSelection(file: File | undefined): void {
    if (!file) {
      return;
    }

    setPendingImportFile(file);
    setImportMessage('');
  }

  async function confirmImport(): Promise<void> {
    if (!pendingImportFile) {
      return;
    }

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await exportAllDataAsJson(`analytics-civitai-backup-before-import-${stamp}.json`);
      const summary = await importAllDataFromJsonFile(pendingImportFile);
      const stored = await getSettings();
      setSettings(stored);
      setApiKey(stored.apiKey);
      setImportMessage(
        `Import OK : ${summary.trackedModels} modèles, ${summary.modelSnapshots} snapshots modèles, ${summary.trackedArticles} articles.`
      );
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Import impossible.');
    } finally {
      setPendingImportFile(undefined);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  function cancelImport(): void {
    setPendingImportFile(undefined);
    if (importInputRef.current) {
      importInputRef.current.value = '';
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

        <label htmlFor="api-base-url" className="mt-3 block text-xs font-medium text-gray-300">
          Instance CivitAI
        </label>
        <select
          id="api-base-url"
          value={settings?.apiBaseUrl ?? CIVITAI_API_BASE_URL}
          onChange={(event) => void handleApiBaseUrlChange(event.target.value)}
          className="mt-2 h-10 w-full rounded border border-white/10 bg-gray-950 px-3 text-sm text-white"
        >
          <option value={CIVITAI_API_BASE_URL}>civitai.com</option>
          <option value={CIVITAI_RED_API_BASE_URL}>civitai.red</option>
        </select>

        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving' || apiKey.trim().length === 0}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {status === 'saving' ? 'Validation' : 'Valider'}
        </button>

        <div className="mt-3 rounded border border-white/10 bg-gray-900/70 p-3">
          <label htmlFor="profile-switch" className="text-xs font-medium text-gray-300">
            Profils API
          </label>
          <select
            id="profile-switch"
            value={settings?.activeProfileId ?? ''}
            onChange={(event) => void handleProfileChange(event.target.value)}
            className="mt-2 h-9 w-full rounded border border-white/10 bg-gray-950 px-2 text-xs text-white"
          >
            <option value="">Compte courant</option>
            {(settings?.accountProfiles ?? []).map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label} · {profile.username}
              </option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <input
              value={profileLabel}
              onChange={(event) => setProfileLabel(event.target.value)}
              placeholder="Nom du profil"
              className="h-9 rounded border border-white/10 bg-gray-950 px-2 text-xs text-white placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              className="inline-flex h-9 items-center justify-center rounded border border-white/10 px-3 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
            >
              Enregistrer
            </button>
          </div>
        </div>

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
        <button
          type="button"
          onClick={openMonthlyReport}
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded border border-white/10 px-3 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
        >
          <Printer className="h-4 w-4" />
          Rapport PDF mensuel
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => handleImportSelection(event.target.files?.[0])}
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

      {pendingImportFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded border border-amber-300/30 bg-gray-900 p-4 shadow-xl">
            <div className="flex items-center gap-2 text-amber-100">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">Confirmer l'import JSON</p>
            </div>
            <p className="mt-2 text-sm text-gray-300">
              Les données locales seront remplacées. Une sauvegarde JSON horodatée sera téléchargée
              automatiquement avant l'import.
            </p>
            <p className="mt-2 truncate text-xs text-gray-500">{pendingImportFile.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={cancelImport}
                className="inline-flex h-9 items-center justify-center rounded border border-white/10 px-3 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmImport()}
                className="inline-flex h-9 items-center justify-center rounded bg-amber-500 px-3 text-xs font-semibold text-gray-950 transition hover:bg-amber-400"
              >
                Sauvegarder et importer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded border border-white/10 bg-gray-800 p-4 text-sm text-gray-300">
        <p>
          Compte connecté :{' '}
          <span className="font-medium text-white">{settings?.username || 'Non configuré'}</span>
        </p>
      </section>
    </div>
  );
}
