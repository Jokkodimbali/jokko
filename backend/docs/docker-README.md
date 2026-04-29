# Jokko Backend - Guide Docker

## 1. Objet
Ce document decrit la facon reelle de lancer, construire et exploiter le backend Jokko avec Docker dans ce repository.

Il couvre les fichiers suivants :

- `Dockerfile`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `docker-compose.yml`
- `scripts/docker/entrypoint.sh`

## 2. Vue d'ensemble des modes Docker

### 2.1 Developpement
Le fichier `docker-compose.dev.yml` lance :

- `backend`
- `postgres` avec image `postgis/postgis:16-3.4-alpine`
- `redis` avec mot de passe

Ce mode est pense pour un travail local complet avec base relationnelle et capacites geospatiales.

### 2.2 Production complete
Le fichier `docker-compose.prod.yml` lance :

- `backend`
- `postgres`
- `redis`

Ce mode vise une stack embarquee complete en conteneurs.

### 2.3 Production legere
Le fichier `docker-compose.yml` lance :

- `backend`
- `redis`

Dans ce mode, la base PostgreSQL est attendue en externe via `DATABASE_URL`.

## 3. Fichiers et comportements reels

### 3.1 Dockerfile
Le `Dockerfile` actuel est multi-stage :

1. `base`
2. `deps`
3. `build`
4. `production-deps`
5. `runner`

Il :

- installe `openssl` et `ca-certificates`
- copie `package*.json`, `prisma.config.ts` et `prisma/`
- execute `npm ci`
- genere Prisma
- build `dist/`
- cree une image runtime `node:22-bookworm-slim`
- expose le port `3000`
- lance `scripts/docker/entrypoint.sh`

### 3.2 Entrypoint runtime
Le script `scripts/docker/entrypoint.sh` applique les migrations Prisma au demarrage tant que `PRISMA_SKIP_MIGRATIONS` n'est pas positionne a `true`.

Concretement :

```sh
npx prisma migrate deploy
```

Puis il lance la commande finale du conteneur.

### 3.3 Healthcheck
Les stacks Docker verifient la sante de l'API via :

`GET /api/v1/sante`

Exemple de verification locale :

```bash
curl http://localhost:3000/api/v1/sante
```

## 4. Commandes a utiliser

## 4.1 Developpement

```bash
cd backend
npm run docker:dev
```

Arret :

```bash
npm run docker:dev:down
```

Logs :

```bash
npm run docker:dev:logs
```

## 4.2 Production complete

```bash
cd backend
npm run docker:up
```

Ou en arriere-plan :

```bash
npm run docker:up:d
```

Arret :

```bash
npm run docker:down
```

Logs :

```bash
npm run docker:logs
```

## 4.3 Build image seule

```bash
cd backend
npm run docker:build
```

## 5. Variables d'environnement utiles

### 5.1 Fichier de production
Le fichier de reference est `backend/.env.example`.

Variables critiques :

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- `REDIS_ENABLED`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `CORS_ORIGINS`

Variables providers optionnelles mais importantes selon l'environnement :

- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `WAVE_API_BASE_URL`
- `WAVE_API_KEY`
- `ORANGE_MONEY_API_BASE_URL`
- `ORANGE_MONEY_API_KEY`
- `CARD_PAYMENT_API_BASE_URL`
- `CARD_PAYMENT_API_KEY`
- `FCM_PROJECT_ID`
- `FCM_PRIVATE_KEY`
- `FCM_CLIENT_EMAIL`
- `SENTRY_DSN`

### 5.2 Fichier local
Le developpement Docker lit `backend/.env.local`.

Il configure notamment :

- `NODE_ENV=development`
- `PORT=3000`
- `DATABASE_URL=postgresql://jokko:jokko@postgres:5432/jokko?schema=public`
- `REDIS_ENABLED=true`
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD=jokkoredis`

## 6. Architecture Docker actuelle

### 6.1 Stack developpement

```text
backend:3000
postgres:5432
redis:6379
```

Caracteristiques :

- montage `./src:/app/src:ro`
- port debug `9229`
- dependances sur `postgres` et `redis`
- healthchecks actifs

### 6.2 Stack production complete

```text
backend:3000
postgres:5432
redis:6379
```

Caracteristiques :

- volume `backend-logs`
- contraintes `deploy.resources`
- Redis en mode appendonly
- restart `on-failure`

### 6.3 Stack production legere

```text
backend:3000
redis:6379
postgres externe via DATABASE_URL
```

Ce mode est utile si PostgreSQL est heberge hors Docker, par exemple sur RDS.

## 7. Prisma 7 et migrations
Le projet utilise Prisma 7 avec `prisma.config.ts`.

Point important :

- la datasource est configuree via `DATABASE_URL`
- le schema est `prisma/schema.prisma`
- les migrations sont dans `prisma/migrations`

Commandes utiles hors Docker :

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

Si vous lancez le backend en conteneur, l'entrypoint execute deja `prisma migrate deploy` sauf si `PRISMA_SKIP_MIGRATIONS=true`.

## 8. Verification rapide de la stack

### 8.1 API

```bash
curl http://localhost:3000/api/v1/sante
```

### 8.2 Conteneurs

```bash
docker compose -f docker-compose.dev.yml ps
```

### 8.3 Logs backend

```bash
docker logs jokko-backend-dev
```

### 8.4 PostgreSQL local

```bash
docker exec -it jokko-postgres-dev psql -U jokko -d jokko -c "SELECT 1"
```

### 8.5 Redis local

```bash
docker exec -it jokko-redis-dev redis-cli -a jokkoredis ping
```

## 9. Bonnes pratiques recommandees

- ne jamais committer un vrai `.env`
- changer tous les secrets de `.env.example` avant un usage reel
- utiliser la stack legere seulement si `DATABASE_URL` pointe vers une base fiable
- garder `REDIS_ENABLED=true` en environnement ou temps reel et throttling doivent etre testes proprement
- verifier `CORS_ORIGINS` avant exposition publique
- brancher monitoring et logs avant une vraie mise en production

## 10. Limitations actuelles a connaitre
Ce repository fournit une bonne base Docker backend, mais cela ne remplace pas a lui seul une readiness complete AWS.

Il reste a traiter selon l'environnement cible :

- secrets manager
- reverse proxy HTTPS
- observabilite centralisee
- sauvegardes managées
- politique IAM et reseau prive
- workers separes si des traitements async sont externalises plus tard

## 11. Resume operationnel
Pour un developpeur backend qui veut aller vite :

1. se placer dans `backend/`
2. verifier `.env.local`
3. lancer `npm run docker:dev`
4. attendre le healthcheck
5. ouvrir `http://localhost:3000/api/docs`

Pour une stack de preproduction ou production embarquee :

1. creer `.env`
2. renseigner `DATABASE_URL` et les secrets
3. lancer `npm run docker:up:d`
4. verifier `/api/v1/sante`

Ce document doit rester aligne avec le `Dockerfile`, les fichiers `docker-compose*.yml` et l'entrypoint Docker du repository.
