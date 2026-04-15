# Architecture Backend Professionnelle - Reference Complete

## 1. But du document
Ce document definit l'architecture cible du backend Jokko et sert de reference unique pour:
- le design technique
- les choix d'implementation
- les standards de qualite
- la robustesse production
- la scalabilite

Ce document doit rester vivant: toute decision structurante doit etre tracee ici.



## 1.1 Metriques Qualite Obligatoires
- Coverage tests: >85% branches.
- Pas de `any` autorise.
- Build/lint strict zero warning.
- E2E sur tous endpoints critiques.
- Perf P95 <300ms hors jobs lourds.

## 1.2 Diagrammes Architecture

### Couches Clean Architecture (dependances →)
```
Domaine ← Ports ← Application ← Controllers
 ↑ Impl            ↑ Ports Impl  ↑ DTO/Guards
Infra Prisma      Services      HTTP/WebSocket
```

### Flux Dependencies Modules (NestJS)
```
AppModule
├── Core (Global)
├── Prisma
├── Auth → Core/Prisma
├── Users → Auth/Prisma/Core
└── Future: Bookings → Users/Payments/etc.
```

## 1.1 Navigation documentaire (source unique)

- `ARCHITECTURE_PROFESSIONNELLE.md`:
  - vision globale
  - choix d'architecture
  - standards de qualite
  - matrice endpoints
  - contraintes par endpoint
  - definition of done endpoint
  - roadmap technique
- `TABLEAU_MESSAGES_HTTP.md`:
  - messages d'erreur/succes centralises
  - codes metier associes
- `TRELLO_BACKEND_COMPLET.csv` + `TRELLO_WORKFLOW.md`:
  - ordonnancement et suivi des taches

Regle: aucun nouveau document d'architecture ne doit contredire ce fichier.

## 2. Principes directeurs

### 2.1 Principes d'architecture
- DDD pragmatique par modules metier (bounded contexts).
- Clean Architecture: la logique metier est protegee des details techniques.
- Event-driven pour decoupler les effets secondaires.
- API stateless pour faciliter le scaling horizontal.

### 2.2 Principes de code
- SOLID:
  - SRP: une classe = une responsabilite.
  - DIP: application depend de ports, pas d'implementations infra.
- DRY: centraliser les regles transverses (messages, erreurs, validation).
- KISS: flux explicites, peu de magie, code lisible.
- Clean Code: noms metier, petits services, conventions stables.

### 2.3 Principes produit
- Priorite aux flux critiques: Auth -> Booking -> Escrow -> Wallet.
- Integrite des donnees avant la vitesse de livraison.
- Securite by design (pas en "patch final").

## 3. Vue d'ensemble

### 3.1 Stack
- API: NestJS (Node.js)
- ORM: Prisma
- DB: PostgreSQL + PostGIS
- Temps reel: WebSocket (Socket.IO)
- Notifications: FCM (cible)
- Paiements: provider local via webhooks (cible)



### 3.2 Arborescence Complete (extrait src/)
```
src/
├── app.module.ts           # Wiring global
├── main.ts                # Bootstrap prod-ready
├── core/                  # Global shared (env, events, audit)
│   ├── config/env.validation.ts
│   ├── events/outbox-event-bus.service.ts
│   └── audit/audit-logger.middleware.ts
├── prisma/prisma.service.ts # DB Client singleton
├── auth/
│   ├── domain/entities/auth-user.entity.ts
│   ├── application/ports/auth-repository.port.ts
│   ├── infrastructure/repositories/auth.repository.ts (Prisma)
│   └── presentation/controllers/auth.controller.ts
├── users/
│   ├── domain/value-objects/address.vo.ts
│   ├── application/services/users.service.ts
│   └── infrastructure/repositories/users.repository.ts
└── sante/                 # Health template
```

**Explication Arborescence**:
Chaque module suit Clean Arch. Exemple Auth:
- `domain`: Pure business (entities, VO comme PasswordVO).
- `application`: Orchestre ports (AuthService → AuthRepositoryPort).
- `infrastructure`: Impl Prisma (AuthRepository implements port).
- `presentation`: HTTP entry (Controller valide DTO → service).

### 3.2 Modules actuellement implémentés

| Module | Fichiers | Statut | Tests |
|--------|---------|--------|-------|
| `core` | Global | ✅ Config, audit, events, validation env | ✅ |
| `prisma` | Singleton DB | ✅ Client Prisma | ✅ |
| `auth` | 33 fichiers | ✅ OTP, register, login, refresh, Google OAuth, guards | ✅ unit + E2E |
| `users` | 16 fichiers | ✅ Profile, avatar, history, anonymisation | ✅ unit + E2E |
| `professionals` | 37 fichiers | ✅ Profil, KYC, services, portfolio, availabilités, reviews | ✅ unit + E2E |
| `categories` | 21 fichiers | ✅ CRUD admin + public, DDD complet, événements domaine | ✅ unit + E2E |
| `sante` | Template | ✅ Health check | ✅ |

### 3.3 Modules métier à implémenter
- `services` (si séparé de professionals)
- `search` (recherche géolocalisée PostGIS)
- `bookings` (réservations + FSM statut)
- `payments` (Wave/OM + webhooks + idempotence)
- `wallet` (ledger immutable)
- `chat` (Socket.IO temps réel)
- `tracking` (GPS live)
- `notifications` (FCM push)
- `admin` (back-office complet)
- `reviews` (avis/notes si séparé)

## 4. Architecture logique par couches


Chaque module metier suit ce pattern (exemple concret AuthModule):

```typescript
// auth/auth.module.ts (extrait)
@Module({
  imports: [PrismaModule, JwtModule.registerAsync({...})],
  controllers: [AuthController],
  providers: [
    AuthService, // Application layer
    AuthRepository, // Infrastructure impl port
    { provide: AUTH_REPOSITORY_PORT, useExisting: AuthRepository }, // Binding!
    JwtAuthGuard,
    PhoneNumberValidator,
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
```

**Explication Bindings DI**:
- Ports abstraits injectes en application.
- Infra impl bindee via `useExisting`.
- Decouplage total: changer Prisma → nouveau repo sans toucher services.

### 4.1 Domain Layer (Pure Business)
**Responsabilites**:
- Entites immuables (UserEntity).
- Value Objects (PhoneNumberVO validates/normalizes).
- Domain Errors (UserDomainError).
- Ports (contrats: `findByPhone(AuthRepositoryPort)`).

**Exemple VO** (users/domain/value-objects/address.vo.ts):
```typescript
export class AddressVO {
  private readonly value: string;
  constructor(value: string) {
    if (!this.isValid(value)) throw new DomainError('Invalid address');
    this.value = value;
  }
  private isValid(v: string): boolean { /* rules */ }
}
```
**Paragraphe**: Domain ignore frameworks/DB. Regles immuables, testable unit. VO encapsule validation.

### 4.2 Application Layer
**Orchestre use cases**:
- Services: `AuthService` coordonne `AuthRepositoryPort`, `PasswordHashService`.
- Commands/DTOs mappes depuis presentation.

**Exemple Port** (auth/application/ports/auth-repository.port.ts):
```typescript
export interface AuthRepositoryPort {
  findByPhone(phone: PhoneNumberVO): Promise<AuthUserEntity | null>;
  save(user: UserEntity): Promise<void>;
}
```

### 4.3 Infrastructure Layer
**Impl ports concrets**:
- Prisma repos: `AuthRepository implements AuthRepositoryPort`.
- Transactionnelle, migrable.

### 4.4 Presentation Layer
**HTTP/WS facade**:
- DTO validation (class-validator).
- Guards (JwtAuthGuard, RolesGuard).
- Mapping → application services.


### 4.1 Presentation
Responsabilites:
- Controllers HTTP/WS
- Mapping DTO <-> commandes application
- Auth guard, validation d'entree

Interdit:
- logique metier complexe
- acces DB direct

### 4.2 Application
Responsabilites:
- orchestration des cas d'usage
- coordination des ports
- publication d'evenements metier

Interdit:
- connaissance Prisma/SQL
- dependance a des details infra

### 4.3 Domaine
Responsabilites:
- vocabulaire metier
- ports (contrats)
- regles metier et evenements de domaine

Interdit:
- dependance framework
- details techniques

### 4.4 Infrastructure
Responsabilites:
- implementation des ports (Prisma, providers, broker)
- persistance
- integration technique externe

## 5. Regles de dependance (obligatoires)

- `presentation` -> `application`
- `application` -> `domaine` + `core` (abstractions transverses)
- `infrastructure` -> `domaine` + `application` (ports)
- `domaine` -> aucune couche externe

Consequence:
- aucune importation `presentation/*` dans `application/*`
- aucune importation `infrastructure/*` dans `application/*` (sauf via port)

## 6. Noyau transversal (`core`)



## 4.5 Prisma Module Deep Dive
**Singleton DB** (`prisma/prisma.service.ts`):
- Client Prisma injecte partout via DI.
- Migrations/seed via `prisma migrate`.
- PostGIS extensions pour geo queries.

**Schema Highlights** (prisma/schema.prisma):
| Entity | Key Fields | Relations | Purpose |
|--------|------------|-----------|---------|
| User | phone (unique), role enum | 1:N Reservations | Core identity |
| ProfilProfessionnel | kyc_status enum, location geography(Point) | 1:N Services | Pro details + geo |
| Reservation | statut enum (EN_ATTENTE→TERMINEE) | N:1 Paiement | Booking FSM |
| Paiement | provider_ref unique, statut enum | 1:1 Reservation | Escrow secure |
| OutboxEvents | payload JSON, status enum | None | Reliable messaging |
| AuditLogs | action_type enum, ip_address | None | Compliance trace |

**Index Critiques**: phone/email unique, GIST on location, composite status+created_at.

## 5. Core Module Exhaustif

### 5.1 Global Config (core/core.module.ts)
Validation stricte boot:
```typescript
ConfigModule.forRoot({ validate: validerEnv }); // Fail fast if DB_URL invalid
```
**Vars Env Critiques**:
- `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS`.

### 5.2 Throttling Multi-Tiers
```typescript
ThrottlerModule.forRootAsync({
  // short: 10 req/s, medium: 60/min, long: 200/10min
});
```
Anti-DDoS + SMS abuse prevention.

### 5.3 Domain Event Bus
- Port: `DOMAINE_EVENT_BUS`.
- Current: Nest EventEmitter.
- Impl: `OutboxEventBusService` (pops from outbox table).

### 6.1 Configuration

- Validation stricte au boot (`env.validation.ts`)
- Echec immediate si variable critique invalide

### 6.2 Gestion d'erreurs
- Format uniforme via `ApiExceptionFilter`
- Catalogue central des messages/erreurs HTTP:
  - `src/core/http/message-catalog.ts`
  - `src/core/http/app-http.exception.ts`

### 6.3 Validation
- `ValidationPipe` global
- Messages de validation en francais
- Factory d'erreur centralisee


## 6. Patterns HTTP/Validation/Guards (main.ts)

**Bootstrap Exhaustif** (main.ts):
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true, forbidNonWhitelisted: true,
  exceptionFactory: buildValidationException, // Custom FR errors
}));
app.useGlobalFilters(new ApiExceptionFilter()); // Uniform JSON errors
app.setGlobalPrefix('api/v1');
app.use(helmet()); app.enableCors({...});
```

**Guards**:
- JwtAuthGuard (security/jwt-auth.guard.ts): @UseGuards(JwtAuthGuard).
- RolesGuard (shared/guards/roles.guard.ts): @Roles('ADMIN').

**Reponses Uniformes** (shared/dto/api-response.dto.ts):
```typescript
{ success: boolean, data?: T, statusCode: number, errorCode?: string }
```

### 6.4 Event bus interne

- Port `DOMAINE_EVENT_BUS`
- Adapter Nest EventEmitter
- Etat actuel: bus interne non durable (a industrialiser)

## 7. Architecture des modules implementes


### 7.1 Auth (Implémenté - Référence)

**Capacites Actuelles**:
- POST /auth/otp/send/verify (phone-based).
- POST /auth/register/login/refresh/logout/me.
- Google OAuth (si keys).

**Module Deep** (auth/auth.module.ts full bindings):
```typescript
providers: [
  AuthService, JwtTokenService, PasswordHashService (argon2),
  RefreshSessionService, GoogleAuthService, OtpService,
  AuthRepository (Prisma impl AUTH_REPOSITORY_PORT),
  OtpRepository (Prisma impl OTP_REPOSITORY_PORT),
  PhoneNumberValidator, JwtAuthGuard,
]
```

**Refresh Rotation Secure Flow**:
```
1. Client POST refresh_token
2. JwtAuthGuard valide signature
3. RefreshSessionService:
   - Hash token → DB match (auth_sessions table)
   - Check !revoked && !expired
   - Gen new access/refresh
   - UPDATE session: new_hash, revoke old
4. Response {access_token, refresh_token}
```

**Diagram Refresh**:
```
Client ─POST─> Controller ─Guard─> RefreshService ─Port─> AuthRepo
                                            │
                       DB: hash_match? → yes → new_tokens + UPDATE session
```

**Forces**:
- Ports DIP partout.
- Rotation anti-replay.
- Tests E2E complets.

**Exemple Service** (application/services/auth.service.ts):
```typescript
async register(cmd: RegisterCommand) {
  const phone = new PhoneNumberVO(cmd.phone);
  const existing = await this.authRepo.findByPhone(phone);
  if (existing) throw new UserAlreadyExistsError();
  const hashed = await this.hashService.hash(cmd.password);
  const user = UserEntity.create({...});
  await this.authRepo.save(user);
  return this.jwtService.generateTokens(user);
}
```

Capacites:

- OTP send/verify
- register/login
- refresh/logout
- me
- google login (si configure)

Forces actuelles:
- separation controller/service/repository
- ports applicatifs en place
- rotation de refresh token
- messages FR centralises
- tests unitaires + e2e complets

Points a durcir:
- provider OTP reel (Twilio/Infobip)
- audit login/securite avancee
- revoke list distribuee si multi-instance


### 7.2 Users (Profile Management)

**Capacites**:
- GET/PUT /users/me (avatar, address via VO).

**Module** (users/users.module.ts):
```typescript
@Module({
  imports: [PrismaModule, AuthModule], // Depends decorated User
  providers: [UsersService, UsersRepository],
  { provide: USERS_REPOSITORY_PORT, useExisting: UsersRepository },
})
```

**Domain VO Example** (domain/value-objects/address.vo.ts - protects invalid):
- Validates format, immutable.

**Service** (application/services/users.service.ts):
Uses port, no Prisma knowledge.

### 7.3 Sante (DDD Template)
**Pattern Use Case + Event**:
- ObtenirEtatSanteUseCase → VERIFICATEUR_BASE_PORT.
- Event EtatSanteVerifie → Handler journalise.

**Utilisation**: Modèle pour tous use cases event-driven.

Capacite:

- endpoint `users/me`

Forces:
- service depend d'un port repository
- repository infra Prisma propre

### 7.3 Sante
Role:
- module exemple DDD + event-driven
- montre pattern use case + event + handler

## 8. Flux critiques de reference

### 8.1 Auth - Register/Login
1. Controller valide DTO.
2. Service application normalise et valide le numero.
3. Service interroge repository via port.
4. Hash mot de passe (argon2id).
5. Creation utilisateur.
6. Emission access/refresh token.
7. Persistance session refresh.

### 8.2 Auth - Refresh
1. Verifier session refresh stockee.
2. Verifier signature/validite JWT refresh.
3. Verifier coherence session <-> utilisateur.
4. Rotation token et session.
5. Retour nouveaux tokens.

### 8.3 Booking -> Payment Escrow -> Wallet (cible)
1. Creation booking (`PENDING`).
2. Acceptation pro (`CONFIRMED`).
3. Paiement initie + idempotency key.
4. Webhook confirme escrow (`PAID_ESCROW`).
5. Fin mission validee client (`COMPLETED`).
6. Ecriture ledger wallet (credit net).
7. Retrait pro via provider.

## 9. Modele data et integrite

### 9.1 Regles globales
- UUID pour identifiants metier.
- Contrainte d'unicite sur identites critiques.
- Transactions DB sur operations multi-etapes.
- Etats metier explicites (pas de transitions implicites).

### 9.2 Tables techniques cibles
- `idempotency_keys`
- `payment_webhook_events`
- `wallet_transactions` (ledger immutable)
- `outbox_events`
- `audit_logs`
- `disputes`

### 9.3 Geospatial
- PostGIS obligatoire pour recherche geo.
- Index GIST sur localisation.
- Queries ST_DWithin/ST_Distance optimisees.


## 7. Event-Driven + Observabilité (Étapes 7)

### 7.1 Outbox Pattern (Reliable Events)
**Schema** (EvenementOutbox):
- payload JSON, status (EN_ATTENTE→TRAITE/ECHEC), attempts, error.
- Poller asynchrone publie vers broker.

**Flow**:
```
Use Case → this.eventBus.publish(event) // DomainEvent
  → OutboxEventBusService.insert(payload)
  → Cron job: select EN_ATTENTE → publish RabbitMQ → UPDATE TRAITE
Retry DLQ on failure.
```

**Avantages**: Atomic avec DB tx, no lost events multi-instance.

### 7.2 Audit Logging Complet
**Middleware Global** (core/audit/audit-logger.middleware.ts on '*'):
- Capture request IP, user @CurrentUser(), action.
- Insert AuditLogs (action_type enum ex CONNEXION/PAIEMENT).

**Schema AuditLogs**:
- user_id/name, ip_address, geo (lat/lng), user_agent.
- Indexes user+created_at, action+created_at.

**Cas**: Login → audit CONNEXION, Paiement → PAIEMENT.

## 8. Déploiement & Infra (Étape 8)

### 8.1 Docker Production
```
docker-compose.yml: postgres14 + app → DATABASE_URL=postgresql://...
entrypoint.sh: wait-db && prisma migrate deploy && prisma seed
```

**Build/Run**:
```bash
docker compose up --build  # Dev
npm run docker:up          # Scripts pkg.json
```

**Scaling Horizontal**:
- Stateless API (JWT self-contained).
- Redis pour Socket.IO adapter (chat/tracking).
- PG replicas + connection pool pgbouncer.

### 8.2 Variables Env Production
| Var | Dev Default | Prod Exemple | Criticity |
|----|-------------|--------------|-----------|
| DATABASE_URL | postgresql://localhost:5432/jokko | cloud-psql://... | Critical |
| JWT_ACCESS_SECRET | devsecret | 64+ random | Critical |
| NODE_ENV | development | production | Info |
| CORS_ORIGINS | http://localhost:3000 | https://jokko.app | Security |

**Secrets**: Docker secrets ou Vault.

## 9. Testing & Standards (Étape 9)

**Stack**: Jest + Supertest (E2E), ts-jest.
- Unit: Services/VO/ports (>90% coverage).
- E2E: Controllers full flow (auth.e2e-spec.ts).
- `npm test:e2e --config test/jest-e2e.json`.

**Standards** (docs/STANDARDS_MODULES_BACKEND.md):
- No cross-layer imports.
- No any/unknown without narrowing.
- Checklist DoD par module/endpoint.

**Lint**: ESLint9 + Prettier3 strict.

## 10. Event-driven: actuel vs cible


### 10.1 Etat actuel
- Publication interne en memoire (EventEmitter).
- Bon decouplage applicatif local.

### 10.2 Cible production
- Outbox transactionnelle en DB.
- Publisher asynchrone.
- Broker durable (RabbitMQ/Kafka/SQS).
- Retry + DLQ + monitoring.

Pourquoi:
- eviter perte d'evenements en cas de panne process.
- garantir la coherence des flux critiques (paiement, wallet, notification).

## 11. Securite et conformite

### 11.1 Mesures techniques
- JWT access court + refresh rotation.
- Hash mot de passe argon2id.
- Rate limiting.
- Validation stricte payload.
- Headers HTTP securises (Helmet).
- TLS obligatoire en production.

### 11.2 Conformite
- traçabilite des decisions admin (KYC/litiges)
- minimisation des donnees
- droit a l'effacement/anonymisation
- journalisation des consentements

## 12. Observabilite et exploitation

### 12.1 Logs
- Logs structures JSON.
- Correlation ID (`X-Request-Id`).
- Masquage des donnees sensibles.

### 12.2 Metriques cibles
- Latence P95/P99 par endpoint.
- Taux d'erreur par route/module.
- Saturation pool DB.
- Debits websocket/messages.

### 12.3 Traces
- OpenTelemetry (cible)
- Correlation API -> DB -> provider externe

### 12.4 Alerting
- Erreurs 5xx anormales
- Echec webhook paiement
- file de retry qui grossit

## 13. Scalabilite et performance

### 13.1 API
- Stateless, multi-instance.
- Autoscaling horizontal.

### 13.2 Realtime
- Redis adapter Socket.IO (cible multi-instance).

### 13.3 DB
- Indexation stricte.
- Pagination cursor-based.
- Read replicas (phase croissance).

### 13.4 Async jobs
- Deporter les taches lourdes: PDF, notifications de masse, reconciliations.

## 14. Qualite et standards de dev

### 14.1 Definition of Done technique
Un module/endpoint est "Done" si:
1. Contrats (DTO + responses + erreurs) clairs.
2. Regles metier dans application/domaine.
3. Ports/interfaces definis.
4. Tests unitaires + integration/e2e.
5. Logs/erreurs/validation conformes.
6. Lint/build strict sans warning bloquant.

### 14.2 Regles de revues de code
- aucun code metier en controller
- aucun acces DB hors infrastructure
- pas de duplication de flux critique
- no dead code / no unused import
- tests obligatoires sur chemins critiques

## 15. Mapping cahier des charges -> architecture

| Exigence | Reponse architecture |
|---|---|
| Confiance/KYC | module `professionals` + `admin` + audit logs |
| Escrow/paiement | module `payments` + webhook securise + idempotence + ledger |
| Geolocalisation | `search` + PostGIS + index GIST |
| Temps reel | `chat`/`tracking` + WS + Redis adapter |
| Scalabilite | API stateless + async jobs + broker + replicas |
| Conformite | consentements + anonymisation + tracabilite |


## 11. Roadmap Modules Manquants + Endpoints (Étape 10)

**Template Module Structure** (ex bookings):
```
bookings/
├── domain/entities/booking.entity.ts (FSM statut enum)
├── application/ports/bookings-repo.port.ts
├── infrastructure/repositories/bookings.repository.ts
├── presentation/controllers/bookings.controller.ts
└── bookings.module.ts
```

**Mappings Schema → Modules**:
- ProfilProfessionnel → professionals module (KYC flow).
- Service/Disponibilite → services.
- Reservation/Paiement → bookings/payments (escrow webhook).
- Conversation/Message → chat (Socket.IO).
- Notification → notifications (FCM).

**Endpoint Matrix Projetés** (en plus implémentés):
| Module | Exemple Endpoint | Auth | Guard | Notes |
|--------|------------------|------|-------|-------|
| professionals | POST /professionals/kyc/submit | Pro | Jwt | Upload docs → PENDING |
| bookings | POST /bookings (serviceId, date) | Client | Jwt | Check disponibilité → EN_ATTENTE |
| payments | POST /payments/initiate (idempotency-key) | Client | Jwt | → PAID_ESCROW on webhook |
| chat | WS /socket (bookingId) | Owner | JwtWs | Redis scale |
| admin | PATCH /admin/disputes/:id/resolve | Admin | Roles(ADMIN) | Audit forced |

**Impl Order**: Professionals → Services → Bookings → Payments → Chat → Admin.

## 12. Appendices (Étape 11)

### 12.1 Checklist DoD Endpoint
- [ ] DTOs/@ApiProperty doc.
- [ ] Tests E2E 200/401/422/500.
- [ ] Logs/action audit.
- [ ] Throttle si public.
- [ ] Idempotence si money.

### 12.2 Commands Prisma
```
prisma migrate dev --name add_bookings
prisma generate
prisma db seed  # ts-node prisma/seed.ts
```

## 13. Conclusion
Documentation architecture **complète et exhaustive**. Référence unique pour dev/prod/scaling.

**Prochaines Actions**: Implémentez modules par ordre roadmap.

## 16. Etat actuel vs cible


### 16.1 Ce qui est deja solide
- fondation modulaire propre
- `auth` de bon niveau (ports, tests, validation, erreurs FR)
- centralisation des messages d'erreur
- pipelines qualite (lint/build/tests)

### 16.2 Ecarts a combler
- modules P0 metier pas encore tous implementes
- event bus durable non en place
- paiements/wallet/escrow non industrialises
- observabilite production non complete

## 17. Roadmap d'industrialisation

### Phase A (immédiat)
- finaliser `professionals`, `categories`, `services`, `search`
- ajouter tests integration module par module

### Phase B (flux argent)
- `bookings` state machine
- `payments` + webhooks + idempotence
- `wallet` + ledger immutable

### Phase C (temps reel)
- `chat` + `tracking`
- redis adapter ws
- policy throttle GPS

### Phase D (hardening)
- outbox + broker + retries + DLQ
- observabilite complete
- tests perf/secu

## 18. Decision finale
La direction actuelle est la bonne et doit etre maintenue.
Il ne faut pas revenir a une architecture CRUD plate.
La priorite doit rester:
1. integrite metier
2. robustesse des flux critiques
3. scalabilite progressive
4. discipline de code stricte

Cette approche permet de livrer vite sans sacrifier la qualite long terme.

## 19. Specification API Complete (fusion execution plan)

### 19.1 Conventions API globales
- Prefix: `/api/v1`
- Reponse succes type:
  - `{ "success": true, "data": ..., "meta": ... }`
- Reponse erreur type:
  - `{ "success": false, "statusCode": ..., "errorCode": "...", "message": "...", "timestamp": "...", "path": "..." }`
- Auth: JWT access token court + refresh token en rotation.
- Idempotence:
  - obligatoire sur `payments/initiate`
  - recommandee sur creations critiques (bookings).
- Tracabilite:
  - `X-Request-Id` recommande sur chaque requete.
- Rate limiting de base:
  - public: 60 req/min/IP
  - authentifie: 100 req/min/user

### 19.2 Matrice endpoints et contraintes

#### Auth
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| POST | `/api/v1/auth/otp/send` | Non | Public | throttle strict, anti-spam SMS, format phone valide |
| POST | `/api/v1/auth/otp/verify` | Non | Public | OTP TTL, max tentatives, creation/connexion compte |
| POST | `/api/v1/auth/register` | Non | Public | validation forte payload, consentement CGU obligatoire |
| POST | `/api/v1/auth/login` | Non | Public | lockout progressif apres echec, audit login |
| POST | `/api/v1/auth/refresh` | Oui (refresh) | User | rotation refresh token + revoke ancien |
| POST | `/api/v1/auth/logout` | Oui | User | revoke refresh actif |
| POST | `/api/v1/auth/google/login` | Non | Public | verification token Google + mapping compte local |
| GET | `/api/v1/auth/me` | Oui | User | token access valide |

#### Users
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| GET | `/api/v1/users/me` | Oui | User | ne jamais exposer donnees sensibles |
| PUT | `/api/v1/users/me` | Oui | User | validation stricte, audit modifications |
| DELETE | `/api/v1/users/me` | Oui | User | anonymisation conforme legal/CDP |

#### Professionals + KYC
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| POST | `/api/v1/professionals/profile` | Oui | Pro | statut KYC initial `PENDING` |
| GET | `/api/v1/professionals` | Optionnelle | Public | geo filtre + tri distance + pagination cursor |
| GET | `/api/v1/professionals/:id` | Optionnelle | Public | bio, notes, portfolio, disponibilites |
| PATCH | `/api/v1/professionals/kyc/submit` | Oui | Pro | document CNI requis, audit soumission |
| PATCH | `/api/v1/admin/kyc/:professionalId/approve` | Oui | Admin | decision tracable, horodatage |
| PATCH | `/api/v1/admin/kyc/:professionalId/reject` | Oui | Admin | motif obligatoire |

#### Categories
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| GET | `/api/v1/categories` | Non | Public | retourner uniquement categories actives |
| POST | `/api/v1/admin/categories` | Oui | Admin | nom unique, ordre tri coherent |
| PUT | `/api/v1/admin/categories/:id` | Oui | Admin | journaliser modifications |
| PATCH | `/api/v1/admin/categories/:id/disable` | Oui | Admin | soft disable, pas suppression brutale |

#### Services
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| POST | `/api/v1/services` | Oui | Pro VERIFIED | KYC doit etre `VERIFIED` |
| PUT | `/api/v1/services/:id` | Oui | Pro owner | ownership obligatoire |
| DELETE | `/api/v1/services/:id` | Oui | Pro owner | soft delete recommande |
| GET | `/api/v1/professionals/:id/services` | Non | Public | filtrer services actifs |

#### Search (Geo)
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| GET | `/api/v1/search/professionals` | Non | Public | PostGIS GIST, lat/lng obligatoires, perf < 500ms |

Query params cibles:
- `lat`, `lng`, `radiusKm`, `categoryId`, `query`, `cursor`, `limit`

#### Bookings
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| POST | `/api/v1/bookings` | Oui | Client | verif disponibilite + idempotence optionnelle |
| GET | `/api/v1/bookings/:id` | Oui | Owner/Admin | controle acces strict |
| PATCH | `/api/v1/bookings/:id/confirm` | Oui | Pro owner | transition valide uniquement si `PENDING` |
| PATCH | `/api/v1/bookings/:id/reject` | Oui | Pro owner | motif rejet obligatoire |
| PATCH | `/api/v1/bookings/:id/on-the-way` | Oui | Pro owner | autorise apres `PAID_ESCROW` |
| PATCH | `/api/v1/bookings/:id/complete` | Oui | Client owner | declenche liberation fonds |
| PATCH | `/api/v1/bookings/:id/cancel` | Oui | Client/Pro | appliquer politique annulation |
| PATCH | `/api/v1/bookings/:id/dispute` | Oui | Client/Pro | bloque paiement, notifie admin |

Machine d'etats booking:
- `PENDING -> CONFIRMED -> PAID_ESCROW -> ON_THE_WAY -> COMPLETED`
- branches: `CANCELLED`, `DISPUTED`

#### Payments + Escrow
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| POST | `/api/v1/payments/initiate` | Oui | Client | `Idempotency-Key` obligatoire |
| POST | `/api/v1/payments/webhook` | Non (signature) | Provider | HMAC obligatoire, replay protection |
| GET | `/api/v1/payments/:id` | Oui | Owner/Admin | ne jamais exposer secrets provider |
| POST | `/api/v1/payments/:id/reconcile` | Oui | Admin/System | usage interne ops only |

Contraintes critiques paiement:
- separation `payment.status` / `booking.status`
- ledger immutable
- outbox event sur succes

#### Wallet + Withdrawals
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| GET | `/api/v1/wallet/me` | Oui | Pro | solde + en attente + disponible |
| GET | `/api/v1/wallet/me/transactions` | Oui | Pro | pagination obligatoire |
| POST | `/api/v1/payments/withdraw` | Oui | Pro | min 2000 FCFA, max 500000 FCFA |

#### Chat + Realtime
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| GET | `/api/v1/conversations` | Oui | User | uniquement conversations utilisateur |
| GET | `/api/v1/conversations/:id/messages` | Oui | User | controle acces conversation |
| WS | `/socket` | Oui (JWT WS) | User | Redis adapter en multi-instance |

Events websocket cibles:
- `chat.message.send`
- `chat.message.read`
- `tracking.position.update`

#### Tracking
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| PATCH | `/api/v1/bookings/:id/tracking/start` | Oui | Pro owner | booking `ON_THE_WAY` requis |
| PATCH | `/api/v1/bookings/:id/tracking/stop` | Oui | Pro owner | fermeture session tracking |
| WS | `/socket` event tracking | Oui | Pro/Client owner | throttle updates (1-2s) |

#### Notifications
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| GET | `/api/v1/notifications` | Oui | User | pagination + filtre read/unread |
| PATCH | `/api/v1/notifications/:id/read` | Oui | User | ownership obligatoire |
| POST | `/api/v1/admin/notifications/broadcast` | Oui | Admin | rate limit admin + audit |

#### Admin
| Methode | Endpoint | Auth | Role | Contraintes |
|---|---|---|---|---|
| GET | `/api/v1/admin/dashboard` | Oui | Admin | aggregations performantes |
| GET | `/api/v1/admin/disputes` | Oui | Admin | tri SLA |
| PATCH | `/api/v1/admin/disputes/:id/resolve` | Oui | Admin | decision obligatoire + audit |
| PATCH | `/api/v1/admin/commission` | Oui | Admin | changement versionne et trace |
| PATCH | `/api/v1/admin/users/:id/block` | Oui | Admin | motif + audit |

### 19.3 Contraintes non fonctionnelles cibles
- Disponibilite: 99.5% uptime/mois.
- Performance API: P95 < 300ms (hors traitements lourds).
- Recherche geo: < 500ms (dataset cible).
- Tchat: reception nominale < 1s.
- Backup DB: au moins toutes les 6h.
- RTO cible: < 2h.

### 19.4 Contraintes data et DB
- UUID sur entites principales.
- Index obligatoires:
  - `users(phone_number)`, `users(email)`
  - `professional_profiles(location)` GIST
  - `bookings(status, scheduled_at)`
  - `payments(status, provider_ref)`
- Tables techniques cibles:
  - `idempotency_keys`
  - `payment_webhook_events`
  - `wallet_transactions` (ledger immutable)
  - `outbox_events`
  - `audit_logs`
  - `disputes`

### 19.5 Definition of Done endpoint
Un endpoint est "Done" seulement si:
1. DTO request/response documentes.
2. Validation + auth + role checks en place.
3. Logs metier et audit si necessaire.
4. Tests unitaires + integration + e2e du cas principal.
5. Codes erreurs metier geres (4xx/5xx).
6. Observabilite minimale (latence + erreurs + logs).

### 19.6 Ordre d'execution recommande
1. `auth`, `users`, `professionals`, `categories`, `services`
2. `search`
3. `bookings`
4. `payments`, `wallet`, `webhook`, `idempotency`, `outbox`
5. `notifications`
6. `chat`, `tracking`, `redis realtime scaling`
7. `admin`, `litiges`, hardening final
