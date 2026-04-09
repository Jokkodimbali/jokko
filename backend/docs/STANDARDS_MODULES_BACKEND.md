# Standards Modules Backend (Obligatoires)

## 1. Structure par module
Chaque module doit suivre exactement cette structure:

```text
src/<module>/
  domain/ ou domaine/
  application/
  infrastructure/
  presentation/
  <module>.module.ts
```

## 2. Regles d'architecture
- `presentation` -> seulement `application`
- `application` -> `domain` + `core` (abstractions)
- `domain` -> aucune dependance framework (`nestjs`, `prisma`, HTTP)
- `infrastructure` -> implementation des ports

## 3. Regles de qualite
- SRP: une classe = une responsabilite claire.
- DRY: pas de duplication de logique metier.
- KISS: fonctions courtes, lisibles, sans magie.
- DTOs uniquement en `presentation`.
- Acces base uniquement en `infrastructure`.
- Messages centralises dans `core/http/app-messages.ts`.

## 4. Checklist "Definition of Done"
Un module est termine seulement si:
1. Lint, build, tests unitaires et e2e passent.
2. Aucun import interdit entre couches.
3. Aucun texte brut metier en dehors des catalogues centralises.
4. Controllers sans logique metier.
5. Services application via ports (pas de dependance directe ORM).

