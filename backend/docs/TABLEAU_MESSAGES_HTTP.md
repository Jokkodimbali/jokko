# Tableau Centralise Des Messages Et Codes HTTP

## 1. Objet du document
Ce document reference les messages utilises par le backend Jokko et explique comment ils sont structures. Il ne faut pas le lire comme une simple liste de phrases. Il doit etre compris comme une convention d'architecture: dans ce projet, les messages visibles par les clients HTTP, les messages de validation, les messages techniques et les messages de notification sont centralises pour garantir la coherence, la reutilisabilite et la maintenabilite.

L'objectif est d'eviter les textes bruts disperses dans les controllers, les services ou les repositories. Lorsqu'un message doit etre modifie, traduit, harmonise ou documente, il doit exister dans un catalogue unique, avec une organisation claire par responsabilite.

## 2. Sources de verite du projet
Les principales sources de verite actuelles sont les suivantes:
- `backend/src/core/messages/app-message.catalog.ts`
- `backend/src/core/messages/validation-message.catalog.ts`
- `backend/src/core/messages/technical-message.catalog.ts`
- `backend/src/core/messages/payment-notification.messages.ts`
- `backend/src/core/messages/reservation-notification.messages.ts`
- `backend/src/core/messages/api-docs.messages.ts`
- `backend/src/core/http/http-status-codes.ts`
- `backend/src/core/http/app-messages.ts`

`app-messages.ts` sert de point d'entree de reexport pour la couche HTTP. Les autres fichiers restent les catalogues de reference selon le type de message.

## 3. Organisation des messages dans le backend
Le projet distingue plusieurs categories.

Les messages applicatifs HTTP servent a construire les reponses de succes et d'erreur renvoyees au frontend. Ils sont associes a un code metier et a un statut HTTP.

Les messages de validation servent aux DTOs et au `ValidationPipe` global. Ils doivent etre explicites, en francais et suffisamment clairs pour etre affiches tels quels dans l'application mobile.

Les messages techniques servent surtout aux logs et a la supervision. Ils ne sont pas destines a etre exposes directement tels quels au frontend, mais ils doivent rester centralises pour conserver un langage commun dans les logs backend.

Les messages de notification servent a fabriquer les contenus lies aux reservations et aux paiements, que ce soit pour les notifications in-app, les SMS, les emails ou les push mobiles.

## 4. Convention de reponse HTTP
Une reponse de succes suit la structure suivante:

```json
{
  "success": true,
  "data": {},
  "message": "...",
  "meta": {}
}
```

Une reponse d'erreur suit la structure suivante:

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

La coherence de cette forme est importante pour Flutter. Le frontend peut ainsi traiter les erreurs et succes de facon uniforme, sans connaitre les details internes de chaque module.

## 5. Table des statuts HTTP centralises
Le projet centralise aussi les familles de codes HTTP dans `http-status-codes.ts`.

| Famille | Cle | Valeur |
|---|---|---:|
| `SUCCESS` | `OK` | `200` |
| `SUCCESS` | `CREATED` | `201` |
| `CLIENT_ERROR` | `BAD_REQUEST` | `400` |
| `CLIENT_ERROR` | `UNAUTHORIZED` | `401` |
| `CLIENT_ERROR` | `FORBIDDEN` | `403` |
| `CLIENT_ERROR` | `NOT_FOUND` | `404` |
| `CLIENT_ERROR` | `CONFLICT` | `409` |
| `CLIENT_ERROR` | `TOO_MANY_REQUESTS` | `429` |
| `SERVER_ERROR` | `NOT_IMPLEMENTED` | `501` |
| `SERVER_ERROR` | `INTERNAL_SERVER_ERROR` | `500` |

Cette centralisation evite d'ecrire des nombres magiques partout dans le code et rend les intentions plus lisibles.

## 6. Messages applicatifs HTTP par module
### 6.1 Validation
| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `VALIDATION_REQUEST_INVALID` | `VALIDATION_REQUEST_INVALID` | `400` | Les donnees envoyees sont invalides. |

### 6.2 Auth
| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `AUTH_OTP_SENT` | `AUTH_OTP_SENT` | `200` | Code OTP envoye avec succes. |
| `AUTH_PHONE_ALREADY_USED` | `AUTH_PHONE_ALREADY_USED` | `409` | Ce numero de telephone est deja utilise. |
| `AUTH_EMAIL_ALREADY_USED` | `AUTH_EMAIL_ALREADY_USED` | `409` | Cette adresse email est deja utilisee. |
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

### 6.3 Users
| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `USERS_USER_NOT_FOUND` | `USERS_USER_NOT_FOUND` | `404` | Utilisateur introuvable. |
| `USERS_UPDATE_EMPTY` | `USERS_UPDATE_EMPTY` | `400` | Aucune donnee a mettre a jour. |
| `USERS_EMAIL_ALREADY_USED` | `USERS_EMAIL_ALREADY_USED` | `409` | Cette adresse email est deja utilisee. |
| `USERS_PROFILE_UPDATED` | `USERS_PROFILE_UPDATED` | `200` | Profil mis a jour avec succes. |
| `USERS_AVATAR_UPDATED` | `USERS_AVATAR_UPDATED` | `201` | Photo de profil mise a jour avec succes. |
| `USERS_ACCOUNT_ANONYMIZED` | `USERS_ACCOUNT_ANONYMIZED` | `200` | Compte anonymise avec succes. |

### 6.4 Professionals
| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `PROFESSIONALS_FORBIDDEN_ROLE` | `PROFESSIONALS_FORBIDDEN_ROLE` | `403` | Seuls les comptes professionnels peuvent effectuer cette action. |
| `PROFESSIONALS_ADMIN_FORBIDDEN_ROLE` | `PROFESSIONALS_ADMIN_FORBIDDEN_ROLE` | `403` | Seuls les administrateurs peuvent effectuer cette action. |
| `PROFESSIONALS_PROFILE_CREATED` | `PROFESSIONALS_PROFILE_CREATED` | `201` | Profil professionnel cree avec succes. |
| `PROFESSIONALS_PROFILE_ALREADY_EXISTS` | `PROFESSIONALS_PROFILE_ALREADY_EXISTS` | `409` | Un profil professionnel existe deja pour ce compte. |
| `PROFESSIONALS_PROFILE_NOT_FOUND` | `PROFESSIONALS_PROFILE_NOT_FOUND` | `404` | Profil professionnel introuvable. |
| `PROFESSIONALS_KYC_SUBMITTED` | `PROFESSIONALS_KYC_SUBMITTED` | `200` | Document KYC soumis avec succes. |
| `PROFESSIONALS_PROFILE_UPDATED` | `PROFESSIONALS_PROFILE_UPDATED` | `200` | Profil professionnel mis a jour avec succes. |
| `PROFESSIONALS_KYC_APPROVED` | `PROFESSIONALS_KYC_APPROVED` | `200` | KYC approuve avec succes. |
| `PROFESSIONALS_KYC_REJECTED` | `PROFESSIONALS_KYC_REJECTED` | `200` | KYC rejete avec succes. |
| `PROFESSIONALS_KYC_NOT_VERIFIED` | `PROFESSIONALS_KYC_NOT_VERIFIED` | `403` | Votre profil KYC doit etre verifie pour effectuer cette action. |
| `PROFESSIONALS_CATEGORY_NOT_FOUND` | `PROFESSIONALS_CATEGORY_NOT_FOUND` | `404` | Categorie introuvable. |
| `PROFESSIONALS_SERVICE_NOT_FOUND` | `PROFESSIONALS_SERVICE_NOT_FOUND` | `404` | Service introuvable. |
| `PROFESSIONALS_SERVICE_CREATED` | `PROFESSIONALS_SERVICE_CREATED` | `201` | Service cree avec succes. |
| `PROFESSIONALS_SERVICE_UPDATED` | `PROFESSIONALS_SERVICE_UPDATED` | `200` | Service mis a jour avec succes. |
| `PROFESSIONALS_SERVICE_DISABLED` | `PROFESSIONALS_SERVICE_DISABLED` | `200` | Service desactive avec succes. |
| `PROFESSIONALS_PORTFOLIO_ITEM_CREATED` | `PROFESSIONALS_PORTFOLIO_ITEM_CREATED` | `201` | Element portfolio ajoute avec succes. |
| `PROFESSIONALS_PORTFOLIO_ITEM_DELETED` | `PROFESSIONALS_PORTFOLIO_ITEM_DELETED` | `200` | Element portfolio supprime avec succes. |
| `PROFESSIONALS_PORTFOLIO_ITEM_NOT_FOUND` | `PROFESSIONALS_PORTFOLIO_ITEM_NOT_FOUND` | `404` | Element portfolio introuvable. |
| `PROFESSIONALS_AVAILABILITY_CREATED` | `PROFESSIONALS_AVAILABILITY_CREATED` | `201` | Disponibilite ajoutee avec succes. |
| `PROFESSIONALS_AVAILABILITY_DISABLED` | `PROFESSIONALS_AVAILABILITY_DISABLED` | `200` | Disponibilite desactivee avec succes. |
| `PROFESSIONALS_UPDATE_EMPTY` | `PROFESSIONALS_UPDATE_EMPTY` | `400` | Au moins un champ doit etre fourni pour la mise a jour. |
| `PROFESSIONALS_REJECT_REASON_EMPTY` | `PROFESSIONALS_REJECT_REASON_EMPTY` | `400` | Le motif de rejet ne peut pas etre vide. |
| `PROFESSIONALS_AVAILABILITY_NOT_FOUND` | `PROFESSIONALS_AVAILABILITY_NOT_FOUND` | `404` | Disponibilite introuvable. |

### 6.5 Categories
| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `CATEGORIES_ADMIN_FORBIDDEN_ROLE` | `CATEGORIES_ADMIN_FORBIDDEN_ROLE` | `403` | Seuls les administrateurs peuvent effectuer cette action. |
| `CATEGORIES_CATEGORY_NOT_FOUND` | `CATEGORIES_CATEGORY_NOT_FOUND` | `404` | Categorie introuvable. |
| `CATEGORIES_NAME_ALREADY_USED` | `CATEGORIES_NAME_ALREADY_USED` | `409` | Une categorie avec ce nom existe deja. |
| `CATEGORIES_CATEGORY_CREATED` | `CATEGORIES_CATEGORY_CREATED` | `201` | Categorie creee avec succes. |
| `CATEGORIES_CATEGORY_UPDATED` | `CATEGORIES_CATEGORY_UPDATED` | `200` | Categorie mise a jour avec succes. |
| `CATEGORIES_CATEGORY_DISABLED` | `CATEGORIES_CATEGORY_DISABLED` | `200` | Categorie desactivee avec succes. |
| `CATEGORIES_UPDATE_EMPTY` | `CATEGORIES_UPDATE_EMPTY` | `400` | Au moins un champ doit etre fourni pour la mise a jour. |

### 6.6 Reservations
| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `RESERVATIONS_FORBIDDEN_ROLE` | `RESERVATIONS_FORBIDDEN_ROLE` | `403` | Ce role ne peut pas effectuer cette action sur les reservations. |
| `RESERVATIONS_NOT_FOUND` | `RESERVATIONS_NOT_FOUND` | `404` | Reservation introuvable. |
| `RESERVATIONS_UNAUTHORIZED` | `RESERVATIONS_UNAUTHORIZED` | `403` | Vous n'etes pas autorise a acceder a cette reservation. |
| `RESERVATIONS_SERVICE_NOT_FOUND` | `RESERVATIONS_SERVICE_NOT_FOUND` | `404` | Service introuvable. |
| `RESERVATIONS_PROFESSIONAL_NOT_FOUND` | `RESERVATIONS_PROFESSIONAL_NOT_FOUND` | `404` | Professionnel introuvable. |
| `RESERVATIONS_SERVICE_NOT_AVAILABLE` | `RESERVATIONS_SERVICE_NOT_AVAILABLE` | `409` | Ce service nest pas disponible pour reservation. |
| `RESERVATIONS_SERVICE_PROFESSIONAL_MISMATCH` | `RESERVATIONS_SERVICE_PROFESSIONAL_MISMATCH` | `409` | Ce service n appartient pas au professionnel selectionne. |
| `RESERVATIONS_SELF_BOOKING_FORBIDDEN` | `RESERVATIONS_SELF_BOOKING_FORBIDDEN` | `409` | Un prestataire ne peut pas reserver son propre service en tant que client. |
| `RESERVATIONS_NEGOTIATION_REQUIRED` | `RESERVATIONS_NEGOTIATION_REQUIRED` | `409` | Ce service necessite une negotiation de prix avant de creer une reservation. |
| `RESERVATIONS_NEGOTIATION_NOT_AVAILABLE` | `RESERVATIONS_NEGOTIATION_NOT_AVAILABLE` | `501` | Le flux de reservation depuis une negotiation nest pas encore disponible. |
| `RESERVATIONS_TIME_SLOT_UNAVAILABLE` | `RESERVATIONS_TIME_SLOT_UNAVAILABLE` | `409` | Ce creneau horaire nest pas disponible. |
| `RESERVATIONS_STATUS_PENDING_REQUIRED` | `RESERVATIONS_STATUS_PENDING_REQUIRED` | `409` | La reservation doit etre en attente pour cette action. |
| `RESERVATIONS_STATUS_ACTIVE_REQUIRED` | `RESERVATIONS_STATUS_ACTIVE_REQUIRED` | `409` | La reservation doit etre confirmee ou en cours pour cette action. |
| `RESERVATIONS_ALREADY_CLOSED` | `RESERVATIONS_ALREADY_CLOSED` | `409` | La reservation est deja terminee ou annulee. |
| `RESERVATIONS_CREATED` | `RESERVATIONS_CREATED` | `201` | Reservation creee avec succes. |
| `RESERVATIONS_CONFIRMED` | `RESERVATIONS_CONFIRMED` | `200` | Reservation confirmee avec succes. |
| `RESERVATIONS_CANCELLED` | `RESERVATIONS_CANCELLED` | `200` | Reservation annulee avec succes. |
| `RESERVATIONS_RESCHEDULED` | `RESERVATIONS_RESCHEDULED` | `200` | Reservation reprogrammee avec succes. |
| `RESERVATIONS_COMPLETED` | `RESERVATIONS_COMPLETED` | `200` | Reservation terminee avec succes. |
| `RESERVATIONS_NO_SHOW_MARKED` | `RESERVATIONS_NO_SHOW_MARKED` | `200` | Absence du client enregistree avec succes. |
| `RESERVATIONS_DATE_RANGE_REQUIRED` | `RESERVATIONS_DATE_RANGE_REQUIRED` | `400` | Les dates de debut et de fin sont obligatoires pour cette requete. |

### 6.7 Payments
| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `PAYMENTS_FORBIDDEN_ROLE` | `PAYMENTS_FORBIDDEN_ROLE` | `403` | Seuls les utilisateurs autorises peuvent consulter ces paiements. |
| `PAYMENTS_NOT_FOUND` | `PAYMENTS_NOT_FOUND` | `404` | Paiement introuvable. |
| `PAYMENTS_INITIATED` | `PAYMENTS_INITIATED` | `201` | Paiement initie avec succes. |
| `PAYMENTS_WEBHOOK_PROCESSED` | `PAYMENTS_WEBHOOK_PROCESSED` | `200` | Webhook de paiement traite avec succes. |
| `PAYMENTS_ESCROW_RELEASED` | `PAYMENTS_ESCROW_RELEASED` | `200` | Fonds liberes avec succes au prestataire. |
| `PAYMENTS_ESCROW_DISPUTED` | `PAYMENTS_ESCROW_DISPUTED` | `200` | Le paiement a ete place en litige. |
| `PAYMENTS_ESCROW_REFUNDED` | `PAYMENTS_ESCROW_REFUNDED` | `200` | Le paiement a ete rembourse. |
| `PAYMENTS_WITHDRAWAL_REQUESTED` | `PAYMENTS_WITHDRAWAL_REQUESTED` | `201` | Demande de retrait initiee avec succes. |

### 6.8 Notifications
| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `NOTIFICATIONS_NOT_FOUND` | `NOTIFICATIONS_NOT_FOUND` | `404` | Notification introuvable. |
| `NOTIFICATIONS_MARKED_AS_READ` | `NOTIFICATIONS_MARKED_AS_READ` | `200` | Notification marquee comme lue avec succes. |
| `NOTIFICATIONS_ALL_MARKED_AS_READ` | `NOTIFICATIONS_ALL_MARKED_AS_READ` | `200` | Toutes les notifications ont ete marquees comme lues. |
| `NOTIFICATIONS_FCM_TOKEN_UPDATED` | `NOTIFICATIONS_FCM_TOKEN_UPDATED` | `200` | Token de notification mis a jour avec succes. |

### 6.9 Systeme
| Cle | Code Metier | HTTP | Message |
|---|---|---:|---|
| `SYSTEM_DATABASE_URL_MISSING` | `SYSTEM_DATABASE_URL_MISSING` | `500` | La variable d'environnement DATABASE_URL est obligatoire. |
| `SYSTEM_INTERNAL_SERVER_ERROR` | `SYSTEM_INTERNAL_SERVER_ERROR` | `500` | Erreur interne du serveur. |

## 7. Messages de validation centralises
Les messages de validation vivent dans `validation-message.catalog.ts`. Ils sont utilises par les DTOs, puis resolves par la factory de validation globale.

### 7.1 Auth et identite
| Cle | Message |
|---|---|
| `PHONE_REQUIRED` | Le numero de telephone est obligatoire. |
| `PHONE_FORMAT` | Le numero de telephone doit etre au format international. |
| `OTP_CODE_REQUIRED` | Le code OTP est obligatoire. |
| `OTP_CODE_LENGTH` | Le code OTP doit contenir exactement 6 chiffres. |
| `NAME_REQUIRED` | Le nom est obligatoire. |
| `NAME_MIN` | Le nom doit contenir au moins 2 caracteres. |
| `NAME_MAX` | Le nom ne doit pas depasser 100 caracteres. |
| `EMAIL_INVALID` | L'adresse email est invalide. |
| `PASSWORD_REQUIRED` | Le mot de passe est obligatoire. |
| `PASSWORD_LENGTH` | Le mot de passe doit contenir entre 8 et 64 caracteres. |
| `ID_TOKEN_REQUIRED` | Le token Google est obligatoire. |
| `ID_TOKEN_MIN` | Le token Google est invalide. |
| `REFRESH_TOKEN_REQUIRED` | Le refresh token est obligatoire. |
| `REFRESH_TOKEN_MIN` | Le refresh token est invalide. |

### 7.2 Users
| Cle | Message |
|---|---|
| `AVATAR_URL_INVALID` | L'URL de l'avatar est invalide. |
| `AVATAR_URL_REQUIRED` | L'URL de l'avatar est obligatoire. |
| `ADDRESS_INVALID` | L'adresse est invalide. |
| `ADDRESS_MAX` | L'adresse ne doit pas depasser 255 caracteres. |
| `HISTORY_LIMIT_MIN` | La limite minimale est 1. |
| `HISTORY_LIMIT_MAX` | Le nombre de resultats de l'historique ne doit pas depasser 100. |
| `HISTORY_LIMIT_INVALID` | Le nombre de resultats de l'historique doit etre un nombre entier superieur ou egal a 1. |

### 7.3 Professionals et categories
| Cle | Message |
|---|---|
| `BIO_MAX` | La biographie ne doit pas depasser 1000 caracteres. |
| `COMPANY_NAME_MAX` | Le nom de l'entreprise ne doit pas depasser 150 caracteres. |
| `CITY_MAX` | La ville ne doit pas depasser 100 caracteres. |
| `KYC_ID_CARD_URL_REQUIRED` | L'URL de la piece d'identite est obligatoire. |
| `KYC_ID_CARD_URL_INVALID` | L'URL de la piece d'identite est invalide. |
| `PROFESSIONALS_LIMIT_MIN` | Le nombre de resultats par page doit etre d'au moins 1. |
| `PROFESSIONALS_LIMIT_MAX` | Le nombre de resultats par page ne doit pas depasser 50. |
| `PROFESSIONALS_PAGE_INVALID` | Le numero de page doit etre un nombre entier superieur ou egal a 1. |
| `KYC_REJECT_REASON_REQUIRED` | Le motif de rejet KYC est obligatoire. |
| `KYC_REJECT_REASON_MIN` | Le motif de rejet KYC doit contenir au moins 10 caracteres. |
| `KYC_REJECT_REASON_MAX` | Le motif de rejet KYC ne doit pas depasser 1000 caracteres. |
| `CATEGORY_ID_REQUIRED` | La categorie est obligatoire. |
| `CATEGORY_ID_FORMAT` | Le format de l'identifiant de categorie est invalide. |
| `CATEGORY_NAME_REQUIRED` | Le nom de la categorie est obligatoire. |
| `CATEGORY_NAME_MIN` | Le nom de la categorie doit contenir au moins 2 caracteres. |
| `CATEGORY_NAME_MAX` | Le nom de la categorie ne doit pas depasser 100 caracteres. |
| `CATEGORY_ICON_URL_INVALID` | L'URL de l'icone de categorie est invalide. |
| `CATEGORY_SORT_ORDER_INTEGER` | L'ordre de tri de la categorie doit etre un nombre entier. |
| `CATEGORY_SORT_ORDER_MIN` | L'ordre de tri de la categorie ne peut pas etre negatif. |
| `CATEGORY_SORT_ORDER_MAX` | L'ordre de tri de la categorie ne doit pas depasser 32767. |
| `SERVICE_NAME_REQUIRED` | Le nom du service est obligatoire. |
| `SERVICE_NAME_MAX` | Le nom du service ne doit pas depasser 200 caracteres. |
| `SERVICE_DESCRIPTION_REQUIRED` | La description du service est obligatoire. |
| `SERVICE_PRICE_INVALID` | Le prix du service est invalide. |
| `SERVICE_PRICE_MUST_BE_POSITIVE` | Le prix du service doit etre un nombre positif. |
| `SERVICE_PRICE_TYPE_INVALID` | Le type de prix est invalide. |
| `SERVICE_ID_REQUIRED` | Le service est obligatoire. |
| `SERVICE_ID_FORMAT` | Le format de l'identifiant du service est invalide. |
| `PORTFOLIO_TITLE_REQUIRED` | Le titre du portfolio est obligatoire. |
| `PORTFOLIO_TITLE_MAX` | Le titre du portfolio ne doit pas depasser 200 caracteres. |
| `PORTFOLIO_IMAGE_URL_REQUIRED` | L'URL de l'image est obligatoire. |
| `PORTFOLIO_IMAGE_URL_INVALID` | L'URL de l'image est invalide. |
| `DAY_OF_WEEK_INVALID` | Le jour de semaine doit etre un nombre entier entre 0 et 6. |
| `DAY_OF_WEEK_MUST_BE_INTEGER` | Le jour de semaine doit etre un nombre entier. |
| `START_TIME_REQUIRED` | L'heure de debut est obligatoire. |
| `END_TIME_REQUIRED` | L'heure de fin est obligatoire. |
| `TIME_FORMAT_INVALID` | Le format d'heure doit etre HH:mm. |
| `PROFESSIONALS_UPDATE_EMPTY` | Au moins un champ doit etre fourni pour la mise a jour. |
| `PROFESSIONALS_REJECT_REASON_EMPTY` | Le motif de rejet ne peut pas etre vide. |

### 7.4 Reservations
| Cle | Message |
|---|---|
| `RESERVATION_PROFESSIONAL_ID_REQUIRED` | Le professionnel est obligatoire. |
| `RESERVATION_PROFESSIONAL_ID_FORMAT` | Le format de l'identifiant du professionnel est invalide. |
| `RESERVATION_NEGOTIATION_ID_REQUIRED` | La negotiation est obligatoire. |
| `RESERVATION_NEGOTIATION_ID_FORMAT` | Le format de l'identifiant de negotiation est invalide. |
| `RESERVATION_DATE_REQUIRED` | La date de reservation est obligatoire. |
| `RESERVATION_DATE_INVALID` | La date de reservation doit etre une date ISO valide. |
| `RESERVATION_ADDRESS_REQUIRED` | L'adresse client de reservation est obligatoire. |
| `RESERVATION_ADDRESS_MAX` | L'adresse client de reservation ne doit pas depasser 255 caracteres. |
| `RESERVATION_DURATION_REQUIRED` | La duree de reservation est obligatoire. |
| `RESERVATION_DURATION_INTEGER` | La duree de reservation doit etre un nombre entier. |
| `RESERVATION_DURATION_MIN` | La duree de reservation doit etre d au moins 15 minutes. |
| `RESERVATION_DURATION_MAX` | La duree de reservation ne doit pas depasser 1440 minutes. |
| `RESERVATION_NOTES_MAX` | Les notes de reservation ne doivent pas depasser 1000 caracteres. |
| `RESERVATION_CANCEL_REASON_MAX` | Le motif d'annulation ne doit pas depasser 1000 caracteres. |
| `RESERVATION_QUERY_DATE_INVALID` | La date fournie dans les filtres est invalide. |

### 7.5 Payments
| Cle | Message |
|---|---|
| `PAYMENT_BOOKING_ID_FORMAT` | Le format de l'ID de reservation est invalide. |
| `PAYMENT_BOOKING_ID_REQUIRED` | La reservation est obligatoire pour le paiement. |
| `PAYMENT_METHOD_REQUIRED` | La methode de paiement est obligatoire. |
| `PAYMENT_METHOD_INVALID` | La methode de paiement est invalide. |
| `PAYMENT_CALLBACK_URL_INVALID` | L'URL de retour est invalide. |
| `PAYMENT_SUCCESS_URL_INVALID` | L'URL de succes est invalide. |
| `PAYMENT_CANCEL_URL_INVALID` | L'URL d'annulation est invalide. |
| `PAYMENT_STATUS_INVALID` | Le statut de paiement est invalide. |
| `WITHDRAWAL_AMOUNT_REQUIRED` | Le montant du retrait est obligatoire. |
| `WITHDRAWAL_AMOUNT_INVALID` | Le montant du retrait est invalide. |
| `WITHDRAWAL_AMOUNT_MIN` | Le montant minimum de retrait n'est pas atteint. |
| `WITHDRAWAL_AMOUNT_MAX` | Le montant maximum de retrait est depasse. |
| `WITHDRAWAL_METHOD_REQUIRED` | La methode de retrait est obligatoire. |
| `WITHDRAWAL_METHOD_INVALID` | La methode de retrait est invalide. |
| `PAYMENT_REASON_MAX` | Le motif ne doit pas depasser 1000 caracteres. |

### 7.6 Notifications
| Cle | Message |
|---|---|
| `NOTIFICATION_READ_INVALID` | Le filtre de lecture doit etre un booleen valide. |
| `NOTIFICATION_LIMIT_INVALID` | La limite des notifications doit etre un nombre entier. |
| `NOTIFICATION_LIMIT_MIN` | La limite des notifications doit etre superieure ou egale a 1. |
| `NOTIFICATION_LIMIT_MAX` | La limite des notifications ne doit pas depasser 100. |
| `NOTIFICATION_OFFSET_INVALID` | L'offset des notifications doit etre un nombre entier. |
| `NOTIFICATION_OFFSET_MIN` | L'offset des notifications ne peut pas etre negatif. |
| `NOTIFICATION_FCM_TOKEN_REQUIRED` | Le token de notification mobile est obligatoire. |
| `NOTIFICATION_FCM_TOKEN_INVALID` | Le token de notification mobile est invalide. |
| `NOTIFICATION_FCM_TOKEN_TOO_LONG` | Le token de notification mobile ne doit pas depasser 500 caracteres. |

### 7.7 Validation transverse
| Cle | Message |
|---|---|
| `NON_WHITELISTED_FIELD` | La requete contient un champ non autorise par le backend. |

## 8. Messages techniques
Ces messages servent surtout aux logs, au diagnostic et a l'observabilite.

| Cle | Message |
|---|---|
| `DATABASE_HEALTH_TIMEOUT` | Le delai de verification de la base de donnees est depasse. |
| `RESERVATION_EMAIL_PROVIDER_NOT_CONFIGURED` | Email provider not configured. Reservation email skipped. |
| `RESERVATION_EMAIL_PROVIDER_CONFIGURATION_MISSING` | Email provider not configured |
| `RESERVATION_SMS_PROVIDER_NOT_CONFIGURED` | Twilio is not configured. Reservation SMS notification skipped. |
| `RESERVATION_SMS_PROVIDER_CONFIGURATION_MISSING` | Twilio provider not configured |
| `NOTIFICATION_FCM_PROVIDER_CONFIGURATION_MISSING` | Firebase Cloud Messaging provider not configured |
| `NOTIFICATION_FCM_TOKEN_MISSING` | Firebase Cloud Messaging access token missing |
| `SEED_DATABASE_URL_MISSING` | DATABASE_URL not set |
| `SEED_CATEGORY_NOT_FOUND` | Category not found |
| `SEED_SUCCESS` | Seed complete: Users, Prof, Services, Reservation creee! |

Certaines entrees sont des fonctions qui interpolent des details d'erreur. Elles sont centralisees pour garder une forme de langage technique stable dans les logs.

## 9. Messages de notification reservation
Les messages de reservation sont centralises dans `reservation-notification.messages.ts`.

| Cle | Valeur |
|---|---|
| `createdTitle` | Reservation enregistree |
| `createdEmailSubject` | Confirmation de votre reservation Jokko |
| `createdPushBody(...)` | Message detaille de reservation avec client, service, professionnel, date et adresse |
| `createdSmsBody(...)` | Message court SMS avec service, professionnel et date |
| `genericEventTitle(eventType)` | Reservation {eventType} |
| `genericEventBody(...)` | Message generique pour un evenement de reservation |

Ces templates sont utilises pour garder la coherence entre la notification in-app, l'email et le SMS autour d'une reservation.

## 10. Messages de notification paiement
Les messages de paiement sont centralises dans `payment-notification.messages.ts`.

| Cle | Valeur |
|---|---|
| `CLIENT_ESCROW_CONFIRMED_TITLE` | Paiement confirme |
| `CLIENT_ESCROW_CONFIRMED_BODY` | Votre paiement a ete confirme et les fonds sont securises par Jokko. |
| `PROFESSIONAL_ESCROW_CONFIRMED_TITLE` | Paiement client confirme |
| `PROFESSIONAL_ESCROW_CONFIRMED_BODY(serviceName)` | Le paiement de la reservation {serviceName} est securise. |
| `SEED_CLIENT_ESCROW_CONFIRMED_BODY` | Votre paiement demo a ete confirme et les fonds sont securises par Jokko. |
| `SEED_PROFESSIONAL_ESCROW_CONFIRMED_BODY` | Un paiement client demo est securise en escrow. |
| `WALLET_ESCROW_RELEASED_DESCRIPTION` | Fonds escrow liberes vers le portefeuille professionnel. |
| `WALLET_WITHDRAWAL_DEBIT_DESCRIPTION` | Retrait professionnel debite du portefeuille. |

## 11. Messages Swagger et documentation d'API
Le projet centralise aussi une partie importante des textes Swagger dans `api-docs.messages.ts`. Ces messages ne sont pas forcement des messages fonctionnels affiches au client final, mais ils constituent un autre niveau de centralisation tres utile. Ils servent aux `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiParam` et `@ApiQuery` dans les controllers.

Cela permet d'eviter que la documentation d'API se degrade ou diverge entre modules.

## 12. Regles d'usage dans le code
Les regles a respecter sont les suivantes:
- un message HTTP visible ne doit pas etre duplique dans plusieurs fichiers
- un message de validation doit provenir du catalogue de validation
- un code HTTP metier doit utiliser la centralisation de `http-status-codes.ts`
- un controller ne doit pas reconstituer librement un message deja connu du domaine
- un message technique de log repetitif doit etre centralise
- un template de notification email, SMS ou push doit vivre dans un fichier dedie

Lorsque le projet doit evoluer, la priorite est de completer les catalogues existants plutot que d'ajouter des chaines en dur dans un nouveau service.

## 13. Conclusion
Le systeme de messages Jokko n'est pas un simple detail de style. C'est une partie de l'architecture. Il garantit une API plus propre, une meilleure maintenabilite, une meilleure coherence avec Flutter et une meilleure qualite generale du code.

Ce document doit rester aligne sur les catalogues de code. Si un message change dans le code source, ce referentiel doit etre mis a jour dans le meme mouvement afin de rester fiable pour l'equipe.
