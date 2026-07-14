# STARVIN — Architecture du moteur de suggestion (v0 → v2)

> Objectif : suggérer UN resto pour (utilisateur, moment, occasion), avec Google Places
> comme source principale, un coût API maîtrisé par une stratégie cache-first, et une
> boucle de données propriétaire qui permet au modèle d'apprendre des choix (globaux
> d'abord, personnalisés ensuite via le passeport culinaire).

---

## 1. Vue d'ensemble

```
┌──────────────┐   POST /suggest {lat,lng,occasion,session}   ┌─────────────────────┐
│   Client     │ ───────────────────────────────────────────▶ │  Engine API          │
│ (landing/app)│ ◀─────────────────────────────────────────── │  FastAPI @ Cloud Run │
└──────────────┘   {place, reason, suggestion_id}             └──────────┬──────────┘
       │                                                                  │
       │ POST /outcome {suggestion_id, event}                             │
       ▼                                                                  ▼
┌──────────────┐                                              ┌─────────────────────┐
│   PostHog    │  (analytics produit, funnels, replay)        │  Postgres (Supabase)│
└──────────────┘                                              │  places_cache       │
                                                              │  area_cache         │
                                              ┌───────────────│  decision_logs      │
                                              │               │  model_weights      │
                                              ▼               └──────────▲──────────┘
                                   ┌─────────────────────┐               │
                                   │ Sources externes     │    cron nightly (Cloud
                                   │ Google Places (New)  │    Scheduler) : retrain
                                   │ Open-Meteo (météo)   │    → nouveaux poids
                                   │ OSM/Overpass (fallbk)│
                                   └─────────────────────┘
```

Principe directeur : **Google ne voit jamais deux fois la même question.** Toute réponse
Google est mise en cache dans Postgres et sert tous les utilisateurs de la même zone
pendant sa durée de vie. Les appels Google deviennent un coût *par zone et par jour*,
pas *par utilisateur*.

---

## 2. Stratégie Google Places : où part l'argent, et comment le garder

### 2.1 Les trois SKU qui te concernent (Places API **New**)

| Usage | SKU | Levier d'économie |
|---|---|---|
| Trouver les restos d'une zone | **Nearby Search** | 1 appel par cellule géo + TTL 24-48h, jamais par utilisateur |
| Détails d'un resto | **Place Details** | Évité presque toujours : le Nearby avec field mask suffit au ranking |
| Photo du resto élu | **Place Photos** | 1 seule photo, uniquement pour le resto CHOISI, cachée par resto |

⚠️ Tarification à vérifier au moment de l'implémentation : Google a remplacé début 2025
le crédit mensuel de 200 $ par des **quotas gratuits par SKU et par mois** (ordre de
grandeur : ~10 000 appels/mois gratuits pour les SKU "Essentials", ~5 000 pour "Pro",
~1 000 pour "Enterprise"). Le levier n° 1 est le **field mask** : le prix d'un appel
dépend des champs demandés. Ne jamais demander un champ Enterprise (ex.
`currentOpeningHours` est Pro, les avis textuels sont Enterprise) sans nécessité.

### 2.2 Field mask recommandé (Nearby Search)

```
places.id, places.displayName, places.location, places.types,
places.rating, places.userRatingCount, places.priceLevel,
places.currentOpeningHours.openNow, places.photos
```

Ces champs suffisent pour : filtrer par occasion, scorer, afficher la Decision Card
(nom, note, volume d'avis, prix €/€€/€€€, ouvert maintenant, référence photo).
`places.photos` renvoie des *références* (gratuites dans la réponse) — la photo
elle-même n'est facturée que si tu appelles l'endpoint Photo, d'où la règle
« une seule photo, celle du resto élu ».

### 2.3 Le cache géographique (le cœur de l'économie)

Découpage du monde en cellules **geohash précision 6** (~1,2 × 0,6 km — adapté à une
recherche "à pied"). Alternative : H3 résolution 8. Une requête utilisateur à
(lat, lng) est arrondie à sa cellule + ses 8 voisines.

```sql
CREATE TABLE area_cache (
  cell        text PRIMARY KEY,          -- geohash6
  fetched_at  timestamptz NOT NULL,
  place_ids   text[] NOT NULL            -- restos de la cellule
);
-- TTL logique : 24h en zone dense, 72h en zone rurale (peu de nouveaux restos)

CREATE TABLE places_cache (
  place_id         text PRIMARY KEY,     -- stockable SANS limite (ToS Google)
  fetched_at       timestamptz NOT NULL, -- les autres champs : refresh ≤ 30 jours (ToS)
  name             text,
  lat double precision, lng double precision,
  types            text[],
  cuisine_cat      text,                 -- mapping interne : burger/italian/japan/kebab/local/world/cafe
  rating           real,
  rating_count     int,
  price_level      smallint,             -- 0-4
  open_now         boolean,              -- snapshot au fetch (affiché "à vérifier" si stale)
  photo_ref        text,
  photo_cached_url text                  -- URL de la photo déjà téléchargée (CDN/Storage)
);
```

Flux d'une suggestion :
1. `cell = geohash6(lat,lng)` → lookup `area_cache` (cellule + voisines).
2. **Hit frais** (≥ 90 % des cas en régime établi) → zéro appel Google.
3. **Miss/stale** → 1 Nearby Search (rayon 1500 m, `type=restaurant`, field mask ci-dessus),
   upsert `places_cache` + `area_cache`. Un seul appel sert ensuite toute la ville
   pendant 24-72h.
4. Scoring sur les candidats du cache → resto élu.
5. Photo : si `photo_cached_url` absent pour l'élu → 1 appel Photo (maxWidth 640),
   stockée dans Supabase Storage/GCS → plus jamais rappelée pour ce resto (< 30 j).

### 2.4 Estimation de coût (ordres de grandeur)

Hypothèse : 1 000 suggestions/jour concentrées sur ~30 villes.
- Nearby Search : ~30 cellules actives × 1 refresh/jour ≈ **900 appels/mois**.
- Place Details : ~0 (le Nearby suffit).
- Photos : ~1 nouvelle photo par *nouveau* resto élu ≈ quelques centaines/mois, décroissant.

→ Très probablement **dans les quotas gratuits** pendant toute la phase de validation.
Le coût croît avec la *couverture géographique*, pas avec le nombre d'utilisateurs :
c'est exactement la bonne pente pour une app qui se lance ville par ville.

### 2.5 Contraintes ToS Google (à respecter dès le jour 1)

- `place_id` : stockable indéfiniment. **Tout le reste : cache ≤ 30 jours** → job
  hebdo de refresh/purge des entrées > 25 jours encore actives.
- Attribution : afficher les données avec les mentions Google requises quand elles
  viennent de Places (logo/mention selon les guidelines UI).
- **Interdiction d'entraîner un modèle sur le contenu Google.** Parade structurelle
  (voir §5) : l'entraînement n'utilise que (a) tes logs de décision propriétaires et
  (b) des features dérivées non-Google (distance OSRM, contexte, catégorie cuisine
  interne). `rating` Google est utilisé au scoring *en ligne* mais loggé sous forme
  de bucket dérivé (ex. `rating_bucket: high/mid/low`) dans les features d'entraînement.

---

## 3. Contexte : les autres sources (gratuites)

- **Open-Meteo** (sans clé) : température + précipitations au moment de la requête.
  Cache 30 min par cellule. Features : `is_raining`, `temp_bucket` (froid/doux/chaud).
- **Temporel** (calculé) : `hour_bucket` (midi / après-midi / soir / nuit),
  `dow` (semaine / vendredi / week-end), `is_holiday` (calendrier FR en dur ou Nager.Date).
- **OSRM** (public, déjà intégré à la démo) : distance et durée piétonnes réelles
  vers les 5-8 meilleurs candidats seulement (pas tous) pour limiter la charge.
- **OSM/Overpass** : rétrogradé en **fallback** si Google indisponible, et en source
  d'enrichissement gratuite (tags cuisine croisés avec `types` Google).

---

## 4. Le moteur v0 : scoring transparent, instrumenté

### 4.1 Features par candidat (schéma FIGÉ dès v0 — c'est le contrat avec le futur)

```json
{
  "place_id": "...",
  "cuisine_cat": "japan",
  "dist_m": 420, "walk_min": 5,
  "rating_bayes": 4.51,          // (v·R + m·C)/(v+m), m=50, C=4.2 (prior ville)
  "rating_bucket": "high",
  "price_level": 2,
  "open_now": true,
  "occasion_match": 0.9,          // affinité cuisine_cat ↔ occasion (table interne)
  "ctx": { "hour_bucket": "soir", "dow": "weekend", "is_raining": false, "temp_bucket": "doux" }
}
```

### 4.2 Score v0

```
score = 3.0·occasion_match
      + 2.0·norm(rating_bayes)
      + 1.5·proximity          # exp(-dist_m/800) : décroissance douce
      + 0.8·open_now
      + 0.4·ctx_bonus          # ex. pluie → +ramen/pho ; soleil+soir → +terrasse-friendly
      + ε·N(0,1)               # bruit d'exploration (≈ epsilon-greedy soft)
```

Le terme de bruit est volontaire : sans exploration, tu ne collectes de la donnée que
sur les restos que l'heuristique aime déjà — le biais classique qui rend les logs
inutilisables pour apprendre. ε ≈ 0.3 en v0, à réduire quand v1 arrive.

Poids stockés en table (rechargés à chaud, pas de redéploiement) :

```sql
CREATE TABLE model_weights (
  version     int PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  weights     jsonb NOT NULL,      -- {"occasion_match":3.0, ...}
  epsilon     real NOT NULL,
  is_active   boolean DEFAULT false
);
```

### 4.3 La table qui vaut de l'or : decision_logs

**Règle absolue : on logge les candidats non choisis.** Sans eux, aucun ranker ne sera
jamais entraînable (il faut des paires choisi/écarté dans le même contexte).

```sql
CREATE TABLE decision_logs (
  suggestion_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts             timestamptz DEFAULT now(),
  session_id     text NOT NULL,
  user_id        text,                    -- null tant que pas de comptes
  cell           text NOT NULL,           -- geohash6 (position arrondie : privacy)
  occasion       text NOT NULL,           -- rapide|sortie|decouverte|local
  ctx            jsonb NOT NULL,          -- hour_bucket, dow, weather...
  candidates     jsonb NOT NULL,          -- array des features §4.1 (5 à 15 candidats)
  chosen_id      text NOT NULL,
  weights_version int NOT NULL,
  -- outcomes (mis à jour par POST /outcome) :
  seen_at        timestamptz,             -- verdict affiché
  go_clicked_at  timestamptz,             -- ★ signal principal
  abandoned      boolean,
  feedback       smallint                 -- v2 : 👍=1 / 👎=-1 post-repas
);
CREATE INDEX ON decision_logs (ts);
CREATE INDEX ON decision_logs (occasion);
```

Privacy by design : position arrondie à la cellule, pas de lat/lng exacts en log ;
`session_id` aléatoire côté client ; RGPD-compatible sans consentement lourd.

### 4.4 Contrat d'API

```
POST /suggest
  { "lat": 48.54, "lng": 7.49, "occasion": "sortie", "session_id": "s_abc" }
→ 200
  { "suggestion_id": "uuid",
    "place": { "place_id","name","cuisine_cat","rating","rating_count",
               "price_level","walk_min","dist_m","open_now","photo_url","lat","lng" },
    "reason": "A place to sit down rated 4.6★, 4 min from you." }

POST /outcome
  { "suggestion_id": "uuid", "event": "go_clicked" | "seen" | "abandoned" | "feedback", "value": 1 }
→ 204
```

Le client (landing puis app) appelle `/outcome` aux mêmes points que les événements
PostHog déjà instrumentés (`verdict_shown`, `go_clicked`). PostHog = observabilité
produit ; `decision_logs` = données d'entraînement. Les deux coexistent, rôles distincts.

---

## 5. v1 puis v2 : comment le moteur apprend

**v1 — apprentissage global (déclencheur : ~300-500 décisions avec outcome).**
Cron nightly (Cloud Scheduler → Cloud Run job) :
1. Extraire `decision_logs` → dataset pairwise (choisi vs candidats, label = go_clicked).
2. Entraîner une régression logistique (ou LightGBM si volume) sur les features §4.1
   — features dérivées uniquement, conformité ToS Google assurée par construction.
3. Écrire `model_weights` version N+1, `is_active=false`.
4. **A/B implicite** : servir N+1 sur 20 % des sessions, comparer le taux
   `go_clicked/verdict_shown` sur 7 jours, promouvoir si supérieur.
Alternative plus élégante (ton terrain : Thompson sampling) : bandit contextuel
linéaire online. Recommandation pragmatique : commencer par le batch nightly,
opérationnellement plus simple à débugger seul.

**v2 — personnalisation (déclencheur : passeport culinaire en prod).**
Le passeport devient un vecteur de features utilisateur injecté dans le même ranker :
`affinity[cuisine_cat]` (fréquences lissées des choix passés), `dist_tolerance`
(médiane des distances acceptées), `explore_rate` (part des choix "découverte"),
`feedback_avg[cuisine_cat]`. Pas de collaborative filtering avant plusieurs milliers
d'utilisateurs actifs : les features explicites font l'essentiel du travail avec
1000× moins de données.

**Métrique nord :** `acceptance_rate = go_clicked / verdict_shown` (globale, puis par
occasion, puis par version de poids). Plus tard : `feedback_rate` post-repas.

---

## 6. Infra & déploiement (volontairement minimal)

| Brique | Choix | Pourquoi |
|---|---|---|
| API | FastAPI + Uvicorn, conteneur **Cloud Run** | Ton terrain GCP, scale-to-zero, ~0 € au repos |
| DB | **Supabase Postgres** (free tier) | Cache + logs + poids au même endroit, SQL direct |
| Storage photos | Supabase Storage (ou GCS) | Photos servies par toi, plus d'appels Google |
| Cron retrain | Cloud Scheduler → Cloud Run job | Nightly, quelques minutes de compute |
| Secrets | GCP Secret Manager | Clé Google Places jamais côté client |
| Observabilité | PostHog (déjà en place) + logs Cloud Run | Suffisant à ce stade |

Sécurité de la clé Google : la clé vit UNIQUEMENT côté serveur, avec restriction
d'API (Places only) + quota journalier dur (ex. 500 appels/jour) dans la console
GCP — le plafond anti-mauvaise-surprise sur la facture.

### Ordre d'implémentation conseillé
1. Tables Supabase (§2.3, §4.3, §4.2) — 1 h.
2. FastAPI `/suggest` avec cache-first + scoring v0 + logging — le cœur, 1-2 jours.
3. `/outcome` + branchement client (mêmes points que PostHog) — 2 h.
4. Job de refresh cache 25 j + purge — 1 h.
5. Brancher la landing sur `/suggest` (remplace la logique locale de la démo) — 2-3 h.
6. (v1, plus tard) job de retrain + A/B des poids.
