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

## 🚦 PHASES DE DÉVELOPPEMENT

---

### ✅ PHASE 1 — Fondations & Setup
**Objectif : avoir une extension qui tourne, se connecte à l'API et stocke les premières données**

#### 1.1 Setup projet
- [x] Initialiser projet Vite + CRXJS + React + TypeScript
- [x] Configurer `manifest.json` (Manifest V3, permissions : `storage`, `alarms`, `identity`)
- [x] Configurer Tailwind CSS
- [x] Configurer Dexie.js (schéma base de données locale)
- [x] Configurer ESLint + Prettier

#### 1.2 Authentification CivitAI
- [x] Champ de saisie API Key dans les Settings (stockée dans Dexie + `chrome.storage.local`)
- [x] Validation de la clé via appel test `GET /api/v1/me`
- [x] Affichage du nom d'utilisateur connecté

#### 1.3 Wrapper API CivitAI
- [x] `GET /api/v1/models?username=...` → liste de ses modèles
- [x] `GET /api/v1/models/:id` → détail d'un modèle (stats complètes)
- [x] `GET /api/v1/articles?username=...` → liste des articles
- [x] Gestion des erreurs et rate limiting

#### 1.4 Premier snapshot de données
- [x] Schéma DB Dexie : modèles suivis, snapshots modèles, articles suivis, snapshots articles
- [x] Fonction de collecte manuelle (bouton "Rafraîchir maintenant")
- [x] Stockage du premier snapshot horodaté

#### 1.5 UI minimaliste
- [x] Popup React avec navigation par onglets
- [x] Page "Dashboard" : liste des modèles avec stats brutes
- [x] Page "Settings" : saisie API key + fréquence de collecte

**Livrable Phase 1 :** Extension installable, connectée à l'API, qui affiche tes modèles avec leurs stats actuelles.

---

### 📊 PHASE 2 — Analytics personnels (tes modèles)
**Objectif : avoir de vrais graphiques d'évolution dans le temps**

#### 2.1 Collecte automatique périodique
- [x] Chrome Alarms API : collecte automatique toutes les X heures (configurable)
- [x] Service Worker qui se réveille, collecte, stocke, se rendort (RAM ~0)
- [x] Indicateur "Dernière collecte : il y a X heures"

#### 2.2 Métriques trackées par modèle/version
- [x] Downloads (total + delta depuis dernier snapshot)
- [x] Likes / Favoris
- [x] Commentaires (nombre total)
- [x] Rating moyen
- [x] Buzz (tips) reçus
- [ ] Nombre de générations (si exposé par l'API)

#### 2.3 Graphiques d'évolution temporelle
- [x] Courbe de downloads dans le temps (par modèle)
- [x] Courbe de likes dans le temps
- [x] Sélecteur de période : 7j / 30j / 90j / tout
- [x] Comparaison multi-modèles sur le même graphique
- [x] Courbe de downloads dans le temps par version

#### 2.4 Score de santé par modèle
- [x] Indice composite calculé : `(downloads/j × 0.4) + (ratio likes/downloads × 0.3) + (comments/j × 0.3)`
- [x] Badge visuel : En croissance / Stable / En déclin
- [x] Alerte si un modèle chute brutalement (−30% downloads en 7j)

#### 2.5 Courbe de vie du modèle
- [x] Détection automatique de la phase : Lancement / Croissance / Plateau / Déclin
- [x] Recommandation contextuelle : "Ce modèle est en plateau depuis 14j — envisage une mise à jour ou un article relance"

#### 2.6 Version ROI
- [x] Comparaison des performances de chaque version d'un même modèle
- [x] Graphique : downloads cumulés v1 vs v2 vs v3 (même axe temps depuis publication)

**Livrable Phase 2 :** Dashboard analytics complet pour tes propres modèles, avec historique et courbes d'évolution.

---

### 🔍 PHASE 3 — Veille concurrence & marché
**Objectif : surveiller les autres, détecter les tendances**

#### 3.1 Suivi de modèles concurrents / inspirants
- [x] Ajout manuel d'un modèle concurrent via son URL CivitAI
- [x] Collecte automatique des mêmes métriques que pour tes propres modèles
- [x] Page "Concurrents" : tableau comparatif (tes stats vs leurs stats)
- [x] Delta : qui monte plus vite ? Qui stagne ?

#### 3.2 Benchmark comparatif
- [x] Vue side-by-side : ton modèle X vs concurrent Y
- [x] Graphique croisé downloads/j, likes/j, engagement ratio
- [x] Score de position relative (tu es à X% de son niveau)

#### 3.3 Trending Radar (modèles qui montent vite)
- [x] Collecte du top 50 CivitAI par catégorie (checkpoint, LoRA, etc.)
- [x] Calcul de la **vélocité** : ratio downloads actuels / âge du modèle
- [x] Affichage des modèles à croissance rapide dans les dernières 24h / 7j
- [x] Filtres : par type, par base model (SDXL, Flux, Pony...)

#### 3.4 Tag popularity tracker
- [x] Extraction des tags des modèles trending
- [x] Classement des tags par fréquence d'apparition dans le top trending
- [x] Évolution des tags dans le temps (quels styles montent ?)
- [x] Alerte visuelle : "Le tag 'flux-realism' est en hausse de 40% cette semaine"

#### 3.5 Gap Finder (niches non couvertes)
- [x] Croisement : tags trending × tes modèles existants
- [x] Affichage : "Ces tags sont populaires mais tu n'as rien dessus : [liste]"
- [x] Score d'opportunité par niche (popularité observée dans le top trending)

#### 3.6 Confort veille quotidienne
- [x] Ajout concurrent en 1 clic depuis CivitAI via content script `+ Suivre`
- [x] Recherche de modèles intégrée dans l'onglet Concurrents (`GET /models?query=...`)
- [x] Badge rouge sur l'icône de l'extension avec nombre d'alertes actives
- [x] Détection automatique de la page CivitAI ouverte dans la popup

**Livrable Phase 3 :** Tableau de veille complet — tu sais ce qui monte, qui cartonne, et où tu as des opportunités.

---

### 📰 PHASE 4 — Analytics Articles & Intelligence publication
**Objectif : mesurer l'impact de tes articles et optimiser le timing de publication**

#### 4.1 Suivi des articles
- [x] Liste de tes articles avec : vues, likes, commentaires, date publication
- [x] Évolution temporelle des métriques d'articles

#### 4.2 Article impact tracker
- [x] Corrélation par association article → modèle ciblé
- [x] Graphique : timeline article + courbe downloads du modèle ciblé
- [x] Score d'impact : "Cet article a généré +X downloads en 72h"

#### 4.3 Best time to publish
- [x] Analyse historique : jours/heures où tes publications ont eu le meilleur démarrage
- [x] Heatmap jour × heure avec intensité observée
- [x] Recommandation via top créneaux observés

#### 4.4 Notification & alertes
- [x] Alerte Chrome si un modèle dépasse un seuil (ex: +100 downloads en 24h)
- [x] Alerte si un concurrent publie un nouveau modèle dans ta niche
- [x] Résumé hebdomadaire (notification recap)

**Livrable Phase 4 :** Tu peux optimiser le timing et le format de chaque publication.

---

### 🧠 PHASE 5 — Intelligence & Export
**Objectif : rapports, export de données, vue stratégique globale**

#### 5.1 Dashboard stratégique global
- [x] Vue "Portfolio" : santé globale de tous tes modèles en un coup d'œil
- [x] KPIs globaux : downloads totaux/semaine, engagement moyen, tendance portfolio
- [x] Score créateur : indice global de performance sur la période

#### 5.2 Export de données
- [x] Export CSV de l'historique complet (tous modèles, toutes métriques)
- [x] Export JSON (pour réimport ou analyse externe)
- [ ] Rapport PDF mensuel automatique (optionnel)

#### 5.3 Paramètres avancés
- [x] Choix de la fréquence de collecte (1h / 6h / 12h / 24h)
- [x] Purge des anciennes données (conserver X jours)
- [x] Import de données existantes (restauration)
- [x] Mode sombre / clair (préférence stockée)

#### 5.4 Confort & polish
- [ ] Import en masse depuis les favoris CivitAI (`favorited=true`, si endpoint disponible/stable)
- [ ] Tri et filtres rapides dans les listes modèles/concurrents
- [ ] Snapshot on-demand par modèle sans collecte globale
- [x] Lien direct vers la page CivitAI depuis chaque concurrent

#### 5.5 Intelligence analytique avancée
- [x] Delta intelligent sur période : downloads/likes nets sur 7j ou période sélectionnée
- [x] Vélocité downloads/j comparée aux 7 jours précédents
- [x] Taux d'engagement likes/downloads sur Dashboard et fiche modèle
- [x] Détection de pics de downloads et affichage des derniers événements
- [x] Heatmap calendrier d'activité par modèle
- [x] Score de longévité basé sur derniers 30j vs premiers 30j
- [x] Tags triés par vélocité réelle, pas seulement fréquence brute
- [x] Matrice opportunité : popularité × croissance × engagement faible
- [x] Profil statistique du top trending : âge, base model, type, images, versions, créateurs

#### 5.6 Multi-compte (optionnel)
- [ ] Gestion de plusieurs API keys (différents comptes CivitAI)
- [ ] Bascule rapide entre comptes

#### 5.7 Publication GitHub & internationalisation
- [x] Système multilingue JSON avec français, anglais et import de langue personnalisée
- [x] Export du modèle de traduction pour passage dans un LLM
- [x] README GitHub professionnel avec badges, screenshots placeholders, guide API key et installation
- [x] `.gitignore` adapté au projet Chrome extension
- [x] `prepare_github.bat` pour générer un dossier source propre sans `node_modules`, `dist` ni données locales
- [x] Licence MIT

#### Backlog optionnel
- [ ] Notes personnelles par modèle suivi
- [ ] Regroupement de la veille concurrence par créateur CivitAI
- [ ] Timeline de publication recommandée combinant historique perso et saturation trending

**Livrable Phase 5 :** Extension complète, production-ready, avec export et gestion avancée.

---

## 📅 Estimation de durée (en sessions de dev assisté par AI)

| Phase | Sessions estimées | Complexité |
|-------|------------------|------------|
| Phase 1 — Fondations | 3–4 sessions | ⭐⭐ |
| Phase 2 — Analytics perso | 4–5 sessions | ⭐⭐⭐ |
| Phase 3 — Veille marché | 4–5 sessions | ⭐⭐⭐ |
| Phase 4 — Articles & timing | 2–3 sessions | ⭐⭐ |
| Phase 5 — Intelligence & export | 2–3 sessions | ⭐⭐ |
| **Total** | **~15–20 sessions** | |

---

## 🔗 Ressources clés

- API CivitAI : https://developer.civitai.com/docs/api/public-rest
- CRXJS (Vite + Chrome Extension) : https://crxjs.dev/vite-plugin
- Dexie.js (IndexedDB) : https://dexie.org/
- Chrome Extensions Manifest V3 : https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3

---

*Roadmap v1.0 — Projet AnalyticsCivitAI*
