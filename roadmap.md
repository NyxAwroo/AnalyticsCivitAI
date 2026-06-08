# 🗺️ ROADMAP — AnalyticsCivitAI Extension Chrome

> Extension Chrome (TypeScript + React) pour tracker et analyser en profondeur ses modèles, articles et la concurrence sur CivitAI.

---

## 📐 Architecture technique cible

```
AnalyticsCivitAI/
├── manifest.json              # Chrome Extension Manifest V3
├── src/
│   ├── background/
│   │   └── service-worker.ts  # Collecte périodique, Chrome Alarms
│   ├── popup/
│   │   ├── App.tsx            # Dashboard principal (React)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Models.tsx
│   │   │   ├── Trends.tsx
│   │   │   ├── Competitors.tsx
│   │   │   ├── Articles.tsx
│   │   │   └── Settings.tsx
│   │   └── components/        # Charts, Cards, Tables...
│   ├── content/
│   │   └── civitai-inject.ts  # Injection optionnelle sur civitai.com
│   ├── api/
│   │   └── civitai.ts         # Wrapper API CivitAI
│   └── storage/
│       └── db.ts              # IndexedDB via idb-keyval ou Dexie
├── public/
│   └── icons/
├── package.json
├── tsconfig.json
└── vite.config.ts             # Builder (CRXJS plugin recommandé)
```

**Stack :**

- TypeScript + React 18
- Vite + CRXJS (build extension Chrome)
- Recharts ou Chart.js (graphiques)
- Dexie.js (IndexedDB simplifié — base de données locale persistante)
- Tailwind CSS (UI rapide et propre)

---

## 

## 🔗 Ressources clés

- API CivitAI : https://developer.civitai.com/docs/api/public-rest
- CRXJS (Vite + Chrome Extension) : https://crxjs.dev/vite-plugin
- Dexie.js (IndexedDB) : https://dexie.org/
- Chrome Extensions Manifest V3 : https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3

---

*Roadmap v1.0 — Projet AnalyticsCivitAI*
