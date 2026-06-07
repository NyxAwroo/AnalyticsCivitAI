<p align="center">
  <img src="public/icons/icon-128.png" alt="AnalyticsCivitAI icon" width="96" height="96">
</p>

<h1 align="center">AnalyticsCivitAI</h1>

<p align="center">
  Local-first analytics, market intelligence and competitor tracking for CivitAI creators.
</p>

<p align="center">
  <img alt="Chrome MV3" src="https://img.shields.io/badge/Chrome-MV3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=111827">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="Local first" src="https://img.shields.io/badge/Privacy-Local_First-10B981?style=for-the-badge">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-7C3AED?style=for-the-badge">
</p>

---

## Why This Extension Exists

CivitAI gives creators public totals, but not enough context to make strategic decisions. You can see that downloads increased, but not whether a model is accelerating, fading, aging well, benefiting from an article, or being overtaken by a competitor.

**AnalyticsCivitAI fills that gap.** It turns your CivitAI activity into a local analytics workspace:

- Track model growth, decline, spikes and engagement over time.
- Compare versions and understand which releases perform best.
- Watch competitor models and creators without copy-paste friction.
- Read market signals from trending models, tags and opportunity gaps.
- Analyze article impact and publication timing.
- Export your data for external analysis.

Everything is stored locally in your browser with IndexedDB. No external backend, no telemetry, no third-party database.

---

## Screenshots

> Replace these placeholders with your own screenshots before publishing the repository.

| Dashboard | Models Analytics |
|---|---|
| ![Dashboard screenshot](https://github.com/NyxAwroo/AnalyticsCivitAI/blob/352ebcf23c6794d20cb5c2ff37feb4287ba78260/screenshots/extension/2026-06-07%2006_51_03-Creator%20Profile%20_%20Civitai%20.png) | ![Models screenshot](https://github.com/NyxAwroo/AnalyticsCivitAI/blob/352ebcf23c6794d20cb5c2ff37feb4287ba78260/screenshots/extension/2026-06-07%2006_51_25-.png) |

<img src="https://github.com/NyxAwroo/AnalyticsCivitAI/blob/352ebcf23c6794d20cb5c2ff37feb4287ba78260/screenshots/extension/2026-06-07%2006_51_51-.png" width="25%">
<img src="https://github.com/NyxAwroo/AnalyticsCivitAI/blob/352ebcf23c6794d20cb5c2ff37feb4287ba78260/screenshots/extension/2026-06-07%2006_52_07-.png" width="25%">


---

## Features

### Personal Model Analytics

- Period deltas: downloads, likes and comments over 7d / 30d / 90d / all time.
- Velocity comparison: current 7-day downloads/day vs previous 7 days.
- Engagement rate: likes/downloads, useful for measuring perceived quality.
- Health score and lifecycle phase: launch, growth, plateau or decline.
- Spike detection: highlights sudden download bursts.
- Activity heatmap: calendar-style intensity view.
- Longevity score: last 30 days vs first 30 days.
- Version ROI: compare downloads by model version.

### Competitor Watch

- Add a competitor manually from a CivitAI URL.
- One-click `+ Track` button injected directly on CivitAI model pages.
- Integrated CivitAI search inside the extension.
- Side-by-side benchmark: your model vs competitor model.
- Position ratio, downloads/day, engagement gap and trend chart.
- Direct links back to CivitAI.
- Extension badge for active alerts.

### Market Intelligence

- Trending radar from CivitAI's top models.
- Tag velocity, not just raw frequency.
- Gap finder: trending tags missing from your own portfolio.
- Opportunity matrix: popularity x growth x low satisfaction.
- Winning model profile: age, base model, type, image count, version count.
- Rising creator detection from trending snapshots.

### Article Analytics

- Track article views, likes and comments over time.
- Link an article to a model and estimate its 72h download impact.
- Publication heatmap and best observed time slots.

### Data, Export and Privacy

- Local IndexedDB storage via Dexie.
- CSV export for model snapshots.
- Full JSON export/import for backup or external analysis.
- Configurable retention window.
- No backend server.
- No analytics tracking.

### Multilingual UI

Built-in languages:

- French
- English

Custom translations can be imported as a flat JSON file:

```json
{
  "Réglages": "Settings",
  "Clé API CivitAI": "CivitAI API key"
}
```

The source language template can be exported from the Settings page, sent to an LLM for translation, then imported back into the extension.

---

## Installation For Users

### 1. Download or Build the Extension

If a release zip is available, download it and extract it.

If building from source:

```bash
npm install
npm run build
```

### 2. Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist/` folder.
5. Pin AnalyticsCivitAI to your toolbar.

---

## How To Get a CivitAI API Key

1. Log in to [CivitAI](https://civitai.com/).
2. Open your account settings.
3. Go to the API keys / developer section.
4. Create a new API key.
5. Copy the token.
6. Open AnalyticsCivitAI → **Settings**.
7. Paste the key into **CivitAI API key** and click **Validate**.

<img alt="" src="screenshots/Find API key on CivitAI/2026-06-07 06_55_55-Manage your Account - Civitai .png" width="" height="170">
<img alt="" src="screenshots/Find API key on CivitAI/2026-06-07 06_56_24-Manage your Account - Civitai .png" width="" height="430">

Recommended permissions: use a key that can read your public/private creator data needed by the API. The key is stored locally in your browser.

---

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```

Tech stack:

- Chrome Extension Manifest V3
- React 18
- TypeScript strict
- Vite + CRXJS
- Tailwind CSS
- Dexie / IndexedDB
- Recharts
- Lucide icons

---

## Preparing a Clean GitHub Folder

On Windows, run:

```bat
prepare_github.bat
```

The script creates a sibling folder named:

```text
AnalyticsCivitAI-GitHub
```

It excludes:

- `node_modules/`
- `dist/`
- `.git/`
- local env files
- logs
- local working folders

Then publish that generated folder to GitHub.

---

## Project Structure

```text
AnalyticsCivitAI/
├── manifest.json
├── popup.html
├── src/
│   ├── api/
│   ├── background/
│   ├── content/
│   ├── i18n/
│   ├── popup/
│   ├── storage/
│   └── utils/
├── public/icons/
├── prepare_github.bat
├── package.json
└── README.md
```

---

## Privacy Model

AnalyticsCivitAI is intentionally local-first:

- Your API key is stored locally through IndexedDB and `chrome.storage.local`.
- Snapshots are stored locally in IndexedDB.
- Exports are generated in your browser.
- No server endpoint is used by this project.
- Network calls go to the CivitAI API.

---

## Roadmap Ideas

- Import competitor watchlist from CivitAI favorites, if the API supports it reliably.
- Snapshot one model on demand without running a full collection.
- Fast sorting and filtering in all model lists.
- Monthly PDF report.
- Multi-account support.
- More bundled translations.

---

## Contributing Translations

1. Open AnalyticsCivitAI → Settings.
2. Click **Export language template**.
3. Translate the JSON values.
4. Keep the JSON keys unchanged.
5. Test with **Import JSON language**.
6. Submit the translated file in `src/i18n/`.

---

## License

MIT. See `LICENSE` when added to the repository.
