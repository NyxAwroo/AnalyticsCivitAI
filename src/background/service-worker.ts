import { COLLECTION_ALARM_NAME, WEEKLY_SUMMARY_ALARM_NAME } from '../utils/constants';
import {
  collectNow,
  findNewCompetitorModelsInOwnedNiches,
  trackCompetitorByModelId
} from '../storage/collect';
import {
  db,
  getCompetitorTrackedModels,
  getLatestModelSnapshots,
  getModelSnapshotsByModelIds,
  getOwnTrackedModels,
  getSettings,
  type ModelSnapshot
} from '../storage/db';
import { calculateLatestDelta, hasSharpDownloadDrop } from '../utils/analytics';

const COMPETITOR_ALERTED_MODEL_IDS_KEY = 'analytics-civitai-alerted-competitor-model-ids';
const CONTEXT_MENU_ANALYTICS_ID = 'analytics-civitai-open-analytics';

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

async function getAlertedCompetitorModelIds(): Promise<Set<number>> {
  const stored: unknown = await chrome.storage.local.get(COMPETITOR_ALERTED_MODEL_IDS_KEY);

  if (typeof stored !== 'object' || stored === null) {
    return new Set();
  }

  const value = (stored as Record<string, unknown>)[COMPETITOR_ALERTED_MODEL_IDS_KEY];
  return new Set(isNumberArray(value) ? value : []);
}

async function saveAlertedCompetitorModelIds(modelIds: Set<number>): Promise<void> {
  await chrome.storage.local.set({
    [COMPETITOR_ALERTED_MODEL_IDS_KEY]: [...modelIds].slice(-500)
  });
}

function getLatestSnapshot(snapshots: ModelSnapshot[]): ModelSnapshot | undefined {
  return [...snapshots].sort((a, b) => b.timestamp - a.timestamp)[0];
}

function calculateDownloadsDeltaSince(snapshots: ModelSnapshot[], days: number): number {
  const latest = getLatestSnapshot(snapshots);
  if (!latest) {
    return 0;
  }

  const cutoff = Date.now() - days * 86_400_000;
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const baseline =
    [...sorted].reverse().find((snapshot) => snapshot.timestamp <= cutoff) ?? sorted[0];

  return Math.max(0, latest.downloads - (baseline?.downloads ?? latest.downloads));
}

async function scheduleAlarms(): Promise<void> {
  const settings = await getSettings();
  await chrome.alarms.clear(COLLECTION_ALARM_NAME);
  await chrome.alarms.create(COLLECTION_ALARM_NAME, {
    periodInMinutes: settings.collectFrequencyHours * 60
  });
  await chrome.alarms.clear(WEEKLY_SUMMARY_ALARM_NAME);
  await chrome.alarms.create(WEEKLY_SUMMARY_ALARM_NAME, {
    periodInMinutes: 7 * 24 * 60
  });
}

function getModelIdFromUrl(url: string | undefined): number | undefined {
  const match = url?.match(/civitai\.(?:com|red)\/models\/(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function createContextMenus(): void {
  chrome.contextMenus?.removeAll(() => {
    chrome.contextMenus?.create({
      id: CONTEXT_MENU_ANALYTICS_ID,
      title: 'Voir analytics dans AnalyticsCivitAI',
      contexts: ['page'],
      documentUrlPatterns: ['https://civitai.com/models/*', 'https://civitai.red/models/*']
    });
  });
}

async function updateActionBadge(extraAlerts = 0): Promise<void> {
  const [ownModels, competitorModels] = await Promise.all([
    getOwnTrackedModels(),
    getCompetitorTrackedModels()
  ]);
  const histories = await getModelSnapshotsByModelIds([
    ...ownModels.map((model) => model.modelId),
    ...competitorModels.map((model) => model.modelId)
  ]);
  let alertCount = extraAlerts;

  for (const model of ownModels) {
    if (hasSharpDownloadDrop(histories.get(model.modelId) ?? [])) {
      alertCount += 1;
    }
  }

  for (const model of competitorModels) {
    const delta = calculateLatestDelta(histories.get(model.modelId) ?? []);
    if (delta.downloads >= 100) {
      alertCount += 1;
    }
  }

  await chrome.action.setBadgeBackgroundColor({ color: '#DC2626' });
  await chrome.action.setBadgeText({
    text: alertCount > 0 ? String(Math.min(alertCount, 99)) : ''
  });
}

async function notifyWeeklySummary(): Promise<void> {
  const ownModels = await getOwnTrackedModels();
  const histories = await getModelSnapshotsByModelIds(ownModels.map((model) => model.modelId));
  let weeklyDownloads = 0;
  let totalDownloads = 0;

  for (const model of ownModels) {
    const history = histories.get(model.modelId) ?? [];
    weeklyDownloads += calculateDownloadsDeltaSince(history, 7);
    totalDownloads += getLatestSnapshot(history)?.downloads ?? 0;
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'AnalyticsCivitAI - résumé hebdo',
    message: `${ownModels.length} modèles suivis · +${weeklyDownloads.toLocaleString('fr-FR')} downloads sur 7j · ${totalDownloads.toLocaleString('fr-FR')} au total.`
  });
}

async function notifyNewCompetitorModels(): Promise<number> {
  const [alerts, alertedIds] = await Promise.all([
    findNewCompetitorModelsInOwnedNiches(),
    getAlertedCompetitorModelIds()
  ]);
  const unseenAlerts = alerts.filter((alert) => !alertedIds.has(alert.modelId));

  if (unseenAlerts.length === 0) {
    return 0;
  }

  for (const alert of unseenAlerts) {
    alertedIds.add(alert.modelId);
  }

  await saveAlertedCompetitorModelIds(alertedIds);

  const firstAlert = unseenAlerts[0];
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Nouveau modèle concurrent',
    message:
      unseenAlerts.length === 1
        ? `${firstAlert.creatorUsername} a publié "${firstAlert.name}" dans ta niche ${firstAlert.matchedTags.slice(0, 2).join(', ')}.`
        : `${unseenAlerts.length} nouveaux modèles concurrents détectés dans tes niches.`
  });

  return unseenAlerts.length;
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
  void scheduleAlarms();
  void updateActionBadge();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
  void scheduleAlarms();
  void updateActionBadge();
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ANALYTICS_ID) {
    return;
  }

  const modelId = getModelIdFromUrl(info.pageUrl ?? tab?.url);
  const url = chrome.runtime.getURL(
    `analytics.html?tab=competitors${modelId ? `&modelId=${modelId}` : ''}`
  );
  void chrome.tabs.create({ url });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === WEEKLY_SUMMARY_ALARM_NAME) {
    void notifyWeeklySummary().catch((error: unknown) => {
      console.error('AnalyticsCivitAI weekly summary failed', error);
    });
    return;
  }

  if (alarm.name !== COLLECTION_ALARM_NAME) {
    return;
  }

  void (async () => {
    const before = await getLatestModelSnapshots();
    const beforeDownloads = [...before.values()].reduce(
      (total, snapshot) => total + snapshot.downloads,
      0
    );

    await collectNow();
    const newCompetitorAlerts = await notifyNewCompetitorModels();

    const after = await getLatestModelSnapshots();
    const afterDownloads = [...after.values()].reduce(
      (total, snapshot) => total + snapshot.downloads,
      0
    );
    const delta = afterDownloads - beforeDownloads;

    if (delta >= 100) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'AnalyticsCivitAI',
        message: `+${delta.toLocaleString('fr-FR')} downloads depuis la dernière collecte.`
      });
    }

    await updateActionBadge(newCompetitorAlerts);
  })().catch((error: unknown) => {
    console.error('AnalyticsCivitAI collection failed', error);
  });
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'TRACK_COMPETITOR_MODEL' &&
    'modelId' in message &&
    typeof message.modelId === 'number'
  ) {
    void trackCompetitorByModelId(message.modelId)
      .then((model) => {
        void updateActionBadge();
        sendResponse({ ok: true, name: model.name });
      })
      .catch((error: unknown) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'CLEAR_ALERT_BADGE'
  ) {
    void chrome.action
      .setBadgeText({ text: '' })
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'IS_MODEL_TRACKED' &&
    'modelId' in message &&
    typeof message.modelId === 'number'
  ) {
    void db.trackedModels
      .get(message.modelId)
      .then((model) => sendResponse({ ok: true, tracked: Boolean(model) }))
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'RESCHEDULE_COLLECTION'
  ) {
    void scheduleAlarms()
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  return false;
});
