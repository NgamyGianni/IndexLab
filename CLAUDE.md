# CLAUDE.md — Contexte projet Starvin

> Ce fichier est lu automatiquement par Claude Code au démarrage. Il résume les décisions,
> conventions et l'état d'avancement qui ne sont pas déductibles du code seul.

## Le produit

**Starvin** — app de décision alimentaire qui élimine la paralysie du choix en
recommandant **UN seul resto** (pas une liste). Slogan : « One craving. One tap. One spot. »
Positionnement clé : *on tranche à ta place*. Différenciateur vs Google Maps/TheFork :
commission sur l'action, pas de pub → classement neutre. Le "aha" produit : 40 options → 1.

- Fondateur : Gianni, basé près de Molsheim (Grand Est, France).
- Site live : **trystarvin.com** (déployé sur Netlify).
- Langue de l'app : **anglais** (traduit depuis le français ; l'audience initiale reste FR
  mais la page vise l'international).

## Fichiers du projet

- `starvin.html` — **fichier unique** (HTML+CSS+JS vanilla, ~1100 lignes) : landing + démo
  interactive. C'est un **prototype**, pas la prod. À terme, port prévu en Next.js +
  Tailwind v4 + HeroUI v3 + Framer Motion (web) et Expo + NativeWind (mobile).
- `STARVIN-ENGINE-ARCHITECTURE.md` — spec du moteur de suggestion (v0→v2), à implémenter
  côté backend (FastAPI/Cloud Run + Supabase). **Prochain gros chantier.**
- `CLAUDE.md` — ce fichier.

## Conventions de travail (IMPORTANT)

- **Vérifier après CHAQUE édition** : (1) syntaxe JS (`node --check` sur le `<script>` extrait),
  (2) équilibre des `<div>` (`grep -c '<div' vs '</div>'` — doit être égal, ~93/93).
  Un déséquilibre = bug d'affichage garanti (déjà arrivé plusieurs fois).
- **Media queries en dernier** dans le `<style>` : `@media (max-width:860px)` puis `560px`.
  Tout nouveau CSS de base s'insère AVANT elles, sinon il override les règles mobiles.
- **Honnêteté sur les données simulées** : ne jamais réintroduire de faux chiffres. Tout le
  social proof fictif a été purgé (voir plus bas). Ne pas afficher ce qu'on ne peut prouver.
- Ton produit : épuré, mono-orange (`--yellow` = #E89B3C), dark par défaut + light mode.
  Police Poppins. Pas de sur-formatage, pas de "AI design tells".

## Architecture de la démo (dans starvin.html)

Flux : écran "Hungry?" → géoloc → écran "What are you craving?" (4 occasions) →
écran de scan (élimination animée) → hub avec Decision Card.

- **4 occasions** : `rapide` (Quick), `sortie` (Night out), `decouverte` (Explore),
  `local` (Local). Les `data-cat` restent en français ; les labels affichés sont EN.
- **Données restos** : **Google Places (New)** en source principale via la library `places`
  du JS SDK (`Place.searchNearby`, field mask minimal, `maxResultCount:20`, rayon 1500 m),
  **cache-first** : 1 seul Nearby Search par cellule ~1,1 km (lat/lng arrondis à 2 décimales)
  et par 24h, résultat en `localStorage` → les sessions suivantes coûtent 0 appel.
  Horaires Google compactés (`periods`) → `isOpenFromPeriods()`. Photo : UNE seule, celle du
  resto élu (`googlePhotoUrl`, cachée 7 j par resto). Fallback si clé absente/appel KO :
  Overpass/OSM (4 miroirs via `Promise.any`, rayons 2000/3500 m, horaires `isOpenNow()`),
  puis restos synthétiques, puis dataset Molsheim. `openState(r)` unifie Google/OSM.
- **Météo** : Open-Meteo (gratuit, sans clé), cache 30 min par cellule en `sessionStorage`.
  `WX = {is_raining, temp_bucket}` alimente le `ctx_bonus` du moteur et les events PostHog.
- **Trajet réel** : OSRM (`router.project-osrm.org`) pour l'itinéraire piéton + durée réelle.
- **Carte** : **Google Maps JS** (loader dynamique `importLibrary`, libraries `maps`+`marker`),
  style cloud via `GMAPS_MAP_ID_DARK`/`GMAPS_MAP_ID_LIGHT`. Pins existants réutilisés via
  `AdvancedMarkerElement` (wrapper `.mm-center` pour recentrer). Polyline OSRM couleur
  `--yellow`. `fitBounds` + recadrage garanti sur `idle`. `disableDefaultUI`,
  `gestureHandling:'greedy'`, logo/attribution Google conservés.
  **Coût** : 1 map load par `new Map` → la carte est créée UNE fois par session (premier
  verdict) et réutilisée (markers déplacés). Seules exceptions : toggle de thème (Map ID non
  changeable à chaud → `syncMapTheme` recrée) et reset démo. Si Google ne charge pas
  (quota/adblock/réseau) → `renderMiniLegacy` (carte-info flèche + distance + minutes),
  le flux ne casse jamais.

## Le moteur v0 (formule complète de la spec §4.2, implémenté dans la démo)

Scoring transparent dans `pickOne()` :
`score = 3.0·occasion_match + 2.0·rating_bayes + 1.5·proximity + 0.8·open_now + 0.4·ctx_bonus + 0.35·noise`
- `occasion_match` : table `AFFINITY` cuisine↔occasion.
- `rating_bayes` : note lissée (m=50, C=4.2) — évite qu'un 5.0★/3 avis batte un 4.6★/800.
- `proximity` : `exp(-dist/800)`.
- `open_now` : via `openState()` — 1 ouvert, 0.5 inconnu (neutre, pour ne pas écraser les
  restos OSM sans horaires), fermé certain exclu du pool en amont.
- `ctx_bonus` : heure réelle (midi→rapide, soir→tables, nuit→kebab) **+ météo Open-Meteo**
  (pluie → japan/world ; froid → local/world ; chaud sec → cafe/japan), plafonné à 1.6.
- `noise` : exploration (variété + anti-biais des logs futurs).
La raison affichée (`reasonFor`) reflète le **facteur dominant** du score.
Le resto est **figé par occasion** pour la session (`sessionPicks`) : revenir sur une
occasion redonne le même resto ; changer d'occasion est permis. Reset au redémarrage démo.

## Social proof (100% réel, aucun fake)

- Volume d'avis réel affiché (« · 296 reviews »).
- Tag « 🏆 Best rated nearby » : certifié par le moteur (meilleur rating bayésien parmi
  les candidats ≤10 min). Autres tags basés sur seuils réels de note.
- Feedback 👍/👎 post-verdict → event PostHog `reco_feedback` (= future récompense du moteur).
- **Purgé définitivement** : `socialOf`, `% liked` fictif, visites inventées, `waitOf`,
  `priceOf`, `dishOf`, `hash`. Ne pas réintroduire.

## Intégrations branchées

- **Google Maps Platform** : constantes `GMAPS_API_KEY`, `GMAPS_MAP_ID_DARK`,
  `GMAPS_MAP_ID_LIGHT` en haut du script (placeholders `REMPLACE_MOI`). Tant que la clé
  n'est pas mise : données via OSM, minimap via `renderMiniLegacy` (aucune dépendance dure).
  Prérequis console GCP (Phase 0) : clé restreinte referrer `trystarvin.com` + APIs
  "Maps JavaScript API" et "Places API (New)" uniquement, **quota journalier dur** (plafond
  anti-surprise), 2 Map IDs stylés (dark/light, POI masqués).
- **Open-Meteo** : sans clé, rien à configurer.
- **Formspree** (capture emails) : form ID `mjgqjgoo`, endpoint `formspree.io/f/mjgqjgoo`.
  Fonction `signup()`. Consulter : formspree.io/forms/mjgqjgoo/submissions.
- **PostHog** (analytics, région **EU**, `eu.i.posthog.com`) : clé en clair dans le `<head>`.
  Helper `track(event, props)`. Events : `demo_started`, `location_granted/denied`,
  `vibe_selected`, `verdict_shown`, `go_clicked`, `reco_feedback`, `signup`.
  Mode `persistence:'memory'` (pas de cookie → pas de bandeau RGPD).

## Layout : système flex contraint (NE PAS casser)

La Decision Card ne doit **jamais** obliger à scroller. Solution durable en place :
`.hub` (overflow:hidden) → `.choice` (flex column, flex:1) → zones avec poids de compression
(photo flex:2, minimap flex:3 = élastique principal, textes flex:0). Bouton « Let's go »
ancré en bas (`margin-top:auto`), toujours visible. Quand l'espace manque, tout se comprime
proportionnellement. **Ne pas revenir à des hauteurs fixes** (source des débordements passés).
Cadre téléphone = ratio iPhone 17 (402/874) + Dynamic Island flottant.

## État d'avancement / TODO

Fait : landing EN, démo complète, moteur v0 complet (open_now + météo), Google Places
cache-first côté client, carte Google Maps (Map IDs cloud, 1 map load/session, fallback
carte-info), Open-Meteo, Formspree, PostHog, feedback 👍/👎, layout sans scroll, social
proof réel, dédup chaînes au plus proche.

Reste (par priorité) :
0. **Phase 0 GCP** : créer la clé restreinte + les 2 Map IDs stylés, remplacer les 3
   placeholders `REMPLACE_MOI` en haut du script de `starvin.html`.
1. **Backend moteur v0** (le gros morceau) : FastAPI/Cloud Run + Supabase selon
   `STARVIN-ENGINE-ARCHITECTURE.md` — la clé passe alors côté serveur, cache geohash6
   partagé entre TOUS les utilisateurs (le cache localStorage actuel n'est que par
   navigateur), table `decision_logs` = l'actif à construire tôt
   (logger les candidats NON choisis, sinon inentraînable).
2. `og:image` (URL absolue) + `og:locale` à passer en `en_*`.
3. SEO technique (canonical, sitemap, robots.txt, JSON-LD) — mais canal d'acquisition
   réel = Reddit / groupes locaux / Product Hunt, PAS le SEO à ce stade.
4. Lien "Feedback/Contact" ouvert (via Formspree) — évoqué, pas encore fait.
5. Vérifier les URLs photos Unsplash (certaines cuisines pourraient ne pas charger).

## Pièges connus

- Certaines features (fetch Formspree/PostHog, géoloc, Google Maps/Places) **ne marchent
  qu'en HTTPS déployé**, pas en `file://` ni dans un aperçu iframe (la clé est restreinte
  par referrer). Toujours tester sur trystarvin.com.
- Beaucoup de restos OSM n'ont pas d'horaires → restent proposables (on ne peut pas vider
  le pool) ; réglé quand la clé Google est configurée (horaires Places).
- Placeholder-driven : `signup()`, `track()`, carte Google et Places ne font rien tant que
  les clés ne sont pas mises — la démo reste 100 % fonctionnelle en mode gratuit (OSM).
- ToS Google : le cache localStorage des Places a un TTL 24h (< 30 j requis) ; ne jamais
  entraîner un modèle sur le contenu Google (les events PostHog ne loggent que des features
  dérivées : météo, occasion, walk).
