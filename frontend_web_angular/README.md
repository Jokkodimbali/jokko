# Jokko Web Angular

Frontend web Angular de Jokko Dimbali. L’application consomme l’API backend NestJS via `http://localhost:3000/api/v1` et respecte l’enveloppe standard du backend : `success`, `message`, `data`, `meta`.

## Prérequis

- Node.js LTS pair uniquement : Node `24.x` recommandé, ou Node `22.12.0+`.
- npm `>=10.9.0 <12`.
- Backend Jokko démarré sur `http://localhost:3000/api/v1` pour charger les catégories, les prestataires et l’authentification.

Le projet active `engine-strict=true` pour éviter les installations avec Node `25.x`, qui est une version impaire non LTS et signalée comme non supportée par Angular CLI.

## Installation

```bash
npm.cmd install
```

## Développement

```bash
npm.cmd start
```

Puis ouvrir `http://127.0.0.1:4200/`.

## Vérification

```bash
npm.cmd run verify
```

Cette commande lance le build Angular puis les tests unitaires en mode non interactif.

## Architecture actuelle

- `src/app/core/http/` : contrat `ApiResponse<T>` et helpers d’extraction des données/erreurs backend.
- `src/app/core/auth/` : stockage centralisé des jetons d’authentification.
- `src/app/core/interceptors/` : injection automatique du Bearer token.
- `src/app/features/auth/` : pages login, register, vérification OTP et service auth.
- `src/app/features/services/` : chargement des catégories et prestataires depuis le backend.
