# Tableau Centralise Des Messages HTTP

Ce tableau reference les messages centralises utilises par le backend.
Source unique: `src/core/http/message-catalog.ts`

Note:
- la colonne `HTTP` correspond au mapping du catalogue de messages centralise.
- le statut HTTP final d'un endpoint peut differer selon la methode/controller (ex: `POST` peut repondre `201`).

| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `VALIDATION_REQUEST_INVALID` | `VALIDATION_REQUEST_INVALID` | `400` | Les donnees envoyees sont invalides. |
| `AUTH_OTP_SENT` | `AUTH_OTP_SENT` | `200` | Code OTP envoye avec succes. |
| `AUTH_PHONE_ALREADY_USED` | `AUTH_PHONE_ALREADY_USED` | `409` | Ce numero de telephone est deja utilise. |
| `AUTH_INVALID_CREDENTIALS` | `AUTH_INVALID_CREDENTIALS` | `401` | Les identifiants sont invalides. |
| `AUTH_REFRESH_TOKEN_INVALID` | `AUTH_REFRESH_TOKEN_INVALID` | `401` | Le refresh token est invalide ou expire. |
| `AUTH_GOOGLE_NOT_CONFIGURED` | `AUTH_GOOGLE_NOT_CONFIGURED` | `401` | La connexion Google n'est pas configuree. |
| `AUTH_GOOGLE_ACCOUNT_INVALID` | `AUTH_GOOGLE_ACCOUNT_INVALID` | `401` | Le compte Google est invalide. |
| `AUTH_GOOGLE_ACCOUNT_NOT_LINKED` | `AUTH_GOOGLE_ACCOUNT_NOT_LINKED` | `401` | Aucun compte lie a Google. Inscrivez-vous via OTP puis liez Google. |
| `AUTH_LOGOUT_SUCCESS` | `AUTH_LOGOUT_SUCCESS` | `200` | Deconnexion effectuee avec succes. |
| `AUTH_USER_NOT_FOUND` | `AUTH_USER_NOT_FOUND` | `404` | Utilisateur introuvable. |
| `AUTH_TOKEN_MISSING` | `AUTH_TOKEN_MISSING` | `401` | Le token d'authentification est manquant. |
| `AUTH_TOKEN_INVALID` | `AUTH_TOKEN_INVALID` | `401` | Le token d'authentification est invalide. |
| `AUTH_OTP_INVALID_OR_EXPIRED` | `AUTH_OTP_INVALID_OR_EXPIRED` | `401` | Le code OTP est invalide ou expire. |
| `AUTH_OTP_TOO_MANY_REQUESTS` | `AUTH_OTP_TOO_MANY_REQUESTS` | `429` | Trop de tentatives OTP. Reessayez plus tard. |
| `AUTH_OTP_RESEND_TOO_EARLY` | `AUTH_OTP_RESEND_TOO_EARLY` | `429` | Veuillez patienter avant de redemander un OTP. |
| `AUTH_PHONE_INVALID` | `AUTH_PHONE_INVALID` | `400` | Le numero de telephone est invalide. |
| `USERS_USER_NOT_FOUND` | `USERS_USER_NOT_FOUND` | `404` | Utilisateur introuvable. |
| `SYSTEM_DATABASE_URL_MISSING` | `SYSTEM_DATABASE_URL_MISSING` | `500` | La variable d'environnement DATABASE_URL est obligatoire. |
| `SYSTEM_INTERNAL_SERVER_ERROR` | `SYSTEM_INTERNAL_SERVER_ERROR` | `500` | Erreur interne du serveur. |
