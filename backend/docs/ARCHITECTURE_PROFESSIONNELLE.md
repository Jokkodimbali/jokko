# Architecture Backend Professionnelle - Reference Reelle Et Complete Du Projet Jokko

## 1. Objet du document

Ce document decrit l'architecture backend telle qu'elle existe actuellement dans le projet Jokko. Il ne s'agit pas d'une cible abstraite, d'un brouillon ou d'une vision purement theorique. Son role est de servir de reference technique centrale pour l'equipe, pour les revues de code, pour l'onboarding, pour les choix d'evolution, pour la qualite logicielle et pour la preparation du deploiement.

Le principe de base est simple: ce document doit refleter le code reel du repository. Lorsqu'un module change, lorsqu'un flux critique evolue, lorsqu'une regle transversale est renforcee, la documentation doit evoluer en meme temps. Le but n'est pas d'ecrire une architecture ideale deconnectee du projet, mais de disposer d'un document fiable qui explique clairement ce que le backend fait aujourd'hui, comment il est structure, comment les couches communiquent et quels principes sont consideres comme non negociables.

Cette documentation est donc un document de travail vivant. Elle doit pouvoir etre partagee a un developpeur backend, a un architecte logiciel, a un responsable produit ou a un membre de l'equipe mobile sans perdre en clarte. Elle doit etre assez detaillee pour guider l'implementation et assez stable pour servir de base commune a l'ensemble du projet.

## 2. Vision generale du backend Jokko

Le backend Jokko est construit comme une API modulaire NestJS organisee autour des domaines metier du produit. Le projet n'est pas concu comme une juxtaposition de CRUD techniques. Il est structure pour supporter un veritable systeme transactionnel de marketplace mobile, avec des flux critiques qui lient l'identite, les reservations, les paiements, l'escrow, la notification et la tracabilite.

L'architecture suit une logique de separation forte des responsabilites. Les controllers recoivent et valident les requetes, les services applicatifs orchestrent les cas d'usage, les objets de domaine portent les regles metier et les repositories ou adapters d'infrastructure encapsulent l'acces a la base et aux services externes. Cette organisation permet de garder un code testable, evolutif et comprehensible, tout en reduisant le couplage entre les briques.

Le backend est egalement pense pour une application Flutter unique ciblee Android et iOS. Cela implique une API stable, des reponses uniformes, des messages francais centralises, une gestion stricte des erreurs et une attention particuliere a la robustesse des flux sensibles, notamment autour des reservations, des paiements et des notifications client.

Le projet ne se limite toutefois pas au mobile. L'architecture backend actuelle est concue pour devenir la base commune de plusieurs interfaces clientes:

- application mobile Android distribuee via le Play Store
- application mobile iOS distribuee via l'App Store
- future application web
- futur site internet Jokko

Cette orientation est importante. Elle signifie que le backend ne doit pas etre pense comme une API reservee a une seule interface temporaire, mais comme une plateforme centralisee de services metier partagee par plusieurs canaux de consommation.

### 2.1 Description produit resumee

Jokko est une plateforme de mise en relation entre clients et professionnels. Le backend porte les briques critiques du produit:

- gestion des comptes et de l'authentification
- gestion des profils professionnels et du KYC
- recherche de professionnels verifies
- creation et suivi des reservations
- paiements securises et escrow
- notifications in-app, SMS, email et push
- observabilite, audit et robustesse transversale

Le backend doit donc rester compatible avec un usage mobile natif, un usage web et des besoins de supervision ou d'administration.

## 3. Socle technique actuel

### 3.1 Framework et langage

Le backend repose sur NestJS pour la structure applicative, l'injection de dependances, les modules, les controllers, les guards et le cycle de vie de l'application. Le code est entierement ecrit en TypeScript, ce qui permet un typage strict, une meilleure fiabilite et une meilleure lisibilite des contrats entre couches.

### 3.2 Persistance et base de donnees

La persistance est assuree par PostgreSQL. L'acces a la base est centralise via Prisma. Le projet utilise un schema unique dans `backend/prisma/schema.prisma` et un `PrismaService` qui constitue le point d'entree unique vers la base depuis les repositories d'infrastructure.

Le service Prisma est configure avec l'adapter `@prisma/adapter-pg` et une pool `pg`. La connexion est construite a partir de `DATABASE_URL`. Si cette variable est absente, l'application refuse explicitement de demarrer. Ce choix va dans le sens d'un backend qui echoue vite lorsqu'une dependance critique n'est pas disponible, plutot que d'accepter un demarrage incomplet.

### 3.3 Securite et execution HTTP

Le bootstrap applique plusieurs protections globales. L'application active `helmet` pour le durcissement des en-tetes HTTP, configure le CORS a partir des variables d'environnement, applique un `ValidationPipe` global avec `whitelist`, `forbidNonWhitelisted`, `forbidUnknownValues` et `transform`, puis enregistre un filtre global `ApiExceptionFilter`. L'API utilise un prefixe global `/api/v1`, ce qui stabilise la surface d'exposition publique et prepare les futures evolutions de versioning.

### 3.4 Authentification et protection des routes

L'authentification repose sur JWT, avec un couple access token et refresh token. Les endpoints proteges utilisent `JwtAuthGuard`. Les routes d'administration combinent ce guard avec `RolesGuard`. Le module auth gere egalement OTP, login mot de passe, login Google, refresh et logout.

### 3.5 Evenements et transversal

Le projet charge `EventEmitterModule` dans `CoreModule` et expose un bus de domaine via `DOMAINE_EVENT_BUS`. L'implementation actuelle passe par `OutboxEventBusService`, ce qui montre que le projet ne se limite pas a un simple event emitter technique mais prepare deja une logique plus robuste de publication et de tracabilite d'evenements.

### 3.6 Validation, messages et ergonomie API

Les validations de DTO sont centralisees via `class-validator`, avec des messages francais references dans un catalogue unique. Les messages applicatifs et codes HTTP sont eux aussi centralises. Les reponses de succes sont homogenes via `createApiResponse`, ce qui offre une forme de contrat d'API stable pour le frontend Flutter.

## 4. Composition actuelle de l'application

Le module racine `AppModule` importe actuellement les modules suivants:

- `SharedModule`
- `CoreModule`
- `PrismaModule`
- `SanteModule`
- `AuthModule`
- `UsersModule`
- `ProfessionalsModule`
- `CategoriesModule`
- `SearchModule`
- `NotificationsModule`
- `ReservationsModule`
- `PaymentsModule`

Cette liste represente l'etat reel du backend aujourd'hui. Elle montre que le projet a deja depasse le stade de la simple fondation technique. Les modules critiques du produit sont deja presents et relies entre eux.

L'`AuditLoggerMiddleware` est applique globalement sur toutes les routes depuis `AppModule`. Cela signifie que toute requete HTTP passee par l'application peut produire une trace d'audit selon son contexte, sa route, son utilisateur, son temps de traitement et des metadonnees de contexte.

## 5. Arborescence generale du backend

Le backend est organise autour d'un noyau transverse, de modules metier et d'un espace de persistance/documentation.

```text
backend/
  src/
    app.module.ts
    main.ts
    auth/
    categories/
    core/
    notifications/
    payments/
    prisma/
    professionals/
    search/
    reservations/
    sante/
    shared/
    users/
  prisma/
    schema.prisma
    migrations/
    seed.ts
    full-seed.ts
  test/
    *.e2e-spec.ts
  docs/
    ARCHITECTURE_PROFESSIONNELLE.md
    TABLEAU_MESSAGES_HTTP.md
    STANDARDS_MODULES_BACKEND.md
```

Cette structure separe clairement le code applicatif, la definition de la base de donnees, les tests de bout en bout et les documents de reference. C'est un point important pour la lisibilite du projet et pour sa maintenance dans le temps.

## 6. Architecture par couches

La plupart des modules metier suivent une organisation par couches inspiree de la Clean Architecture et du DDD pragmatique.

```text
src/<module>/
  domain/
  application/
  infrastructure/
  presentation/
  <module>.module.ts
```

Cette structure est une convention forte du projet. Elle garantit que les responsabilites sont distribuees correctement et que les choix techniques n'envahissent pas le coeur metier.

### 6.1 Couche presentation

La couche presentation contient les controllers HTTP, les DTOs, les decorations Swagger et les elements lies a l'interface API. Son role est de recevoir les entrees, de s'appuyer sur la validation, de faire appel au bon service applicatif et de retourner une reponse normalisee.

Dans Jokko, cette couche ne doit pas contenir de logique metier. Un controller ne calcule pas de commission, ne decide pas d'une transition d'etat metier et ne parle pas directement a Prisma. Il oriente simplement la requete vers la bonne orchestration applicative.

### 6.2 Couche application

La couche application porte les services qui orchestrent les cas d'usage. C'est ici que sont composes les flux metier, que les ports sont appeles et que plusieurs operations sont enchainees dans le bon ordre.

Cette couche est volontairement separee des details techniques. Elle ne doit pas dependra d'un repository Prisma concret ni d'un provider externe concret. Elle depend de ports et de contrats. C'est ce qui permet de tester les cas d'usage proprement et de faire evoluer l'infrastructure sans reecrire la logique fonctionnelle.

### 6.3 Couche domaine

La couche domaine contient les entites, les value objects, les erreurs metier, les evenements de domaine et les regles qui n'ont pas vocation a dependre de NestJS ou de Prisma. C'est la couche qui exprime le langage du metier.

Lorsqu'une regle concerne l'identite, un statut, un type de paiement, un montant, une reservation ou une notification, elle doit vivre ici ou etre au minimum protegee de la couche presentation.

### 6.4 Couche infrastructure

La couche infrastructure branche les details concrets: repositories Prisma, adapters de paiement, adapters d'email, de SMS, de push, securisation HMAC des webhooks, persistance de l'idempotence, ledger wallet, etc.

Cette couche est le seul endroit ou l'on doit trouver l'acces a la base de donnees et les integrations techniques externes. C'est aussi la couche qui implemente les ports definis par l'application.

## 7. Regles de dependance

Le sens des dependances est un point structurant du projet. La regle generale est la suivante:

- `presentation -> application`
- `application -> domain`
- `application -> ports`
- `infrastructure -> application + domain`
- `domain -> aucune couche technique`

Concretement, cela signifie plusieurs choses importantes. D'abord, un controller ne doit jamais manipuler Prisma. Ensuite, un service applicatif ne doit pas importer directement un repository concret d'infrastructure, mais un port. Enfin, un objet de domaine ne doit pas dependre de `@nestjs/common`, d'Express, de Swagger ou de `@prisma/client`.

Ce sens de dependance est ce qui permet au backend de rester stable a mesure qu'il grossit. Sans cette discipline, les modules critiques finissent vite par se melanger et deviennent difficiles a tester, a corriger et a faire evoluer.

## 8. Bootstrap global et comportement runtime

Le point d'entree du serveur est `backend/src/main.ts`. Au demarrage, l'application cree l'instance Nest, recupere `ConfigService`, active `helmet`, active le CORS selon `CORS_ORIGINS` et `NODE_ENV`, configure `trust proxy`, applique le `ValidationPipe` global, applique `ApiExceptionFilter`, fixe le prefixe `/api/v1`, active les shutdown hooks puis ecoute sur `PORT` ou `3000`.

Le bootstrap initialise egalement Swagger avec `DocumentBuilder` et `SwaggerModule`. La documentation interactive de l'API est exposee sur `/api/docs`. Elle reprend les tags par module, les DTOs, les parametres de route et de query, ainsi que les principales reponses de succes et d'erreur. Cette documentation est concue comme une vue d'exploration rapide du backend pour les developpeurs backend, mobile et QA.

### 8.1 URLs de travail par environnement

Les URLs de reference actuellement retenues sont les suivantes.

#### Local

- API locale: `http://localhost:3000/api/v1`
- Swagger local: `http://localhost:3000/api/docs`
- endpoint sante local: `http://localhost:3000/api/v1/sante`

#### Production cible

- API production cible: `https://api.jokko.sn/api/v1`
- Swagger production cible: `https://api.jokko.sn/api/docs`
- endpoint sante production cible: `https://api.jokko.sn/api/v1/sante`

Ces URLs sont documentees pour servir de base commune a l'equipe backend, a l'equipe mobile Flutter, a la future interface web et a l'integration du futur site internet.

Le comportement CORS est volontairement prudent. Si `CORS_ORIGINS` est renseigne, seules les origines configurees sont acceptees. En production, si rien n'est configure, aucun origin n'est autorise par defaut. En developpement, le systeme reste plus permissif pour faciliter le travail local.

Ce bootstrap donne une base d'execution saine: validation stricte, surface d'API uniforme, securite de base activee et comportement previsible entre environnements.

## 9. Noyau transverse du projet

### 9.1 CoreModule

`CoreModule` est global et joue un role central. Il charge `ConfigModule` avec validation d'environnement via `validerEnv`, `EventEmitterModule`, `ThrottlerModule`, `OutboxEventBusService`, `AuditService`, `AuditLoggerMiddleware` et le `APP_GUARD` base sur `ThrottlerGuard`.

Ce module est le point de regroupement des regles transverses qui doivent s'appliquer a tout le backend. Il concentre la configuration, la protection globale et le socle commun necessaire aux modules metier.

### 9.2 PrismaModule

`PrismaModule` encapsule `PrismaService`. Il constitue le point d'entree unique vers la base. Les modules metier n'ont pas a recreer de connexion ni a contourner ce service.

### 9.3 SharedModule

`SharedModule` contient les composants mutualises qui n'appartiennent pas a un seul domaine metier. On y retrouve notamment des DTOs generiques, des guards partages et des briques de support.

### 9.4 Gestion des erreurs

Le backend utilise `ApiExceptionFilter` pour homogeniser les erreurs renvoyees au client. La forme de reponse d'erreur est stable: `success`, `statusCode`, `errorCode`, `message`, `timestamp` et `path`.

Le filtre traite les erreurs Nest standard, mais aussi les erreurs de domaine partagees comme `ValidationError`, `ConflictError` et `NotFoundError`. Cela permet d'avoir un comportement coherent entre la logique metier et la couche HTTP.

### 9.5 Validation

Le `ValidationPipe` global s'appuie sur `buildValidationException`. Ce composant transforme les erreurs `class-validator` en une structure HTTP standard et resolve les cles de validation via le catalogue central des messages. Cela evite de disperser des messages bruts dans toute l'application.

### 9.6 Audit

`AuditLoggerMiddleware` intercepte la fin des reponses HTTP pour enregistrer un journal d'audit. Le systeme determine un type d'action a partir du chemin et de la methode HTTP, tente de retrouver l'utilisateur courant, enregistre l'IP, le user agent, la duree et, si disponibles, les coordonnees geographiques envoyees par le client.

Ce mecanisme est important pour la conformite, l'analyse d'incidents et le suivi des actions sensibles comme login, KYC, paiement ou reservation.

## 10. Modules metier implementes

### 10.1 AuthModule

`AuthModule` gere l'identite et l'authentification. C'est un module de reference en termes de separation entre presentation, application, domaine et infrastructure.

Il prend en charge l'envoi d'OTP, la verification d'OTP, l'inscription classique, la connexion par mot de passe, la connexion Google, la rotation de refresh token, le logout et la lecture du profil courant via `/auth/me`.

Sa structure inclut des ports applicatifs, des services dedies comme `JwtTokenService`, `PasswordHashService`, `RefreshSessionService`, des repositories d'infrastructure distincts et des objets de domaine autour de l'utilisateur auth et des tokens. Ce module montre bien la philosophie du projet: les controllers deleguent, les services orchestrent et les repositories persistents restent encapsules.

### 10.2 UsersModule

`UsersModule` gere le profil courant de l'utilisateur connecte. Il expose la lecture du profil, la mise a jour partielle, la mise a jour de l'avatar, la lecture de l'historique et l'anonymisation du compte.

Ce module est volontairement plus simple qu'auth ou payments, mais il suit la meme logique d'architecture. La lecture et la mise a jour passent par `UsersService`, les DTOs vivent en presentation et les acces base sont regroupes dans un repository dedie.

### 10.3 ProfessionalsModule

`ProfessionalsModule` est l'un des modules coeur du produit. Il gere le profil professionnel, le KYC, les services proposes, le portfolio, les disponibilites et les endpoints publics de consultation.

Ce module couvre des besoins metier riches: creation de profil prestataire, mise a jour, soumission KYC, creation et gestion des offres, exposition publique du profil et vues publiques annexes comme les services, disponibilites, portfolio et reviews. Il comprend egalement un controller admin dedie aux decisions KYC.

Par sa taille et son importance fonctionnelle, ce module sert de tres bon exemple de module metier complet dans Jokko. Il montre comment un domaine riche peut rester lisible lorsqu'il est correctement decoupe.

### 10.4 CategoriesModule

`CategoriesModule` gere les categories publiques et leur administration. Le module expose une liste publique de categories actives et un ensemble d'actions admin pour creer, mettre a jour et desactiver une categorie.

C'est un module simple, mais utile comme reference de CRUD metier propre. Il montre comment un flux apparemment basique peut tout de meme respecter les conventions du projet: DTOs, facade applicative, controle des roles, messages centralises et repository dedie.

### 10.5 SearchModule

`SearchModule` est le module dedie a la recherche publique des professionnels verifies. Il centralise les filtres par ville, categorie, texte libre, geolocalisation et pagination. La requete de lecture est portee par un repository SQL/PostGIS dedie, ce qui evite d'alourdir le module `professionals` avec une logique de recherche transversale.

Ce module applique un principe important du backend Jokko: une seule responsabilite par logique metier. La route `GET /api/v1/search/professionals` est la reference fonctionnelle pour la recherche publique. La route `GET /api/v1/professionals` reste exposee pour compatibilite, mais elle delegue desormais a la meme logique `search` afin d'eliminer la duplication et de garantir des resultats identiques.

### 10.6 ReservationsModule

`ReservationsModule` gere le cycle de vie des reservations. Il couvre la creation d'une reservation, la creation depuis negotiation, la lecture des reservations du compte courant, la lecture d'une reservation par identifiant, la confirmation, l'annulation, la reprogrammation, la completion, le no-show, le marquage comme payee, le demarrage, l'ouverture d'un litige et les vues admin de liste, detail et statistiques.

C'est un module charniere entre le domaine des services et le domaine financier. Il relie client, professionnel, service, calendrier, statut metier et flux de notification. Il joue donc un role central dans la cohesion du backend.

### 10.7 PaymentsModule

`PaymentsModule` gere le paiement a partir d'une reservation, le webhook provider, l'escrow, les retraits et les vues d'administration financiere.

Il expose notamment l'initiation d'un paiement, le traitement d'un webhook, l'historique client des paiements, l'historique des retraits professionnel, la demande de retrait, le detail d'un paiement, la liberation de l'escrow, la mise en litige de l'escrow, la consultation du statut escrow et les vues admin de liste, statistiques, remboursement et traitement des escrow en attente.

Ce module est structure autour de plusieurs services applicatifs specialises, de ports, de repositories techniques et d'adapters de passerelles de paiement. Il integre aussi l'idempotence, le ledger wallet et des adapters pour Wave, Orange Money, carte et un gateway mock.

### 10.8 NotificationsModule

`NotificationsModule` est aujourd'hui un module complet et autonome, et non plus une logique secondaire dispersee dans les autres domaines. Il centralise les notifications in-app, le marquage lu et tout lu, la mise a jour du token FCM, la creation des notifications liees aux reservations, la creation des notifications liees aux paiements, l'enregistrement des communications reservation par email et SMS et la preparation des envois email, SMS et push.

Ce module est structure avec un service applicatif generique `NotificationsService`, des services specialises comme `PaymentNotificationService` et `ReservationClientNotificationService`, un service transverse `NotificationDeliveryService`, des repositories dedies et des adapters d'envoi `Resend`, `Twilio` et `FCM`.

Cette centralisation est tres importante architecturalement. Elle permet d'eviter que les modules `reservations` ou `payments` se mettent a gerer eux-memes les details d'email, de SMS ou de push. Chaque module metier signale un besoin de notification, puis `notifications` prend le relai proprement.

### 10.9 SanteModule

`SanteModule` expose un endpoint simple de sante. C'est un module volontairement minimal, mais utile pour la supervision, la verification de demarrage et les tests rapides de disponibilite du backend.

## 11. Structure interne par module: realite du projet

Tous les modules ne sont pas strictement identiques fichier par fichier, mais ils suivent une logique commune. La structure de reference observee dans le code ressemble a ceci:

```text
src/<module>/
  application/
    commands/
    mappers/              # present selon le besoin
    ports/
    services/
  domain/
    entities/
    errors/
    events/               # present selon le besoin
    validators/           # present selon le besoin
    value-objects/
    index.ts
  infrastructure/
    repositories/
    adapters/             # present si le module parle a l'exterieur
  presentation/
    controllers/
    dto/
  <module>.module.ts
```

Le projet suit donc un standard ferme sur les grandes couches, tout en gardant un peu de pragmatisme a l'interieur des modules. Un module n'est pas oblige d'avoir un dossier `adapters` ou `events` s'il n'en a pas besoin, mais il doit rester coherent avec la logique globale.

## 12. Surface API reelle exposee aujourd'hui

### 12.1 Auth

- `POST /api/v1/auth/otp/send`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/google/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### 12.2 Users

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `POST /api/v1/users/me/avatar`
- `GET /api/v1/users/me/history`
- `DELETE /api/v1/users/me`

### 12.3 Search

- `GET /api/v1/search/professionals`

Ce endpoint est la reference metier pour la recherche publique des professionnels verifies. Il supporte la ville, la categorie, le texte libre, la geolocalisation et la pagination. La route `GET /api/v1/professionals` reutilise la meme logique afin d'eviter la repetition et de maintenir un contrat public coherent.

### 12.4 Professionals

- `POST /api/v1/professionals/profile`
- `GET /api/v1/professionals/me`
- `PATCH /api/v1/professionals/me`
- `PATCH /api/v1/professionals/me/kyc/submit`
- `POST /api/v1/professionals/me/services`
- `PATCH /api/v1/professionals/me/services/:serviceId`
- `DELETE /api/v1/professionals/me/services/:serviceId`
- `POST /api/v1/professionals/me/portfolio`
- `DELETE /api/v1/professionals/me/portfolio/:itemId`
- `POST /api/v1/professionals/me/availabilities`
- `DELETE /api/v1/professionals/me/availabilities/:availabilityId`
- `GET /api/v1/professionals`
- `GET /api/v1/professionals/:id`
- `GET /api/v1/professionals/:id/services`
- `GET /api/v1/professionals/:id/portfolio`
- `GET /api/v1/professionals/:id/availabilities`
- `GET /api/v1/professionals/:id/reviews`
- `PATCH /api/v1/admin/kyc/:professionalId/approve`
- `PATCH /api/v1/admin/kyc/:professionalId/reject`

### 12.5 Categories

- `GET /api/v1/categories`
- `POST /api/v1/admin/categories`
- `PATCH /api/v1/admin/categories/:categoryId`
- `PATCH /api/v1/admin/categories/:categoryId/disable`

### 12.6 Reservations

- `POST /api/v1/reservations`
- `POST /api/v1/reservations/from-negotiation`
- `GET /api/v1/reservations/my`
- `GET /api/v1/reservations/:reservationId`
- `PATCH /api/v1/reservations/:reservationId/confirm`
- `PATCH /api/v1/reservations/:reservationId/cancel`
- `PATCH /api/v1/reservations/:reservationId/reschedule`
- `PATCH /api/v1/reservations/:reservationId/complete`
- `PATCH /api/v1/reservations/:reservationId/no-show`
- `PATCH /api/v1/reservations/:reservationId/mark-paid`
- `PATCH /api/v1/reservations/:reservationId/start`
- `PATCH /api/v1/reservations/:reservationId/dispute`
- `GET /api/v1/admin/reservations`
- `GET /api/v1/admin/reservations/:reservationId`
- `GET /api/v1/admin/reservations/statistics`

### 12.6 Payments

- `POST /api/v1/payments/initiate`
- `POST /api/v1/payments/webhook`
- `GET /api/v1/payments/history`
- `GET /api/v1/payments/withdrawals`
- `POST /api/v1/payments/withdraw`
- `GET /api/v1/payments/:paymentId`
- `PATCH /api/v1/payments/:paymentId/escrow/release`
- `PATCH /api/v1/payments/:paymentId/escrow/dispute`
- `GET /api/v1/payments/:paymentId/escrow/status`
- `GET /api/v1/admin/payments`
- `GET /api/v1/admin/payments/statistics`
- `GET /api/v1/admin/payments/:paymentId`
- `POST /api/v1/admin/payments/:paymentId/refund`
- `GET /api/v1/admin/payments/escrow/pending`
- `POST /api/v1/admin/payments/escrow/process-pending`

### 12.7 Notifications

- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/read-all`
- `PATCH /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/device-token`

### 12.8 Sante

- `GET /api/v1/sante`

## 13. Format des reponses API

Le backend renvoie des reponses de succes homogenes via `createApiResponse`.

La structure de succes est la suivante:

```json
{
  "success": true,
  "data": {},
  "message": "...",
  "meta": {}
}
```

Le `message` et `meta` peuvent etre absents selon le cas d'usage. Pour les listes paginees, `meta.pagination` est renseigne via `createPaginatedResponse`.

La structure d'erreur est la suivante:

```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "VALIDATION_REQUEST_INVALID",
  "message": "Les donnees envoyees sont invalides.",
  "timestamp": "2026-04-24T10:00:00.000Z",
  "path": "/api/v1/..."
}
```

Cette uniformite est importante pour Flutter. Elle permet de centraliser le traitement des erreurs et des succes dans la couche cliente sans multiplier les cas speciaux.

## 14. Base de donnees et modeles structurants

Le schema Prisma est riche. Les modeles qui structurent le plus l'architecture actuelle sont les suivants.

### 14.1 Utilisateur

`Utilisateur` est le pivot identitaire du systeme. Il porte notamment le telephone, le nom, l'email, le role, l'etat actif et le token FCM. Il est relie a l'authentification, aux reservations, aux paiements, aux notifications et a l'audit.

### 14.2 ProfilProfessionnel

`ProfilProfessionnel` specialise l'utilisateur en tant que prestataire. Il concentre les informations de bio, KYC, disponibilite, rating, portefeuille et positionnement metier.

### 14.3 Reservation

`Reservation` porte le coeur du flux de booking. Elle relie client, professionnel, service et statut metier. C'est l'entite de coordination entre la prestation et le paiement.

### 14.4 Paiement

`Paiement` relie une reservation a son flux financier. Il contient le montant total, la commission Jokko, le montant net professionnel, la methode, le statut, les references gateway et les informations d'escrow.

### 14.5 Notification

`Notification` represente la notification in-app persistante. Elle contient l'utilisateur cible, le type, le titre, le contenu, les donnees associees et l'etat de lecture.

### 14.6 CommunicationReservation

`CommunicationReservation` est une table tres importante pour la tracabilite des emails et SMS lies a une reservation. Elle permet de conserver le canal, le destinataire, le sujet, le corps, le provider, un identifiant provider, le statut d'envoi, l'erreur eventuelle, des metadonnees et la date d'envoi.

Cette table montre que Jokko ne se contente pas d'essayer d'envoyer une communication. Le systeme garde une trace exploitable de ce qui a ete prepare, envoye ou ignore, ce qui est essentiel pour une application transactionnelle.

### 14.7 Tables techniques et de robustesse

Le backend prepare aussi des briques de robustesse comme l'outbox event, l'idempotence, l'audit et les historiques techniques. Cela montre que l'architecture anticipe la montee en charge et la fiabilisation progressive des flux critiques.

## 15. Flux metier critiques actuellement relies

### 15.1 Flux d'authentification

Le flux d'authentification commence en presentation avec les DTOs, puis passe par `AuthService` et ses services auxiliaires. Les repositories lisent et ecrivent l'etat d'authentification, les mots de passe sont hashes, les OTP sont verifies et les tokens JWT sont generes. Le refresh repose sur une logique de rotation et de persistance de session, ce qui renforce la securite par rapport a un refresh token purement stateless.

### 15.2 Flux de reservation

Lorsqu'une reservation est creee, le controller ne fait qu'appeler la facade de reservation. La couche application valide le contexte, controle la coherence du professionnel et du service, applique les regles metier de creation, persiste la reservation puis declenche les notifications adequates.

Le module reservations ne porte plus directement toute la logique de communication email, SMS ou push. Il s'appuie sur le module notifications, ce qui est un bon signe de maturite architecturale.

### 15.3 Flux de paiement a partir d'une reservation

Le paiement se construit a partir d'une reservation. L'initiation passe par `PaymentsFacade`, les services applicatifs specialises orchestrent l'idempotence, la selection de gateway, la creation du paiement et la persistance technique. Le webhook provider vient ensuite confirmer ou faire evoluer l'etat du paiement.

Lorsque les transitions critiques sont atteintes, le module peut mettre a jour l'escrow, le ledger et la reservation concernee, puis deleguer la notification au module notifications. Ce flux est important parce qu'il relie plusieurs modules sans leur faire perdre leur responsabilite propre.

### 15.4 Flux de notification

Le module notifications centralise plusieurs niveaux de sortie. D'abord, il cree une notification in-app persistante. Ensuite, selon le contexte, il peut preparer et tenter un envoi email, SMS ou push.

Le service `NotificationDeliveryService` agit comme orchestrateur technique. Il n'est pas confondu avec la logique metier de reservation ou de paiement. Les adapters concrets `ResendEmailNotificationAdapter`, `TwilioSmsNotificationAdapter` et `FcmPushNotificationAdapter` encapsulent les details techniques d'envoi.

Lorsque les providers ne sont pas encore configures, le backend reste stable et marque les communications de maniere explicite, au lieu d'echouer silencieusement. C'est une bonne pratique pour un projet qui va passer progressivement du mode developpement au mode production.

## 16. Systeme de messages centralises

Le backend centralise plusieurs familles de messages:

- les messages applicatifs HTTP
- les messages de validation DTO
- les messages techniques
- les messages de notification reservation
- les messages de notification paiement
- les messages de documentation Swagger

Les fichiers structurants sont notamment:

- `src/core/messages/app-message.catalog.ts`
- `src/core/messages/validation-message.catalog.ts`
- `src/core/messages/technical-message.catalog.ts`
- `src/core/messages/reservation-notification.messages.ts`
- `src/core/messages/payment-notification.messages.ts`
- `src/core/messages/api-docs.messages.ts`
- `src/core/http/http-status-codes.ts`
- `src/core/http/app-messages.ts`

Ce choix est central pour le projet. Il permet d'eviter la duplication des libelles, d'harmoniser l'experience frontend et de reduire les divergences entre les modules.

## 17. Qualite logicielle et conventions observees

### 17.1 Controllers minces

Le projet suit globalement une regle claire: pas de logique metier dans les controllers. Les controllers lisent les DTOs, recuperent l'utilisateur courant, appliquent guards et roles, puis deleguent a des services applicatifs ou des facades.

### 17.2 Services responsables de l'orchestration

Les services applicatifs portent la coordination des cas d'usage. Ils appellent les ports, composent les operations et prennent les decisions applicatives attendues.

### 17.3 Repositories limites a l'infrastructure

Les acces base sont regroupes dans les repositories d'infrastructure. Cette separation est importante pour maintenir une bonne testabilite et respecter le principe de responsabilite unique.

### 17.4 Typage strict

Le projet poursuit une discipline forte autour du typage et cherche a eviter `any`. Cette contrainte participe directement a la qualite du code et a la solidite du backend.

### 17.5 Messages en francais

Les validations et les messages applicatifs exposes doivent etre en francais clair, explicite et centralise. Cela correspond a la realite fonctionnelle du projet et a l'experience attendue sur le marche cible.

## 18. Securite transversale

Le backend a deja plusieurs fondations de securite solides:

- JWT pour les endpoints proteges
- `RolesGuard` pour les endpoints admin
- throttling global
- validation stricte des requetes
- `helmet`
- webhook de paiement securisable
- audit middleware global
- centralisation des erreurs

Ces briques ne suffisent pas a elles seules a qualifier une architecture de production enterprise complete, mais elles constituent un socle serieux et coherent pour la phase actuelle du projet.

## 19. Scalabilite, robustesse et limites actuelles

L'architecture actuelle est robuste dans sa structure. Les modules sont decouples, les flux critiques sont identifies, la persistance est centralisee et la separation des couches est clairement posee. Les modules `payments` et `notifications` montrent en particulier une bonne maturite en termes de ports, adapters et tracabilite.

Le projet prepare deja certains besoins de robustesse comme l'idempotence, l'outbox, l'audit et le ledger. Cela dit, pour atteindre un niveau de production tres eleve sur trafic important, plusieurs briques pourront encore etre industrialisees davantage:

- broker durable externe
- queues de jobs asynchrones
- retries automatiques avec backoff
- workers separes pour les traitements lourds
- observabilite avancee
- preferences utilisateur de notification
- monitoring de delivery email, SMS et push

Il est important de comprendre que ces evolutions futures ne remettent pas en cause la qualite de la structure actuelle. Au contraire, elles seront plus simples a ajouter parce que l'architecture a deja ete pensee pour le decouplage.

## 20. Documentation associee

Ce document doit etre lu avec:

- `backend/docs/TABLEAU_MESSAGES_HTTP.md` pour le referentiel complet des messages et codes
- `backend/docs/STANDARDS_MODULES_BACKEND.md` pour les conventions d'implementation module par module
- `backend/docs/cahier_des_charges_jokko.md` pour la reference produit et metier

Les trois documents sont complementaires. L'architecture explique l'organisation et les flux. Le tableau des messages explique les conventions de reponse et les catalogues. Le standard des modules explique comment developper ou faire evoluer un module sans casser la coherence globale.

## 21. Conclusion

Le backend Jokko est aujourd'hui une base serieuse, modulaire et professionnelle. Il ne s'agit plus d'une simple ossature NestJS en attente de construction. Les modules auth, users, professionals, categories, reservations, payments et notifications sont deja presents et relies entre eux. Les couches sont identifiables, les reponses HTTP sont homogenes, les messages sont centralises, la securite de base est activee, l'audit est present et les flux reservation-paiement-notification sont reels.

La vraie force de cette architecture est sa coherence. Elle cherche a proteger le metier des details techniques, a reduire le couplage, a rendre les modules lisibles et a preparer une croissance progressive du niveau de robustesse. Ce document doit donc rester la reference qui explique non seulement ce que le projet veut devenir, mais surtout ce qu'il est deja aujourd'hui et la maniere dont il doit continuer a evoluer.

## Annexe A. Contrats de reponse HTTP standardises

Le backend Jokko utilise une convention de reponse unique, appliquee a tous les modules. Cette convention est maintenant documentee aussi bien dans le code que dans Swagger grace a des DTOs de reponse dedies situes dans `src/shared/swagger/api-response-swagger.dto.ts`.

### A.1 Reponse de succes standard

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "message": "Operation effectuee avec succes.",
  "meta": null
}
```

### A.2 Reponse de succes paginee

```json
{
  "success": true,
  "data": [],
  "message": "Resultats recuperes avec succes.",
  "meta": {
    "pagination": {
      "total": 24,
      "page": 1,
      "limit": 20,
      "totalPages": 2,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

### A.3 Reponse d'erreur standard

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

### A.4 Codes HTTP de reference

| Code | Sens | Structure |
|---|---|---|
| `200` | succes standard | `success + data + message + meta?` |
| `201` | creation reussie | `success + data + message + meta?` |
| `400` | requete invalide | `success=false + statusCode + errorCode + message + timestamp + path` |
| `401` | non authentifie | `success=false + statusCode + errorCode + message + timestamp + path` |
| `403` | action interdite | `success=false + statusCode + errorCode + message + timestamp + path` |
| `404` | ressource introuvable | `success=false + statusCode + errorCode + message + timestamp + path` |
| `409` | conflit metier | `success=false + statusCode + errorCode + message + timestamp + path` |
| `429` | limitation de debit | `success=false + statusCode + errorCode + message + timestamp + path` |
| `500` | erreur interne | `success=false + statusCode + errorCode + message + timestamp + path` |

## Annexe B. DTOs Swagger de reponse

Pour rendre Swagger precis et exploitable, le projet utilise les elements suivants:

- `ApiSuccessEnvelopeSwaggerDto`
- `ApiErrorSwaggerDto`
- `ApiMetaSwaggerDto`
- `PaginationSwaggerDto`
- `ApiStandardSuccessResponse`
- `ApiStandardErrorResponse`

Ces briques ne changent pas l'execution metier du backend. Elles servent a documenter explicitement les champs `data`, `message` et `meta` ainsi que les erreurs normalisees. Cela evite les schemas implicites ou trop vagues dans Swagger.

## Annexe C. Jeux de donnees de test documentes

Les exemples Swagger et les scenarios de test s'appuient sur des donnees de reference stables.

### C.1 Identifiants de reference

- utilisateur client: `550e8400-e29b-41d4-a716-446655440000`
- reservation: `650e8400-e29b-41d4-a716-446655440001`
- categorie: `750e8400-e29b-41d4-a716-446655440002`
- professionnel: `850e8400-e29b-41d4-a716-446655440003`
- notification: `950e8400-e29b-41d4-a716-446655440004`
- paiement: `a50e8400-e29b-41d4-a716-446655440005`

### C.2 Donnees fonctionnelles de reference

- telephone client: `+221771234567`
- email client: `client@jokko.sn`
- ville: `Dakar`
- categorie: `Plomberie`
- montant paiement de demonstration: `10000 FCFA`
- commission Jokko: `1000 FCFA`
- montant net professionnel: `9000 FCFA`
- latitude de demonstration: `14.7167`
- longitude de demonstration: `-17.4677`

## Annexe D. Cas d'erreur metier documentes endpoint par endpoint

Cette annexe sert de reference rapide pour l'equipe mobile, la QA et les futurs developpeurs backend.

### D.1 Auth

| Endpoint | Succes | Erreurs principales |
|---|---|---|
| `POST /api/v1/auth/otp/send` | `200` OTP envoye | `400` telephone invalide, `429` trop de demandes OTP |
| `POST /api/v1/auth/otp/verify` | `200` OTP verifie | `400` OTP invalide ou expire |
| `POST /api/v1/auth/register` | `201` compte cree | `400` payload invalide, `409` telephone ou email deja utilise |
| `POST /api/v1/auth/login` | `200` connexion reussie | `400` payload invalide, `401` identifiants invalides |
| `POST /api/v1/auth/google/login` | `200` connexion Google reussie | `400` payload invalide, `401` compte Google invalide ou non lie |
| `POST /api/v1/auth/refresh` | `200` token renouvele | `400` payload invalide, `401` refresh token invalide |
| `GET /api/v1/auth/me` | `200` profil recupere | `401` token invalide, `404` utilisateur introuvable |

### D.2 Users

| Endpoint | Succes | Erreurs principales |
|---|---|---|
| `GET /api/v1/users/me` | `200` profil recupere | `401` token invalide |
| `PATCH /api/v1/users/me` | `200` profil mis a jour | `400` payload vide ou invalide, `409` email deja utilise |
| `POST /api/v1/users/me/avatar` | `201` avatar mis a jour | `400` URL invalide |
| `GET /api/v1/users/me/history` | `200` historique recupere | `400` limite invalide |
| `DELETE /api/v1/users/me` | `200` compte anonymise | `401` token invalide |

### D.3 Search

| Endpoint | Succes | Erreurs principales |
|---|---|---|
| `GET /api/v1/search/professionals` | `200` resultats recuperes | `400` latitude sans longitude, longitude sans latitude, pagination invalide |

### D.4 Payments

| Endpoint | Succes | Erreurs principales |
|---|---|---|
| `POST /api/v1/payments/initiate` | `201` paiement initie | `400` payload invalide, `401` token invalide, `404` reservation introuvable, `409` etat metier incompatible |
| `POST /api/v1/payments/webhook` | `200` webhook traite | `400` payload ou signature invalide |
| `GET /api/v1/payments/history` | `200` historique recupere | `400` filtres invalides, `401` token invalide |
| `POST /api/v1/payments/withdraw` | `201` retrait cree | `400` montant ou methode invalides, `401` token invalide, `409` montant indisponible |
| `GET /api/v1/payments/:paymentId` | `200` paiement recupere | `401` token invalide, `404` paiement introuvable |
| `PATCH /api/v1/payments/:paymentId/escrow/release` | `200` escrow libere | `401` token invalide, `404` paiement introuvable, `409` etat escrow incompatible |
| `PATCH /api/v1/payments/:paymentId/escrow/dispute` | `200` litige ouvert | `400` motif invalide, `401` token invalide, `404` paiement introuvable, `409` etat escrow incompatible |
| `GET /api/v1/payments/:paymentId/escrow/status` | `200` statut recupere | `401` token invalide, `404` paiement introuvable |

### D.5 Notifications

| Endpoint | Succes | Erreurs principales |
|---|---|---|
| `GET /api/v1/notifications` | `200` notifications recuperees | `400` filtres invalides, `401` token invalide |
| `PATCH /api/v1/notifications/read-all` | `200` notifications marquees comme lues | `401` token invalide |
| `PATCH /api/v1/notifications/:id/read` | `200` notification marquee comme lue | `401` token invalide, `404` notification introuvable |
| `POST /api/v1/notifications/device-token` | `200` token FCM enregistre | `400` token invalide, `401` token invalide |
