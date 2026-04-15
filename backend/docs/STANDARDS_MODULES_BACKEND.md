# Standards Modules Backend (Obligatoires)

## 1. Structure par module
Chaque module doit suivre exactement cette architecture **DDD / Clean Architecture** :

```text
src/<module>/
├── domain/
│   ├── entities/           # Aggregate roots avec comportements métier
│   ├── value-objects/      # Value Objects immuables + validation + equals()
│   ├── events/             # Domain events (étendent DomainEvent partagée)
│   ├── errors/             # Erreurs domaine (étendent ValidationError/ConflictError/NotFoundError)
│   └── index.ts            # Barrel export
├── application/
│   ├── commands/           # CQRS Commands (écriture)
│   ├── queries/            # CQRS Queries (lecture)
│   ├── ports/              # Interfaces repository (Symbols DI)
│   ├── services/           # Services applicatifs (orchestration)
│   └── <module>.service.spec.ts  # Tests unitaires
├── infrastructure/
│   └── repositories/       # Implémentations Prisma des ports
├── presentation/
│   ├── controllers/        # Contrôleurs NestJS + Swagger
│   └── dto/                # DTOs class-validator + ApiProperty
└── <module>.module.ts      # Wiring NestJS
```

## 2. Règles d'architecture

### 2.1 Dépendances (unidirectionnelles)
```
presentation → application → domaine ← infrastructure (ports)
```
- `presentation` → seulement `application`
- `application` → `domain` + `core` (abstractions)
- `domain` → **aucune** dépendance framework (`nestjs`, `prisma`, HTTP)
- `infrastructure` → implémente les ports du domaine

### 2.2 Domain-Driven Design
- **Entités riches** : comportement métier + invariants + événements de domaine (pas d'entités anémiques)
- **Value Objects** : immuables (`private constructor` + `readonly`), validation stricte, méthode `equals()`
- **Domain Events** : publiés lors de changements d'état significatifs
- **Aggregate Roots** : garantissent les invariants métier

### 2.3 CQRS
- Commands et Queries dans des fichiers séparés
- `commands/` pour les opérations d'écriture
- `queries/` pour les opérations de lecture

### 2.4 Repository Pattern
- Ports définis avec des **Symbols** pour l'injection
- Interface segmentée (ISP) si le repository gère plusieurs agrégats
- Retourne des **Result types** discriminés (`{ status: 'created' | 'not_found' | 'conflict' }`)

## 3. Règles de qualité

| Principe | Règle |
|----------|-------|
| **SRP** | Une classe = une responsabilité claire |
| **DRY** | Pas de duplication de logique métier |
| **KISS** | Fonctions courtes, lisibles, sans magie |
| **Clean Code** | Interdiction totale de `any` ; préférer `unknown` + narrowing |
| **Validation** | DTOs uniquement en `presentation` |
| **Accès DB** | Uniquement en `infrastructure` |
| **Messages** | Centralisés dans `core/http/app-messages.ts` |
| **HTTP** | `PATCH` pour updates partiels, `POST` → 201, `GET` → 200 |
| **Swagger** | `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiProperty` sur tous les endpoints/DTOs |
| **Sécurité** | `@Roles(ADMIN)` + `RolesGuard` sur tous les endpoints admin |

## 4. Checklist "Definition of Done"

Un module est terminé **seulement si** :

- [ ] `npm run build` passe sans erreur
- [ ] `npm run lint` passe sans warning
- [ ] Tests unitaires passent (`npm test`)
- [ ] Tests E2E passent
- [ ] Aucun import interdit entre couches
- [ ] Aucun texte brut métier en dehors des catalogues centralisés
- [ ] Contrôleurs sans logique métier
- [ ] Services application accèdent aux repositories via **ports** (pas de Prisma direct)
- [ ] Entités domaine avec comportements métier et événements
- [ ] Value Objects avec validation + `equals()`
- [ ] `@HttpCode` explicite sur chaque endpoint
- [ ] Swagger complet sur tous les endpoints et DTOs
- [ ] Messages de validation 100% en français

## 5. Modules de référence

Les modules suivants servent de référence pour l'implémentation :

| Module | Fichiers | Particularités |
|--------|---------|----------------|
| **categories** | 21 | Le plus complet — DDD full stack, CQRS, events, VO avec equals() |
| **professionals** | 37 | Multi-agrégats, 5 services app, facade, 10 domain events |
| **users** | 16 | CRUD user + anonymisation, 5 domain events |
| **auth** | 33 | JWT + OTP + Google OAuth, refresh rotation, 8 domain events |
