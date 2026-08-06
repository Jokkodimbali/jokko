# Jokko Backend

Backend NestJS du projet Jokko, une marketplace de services qui relie clients, prestataires verifies et administration de plateforme autour d'un cycle complet :

- authentification
- profils utilisateurs et professionnels
- recherche geolocalisee
- reservation
- negociation
- messagerie temps reel
- live tracking
- paiement avec escrow
- notifications
- avis
- litiges
- gouvernance admin

## Vue d'ensemble

Le backend est organise par modules metier et suit une separation claire entre :

- `presentation`
- `application`
- `domain`
- `infrastructure`

Le projet utilise :

- NestJS
- TypeScript
- Prisma 7
- PostgreSQL
- Socket.IO
- Swagger

## Modules actuellement implementes

- `auth`
- `users`
- `professionals`
- `categories`
- `search`
- `negotiations`
- `reservations`
- `messaging`
- `live-tracking`
- `calls`
- `payments`
- `notifications`
- `disputes`
- `admin`
- `sante`

Modules encore hors scope backend actuel :

- upload media reel
- documents / factures
- parrainage

## Structure du projet

```text
backend/
  src/
    admin/
    auth/
    categories/
    core/
    disputes/
    live-tracking/
    messaging/
    negotiations/
    notifications/
    payments/
    prisma/
    professionals/
    reservations/
    sante/
    search/
    shared/
    users/
    app.module.ts
    main.ts
  prisma/
    schema.prisma
    migrations/
    seed.ts
  test/
    *.e2e-spec.ts
  docs/
```

## URLs locales

- API : `http://localhost:3000/api/v1`
- Swagger : `http://localhost:3000/api/docs`
- Sante : `http://localhost:3000/api/v1/sante`

## URLs production Render

- API : `https://jokko-dimbali.onrender.com/api/v1`
- Swagger : `https://jokko-dimbali.onrender.com/api/docs`
- Sante : `https://jokko-dimbali.onrender.com/api/v1/sante`

Swagger contient maintenant deux serveurs de test : local et production Render. Le guide dedie se trouve dans `docs/SWAGGER_TESTS.md`.

## Installation

```bash
cd backend
npm install
```

En PowerShell sur Windows, prefere :

```bash
npm.cmd install
```

## Variables d'environnement

Les fichiers de reference existants sont :

- `.env.example`
- `.env.local`

Variables importantes :

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` pour les appels audio/video. Les secrets restent uniquement sur le backend.
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`
- `REDIS_ENABLED`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `PAYMENT_WEBHOOK_SECRET`

Providers optionnels selon environnement :

- Resend
- Twilio
- FCM
- Wave
- Orange Money
- carte bancaire

## Demarrage en local

### Mode developpement

```bash
npm.cmd run start:dev
```

### Build

```bash
npm.cmd run build
```

### Production locale

```bash
npm.cmd run start:prod
```

## Prisma

Le projet utilise Prisma 7 avec `prisma.config.ts`.

Commandes utiles :

```bash
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
```

Point important : sur certains environnements Windows, `prisma migrate deploy` peut rencontrer un blocage `EPERM` sur le binaire Prisma. Dans ce cas, il faut traiter le point proprement selon l'environnement courant avant de considerer la migration comme appliquee.

## Tests

### Lint

```bash
npm.cmd run lint
```

### Tests unitaires

```bash
npm.cmd run test -- --runInBand
```

### Tests E2E

```bash
npm.cmd run test:e2e -- --runInBand
```

### Suites E2E disponibles

- `admin.e2e-spec.ts`
- `app.e2e-spec.ts`
- `auth.e2e-spec.ts`
- `categories.e2e-spec.ts`
- `disputes.e2e-spec.ts`
- `live-tracking.e2e-spec.ts`
- `messaging.e2e-spec.ts`
- `negotiations.e2e-spec.ts`
- `notifications.e2e-spec.ts`
- `payments.e2e-spec.ts`
- `professionals.e2e-spec.ts`
- `reservations.e2e-spec.ts`
- `search.e2e-spec.ts`
- `users.e2e-spec.ts`

## Docker

Le projet fournit :

- `Dockerfile`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `docker-compose.yml`

Commandes utiles :

```bash
npm run docker:dev
npm run docker:dev:down
npm run docker:dev:logs
npm run docker:up
npm run docker:up:d
npm run docker:down
npm run docker:logs
npm run docker:build
```

L'entrypoint Docker applique automatiquement :

```bash
prisma migrate deploy
```

sauf si `PRISMA_SKIP_MIGRATIONS=true`.

Sur Render avec Neon, il suffit de definir `DATABASE_URL`. L'entrypoint Docker et
`prisma.config.ts` detectent automatiquement le pooler Neon et derivent l'URL
directe pour les migrations. Si `DATABASE_URL` contient `-pooler.`, l'entrypoint
affiche un avertissement puis extrait l'URL directe avant d'executer
`prisma migrate deploy`. Les URLs sans SSL strict sont normalisees avec
`sslmode=verify-full` automatiquement.

## Temps reel

Trois modules temps reel existent deja :

- `messaging`
- `live-tracking`
- `calls`

Gateways exposes :

- `src/messaging/presentation/gateways/messaging.gateway.ts`
- `src/live-tracking/presentation/gateways/live-tracking.gateway.ts`
- `src/calls/presentation/calls.gateway.ts`

Swagger documente les endpoints HTTP, mais les evenements Socket.IO doivent etre verifies avec les tests E2E et un client temps reel.

## Documentation du projet

Les documents structurants du backend sont dans `backend/docs/`.

Principaux fichiers :

- `ARCHITECTURE_PROFESSIONNELLE.md`
- `APPELS_LIVEKIT_WEBRTC.md`
- `STANDARDS_MODULES_BACKEND.md`
- `TABLEAU_MESSAGES_HTTP.md`
- `POSTMAN_TESTS.md`
- `SWAGGER_TESTS.md`
- `docker-README.md`
- `cahier_des_charges_jokko.md`

## Standards du projet

Le backend impose :

- messages centralises
- DTOs valides et documentes
- faible couplage inter-modules
- architecture modulaire
- separation claire des couches
- Swagger coherent avec le runtime
- tests des flux critiques

## Surface fonctionnelle actuelle

Le backend couvre deja les flux principaux suivants :

- auth -> profil -> professionnel
- recherche -> reservation
- negotiation -> reservation
- reservation -> discussion
- reservation -> paiement -> notification
- reservation -> suivi prestataire
- reservation -> avis
- reservation/paiement -> litige -> administration

## Ce qui reste a faire cote backend

Le coeur metier principal est en place. Les prochaines briques backend naturelles sont :

- upload media reel
- documents / factures
- parrainage

## Contribution

Avant toute modification importante :

1. verifier le module cible et ses dependances
2. respecter les standards de `docs/STANDARDS_MODULES_BACKEND.md`
3. maintenir Swagger et la documentation si une convention change
4. relancer au minimum `build`, `lint` et les tests critiques du perimetre

## Resume

Ce backend n'est plus un squelette NestJS de depart. C'est deja une base metier riche, modulaire et exploitable pour une vraie application mobile de marketplace de services.
