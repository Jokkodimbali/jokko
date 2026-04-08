# Architecture Backend

## Objectif
Backend structure pour la production mobile (Play Store / App Store) avec:
- SOLID
- DRY
- KISS
- DDD (Domain-Driven Design)
- Event-Driven
- Clean Code

Documentation detaillee:
- `docs/ARCHITECTURE_PROFESSIONNELLE.md` (document unique de reference architecture + alignement cahier des charges)
- `docs/BACKEND_EXECUTION_PLAN_COMPLET.md` (fichier de redirection vers le document unique)
- `docs/TRELLO_BACKEND_COMPLET.csv` (import Trello complet)
- `docs/TRELLO_WORKFLOW.md` (regles To Do / Doing / Done)

## Organisation
Chaque module metier suit le meme decoupage:

```text
src/<module>/
  domaine/
    events/
    ports/
  application/
    handlers/
    *.use-case.ts
  infrastructure/
    prisma/
  presentation/
    *.controller.ts
  <module>.module.ts
```

## Regles de dependance (Clean Architecture)
- `presentation` depend de `application`
- `application` depend de `domaine` (ports + events)
- `infrastructure` implemente les ports du `domaine`
- `domaine` ne depend d'aucune couche externe

## Event-Driven
- Les use cases publient des evenements de domaine via `DOMAINE_EVENT_BUS`
- Les handlers reagissent aux evenements via `@OnEvent(...)`
- L'infrastructure de publication est centralisee dans `src/core/events`

## Noyau technique
- `src/core/config`: validation stricte des variables d'environnement
- `src/core/http`: format d'erreur uniforme via filtre global
- `src/core/events`: bus d'evenements de domaine

## Conventions
- Un use case = une responsabilite
- Pas d'acces direct Prisma depuis `presentation` ou `application`
- Toute integration externe passe par un port (interface) + adapter
- Tests unitaires sur use cases, tests e2e sur endpoints
