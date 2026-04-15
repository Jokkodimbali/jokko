# Tableau Centralisé Des Messages HTTP

Ce tableau référence **tous** les messages centralisés utilisés par le backend.
Source unique : `src/core/http/app-messages.ts`

## Messages par module

### Auth
| Clé | Code Métier | HTTP | Message |
|---|---|---:|---|
| `AUTH_OTP_SENT` | `AUTH_OTP_SENT` | `200` | Code OTP envoyé avec succes. |
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

### Users
| Clé | Code Métier | HTTP | Message |
|---|---|---:|---|
| `USERS_USER_NOT_FOUND` | `USERS_USER_NOT_FOUND` | `404` | Utilisateur introuvable. |
| `USERS_PROFILE_UPDATED` | `USERS_PROFILE_UPDATED` | `200` | Profil mis a jour avec succes. |
| `USERS_AVATAR_UPDATED` | `USERS_AVATAR_UPDATED` | `200` | Photo de profil mise a jour avec succes. |
| `USERS_ACCOUNT_ANONYMIZED` | `USERS_ACCOUNT_ANONYMIZED` | `200` | Compte anonymise avec succes. |
| `USERS_UPDATE_EMPTY` | `USERS_UPDATE_EMPTY` | `400` | Au moins un champ doit etre fourni pour la mise a jour. |

### Professionals
| Clé | Code Métier | HTTP | Message |
|---|---|---:|---|
| `PROFESSIONALS_FORBIDDEN_ROLE` | `PROFESSIONALS_FORBIDDEN_ROLE` | `403` | Seul un prestataire peut effectuer cette action. |
| `PROFESSIONALS_ADMIN_FORBIDDEN_ROLE` | `PROFESSIONALS_ADMIN_FORBIDDEN_ROLE` | `403` | Seul un administrateur peut effectuer cette action. |
| `PROFESSIONALS_PROFILE_CREATED` | `PROFESSIONALS_PROFILE_CREATED` | `201` | Profil professionnel cree avec succes. |
| `PROFESSIONALS_PROFILE_ALREADY_EXISTS` | `PROFESSIONALS_PROFILE_ALREADY_EXISTS` | `409` | Un profil professionnel existe deja. |
| `PROFESSIONALS_PROFILE_NOT_FOUND` | `PROFESSIONALS_PROFILE_NOT_FOUND` | `404` | Profil professionnel introuvable. |
| `PROFESSIONALS_PROFILE_UPDATED` | `PROFESSIONALS_PROFILE_UPDATED` | `200` | Profil professionnel mis a jour avec succes. |
| `PROFESSIONALS_KYC_SUBMITTED` | `PROFESSIONALS_KYC_SUBMITTED` | `200` | Document KYC soumis avec succes. |
| `PROFESSIONALS_KYC_APPROVED` | `PROFESSIONALS_KYC_APPROVED` | `200` | KYC approuve avec succes. |
| `PROFESSIONALS_KYC_REJECTED` | `PROFESSIONALS_KYC_REJECTED` | `200` | KYC rejete avec succes. |
| `PROFESSIONALS_KYC_NOT_VERIFIED` | `PROFESSIONALS_KYC_NOT_VERIFIED` | `403` | Votre compte n'est pas encore verifie. |
| `PROFESSIONALS_CATEGORY_NOT_FOUND` | `PROFESSIONALS_CATEGORY_NOT_FOUND` | `404` | Categorie introuvable. |
| `PROFESSIONALS_SERVICE_NOT_FOUND` | `PROFESSIONALS_SERVICE_NOT_FOUND` | `404` | Service introuvable. |
| `PROFESSIONALS_SERVICE_CREATED` | `PROFESSIONALS_SERVICE_CREATED` | `201` | Service cree avec succes. |
| `PROFESSIONALS_SERVICE_UPDATED` | `PROFESSIONALS_SERVICE_UPDATED` | `200` | Service mis a jour avec succes. |
| `PROFESSIONALS_SERVICE_DISABLED` | `PROFESSIONALS_SERVICE_DISABLED` | `200` | Service desactive avec succes. |
| `PROFESSIONALS_PORTFOLIO_ITEM_CREATED` | `PROFESSIONALS_PORTFOLIO_ITEM_CREATED` | `201` | Element portfolio cree avec succes. |
| `PROFESSIONALS_PORTFOLIO_ITEM_DELETED` | `PROFESSIONALS_PORTFOLIO_ITEM_DELETED` | `200` | Element portfolio supprime avec succes. |
| `PROFESSIONALS_PORTFOLIO_ITEM_NOT_FOUND` | `PROFESSIONALS_PORTFOLIO_ITEM_NOT_FOUND` | `404` | Element portfolio introuvable. |
| `PROFESSIONALS_AVAILABILITY_CREATED` | `PROFESSIONALS_AVAILABILITY_CREATED` | `201` | disponibilite creee avec succes. |
| `PROFESSIONALS_AVAILABILITY_DISABLED` | `PROFESSIONALS_AVAILABILITY_DISABLED` | `200` | disponibilite desactivee avec succes. |
| `PROFESSIONALS_AVAILABILITY_NOT_FOUND` | `PROFESSIONALS_AVAILABILITY_NOT_FOUND` | `404` | disponibilite introuvable. |
| `PROFESSIONALS_UPDATE_EMPTY` | `PROFESSIONALS_UPDATE_EMPTY` | `400` | Au moins un champ doit etre fourni pour la mise a jour. |
| `PROFESSIONALS_REJECT_REASON_EMPTY` | `PROFESSIONALS_REJECT_REASON_EMPTY` | `400` | Le motif de rejet ne peut pas etre vide. |

### Categories
| Clé | Code Métier | HTTP | Message |
|---|---|---:|---|
| `CATEGORIES_ADMIN_FORBIDDEN_ROLE` | `CATEGORIES_ADMIN_FORBIDDEN_ROLE` | `403` | Seuls les administrateurs peuvent effectuer cette action. |
| `CATEGORIES_CATEGORY_NOT_FOUND` | `CATEGORIES_CATEGORY_NOT_FOUND` | `404` | Categorie introuvable. |
| `CATEGORIES_NAME_ALREADY_USED` | `CATEGORIES_NAME_ALREADY_USED` | `409` | Une categorie avec ce nom existe deja. |
| `CATEGORIES_CATEGORY_CREATED` | `CATEGORIES_CATEGORY_CREATED` | `201` | Categorie creee avec succes. |
| `CATEGORIES_CATEGORY_UPDATED` | `CATEGORIES_CATEGORY_UPDATED` | `200` | Categorie mise a jour avec succes. |
| `CATEGORIES_CATEGORY_DISABLED` | `CATEGORIES_CATEGORY_DISABLED` | `200` | Categorie desactivee avec succes. |
| `CATEGORIES_UPDATE_EMPTY` | `CATEGORIES_UPDATE_EMPTY` | `400` | Au moins un champ doit etre fourni pour la mise a jour. |

### Validation
| Clé | Message |
|---|---|
| `PHONE_REQUIRED` | Le numero de telephone est obligatoire. |
| `PHONE_FORMAT` | Le numero de telephone doit etre au format international. |
| `OTP_CODE_REQUIRED` | Le code OTP est obligatoire. |
| `OTP_CODE_LENGTH` | Le code OTP doit contenir exactement 6 chiffres. |
| `NAME_REQUIRED` | Le nom est obligatoire. |
| `NAME_MIN` | Le nom doit contenir au moins 2 caracteres. |
| `NAME_MAX` | Le nom ne doit pas depasser 100 caracteres. |
| `EMAIL_INVALID` | L'adresse email est invalide. |
| `AVATAR_URL_INVALID` | L'URL de l'avatar est invalide. |
| `AVATAR_URL_REQUIRED` | L'URL de l'avatar est obligatoire. |
| `ADDRESS_INVALID` | L'adresse est invalide. |
| `ADDRESS_MAX` | L'adresse ne doit pas depasser 255 caracteres. |
| `HISTORY_LIMIT_INVALID` | Le nombre de resultats de l'historique doit etre un nombre entier superieur ou egal a 1. |
| `HISTORY_LIMIT_MAX` | Le nombre de resultats de l'historique ne doit pas depasser 100. |
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
| `PORTFOLIO_TITLE_REQUIRED` | Le titre du portfolio est obligatoire. |
| `PORTFOLIO_TITLE_MAX` | Le titre du portfolio ne doit pas depasser 200 caracteres. |
| `PORTFOLIO_IMAGE_URL_REQUIRED` | L'URL de l'image est obligatoire. |
| `PORTFOLIO_IMAGE_URL_INVALID` | L'URL de l'image est invalide. |
| `DAY_OF_WEEK_INVALID` | Le jour de semaine doit etre un nombre entier entre 0 et 6. |
| `DAY_OF_WEEK_MUST_BE_INTEGER` | Le jour de semaine doit etre un nombre entier. |
| `START_TIME_REQUIRED` | L'heure de debut est obligatoire. |
| `END_TIME_REQUIRED` | L'heure de fin est obligatoire. |
| `TIME_FORMAT_INVALID` | Le format d'heure doit etre HH:mm. |
| `PASSWORD_REQUIRED` | Le mot de passe est obligatoire. |
| `PASSWORD_LENGTH` | Le mot de passe doit contenir entre 8 et 64 caracteres. |
| `NON_WHITELISTED_FIELD` | La requete contient un champ non autorise par le backend. |

### Système
| Clé | Code Métier | HTTP | Message |
|---|---|---:|---|
| `VALIDATION_REQUEST_INVALID` | `VALIDATION_REQUEST_INVALID` | `400` | Les donnees envoyees sont invalides. |
| `SYSTEM_INTERNAL_SERVER_ERROR` | `SYSTEM_INTERNAL_SERVER_ERROR` | `500` | Erreur interne du serveur. |
