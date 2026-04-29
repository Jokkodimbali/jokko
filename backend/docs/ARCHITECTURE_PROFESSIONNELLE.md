# Architecture Backend Professionnelle - Jokko

## 1. Objet
Ce document decrit l'architecture backend reelle du projet Jokko dans son etat actuel.

Il ne s'agit pas d'une architecture cible theorique. C'est une reference de travail pour :

- l'equipe backend
- l'equipe mobile
- l'administration technique
- les revues de code
- la preparation du deploiement

## 2. Resume executif
Le backend Jokko est une API NestJS modulaire, orientee domaines metier, avec PostgreSQL via Prisma, messages centralises, Swagger exploitable, audit HTTP, notifications multi-canaux et deux briques temps reel Socket.IO :

- `messaging`
- `live-tracking`

Le projet a deja depasse le stade d'une simple base CRUD. Il supporte aujourd'hui des flux inter-modules complets :

- auth -> profil -> professionnel -> reservation
- negotiation -> reservation
- reservation -> messagerie -> paiement -> notification -> avis
- reservation/paiement -> litige -> administration
- reservation -> live tracking -> notification

## 3. Modules actuellement importes par `AppModule`
Le module racine charge actuellement :

- `SharedModule`
- `CoreModule`
- `PrismaModule`
- `SanteModule`
- `AuthModule`
- `UsersModule`
- `ProfessionalsModule`
- `CategoriesModule`
- `NegotiationsModule`
- `NotificationsModule`
- `DisputesModule`
- `MessagingModule`
- `LiveTrackingModule`
- `AdminModule`
- `SearchModule`
- `ReservationsModule`
- `PaymentsModule`

L'application applique aussi globalement `AuditLoggerMiddleware`.

## 4. Socle technique actuel

### 4.1 Framework

- NestJS
- TypeScript
- class-validator
- Swagger NestJS
- Socket.IO

### 4.2 Persistance

- PostgreSQL
- Prisma 7
- `prisma.config.ts`
- `DATABASE_URL` comme source de connexion

### 4.3 Execution HTTP

- prefixe global `/api/v1`
- `helmet`
- `ValidationPipe` global strict
- `ApiExceptionFilter`
- guards JWT et roles
- Swagger sur `/api/docs`

### 4.4 Transversal

- audit HTTP
- throttling global
- outbox / event bus
- notifications in-app
- adapters email / SMS / push

## 5. Structure cible d'un module

```text
src/<module>/
  application/
  domain/
  infrastructure/
  presentation/
  <module>.module.ts
```

Cette structure est effectivement appliquee sur les modules metier principaux.

## 6. Separation des couches

### 6.1 Presentation
Contient :

- controllers HTTP
- DTOs
- decorators Swagger
- gateways Socket.IO quand necessaire

### 6.2 Application
Contient :

- orchestration des cas d'usage
- facades
- services de commande et de lecture
- ports vers l'infrastructure

### 6.3 Domain
Contient :

- entites
- value objects
- erreurs metier
- invariants
- evenements de domaine ou assimilables quand necessaire

### 6.4 Infrastructure
Contient :

- repositories Prisma
- adapters externes
- details de provider
- persistance technique

## 7. Regles de dependance

- `presentation -> application`
- `application -> domain`
- `application -> ports`
- `infrastructure -> application + domain`
- `domain -> aucune dependance technique`

## 8. Modules metier reels

### 8.1 Auth
Responsabilites :

- OTP
- register
- login mot de passe
- login Google
- refresh token
- logout
- `GET /auth/me`

Points forts :

- JWT access/refresh
- sessions de refresh
- guards propres
- messages centralises

### 8.2 Users
Responsabilites :

- profil courant
- update profil
- avatar
- historique personnel
- anonymisation du compte
- administration utilisateur

### 8.3 Professionals
Responsabilites :

- profil professionnel
- KYC
- services
- portfolio
- disponibilites
- lectures publiques
- administration KYC

### 8.4 Categories
Responsabilites :

- liste publique des categories actives
- creation admin
- mise a jour admin
- desactivation admin
- taux de commission par categorie

### 8.5 Search
Responsabilites :

- recherche de professionnels verifies
- filtres ville, categorie, texte, geolocalisation, pagination

### 8.6 Negotiations
Responsabilites :

- creation de negotiation
- contre-proposition
- acceptation
- rejet
- annulation
- conversion vers reservation

### 8.7 Reservations
Responsabilites :

- creation
- creation depuis negotiation
- listing et detail
- confirmation
- annulation
- reprogrammation
- ajustement de prix
- demarrage
- completion
- no-show
- avis client
- ouverture de litige
- vues admin

Ce module est le pivot metier principal du projet.

### 8.8 Messaging
Responsabilites :

- conversation par reservation
- envoi de messages
- lecture d'historique
- temps reel Socket.IO
- notification in-app de nouveau message

### 8.9 Live Tracking
Responsabilites :

- presence prestataire
- activation "on the way"
- session de tracking par reservation
- points GPS
- temps reel Socket.IO

### 8.10 Payments
Responsabilites :

- initiation de paiement
- webhook provider
- escrow
- litige escrow
- remboursement admin
- retraits pro
- statistiques admin

### 8.11 Notifications
Responsabilites :

- notifications in-app
- lecture et marquage lu
- token FCM
- diffusion admin
- delivery push
- branchages email et SMS

### 8.12 Disputes
Responsabilites :

- dossier de litige unique
- liaison reservation/paiement
- prise en charge admin
- resolution ou rejet
- traces de decision

### 8.13 Admin
Responsabilites :

- dashboard global
- vue de gouvernance transverse

### 8.14 Sante
Responsabilites :

- healthcheck API

## 9. Surface HTTP reelle
Les controllers HTTP actuels sont :

- `admin-dashboard.controller.ts`
- `auth.controller.ts`
- `admin-categories.controller.ts`
- `categories.controller.ts`
- `admin-disputes.controller.ts`
- `live-tracking.controller.ts`
- `conversations.controller.ts`
- `negotiations.controller.ts`
- `admin-notifications.controller.ts`
- `notifications.controller.ts`
- `admin-payments.controller.ts`
- `payments.controller.ts`
- `admin-kyc.controller.ts`
- `professionals.controller.ts`
- `admin-reservations.controller.ts`
- `reservations.controller.ts`
- `sante.controller.ts`
- `search.controller.ts`
- `admin-users.controller.ts`
- `users.controller.ts`

## 10. Surface temps reel reelle
Les gateways Socket.IO actuels sont :

- `messaging.gateway.ts`
- `live-tracking.gateway.ts`

Ces briques couvrent les besoins temps reel du projet actuellement implementes.

## 11. Reponse HTTP standard

### 11.1 Succes

```json
{
  "success": true,
  "message": "Operation effectuee avec succes.",
  "data": {},
  "meta": {}
}
```

### 11.2 Erreur

```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "VALIDATION_REQUEST_INVALID",
  "message": "Les donnees envoyees sont invalides.",
  "timestamp": "2026-04-24T10:00:00.000Z",
  "path": "/api/v1/endpoint"
}
```

## 12. Documentation API
Swagger est une vraie brique de l'architecture documentaire.

Chemin local :

`http://localhost:3000/api/docs`

Le backend utilise :

- `api-docs.messages.ts`
- `swagger-response.examples.ts`
- `ApiStandardSuccessResponse`
- `ApiStandardErrorResponse`

Objectif :

- exposer la meme enveloppe que le runtime
- fournir des exemples de test directement utilisables
- standardiser les summaries, params et erreurs

## 13. Flux metier critiques deja relies

### 13.1 Flux reservation vers paiement

1. le client cree ou obtient une reservation
2. le paiement est initie a partir de la reservation
3. l'escrow se verrouille
4. les notifications adequates sont persistees

### 13.2 Flux negotiation vers reservation

1. le client ouvre une negotiation sur un service negociable
2. le prestataire contre-propose ou accepte
3. la negotiation acceptee est convertie en reservation

### 13.3 Flux reservation vers messagerie

1. une conversation est liee a une reservation
2. les messages sont persistes
3. la notification in-app est creee
4. l'evenement temps reel est emis

### 13.4 Flux reservation vers live tracking

1. le prestataire active "on the way"
2. une session de tracking est ouverte
3. la presence est mise a jour
4. les points GPS sont diffuses en temps reel

### 13.5 Flux reservation vers avis

1. la reservation doit etre terminee
2. le client poste la note
3. le professionnel voit sa note agregree recalculer

### 13.6 Flux reservation ou paiement vers litige

1. ouverture du litige
2. liaison au paiement et a la reservation
3. prise en charge admin
4. resolution ou rejet

## 14. Base de donnees
Le schema Prisma du projet couvre notamment :

- utilisateurs
- profils professionnels
- categories
- services
- disponibilites
- portfolio
- reservations
- negotiations
- propositions de negotiation
- conversations
- messages
- sessions de tracking
- points GPS
- paiements
- retraits
- notifications
- litiges
- outbox events

Le backend applique aussi des contraintes de coherence importantes :

- FKs
- unicites
- checks metier
- indexes de lecture

## 15. Event-driven et robustesse
Le backend prepare ou applique deja plusieurs briques de robustesse :

- outbox events
- audit middleware global
- idempotence sur des flux sensibles
- persistance des communications reservation
- separation claire entre application et adapters externes

Ce n'est pas encore une architecture de workers distribues complete, mais le socle actuel est serieux.

## 16. Ce qui est encore hors scope backend aujourd'hui
Les modules suivants ne sont pas encore implementes completement :

- upload media reel
- documents / factures
- parrainage

Cette limite doit etre consideree comme la frontiere fonctionnelle actuelle du backend.

## 17. Exigences de coherence documentaire
Ce document doit rester aligne avec :

- `backend/docs/TABLEAU_MESSAGES_HTTP.md`
- `backend/docs/STANDARDS_MODULES_BACKEND.md`
- `backend/docs/POSTMAN_TESTS.md`
- `backend/docs/cahier_des_charges_jokko.md`

et avec le code reel sous `backend/src/`.

## 18. Conclusion
Le backend Jokko est aujourd'hui une base modulaire et deja riche, organisee autour de domaines metier clairs et de flux inter-modules reels.

Sa force principale n'est pas seulement le nombre de modules implementes. C'est surtout la coherence d'ensemble :

- separation presentation / application / domaine / infrastructure
- messages centralises
- docs Swagger exploitables
- endpoints admin reels
- flux temps reel reels
- notifications et paiements relies au metier

Le prochain niveau de maturite backend se jouera surtout sur les briques encore manquantes comme l'upload reel, les documents/factures et le parrainage, pas sur une refonte de la structure actuelle.
