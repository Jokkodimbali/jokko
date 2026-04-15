# Guide des tests Postman

## Fichiers créés

- `jokko-api.postman_collection.json` - Collection des endpoints API
- `jokko-api.postman_environment.json` - Environnement avec variables

## Import dans Postman

1. Ouvrir Postman
2. Importer `jokko-api.postman_collection.json`
3. Importer `jokko-api.postman_environment.json`
4. Configurer l'environnement : Settings > Environments > Select "Jokko API Environment"

## Configuration

Le `baseUrl` est configuré pour `http://localhost:3000/api/v1`.

Modifier dans l'environnement si utilisation distante.

## Ordre de test recommandé

### 1. Health Check
- `GET /sante` — Vérifier que l'API fonctionne

### 2. Auth (sans token)
- `POST /auth/otp/send` — Envoyer un code OTP
- `POST /auth/otp/verify` — Vérifier le code OTP
- `POST /auth/register` — Créer un compte
- `POST /auth/login` — Connexion avec mot de passe
- `POST /auth/google/login` — Connexion via Google (si configuré)
- `POST /auth/refresh` — Rafraîchir le token
- `POST /auth/logout` — Déconnexion

### 3. Users (authentifié)
- `GET /users/me` — Voir mon profil
- `PATCH /users/me` — Modifier mon profil (update partiel)
- `PATCH /users/me/avatar` — Changer l'avatar
- `GET /users/me/history` — Historique des réservations
- `DELETE /users/me` — Supprimer mon compte (anonymisation)

### 4. Categories (public + admin)
**Public :**
- `GET /categories` — Liste des catégories actives

**Admin (rôle ADMIN requis) :**
- `POST /admin/categories` — Créer une catégorie (201)
- `PATCH /admin/categories/:id` — Modifier une catégorie (update partiel)
- `PATCH /admin/categories/:id/disable` — Désactiver une catégorie

### 5. Professionals (authentifié)
- `POST /professionals/profile` — Créer un profil professionnel
- `GET /professionals/me` — Voir mon profil pro
- `PATCH /professionals/me` — Modifier mon profil pro (update partiel)
- `PATCH /professionals/me/kyc/submit` — Soumettre documents KYC
- `POST /professionals/me/services` — Ajouter un service
- `PATCH /professionals/me/services/:serviceId` — Modifier un service (update partiel)
- `DELETE /professionals/me/services/:serviceId` — Supprimer un service
- `POST /professionals/me/portfolio` — Ajouter un élément portfolio
- `DELETE /professionals/me/portfolio/:itemId` — Supprimer un élément portfolio
- `POST /professionals/me/availabilities` — Créer une disponibilité
- `DELETE /professionals/me/availabilities/:availabilityId` — Supprimer une disponibilité

### 6. Professionals (public)
- `GET /professionals` — Liste pros vérifiés (pagination page/limit)
- `GET /professionals/:id` — Voir profil pro
- `GET /professionals/:id/services` — Voir services
- `GET /professionals/:id/portfolio` — Voir portfolio
- `GET /professionals/:id/availabilities` — Voir disponibilités
- `GET /professionals/:id/reviews` — Voir avis

### 7. Admin - KYC (authentifié, rôle ADMIN)
- `PATCH /admin/kyc/:professionalId/approve` — Approuver un KYC
- `PATCH /admin/kyc/:professionalId/reject` — Rejeter un KYC (avec motif)

## Variables automatisées

L'environnement inclut des scripts qui stockent automatiquement :
- `accessToken` après login/register/verify-otp
- `refreshToken` après login/register/verify-otp
- `userId` après inscription
- `professionalId` après création de profil pro
- `categoryId` après création de catégorie
- `serviceId` après création de service
- `portfolioItemId` après création d'élément portfolio
- `availabilityId` après création de disponibilité

## Notes importantes

- **Tous les endpoints protégés** nécessitent un token Bearer dans l'en-tête `Authorization`
- **Endpoints admin** nécessitent le rôle `ADMIN` (retour 403 sinon)
- **Les délais OTP sont courts** — tester rapidement après l'envoi
- **Numéros de téléphone** au format `+221XXXXXXXX`
- **Méthodes HTTP** : `PATCH` pour les updates partiels, `POST` pour les créations (retour 201), `DELETE` pour les suppressions
- **Format des réponses** : `{ "success": true/false, "data": ..., "message": "...", "errorCode": "..." }`
