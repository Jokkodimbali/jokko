# Jokko Backend - Docker

## Table des Matières

1. [Prérequis](#prérequis)
2. [Configuration Rapide](#configuration-rapide)
3. [Architecture des Services](#architecture-des-services)
4. [Commandes Docker](#commandes-docker)
5. [Variables d'Environnement](#variables-denvironnement)
6. [Développement Local](#développement-local)
7. [Production](#production)
8. [Dépannage](#dépannage)

---

## Prérequis

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Node.js** >= 20 (pour développement local)

### Services Requis

| Service | Version | Purpose |
|---------|---------|---------|
| PostgreSQL | 16 + PostGIS | Base de données avec géométrie |
| Redis | 7-alpine | Cache et sessions |

---

## Configuration Rapide

### Démarrage Rapide - Développement

```bash
cd backend
npm run docker:dev
```

L'API sera disponible sur `http://localhost:3000`

### Démarrage Rapide - Production

```bash
cd backend
cp .env.example .env
# Éditer .env avec vos valeurs
npm run docker:up:d
```

---

## Architecture des Services

### Développement (docker-compose.dev.yml)

```
┌─────────────────────────────────────────────────────────────┐
│                     jokko-network-dev                       │
├─────────────────┬─────────────────┬───────────────────────┤
│   Backend       │   PostgreSQL     │       Redis            │
│   :3000         │   :5432          │       :6379           │
│   (NestJS)      │   (PostGIS)      │       (Cache)          │
└─────────────────┴─────────────────┴───────────────────────┘
```

### Production (docker-compose.yml / docker-compose.prod.yml)

```
┌─────────────────────────────────────────────────────────────┐
│                       jokko-network                         │
├─────────────────┬─────────────────┬───────────────────────┤
│   Backend       │   PostgreSQL     │       Redis            │
│   :3000         │   :5432          │       :6379           │
│   (NestJS)      │   (PostGIS)      │       (AOF persist)   │
└─────────────────┴─────────────────┴───────────────────────┘
```

---

## Commandes Docker

### Développement

| Commande | Description |
|---------|-------------|
| `npm run docker:dev` | Démarrer en mode développement |
| `npm run docker:dev:logs` | Voir les logs en temps réel |
| `npm run docker:dev:down` | Arrêter les services |

### Production

| Commande | Description |
|---------|-------------|
| `npm run docker:up` | Démarrer les services |
| `npm run docker:up:d` | Démarrer en arrière-plan |
| `npm run docker:down` | Arrêter les services |
| `npm run docker:logs` | Voir les logs |
| `npm run docker:build` | Construire l'image |

### Commandes Directes Docker Compose

```bash
# Voir le statut des conteneurs
docker compose -f docker-compose.dev.yml ps

# Redémarrer un service
docker compose -f docker-compose.dev.yml restart backend

# Accéder au conteneur
docker exec -it jokko-backend-dev sh

# voir les logs d'un service spécifique
docker compose -f docker-compose.dev.yml logs -f backend
```

---

## Variables d'Environnement

### Variables Requises en Production

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | Connection PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | (fort) |
| `REDIS_PASSWORD` | Mot de passe Redis | (fort) |
| `JWT_ACCESS_SECRET` | Clé JWT access (32+ chars) | (générer) |
| `JWT_REFRESH_SECRET` | Clé JWT refresh (32+ chars) | (générer) |
| `CORS_ORIGINS` | Origins autorisés (virgule) | `https://jokko.app` |
| `REDIS_ENABLED` | Activer Redis | `true` |

### Variables Optionnelles

```bash
# Rate Limiting
THROTTLE_SHORT_TTL=1000
THROTTLE_SHORT_LIMIT=10
THROTTLE_MEDIUM_TTL=60000
THROTTLE_MEDIUM_LIMIT=60

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_LOG_LEVEL=notice

# Monitoring
SENTRY_DSN=
```

### Variables de Développement (.env.local)

Le fichier `.env.local` est préconfiguré avec :
- PostgreSQL: `jokko:jokko@postgres:5432/jokko`
- Redis: `redis:6379` avec password `jokkoredis`

---

## Développement Local

### Structure du Projet

```
backend/
├── src/                    # Code source
├── prisma/                 # Schéma et migrations
├── scripts/docker/        # Scripts Docker
├── docker-compose.dev.yml # Configuration dev
├── docker-compose.yml     # Configuration production légère
└── docker-compose.prod.yml# Configuration production complète
```

### Fonctionnalités en Développement

- **Hot Reload**: Le code source est mounté en lecture seule
- **Debug**: Port 9229 disponible pour Node.js debugging
- **Logs**: Volumes persistants pour les logs

### Commandes Utiles

```bash
# Vérifier la santé de l'API
curl http://localhost:3000/api/v1/sante

# Vérifier PostgreSQL
docker exec jokko-postgres-dev psql -U jokko -d jokko -c "SELECT 1"

# Vérifier Redis
docker exec jokko-redis-dev redis-cli -a jokkoredis ping
```

---

## Production

### Meilleures Pratiques

1. **Sécurité**
   - Modifier tous les mots de passe par défaut
   - Utiliser des variables d'environnement sécurisées
   - Activer HTTPS via reverse proxy (nginx, traefik)

2. **Performance**
   - Limites de ressources configurées (CPU/RAM)
   - Redis avec AOF persistant
   - PostgreSQL avec volumes persistants

3. **Monitoring**
   - Healthcheck sur `/api/v1/sante`
   - Intégration Sentry possible
   - Logs stockés dans volumes Docker

### Déploiement avec Docker Swarm

```yaml
# docker-compose.prod.yml utilise deploy.resources
# Compatible avec Docker Swarm et Kubernetes
```

---

## Dépannage

### Erreurs Courantes

#### "extension postgis is not available"

**Cause**: Image PostgreSQL sans PostGIS  
**Solution**: Utiliser `postgis/postgis:16-3.4-alpine`

#### "Failed to connect to database"

**Cause**: PostgreSQL pas encore prêt  
**Solution**: Le `depends_on` avec `condition: service_healthy` gère cela automatiquement

#### "Permission denied" sur les volumes

**Cause**: Problème de permissions Linux  
**Solution**:
```bash
sudo chown -R $(id -u):$(id -g) ./volumes
```

#### "Connection refused" Redis

**Cause**: Redis pas prêt  
**Solution**: Vérifier `REDIS_ENABLED=true` et `REDIS_HOST=redis`

### Logs de Debug

```bash
# Logs NestJS
docker logs jokko-backend-dev

# Logs PostgreSQL
docker logs jokko-postgres-dev

# Logs Redis
docker logs jokko-redis-dev
```

### Recréer les Volumes

```bash
# Attention: perd toutes les données
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
```

---

## Références

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose)
- [PostgreSQL/PostGIS](https://postgis.net/documentation)