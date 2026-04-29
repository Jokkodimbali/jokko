# Standards D'Implementation Des Modules Backend

## 1. Objet
Ce document definit les standards que tous les modules du backend Jokko doivent respecter.

Il s'applique a l'ensemble des domaines actuellement presents :

- auth
- users
- professionals
- categories
- search
- reservations
- negotiations
- messaging
- live-tracking
- payments
- notifications
- disputes
- admin
- sante

## 2. Principes obligatoires

### 2.1 SOLID

- une classe, une responsabilite principale
- dependre d'abstractions quand l'infrastructure est impliquee
- eviter les services monolithiques et les repositories "fourre-tout"

### 2.2 DRY

- pas de duplication de regle metier
- pas de duplication de messages visibles
- pas de duplication de logique Swagger ou de payloads de test si une source partagee existe deja

### 2.3 KISS

- preferer une orchestration lisible a une abstraction prematuree
- introduire une couche seulement si elle apporte une vraie clarte
- eviter les patterns "enterprise" decoratifs sans besoin concret

### 2.4 Clean Code

- nommage explicite
- typage strict
- zero `any` par defaut
- fonctions courtes et intentionnelles
- imports et code mort nettoyes

### 2.5 DDD pragmatique

- le domaine porte les invariants metier
- la presentation ne decide pas les regles metier
- l'infrastructure n'envahit pas la logique fonctionnelle

### 2.6 Event-driven pragmatique
Le projet prepare et utilise deja des mecanismes event-driven.

Attendus :

- evenement metier ou outbox lorsqu'un flux critique doit etre trace ou rejoue
- pas de publication d'evenement decorative
- garder les flux transactionnels critiques atomiques lorsque c'est necessaire

## 3. Structure standard d'un module

```text
src/<module>/
  application/
    commands/
    queries/
    ports/
    services/
  domain/
    entities/
    errors/
    events/
    value-objects/
  infrastructure/
    adapters/
    repositories/
  presentation/
    controllers/
    dto/
    gateways/
  <module>.module.ts
```

Tous les sous-dossiers ne sont pas obligatoires, mais les quatre couches principales doivent rester clairement identifiables.

## 4. Responsabilites par couche

### 4.1 Presentation
Contient :

- controllers HTTP
- DTOs
- decorators Swagger
- guards
- lecture de l'utilisateur courant
- gateways Socket.IO si le module en a besoin

N'y met jamais :

- acces Prisma
- logique de commission
- transitions de statut metier
- logique provider

### 4.2 Application
Contient :

- orchestration des cas d'usage
- facades si necessaire
- coordination inter-services
- appels aux ports

N'y met jamais :

- objets Express
- decorators Swagger
- details Prisma bruts
- code Twilio, Resend, FCM, Wave, Orange Money ou carte en direct si un port existe

### 4.3 Domain
Contient :

- entites
- value objects
- erreurs de domaine
- evenements de domaine
- invariants metier

N'y met jamais :

- NestJS
- Prisma
- HTTP
- Swagger

### 4.4 Infrastructure
Contient :

- repositories Prisma
- adapters externes
- persistance outbox, audit, idempotence
- securisation technique des webhooks

N'y met jamais :

- texte HTTP metier recopie
- logique produit qui devrait vivre en domaine ou application

## 5. Sens des dependances

- `presentation -> application`
- `application -> domain`
- `application -> ports`
- `infrastructure -> application + domain`
- `domain -> aucune dependance technique`

Concretement :

- un controller ne parle jamais a Prisma
- un service applicatif ne depend pas d'un repository concret si un port existe
- un objet de domaine ne depend ni de NestJS ni de Swagger

## 6. Standards des controllers
Un controller Jokko doit :

- etre mince
- valider son DTO
- deleguer a l'application
- retourner une enveloppe standard via `createApiResponse`
- documenter ses reponses via `ApiStandardSuccessResponse` et `ApiStandardErrorResponse`

Un controller Jokko ne doit pas :

- decider une transition metier
- creer lui-meme un message deja centralise
- connaitre la structure Prisma d'une table

## 7. Standards des DTOs
Un DTO doit :

- vivre en `presentation/dto`
- utiliser `class-validator`
- utiliser des messages centralises
- porter des exemples Swagger realistes

Un DTO ne doit pas :

- contenir de logique metier
- etre reutilise comme entite de domaine
- masquer des regles metier qui devraient vivre dans le domaine

## 8. Standards des services applicatifs
Un service applicatif doit :

- orchestrer un cas d'usage clair
- utiliser des ports explicites
- renvoyer des structures metier lisibles
- rester testable hors framework

Un service applicatif ne doit pas :

- construire une reponse HTTP
- emettre des effets externes sans passer par la bonne abstraction
- absorber plusieurs sous-domaines sans raison forte

## 9. Standards des repositories
Un repository d'infrastructure doit :

- encapsuler Prisma
- implementer un port ou un contrat clair
- faire le mapping de persistance necessaire
- porter les transactions de base si elles sont de son ressort

Il ne doit pas :

- servir de service metier cache
- etre appele directement par la presentation

## 10. Standards des gateways temps reel
Pour les modules temps reel comme `messaging` et `live-tracking` :

- le gateway gere l'entree/sortie Socket.IO
- la logique metier reste dans les services applicatifs
- les payloads recus doivent etre valides
- la diffusion doit rester coherente avec les droits d'acces et les rooms

## 11. Messages, Swagger et documentation
Tout module doit respecter la centralisation.

Sources communes :

- `src/core/messages/app-message.catalog.ts`
- `src/core/messages/validation-message.catalog.ts`
- `src/core/messages/domain-message.catalog.ts`
- `src/core/messages/technical-message.catalog.ts`
- `src/core/messages/api-docs.messages.ts`
- `src/shared/swagger/swagger-response.examples.ts`

Regles :

- pas de texte metier duplique dans le code
- pas d'exemple Swagger improvise si un exemple partage existe deja
- la doc `backend/docs` doit etre tenue a jour si une convention structurante evolue

## 12. Tests attendus

### 12.1 Minimum

- `npm.cmd run build`
- `npm.cmd run lint`
- tests unitaires ou ciblage metier si le module en a
- tests E2E pour les endpoints critiques

### 12.2 Modules critiques
Pour les modules critiques comme `reservations`, `payments`, `notifications`, `messaging`, `live-tracking`, `disputes` et `admin`, il faut verifier :

- les transitions heureuses
- les refus de role
- les conflits d'etat
- la coherence des ecritures en base
- la non-regression inter-modules

## 13. Definition of Done d'un module
Un module est considere comme correctement implemente quand :

- sa structure est lisible
- ses couches sont separees
- ses endpoints sont documentes
- ses DTOs ont des exemples exploitables
- ses messages sont centralises
- ses tests critiques existent
- build et lint passent
- la documentation `backend/docs` reste alignee

## 14. Definition of Done d'un endpoint
Un endpoint est considere comme fini quand :

- la validation est correcte
- l'auth et les roles sont en place si necessaire
- le service applicatif porte la logique
- la reponse suit l'enveloppe standard
- les erreurs metier principales sont gerees
- Swagger est exploitable directement
- un test critique couvre le flux

## 15. Reference interne des meilleurs exemples actuels

| Module | Pourquoi il sert de reference |
|---|---|
| `auth` | auth complete, JWT, OTP, refresh, guards |
| `professionals` | domaine riche, KYC, services, portfolio, disponibilites |
| `reservations` | transitions metier, notifications, avis, admin |
| `negotiations` | integration metier avec reservation |
| `messaging` | HTTP + temps reel + reservation comme pivot |
| `live-tracking` | presence et socket temps reel |
| `payments` | idempotence, escrow, webhook, commission |
| `notifications` | module transversal bien extrait |
| `disputes` | gouvernance admin et coherences finance/reservation |

## 16. Ce qui n'est pas encore un standard de module clos
Le backend n'a pas encore de module complet pour :

- upload media reel
- documents / factures
- parrainage

Tout futur travail sur ces blocs doit respecter les standards ci-dessus.

## 17. Conclusion
Les standards Jokko existent pour proteger la coherence du backend sur la duree. Ils ne doivent pas etre lus comme une check-list bureaucratique, mais comme une discipline de qualite.

Quand un module grandit, la bonne strategie n'est pas d'assouplir ces standards. C'est au contraire de les appliquer plus strictement pour eviter le couplage fort, la duplication et la derive d'architecture.
