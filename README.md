# Jokko


Jokko est une plateforme de services qui relie des clients et des prestataires verifies autour d'un cycle metier complet : recherche, reservation, negociation, discussion, paiement avec escrow, suivi temps reel, avis et gouvernance admin.

Ce repository sert de base technique du projet. Dans son etat actuel, il est principalement centre sur le backend applicatif.

## Vision du produit
Jokko vise a fournir une experience de marketplace de services fiable et industrialisable, adaptee a un usage mobile reel et a un contexte de production exigeant.

Le produit repose sur plusieurs piliers :

- confiance, avec verification des prestataires et gestion admin
- fluidite, avec recherche, reservation et discussion en temps reel
- securite, avec paiement, escrow, audit et gestion des litiges
- gouvernance, avec outils admin pour piloter la plateforme
- evolutivite, avec une architecture modulaire et documentee

## Portee actuelle du repository
Le repository contient aujourd'hui principalement :

- le backend NestJS de Jokko dans `backend/`
- la documentation technique du backend
- les scripts de build, test, Docker et Prisma associes

Arborescence racine actuelle :

```text
.
|- backend/
|- .github/
|- README.md
`- package-lock.json
```

## Backend principal
Le coeur du projet se trouve dans :

- [backend/README.md](backend/README.md)

Le backend implemente deja les domaines suivants :

- authentification
- utilisateurs
- professionnels
- categories
- recherche geolocalisee
- negotiations
- reservations
- messagerie temps reel
- live tracking
- paiements avec escrow
- notifications
- litiges
- administration
- sante applicative

## Architecture generale

Le backend suit une organisation modulaire et une separation forte des responsabilites entre :

- `presentation`
- `application`
- `domain`
- `infrastructure`

Cette approche permet de garder :

- un faible couplage inter-modules
- des regles metier protegees
- des integrations techniques encapsulees
- une meilleure testabilite
- une documentation plus fiable

## Flux metier deja couverts

Le backend n'est pas un socle vide. Il couvre deja des flux inter-modules coherents et verifies, notamment :

- auth -> profil -> professionnel
- recherche -> reservation
- negotiation -> reservation
- reservation -> discussion
- reservation -> paiement -> notification
- reservation -> suivi prestataire
- reservation -> avis
- reservation/paiement -> litige -> administration

## Documentation de reference

La documentation structurante du projet backend est centralisee dans `backend/docs/`.

Documents principaux :

- [backend/docs/ARCHITECTURE_PROFESSIONNELLE.md](backend/docs/ARCHITECTURE_PROFESSIONNELLE.md)
- [backend/docs/STANDARDS_MODULES_BACKEND.md](backend/docs/STANDARDS_MODULES_BACKEND.md)
- [backend/docs/TABLEAU_MESSAGES_HTTP.md](backend/docs/TABLEAU_MESSAGES_HTTP.md)
- [backend/docs/POSTMAN_TESTS.md](backend/docs/POSTMAN_TESTS.md)
- [backend/docs/docker-README.md](backend/docs/docker-README.md)
- [backend/docs/cahier_des_charges_jokko.md](backend/docs/cahier_des_charges_jokko.md)

Ces documents ont des roles differents :

- architecture globale
- standards de developpement
- centralisation des messages
- tests manuels
- execution Docker
- reference fonctionnelle produit

## Acces rapides backend

### Lancement local

```bash
cd backend
npm.cmd install
npm.cmd run start:dev
```

### Points d'acces

- API locale : `http://localhost:3000/api/v1`
- Swagger : `http://localhost:3000/api/docs`
- Sante : `http://localhost:3000/api/v1/sante`

### Verification minimale

```bash
cd backend
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e -- --runInBand
```

## Standards de qualite du projet

Le projet poursuit un niveau d'exigence eleve sur :

- SOLID
- DRY
- KISS
- DDD pragmatique
- clean code
- faible couplage
- centralisation des messages
- Swagger exploitable pour test manuel
- verification E2E des flux critiques

Le backend cherche a rester defendable pour une vraie mise en production, pas seulement a "fonctionner en local".

## Docker et exploitation

Le backend dispose deja :

- d'un `Dockerfile`
- d'une stack `docker-compose.dev.yml`
- d'une stack `docker-compose.prod.yml`
- d'une stack `docker-compose.yml`

Les details d'exploitation sont documentes ici :

- [backend/docs/docker-README.md](backend/docs/docker-README.md)

## Etat actuel du projet

Le coeur backend principal est deja en place. Les prochaines briques majeures encore attendues cote backend sont :

- upload media reel
- documents / factures
- parrainage

Cela veut dire que le travail restant porte surtout sur des briques de plateforme complementaires, pas sur les fondations metier principales.

## A qui sert ce README
Ce document est pense pour :

- un developpeur backend qui rejoint le projet
- un responsable technique qui veut evaluer le socle
- un integrateur mobile ou web qui veut comprendre la surface disponible
- un reviewer ou auditeur qui veut savoir ou se trouve la vraie documentation

## Point d'entree recommande
Si vous devez commencer par un seul fichier, utilisez :

- [backend/README.md](backend/README.md)

Puis, selon votre besoin :

- architecture : `backend/docs/ARCHITECTURE_PROFESSIONNELLE.md`
- standards : `backend/docs/STANDARDS_MODULES_BACKEND.md`
- messages et erreurs : `backend/docs/TABLEAU_MESSAGES_HTTP.md`
- tests manuels : `backend/docs/POSTMAN_TESTS.md`
- Docker : `backend/docs/docker-README.md`

## Resume
Jokko est aujourd'hui un projet backend deja riche, modulaire et documente, oriente vers une marketplace de services avec logique transactionnelle, temps reel et gouvernance admin. Ce repository doit etre lu comme la base technique serieuse du produit, avec `backend/` comme coeur principal de l'implementation actuelle.
