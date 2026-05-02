# CyStadium

Système de réservation de billets pour la **Coupe du Monde FIFA 2026** — gestion multi-stades, multi-matchs, allocation de sièges en temps réel.

**Stack :** Scala 2.13 + Akka Actors + Akka HTTP + Slick + Next.js 14 + PostgreSQL (Supabase).

Modélisation et vérification formelle via réseaux de Petri (reachabilité, bornitude, absence de deadlock, invariants LTL).

## Contexte

CyStadium gère la billetterie pour l'ensemble des stades de la Coupe du Monde FIFA 2026. Chaque match se déroule dans un stade spécifique, avec ses zones (VIP, Or, Standard, Populaire) et ses sièges individuels. Le système garantit l'atomicité des réservations multi-sièges, l'absence de surbooking, et la cohérence des statuts en temps réel via WebSocket.

## Architecture

```
src/main/scala/cystadium/
├── actors/          # Akka actors
│   ├── SeatActor         # Un acteur par siège — exclusivité par mailbox
│   ├── ZoneManager       # Agrège les sièges d'une zone (VIP/Or/Standard/Populaire)
│   ├── MatchManager      # Gère un match dans un stade donné
│   ├── SeatAllocator     # Réservation atomique multi-sièges (2-phase commit)
│   ├── ReservationHandler# Orchestration réservation + persistance DB
│   ├── PaymentGateway    # Simulation paiement (80% succès / 10% échec / 10% timeout)
│   ├── SessionManager    # Authentification et sessions client
│   └── Supervisor        # Hiérarchie de supervision
├── api/             # Akka HTTP routes + WebSocket handlers
├── db/              # Slick tables + repositories
├── json/            # circe codecs (snake_case)
├── petri/           # Réseau de Petri — modèle, analyseur, propriétés LTL
│   ├── PetriNet.scala          # Place, Transition, Arc, Marking, CyStadiumPetriModel
│   ├── PetriNetAnalyzer.scala  # Graphe d'atteignabilité, bornitude, deadlock, vivacité
│   └── LTLProperties.scala     # S1-S4, V1-V3 (no double réservation, seat status, etc.)
├── protocol/        # Messages partagés entre équipes (contrat figé)
└── ...

frontend/            # Next.js 14 — SeatMap, ZoneSelector, ReservationCart, PaymentForm, LiveStatus
docs/                # Missions, rapports, guides Petri
```

## Commandes utiles

### Backend Scala

```bash
# Compiler
sbt compile

# Compiler propre
sbt clean compile

# Exécuter tous les tests
sbt test

# Exécuter un test spécifique
sbt "testOnly cystadium.petri.PetriNetAnalyzerSpec"

# Exécuter les tests Petri uniquement
sbt "testOnly *PetriNet*"

# Lancer l'application
sbt run

# Console interactive (REPL)
sbt console

# Générer les types TypeScript depuis le schema DB
sbt generateTypes
```

### Frontend Next.js

```bash
cd frontend

# Installer les dépendances
npm install

# Lancer en mode dev
npm run dev

# Build production
npm run build

# Lancer en production
npm run start

# Linter
npm run lint
```

### Base de données (Supabase / PostgreSQL)

```bash
# Les migrations sont dans src/main/resources/db/migration/
# V1__init.sql → V5__matches_extra_fields.sql
```

### Réseau de Petri

Le modèle Petri est dans `src/main/scala/cystadium/petri/` :

| Fichier | Description |
|---------|-------------|
| `PetriNet.scala` | Types de base + `CyStadiumPetriModel.build()` (3 sièges, 2 clients) |
| `PetriNetAnalyzer.scala` | Graphe d'atteignabilité, bornitude, deadlock, vivacité |
| `LTLProperties.scala` | Propriétés S1–S4, V1–V3 |

```bash
# Analyser le modèle CyStadium via les tests
sbt "testOnly cystadium.petri.PetriNetAnalyzerSpec"

# Voir les résultats d'analyse (reachable states, bounded, deadlock-free, invariants, LTL)
# → Les assertions du test "analyze the CyStadium model" affichent le rapport complet
```

### Propriétés vérifiées

| Propriété | Type | Description |
|-----------|------|-------------|
| **S1** | Invariant | Pas de double réservation d'un même siège |
| **S2** | Invariant | Un siège a exactement un statut à tout instant |
| **S3** | Invariant | Siège confirmé ⇒ paiement réussi |
| **S4** | LTL | Paiement échoué ⇒ siège finalement libéré |
| **V1/V2** | LTL | Chaque état d'attente de paiement est finalement résolu |
| **V3** | LTL | Pas de deadlock inattendu |

### Scénarios de test (S1–S8)

| # | Scénario |
|---|----------|
| S1 | 1 client réserve + paie |
| S2 | Paiement refusé → rollback |
| S3 | Timeout 10 min → libération |
| S4 | 2 clients → même siège simultané (race) |
| S5 | 2 clients → sièges différents |
| S6 | 1 client → 3 sièges (tout-ou-rien) |
| S7 | Crash ZoneManager → restauration |
| S8 | 3 clients, 2 sièges dispo (anti-surbooking) |

### Documentation

| Fichier | Description |
|---------|-------------|
| `docs/MISSIONS.md` | Contrats d'intégration, missions par équipe, scénarios S1–S8 |
| `docs/RAPPORT_ANALYSE.md` | Rapport d'analyse ultra-détaillé du projet |
| `docs/petri/guide-reseau-petri.md` | Guide complet pour dessiner/comprendre le réseau de Petri |
| `docs/petri/reseau-petri.html` | Diagramme SVG du réseau de Petri |
| `sujet.pdf` | Sujet du projet — Coupe du Monde FIFA 2026 |

## Équipe

Adam · Fatima · Abdel · Eléonore · Inès

## Deadline

2026-05-17
