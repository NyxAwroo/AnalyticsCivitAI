# 🧠 PROMPT SYSTÈME — AnalyticsCivitAI

> Ce fichier est à coller en début de chaque session de développement avec un AI (Claude, Cursor, etc.) pour assurer la continuité et la cohérence du projet.

---

## 🎯 Contexte du projet

Tu m'aides à développer **AnalyticsCivitAI**, une extension Chrome (Manifest V3) pour tracker et analyser en profondeur les modèles, articles et tendances sur [CivitAI](https://civitai.com).

Je suis un **testeur / product owner** : je décris ce que je veux, tu écris le code complet, prêt à utiliser. Je ne veux pas de guidance générale — je veux du code fonctionnel, des fichiers complets, des instructions d'installation précises.

---

## 🛠️ Stack technique (non négociable)

| Composant | Technologie |
|-----------|-------------|
| Langage | TypeScript strict |
| UI | React 18 (hooks uniquement) |
| Builder | Vite + plugin CRXJS (`@crxjs/vite-plugin`) |
| Styles | Tailwind CSS v3 |
| Base de données locale | Dexie.js (wrapper IndexedDB) |
| Graphiques | Recharts |
| Extension | Chrome Manifest V3 |
| Package manager | npm |

---

## 📁 Structure du projet

```
AnalyticsCivitAI/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.ts     ← collecte auto (Chrome Alarms)
│   ├── content/
│   │   └── civitai-inject.ts     ← bouton "+ Suivre" sur pages modèle CivitAI
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx               ← routing par onglets
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx     ← vue globale portfolio
│   │   │   ├── Models.tsx        ← mes modèles + graphiques
│   │   │   ├── Trends.tsx        ← trending radar + tags
│   │   │   ├── Competitors.tsx   ← modèles suivis / benchmark
│   │   │   └── Settings.tsx      ← API key, fréquence, options
│   │   └── components/
│   │       ├── StatCard.tsx
│   │       ├── ModelRow.tsx
│   │       ├── TimeSeriesChart.tsx
│   │       └── HealthBadge.tsx
│   ├── api/
│   │   └── civitai.ts            ← wrapper API CivitAI
│   ├── storage/
│   │   └── db.ts                 ← schéma Dexie + helpers CRUD
│   └── utils/
│       ├── analytics.ts          ← calculs (score santé, vélocité...)
│       └── constants.ts
├── public/
│   └── icons/                    ← icon-16.png, icon-48.png, icon-128.png
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🗄️ Schéma de base de données (Dexie.js)

```typescript
// src/storage/db.ts
interface ModelSnapshot {
  id?: number;
  modelId: number;
  versionId?: number;
  timestamp: number;             // Date.now()
  downloads: number;
  likes: number;
  comments: number;
  rating: number;
  ratingCount: number;
  buzzTipped?: number;
}

interface TrackedModel {
  modelId: number;
  name: string;
  type: string;                  // 'Checkpoint' | 'LORA' | 'TextualInversion' ...
  baseModel: string;             // 'SDXL' | 'Flux' | 'Pony' ...
  tags: string[];
  isOwn: boolean;                // true = mes modèles / false = concurrent suivi
  addedAt: number;
  creatorUsername?: string;
}

interface ArticleSnapshot {
  id?: number;
  articleId: number;
  timestamp: number;
  views: number;
  likes: number;
  comments: number;
}

interface TrackedArticle {
  articleId: number;
  title: string;
  publishedAt: number;
  linkedModelIds: number[];      // modèles associés pour corrélation
}

interface Settings {
  apiKey: string;
  username: string;
  collectFrequencyHours: number; // 1 | 6 | 12 | 24
  lastCollectedAt: number;
  darkMode: boolean;
}

// Tables Dexie :
// db.modelSnapshots — historique des métriques
// db.trackedModels  — modèles suivis (propres + concurrents)
// db.articleSnapshots
// db.trackedArticles
// db.settings       — clé unique 'main'
```

---

## 🌐 API CivitAI — Endpoints utilisés

Base URL : `https://civitai.com/api/v1`
Authentification : header `Authorization: Bearer {API_KEY}`

| Endpoint | Usage |
|----------|-------|
| `GET /me` | Vérifier la clé API + récupérer username |
| `GET /models?username={user}&limit=100` | Liste de ses modèles |
| `GET /models/{id}` | Détail modèle (stats par version) |
| `GET /articles?username={user}&limit=100` | Ses articles |
| `GET /models?sort=Most Downloaded&period=Day&limit=50` | Trending du jour |
| `GET /models?query={search}&limit=20` | Recherche intégrée dans l'onglet Concurrents |
| `GET /models?sort=Newest&limit=50` | Modèles récents |
| `GET /models?tags={tag}` | Modèles par tag |

**Rate limit :** respecter 1 requête / seconde minimum. Mettre un délai entre les appels batch.

---

## ⚙️ Règles de développement strictes

### Code
- Tous les fichiers en **TypeScript strict** (`"strict": true` dans tsconfig)
- Pas de `any` sauf cas exceptionnel commenté
- Interfaces typées pour toutes les réponses API
- Async/await uniquement (pas de `.then()`)
- Gestion d'erreur systématique (try/catch + message d'erreur utilisateur)

### Extension Chrome MV3
- Utiliser **Chrome Alarms API** pour la collecte périodique (pas de `setInterval` dans le service worker)
- Le service worker s'endort automatiquement — tout état persistant passe par `chrome.storage` ou Dexie
- La popup est un **SPA React** injecté dans `popup.html`
- Accès DOM limité à `civitai.com/models/*` via content script pour le bouton `+ Suivre`; la collecte et l'analyse passent par l'API

### UI / UX
- Popup dimensionnée : `min-width: 420px`, `min-height: 500px`, `max-height: 600px`
- Scrollable si contenu long
- Couleurs : thème sombre par défaut (background `#111827`, accent `#7C3AED` — violet CivitAI)
- Tous les graphiques Recharts doivent être `ResponsiveContainer`

### Données
- Chaque snapshot = photo à un instant T. Ne jamais écraser, toujours ajouter
- Purge automatique des snapshots > 90 jours (configurable)
- Les deltas (ex: +X downloads depuis hier) se calculent à la volée depuis l'historique

---

## 📋 Format de réponse attendu de l'AI

Quand je demande de coder quelque chose :

1. **Fichier(s) complet(s)** — pas de `// ... reste inchangé`, le fichier entier
2. **Chemin exact** de chaque fichier dans l'arborescence
3. **Commandes à exécuter** si besoin (npm install, etc.)
4. **Ce qui a changé** par rapport à la session précédente (liste courte)
5. **Test à faire** pour valider que ça fonctionne

---

## 🏁 État actuel du projet

> ⚠️ **METTRE À JOUR CETTE SECTION à chaque fin de session**

```
Phase actuelle    : Phase 5 — Intelligence & Export
Dernière session  : 2026-06-08
Dernier fichier modifié : prompt_system.md

✅ Terminé :
- [x] Setup initial Vite + CRXJS + React + TypeScript strict
- [x] Manifest Chrome MV3 avec permissions storage / alarms / identity
- [x] Tailwind CSS v3 configuré avec thème sombre CivitAI
- [x] Dexie.js configuré avec tables modèles, snapshots, articles et settings
- [x] Wrapper API CivitAI avec validation API key, modèles, détails, articles et tendances
- [x] Popup React avec onglets Dashboard, Modèles, Trends, Veille et Réglages
- [x] Settings avec champ API key, validation `/me`, username et fréquence de collecte
- [x] Copie des settings dans `chrome.storage.local` en plus de Dexie
- [x] Collecte manuelle avec stockage de snapshots horodatés
- [x] Service worker MV3 avec Chrome Alarms et replanification
- [x] Correction du chargement popup via entrée racine `popup.html`
- [x] Collecte rendue tolérante aux 404 CivitAI sur détails modèles et articles
- [x] Stats likes/comments/rating lues au niveau `model.stats`, downloads par version
- [x] Champ likes CivitAI corrigé : `thumbsUpCount` au lieu de `favoriteCount`
- [x] Requêtes `isOwn` sécurisées via filtrage JS (`getOwnTrackedModels`)
- [x] Snapshots multi-versions agrégés sans multiplier les métriques racine
- [x] Phase 2.1 : collecte automatique périodique + indicateur dernière collecte
- [x] Phase 2.2 : métriques complètes modèle/version, deltas, rating, buzz
- [x] Phase 2.3 : graphiques downloads/likes, période 7j/30j/90j/tout, comparaison multi-modèles
- [x] Phase 2.4 : score santé, badges calculés depuis l'historique, alerte chute
- [x] Phase 2.5 : phase de vie et recommandation contextuelle
- [x] Phase 2.6 : Version ROI, stockage `trackedModelVersions`, downloads cumulés par version
- [x] Phase 3.1 : ajout concurrent par URL CivitAI, collecte, deltas et suppression
- [x] Phase 3.2 : benchmark side-by-side modèle perso vs concurrent, position relative et graph croisé
- [x] Phase 3.3 : Trending Radar top 50 CivitAI, vélocité, filtres type/base/tag et période 24h/7j
- [x] Phase 3.4 : tags populaires, évolution entre collectes et hausse en pourcentage
- [x] Phase 3.5 : Gap Finder tags trending non couverts par le portfolio
- [x] Phase 3.6 : confort veille quotidienne, bouton `+ Suivre` injecté, recherche intégrée, badge alertes, détection page active
- [x] Phase 4.1 : onglet Articles, métriques vues/likes/commentaires et historique
- [x] Phase 4.2 : association article → modèle, score d'impact downloads sur 72 h et courbe ciblée
- [x] Phase 4.3 : meilleurs créneaux observés et heatmap publication jour × heure
- [x] Phase 4.4 : notifications Chrome seuil downloads, nouveau modèle concurrent dans une niche, recap hebdo
- [x] Phase 5.1 : dashboard stratégique avec score créateur, downloads 7j et engagement moyen
- [x] Phase 5.2 : export CSV snapshots modèles et export JSON complet
- [x] Phase 5.3 : fréquence collecte, rétention snapshots, import JSON restauration, préférence dark mode
- [x] Phase 5.5 : intelligence analytique avancée, deltas période, vélocité comparée, engagement, pics, heatmap, longévité
- [x] Phase 5.5 marché : tags par vélocité, matrice opportunité, profil du top trending et créateurs qui montent
- [x] Phase 5.7 : i18n JSON français/anglais/personnalisé, README GitHub, `.gitignore`, `prepare_github.bat`, licence MIT
- [x] Polish : lien direct vers CivitAI depuis chaque concurrent suivi
- [x] Audit 2026-06-08 P1 : support `civitai.red` configurable, `nsfw=true`, compteur d'erreurs de collecte, aide Articles, backup + confirmation avant import JSON
- [x] Audit 2026-06-08 polish : content script actif sur `civitai.red`, bouton `+ Suivre` désactivé si modèle déjà suivi, lien direct vers les articles CivitAI
- [x] Audit 2026-06-08 complet : snapshot on-demand, tris/filtres/pagination, raccourcis clavier, menu contextuel, page complète `analytics.html`, progression collecte, générations, mode clair, rapport PDF via impression, import favoris, groupement veille, notes personnelles, recommandation publication, badge remis à zéro, debounce recherche, confirmation suppression, parité i18n et profils multi-compte
- [x] Build production `dist/` validé après `npm run typecheck`, `npm run lint`, `npm run build`

🚧 En cours :
- [ ] Validation manuelle dans Chrome après rechargement de l'extension `dist/`
- [ ] Validation fonctionnelle des notifications après prochaine alarme Chrome
- [ ] Validation manuelle du bouton `+ Suivre` sur une page `https://civitai.com/models/...`
- [ ] Validation manuelle du bouton `+ Suivre` sur une page `https://civitai.red/models/...`
- [ ] Validation manuelle du changement de langue FR/EN dans Chrome après reload
- [ ] Validation manuelle de l'import JSON : téléchargement backup puis confirmation avant restauration

⏳ Prochain objectif :
- Vérifier si l'API expose le nombre de générations
- Décider si le rapport PDF mensuel automatique et le multi-compte doivent être implémentés
- Valider manuellement les nouvelles fonctionnalités audit 2026-06-08 dans Chrome : page complète, menu contextuel, import favoris, profils, impression PDF, mode clair
- Étudier la timeline de publication recommandée combinant historique perso et saturation trending
- Appliquer réellement le mode clair à l'UI si la préférence `darkMode=false` devient utile
- Ajouter des traductions complètes supplémentaires via fichiers JSON dans `src/i18n/`
```

---

## 🐛 Bugs connus / Points d'attention

> Lister ici les bugs rencontrés en cours de développement

- Popup bloquée sur "Chargement d’AnalyticsCivitAI..." si l'entrée HTML est imbriquée dans `src/popup/` avec assets relatifs complexes. Correction : utiliser `popup.html` à la racine du build et lazy-load des pages lourdes.
- CivitAI peut renvoyer 404 sur certains détails modèle ou sur l'endpoint articles. La collecte ne doit pas échouer entièrement : fallback sur la liste modèles et skip articles pour la session.
- Les métriques CivitAI ne sont pas toutes au même niveau : downloads peut être par version, mais likes/comments/rating sont agrégés dans `model.stats`. Le champ likes réel est `thumbsUpCount`, pas `favoriteCount`. Ne pas sommer ces métriques racine entre versions.
- `TrackedModel.isOwn` est un booléen ; éviter `where('isOwn').equals(1)` et utiliser `getOwnTrackedModels()`.
- La table `trackedModelVersions` est ajoutée en Dexie v2. Après mise à jour, une nouvelle collecte est nécessaire pour remplir les noms/dates de publication des versions.
- Les concurrents sont stockés dans `trackedModels` avec `isOwn: false` et collectés par `collectNow()` avec les mêmes snapshots que les modèles propres.
- Les KPIs Dashboard doivent filtrer sur `getOwnTrackedModels()` : ne pas additionner les snapshots concurrents dans le portfolio.
- Les associations article → modèle sont stockées dans `TrackedArticle.linkedModelIds` et doivent être préservées par la collecte.
- Les notifications concurrentes s'appuient sur `creatorUsername` des modèles concurrents. Les concurrents ajoutés avant ce champ peuvent nécessiter une nouvelle collecte pour remplir ce créateur.
- L'import JSON remplace les tables locales principales. Exporter une sauvegarde avant restauration si les données locales comptent.
- Le content script `src/content/civitai-inject.ts` injecte un bouton fixe `+ Suivre` sur les pages `civitai.com/models/*` et passe par `chrome.runtime.sendMessage`.
- La recherche concurrents utilise `GET /models?query=...`; si CivitAI change ou dégrade ce paramètre, prévoir fallback par tag.
- Le badge d'extension est mis à jour depuis le service worker après collecte, installation, startup et ajout via content script.
- La table `trendSnapshots` est enrichie en Dexie v4 avec `creatorUsername`, `descriptionLength`, `imageCount`, `versionCount`. Les anciens snapshots restent utilisables avec valeurs par défaut.
- Les deltas stratégiques doivent privilégier `calculateDeltaForPeriod`, `calculateVelocityComparison`, `calculateEngagementRate`, `detectDownloadSpikes` et `calculateLongevityScore` dans `utils/analytics.ts`.
- L'i18n utilise des fichiers JSON plats dans `src/i18n/` : les clés sont les textes français sources et les valeurs sont les traductions. On peut exporter le modèle depuis Réglages, le faire traduire par un LLM, puis le réimporter.
- `prepare_github.bat` génère un dossier frère `AnalyticsCivitAI-GitHub` en excluant `node_modules`, `dist`, `.git`, `.vite`, logs et fichiers locaux.

---

## 💡 Décisions d'architecture prises

> Lister ici les choix importants pour ne pas les remettre en question à chaque session

| Décision | Raison |
|----------|--------|
| Dexie.js au lieu de `chrome.storage` | `chrome.storage` est limité à 5MB et peu adapté aux séries temporelles |
| Recharts plutôt que Chart.js | Meilleure intégration React native |
| CRXJS plutôt que webpack | Setup plus simple, hot-reload en dev |
| Popup fixe (pas de page dédiée) | Moins de surface d'attaque, plus simple pour l'utilisateur |
| Articles associés manuellement aux modèles | L'API articles ne fournit pas toujours un lien fiable vers les modèles ciblés |
| Alertes concurrentes dédupliquées dans `chrome.storage.local` | Évite les notifications répétées pour le même nouveau modèle |
| Export/import JSON local | Permet restauration et analyse externe sans serveur |
| Content script limité aux pages modèle | Ajout concurrent en 1 clic sans scraper globalement CivitAI |
| Calculs analytiques centralisés dans `utils/analytics.ts` | Évite les divergences entre Dashboard, Models et service worker |
| Intelligence marché basée sur snapshots trending locaux | Pas de serveur externe, lecture décisionnelle construite sur l'historique collecté |
| I18n par JSON plat texte source → traduction | Facile à envoyer dans un LLM et à maintenir par contributeurs |
| Dossier GitHub généré par `.bat` | Évite de publier les dépendances, builds et données locales par erreur |

---

## 🚀 Commandes utiles

```bash
# Installer les dépendances
npm install

# Développement avec hot-reload
npm run dev
# → Charger l'extension dans Chrome : chrome://extensions → "Charger l'extension non empaquetée" → dossier dist/

# Build production
npm run build

# Vérifier les types TypeScript
npx tsc --noEmit
```

---

## 📌 Instructions pour démarrer une session

**Copier ce bloc en début de conversation avec l'AI :**

```
Je travaille sur AnalyticsCivitAI, une extension Chrome TypeScript + React.
Voici mon prompt système complet : [coller ce fichier]

État actuel : [copier la section "État actuel" mise à jour]

Aujourd'hui je veux : [décrire l'objectif de la session]
```

---

*prompt_system.md v1.0 — Projet AnalyticsCivitAI*
