# Standards D'Implementation Des Modules Backend

## 1. Objet du document
Ce document definit les standards d'implementation que tous les modules backend Jokko doivent respecter. Son but n'est pas d'imposer une rigidite sterile, mais de garantir que les modules restent coherents entre eux, lisibles, testables, evolutifs et conformes aux principes d'architecture du projet.

Dans Jokko, un module n'est pas seulement un dossier NestJS. C'est une unite de conception qui porte un domaine fonctionnel, une organisation de couches, des conventions de nommage, des regles de dependance et un niveau d'exigence qualite. Lorsqu'un nouveau module est cree ou lorsqu'un module existant evolue, il doit rester aligne sur ces standards.

## 2. Principes directeurs obligatoires
Les principes suivants sont consideres comme structurants pour tout le backend.

### 2.1 SOLID
Chaque classe doit avoir une responsabilite claire. Les services ne doivent pas tout faire. Les repositories ne doivent pas devenir des services metier caches. Les adapters ne doivent pas embarquer des decisions fonctionnelles. Les dependances doivent pointer vers des abstractions, pas vers des details concrets, autant que possible.

### 2.2 DRY
La duplication de logique, de messages, de validations et de conventions doit etre reduite au minimum. Lorsqu'une regle existe deja dans un catalogue, un value object, un helper partage ou un port, elle ne doit pas etre recopiee ailleurs sous une autre forme.

### 2.3 KISS
La simplicite reste une priorite. Le projet cherche une architecture serieuse, pas une complexite artificielle. Un module doit etre comprehensible par un autre developpeur sans qu'il ait besoin de reconstruire mentalement trop de couches cachees ou de conventions implicites.

### 2.4 Clean Code
Le code doit rester lisible, sobre et intentionnel. Les noms doivent etre explicites, les fonctions raisonnablement courtes, les dependances visibles et le typage strict. Le projet suit une regle forte: l'usage de `any` est a eviter completement.

### 2.5 DDD pragmatique
Le projet ne cherche pas un DDD dogmatique, mais un DDD utile. Les modules doivent exprimer le metier, proteger leurs invariants, porter des objets de domaine quand ils ont une vraie valeur et separer la logique fonctionnelle des details purement techniques.

## 3. Structure standard d'un module
La structure cible d'un module Jokko est la suivante:

```text
src/<module>/
  application/
    commands/
    queries/              # optionnel selon le besoin
    mappers/              # optionnel selon le besoin
    ports/
    services/
  domain/
    entities/
    errors/
    events/               # optionnel selon le besoin
    validators/           # optionnel selon le besoin
    value-objects/
    index.ts
  infrastructure/
    repositories/
    adapters/             # optionnel selon le besoin
  presentation/
    controllers/
    dto/
  <module>.module.ts
```

Tous les sous-dossiers ne sont pas obligatoires en toutes circonstances. En revanche, les quatre grandes couches `application`, `domain`, `infrastructure` et `presentation` constituent le socle de reference. Si un module n'a pas encore besoin d'`adapters` ou d'`events`, il peut s'en passer. Mais il ne doit pas casser la logique generale en melangeant tout dans un seul dossier.

## 4. Responsabilites par couche
### 4.1 Presentation
La couche presentation contient:
- les controllers HTTP
- les DTOs de requete
- les decorations Swagger
- les guards et roles au niveau des endpoints
- la lecture de l'utilisateur courant
- le mapping entree vers application

Elle ne doit pas contenir:
- de logique metier complexe
- d'acces a Prisma
- de calcul de commission
- de transition de statut metier
- de decisions techniques de persistance

### 4.2 Application
La couche application contient:
- les services d'orchestration
- les facades de module lorsque c'est utile
- les ports vers l'infrastructure
- les commandes et eventuellement les queries
- le chainage des cas d'usage

Elle ne doit pas contenir:
- d'import direct d'un repository Prisma concret
- de details HTTP
- de details de provider tiers
- de logique de serialisation de reponse

### 4.3 Domain
La couche domaine contient:
- les entites metier
- les value objects
- les erreurs metier
- les evenements de domaine quand ils existent
- les validateurs de domaine si necessaire

Elle ne doit pas contenir:
- de dependance a NestJS
- de dependance a Prisma
- de dependance a Express
- de decoration Swagger

### 4.4 Infrastructure
La couche infrastructure contient:
- les repositories Prisma
- les adapters de providers externes
- les mecanismes de securisation technique
- les repositories d'idempotence, webhook, ledger, audit, etc.

Elle ne doit pas absorber la logique metier du module. Si une regle fonctionnelle decide si une action est autorisee ou non, cette regle doit vivre plus haut.

## 5. Regles de dependance
Le sens de dependance a respecter est le suivant:
- `presentation -> application`
- `application -> domain`
- `application -> ports`
- `infrastructure -> application + domain`
- `domain -> aucune couche technique`

Cela implique des regles concretes:
- un controller ne parle jamais directement a Prisma
- un service applicatif depend d'un port et non d'une implementation concrete
- un repository n'est pas appele depuis un controller
- un objet de domaine n'importe pas `@nestjs/common`
- un DTO n'existe pas dans `domain`

## 6. Standards des controllers
Les controllers doivent rester minces. Ils doivent faire les choses suivantes, et rien de plus:
- recevoir le DTO
- appliquer les guards
- recuperer l'utilisateur courant si besoin
- appeler la facade ou le service applicatif
- retourner `createApiResponse`

Ils doivent aussi:
- etre documentes avec Swagger
- utiliser des routes claires et stables
- definir les statuts HTTP attendus avec `@HttpCode` lorsque necessaire
- s'appuyer sur les messages centralises au lieu d'ecrire du texte brut

Les controllers ne doivent pas:
- acceder a Prisma
- manipuler directement les entites Prisma
- dupliquer une regle metier d'un service
- reconstruire une erreur fonctionnelle deja geree ailleurs

## 7. Standards des services applicatifs
Un service applicatif orchestre un cas d'usage ou un groupe coherent de cas d'usage. Il peut appeler plusieurs ports, composer plusieurs etapes et publier des evenements si necessaire.

Un service applicatif doit:
- avoir une responsabilite claire
- travailler avec des types explicites
- s'appuyer sur des ports pour l'infrastructure
- traduire les regles metier en orchestration lisible
- rester testable independamment du framework

Un service applicatif ne doit pas:
- contenir de code HTTP
- renvoyer des objets Express
- se brancher directement a un provider technique concret si un port existe deja
- melanger plusieurs sous-domaines sans raison

Lorsque le module devient riche, il est acceptable de separer les services par responsabilite. C'est ce que montre le projet avec `payments` et `notifications`, ou plusieurs services collaborent sans devenir un bloc unique difficile a maintenir.

## 8. Standards des repositories
Les repositories vivent dans `infrastructure/repositories`. Leur role est de parler a la base, de mapper les donnees et d'implementer les ports applicatifs.

Ils doivent:
- concentrer l'acces a la persistance
- utiliser `PrismaService`
- retourner des objets et structures attends par l'application
- garder une responsabilite de persistance et non de logique produit

Ils ne doivent pas:
- contenir des decisions metier riches
- etre appeles directement depuis les controllers
- construire eux-memes des reponses HTTP

## 9. Standards des adapters
Les adapters sont utilises lorsqu'un module communique avec un systeme externe ou avec une interface technique abstraite. C'est le cas, par exemple, des passerelles de paiement, de l'envoi d'email, de SMS ou de push.

Un adapter doit:
- implementer un port explicite
- encapsuler les details techniques du provider
- rester facilement remplacable
- remonter des resultats et erreurs propres a la couche application

Un adapter ne doit pas:
- decider a la place du metier si l'action est autorisee
- connaitre les routes HTTP du projet
- dupliquer les validations deja faites en presentation ou domaine sans besoin technique reel

## 10. Standards des objets de domaine
### 10.1 Entites
Une entite de domaine doit representer une realite metier significative. Elle peut porter des comportements, des invariants et une logique propre. Une entite ne doit pas etre un simple conteneur anemique si le domaine justifie un vrai comportement.

### 10.2 Value objects
Les value objects doivent etre utilises lorsqu'une valeur a un sens metier propre: montant, mot de passe, token, email, telephone, etc. Ils doivent etre immuables, validables et expressifs.

### 10.3 Erreurs de domaine
Les erreurs de domaine doivent etre explicites et porter une intention metier. Elles sont preferees aux chaines de caracteres vagues ou aux `throw new Error(...)` sans contexte.

### 10.4 Evenements de domaine
Les evenements de domaine sont a utiliser lorsqu'un changement important merite d'etre exprime comme evenement metier. Ils sont utiles pour le decouplage, la tracabilite et l'evolution vers des traitements asynchrones plus riches.

## 11. Standards des DTOs
Les DTOs vivent uniquement dans `presentation/dto`. Ils servent a:
- valider l'entree
- documenter l'API
- transformer les donnees si necessaire

Ils doivent:
- utiliser `class-validator`
- utiliser des messages francais centralises
- utiliser Swagger (`@ApiProperty` ou equivalent) lorsque pertinent
- rester focalises sur le contrat HTTP

Ils ne doivent pas:
- contenir de logique metier
- etre reutilises comme objets de domaine
- etre appeles directement depuis l'infrastructure

## 12. Messages, codes HTTP et validations
Toutes les reponses visibles doivent suivre les conventions centralisees du projet.

Cela signifie:
- les messages HTTP visibles passent par `app-message.catalog.ts`
- les messages de validation passent par `validation-message.catalog.ts`
- les statuts HTTP passent par `http-status-codes.ts`
- les messages techniques repetitifs passent par `technical-message.catalog.ts`
- les messages de notification passent par les catalogues dedies

Un module ne doit pas multiplier les textes bruts disperses. Si une phrase est importante, repetee ou visible dans l'application, elle doit etre centralisee.

## 13. Regles de qualite complementaires
### 13.1 No `any`
Le projet suit une exigence de typage stricte. `any` ne doit pas etre utilise sauf cas exceptionnel et justifie, et meme dans ce cas il doit etre remplace des que possible par un type precis, `unknown` avec narrowing, ou une structure explicite.

### 13.2 Pas de code mort
Aucun module ne doit conserver des fonctions, constantes, imports ou fichiers non utilises sans raison claire. Le code mort complique les revues, brouille la lecture et augmente le risque de divergence.

### 13.3 Pas de duplication inutile
Si une logique apparait dans plusieurs fichiers, elle doit etre analysee et, si elle est vraiment commune, factorisee au bon niveau. La factorisation ne doit pas etre prematuree, mais la duplication durable n'est pas acceptable sur les flux critiques.

### 13.4 Pas de couplage fort inter-module
Un module peut collaborer avec un autre, mais cette collaboration doit rester lisible et limitee. Lorsqu'un domaine comme `notifications` devient transversal, il doit etre traite comme un module a part entiere, et non comme un amas de fichiers copies dans les autres domaines.

## 14. Standards de tests
Chaque module doit etre couvert par plusieurs niveaux de verification selon sa criticite.

Minimum attendu:
- tests unitaires sur les services et objets sensibles
- tests E2E sur les endpoints du module
- verification `build`
- verification `lint`

Pour les modules critiques comme `auth`, `reservations`, `payments` et `notifications`, les tests doivent couvrir les chemins heureux et les chemins d'erreur principaux.

## 15. Definition of Done d'un module
Un module peut etre considere comme termine uniquement si les points suivants sont remplis:
- la structure de couches est respectee
- les controllers sont minces et sans logique metier
- les DTOs sont valides et documentes
- les services passent par des ports si l'infrastructure est impliquee
- les repositories restent dans l'infrastructure
- les messages visibles sont centralises
- aucun `any` n'a ete ajoute
- `npm run build` passe
- `npm run lint` passe
- les tests du module passent
- les endpoints exposes sont coherents avec la documentation

## 16. Definition of Done d'un endpoint
Un endpoint est considere comme termine si:
- son DTO est valide
- sa route est claire
- son auth/role check est en place si necessaire
- sa logique metier est deleguee a l'application
- sa reponse utilise le format standard
- ses messages sont centralises
- ses erreurs metier principales sont gerees
- il est documente en Swagger
- il est couvert par un test E2E ou equivalent sur le chemin critique

## 17. Modules de reference dans le projet actuel
Plusieurs modules servent aujourd'hui de bonnes references internes:
- `auth`: bonne separation controller/service/repository, securite complete, refresh rotation
- `professionals`: bon exemple de domaine riche avec facade applicative
- `payments`: bon exemple de module complexe avec ports, adapters, ledger et idempotence
- `notifications`: bon exemple de module transversal bien extrait, avec repositories et adapters dedies
- `users`: bon exemple de module simple mais propre
- `categories`: bon exemple de CRUD admin/public bien encapsule

## 18. Regle de coherence documentaire
Chaque module implemente doit rester coherent avec:
- `ARCHITECTURE_PROFESSIONNELLE.md`
- `TABLEAU_MESSAGES_HTTP.md`
- ce document de standards

Si le code evolue et change une convention structurante, la documentation doit etre mise a jour dans le meme mouvement. Le backend ne doit pas vivre avec une architecture reelle et une architecture documentee qui se contredisent.

## 19. Conclusion
Ces standards existent pour proteger la qualite du projet a mesure qu'il grandit. Ils ne sont pas la pour ralentir l'equipe, mais pour eviter que les modules divergent, que le couplage augmente, que les messages se dispersent et que la maintenabilite baisse.

Un backend robuste ne tient pas seulement a une bonne idee de depart. Il tient surtout a la repetition disciplinee de bonnes decisions module apres module. Ce document est la reference qui doit guider cette discipline dans Jokko.

## Annexe A. Standard de documentation Swagger
Tout endpoint critique doit documenter:
- le format de succes `success + data + message + meta`
- le format d'erreur `success + statusCode + errorCode + message + timestamp + path`
- les principaux cas d'erreur metier attendus
- des exemples de donnees realistes, en francais et alignes avec les tests ou le seed

Le standard du projet repose sur les composants partages suivants:
- `ApiSuccessEnvelopeSwaggerDto`
- `ApiErrorSwaggerDto`
- `ApiMetaSwaggerDto`
- `PaginationSwaggerDto`
- `ApiStandardSuccessResponse`
- `ApiStandardErrorResponse`

Un module n'est pas considere comme suffisamment documente si Swagger laisse deviner implicitement la forme de reponse d'un endpoint critique.

## Annexe B. Exigence de coherence entre code, tests et documentation
Les exemples Swagger, les donnees de demonstration et les jeux de donnees de test doivent rester coherents entre:
- les controllers
- les DTOs de reponse Swagger
- les tests E2E
- les seeds ou full-seeds lorsque c'est pertinent
- les documents `ARCHITECTURE_PROFESSIONNELLE.md` et `TABLEAU_MESSAGES_HTTP.md`

Cette coherence est importante parce qu'elle transforme Swagger en veritable contrat d'API et non en simple documentation illustrative.


