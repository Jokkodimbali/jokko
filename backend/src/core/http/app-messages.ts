import type { HttpStatus } from '@nestjs/common';
import { HTTP_STATUS_CODES } from './http-status-codes';

export type AppMessageDefinition = {
  code: string;
  httpStatus: HttpStatus;
  message: string;
};

export const APP_MESSAGES_BY_MODULE = {
  validation: {
    VALIDATION_REQUEST_INVALID: {
      code: 'VALIDATION_REQUEST_INVALID',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'Les donnees envoyees sont invalides.',
    },
  },
  auth: {
    AUTH_OTP_SENT: {
      code: 'AUTH_OTP_SENT',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Code OTP envoye avec succes.',
    },
    AUTH_PHONE_ALREADY_USED: {
      code: 'AUTH_PHONE_ALREADY_USED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Ce numero de telephone est deja utilise.',
    },
    AUTH_EMAIL_ALREADY_USED: {
      code: 'AUTH_EMAIL_ALREADY_USED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Cette adresse email est deja utilisee.',
    },
    AUTH_INVALID_CREDENTIALS: {
      code: 'AUTH_INVALID_CREDENTIALS',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.UNAUTHORIZED,
      message: 'Les identifiants sont invalides.',
    },
    AUTH_REFRESH_TOKEN_INVALID: {
      code: 'AUTH_REFRESH_TOKEN_INVALID',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.UNAUTHORIZED,
      message: 'Le refresh token est invalide ou expire.',
    },
    AUTH_GOOGLE_NOT_CONFIGURED: {
      code: 'AUTH_GOOGLE_NOT_CONFIGURED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.UNAUTHORIZED,
      message: "La connexion Google n'est pas configuree.",
    },
    AUTH_GOOGLE_ACCOUNT_INVALID: {
      code: 'AUTH_GOOGLE_ACCOUNT_INVALID',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.UNAUTHORIZED,
      message: 'Le compte Google est invalide.',
    },
    AUTH_GOOGLE_ACCOUNT_NOT_LINKED: {
      code: 'AUTH_GOOGLE_ACCOUNT_NOT_LINKED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.UNAUTHORIZED,
      message:
        'Aucun compte lie a Google. Inscrivez-vous via OTP puis liez Google.',
    },
    AUTH_LOGOUT_SUCCESS: {
      code: 'AUTH_LOGOUT_SUCCESS',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Deconnexion effectuee avec succes.',
    },
    AUTH_USER_NOT_FOUND: {
      code: 'AUTH_USER_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Utilisateur introuvable.',
    },
    AUTH_TOKEN_MISSING: {
      code: 'AUTH_TOKEN_MISSING',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.UNAUTHORIZED,
      message: "Le token d'authentification est manquant.",
    },
    AUTH_TOKEN_INVALID: {
      code: 'AUTH_TOKEN_INVALID',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.UNAUTHORIZED,
      message: "Le token d'authentification est invalide.",
    },
    AUTH_OTP_INVALID_OR_EXPIRED: {
      code: 'AUTH_OTP_INVALID_OR_EXPIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.UNAUTHORIZED,
      message: 'Le code OTP est invalide ou expire.',
    },
    AUTH_OTP_TOO_MANY_REQUESTS: {
      code: 'AUTH_OTP_TOO_MANY_REQUESTS',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.TOO_MANY_REQUESTS,
      message: 'Trop de tentatives OTP. Reessayez plus tard.',
    },
    AUTH_OTP_RESEND_TOO_EARLY: {
      code: 'AUTH_OTP_RESEND_TOO_EARLY',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.TOO_MANY_REQUESTS,
      message: 'Veuillez patienter avant de redemander un OTP.',
    },
    AUTH_PHONE_INVALID: {
      code: 'AUTH_PHONE_INVALID',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'Le numero de telephone est invalide.',
    },
  },
  users: {
    USERS_USER_NOT_FOUND: {
      code: 'USERS_USER_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Utilisateur introuvable.',
    },
    USERS_UPDATE_EMPTY: {
      code: 'USERS_UPDATE_EMPTY',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'Aucune donnee a mettre a jour.',
    },
    USERS_EMAIL_ALREADY_USED: {
      code: 'USERS_EMAIL_ALREADY_USED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Cette adresse email est deja utilisee.',
    },
    USERS_PROFILE_UPDATED: {
      code: 'USERS_PROFILE_UPDATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Profil mis a jour avec succes.',
    },
    USERS_AVATAR_UPDATED: {
      code: 'USERS_AVATAR_UPDATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Photo de profil mise a jour avec succes.',
    },
    USERS_ACCOUNT_ANONYMIZED: {
      code: 'USERS_ACCOUNT_ANONYMIZED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Compte anonymise avec succes.',
    },
  },
  professionals: {
    PROFESSIONALS_FORBIDDEN_ROLE: {
      code: 'PROFESSIONALS_FORBIDDEN_ROLE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message:
        'Seuls les comptes professionnels peuvent effectuer cette action.',
    },
    PROFESSIONALS_ADMIN_FORBIDDEN_ROLE: {
      code: 'PROFESSIONALS_ADMIN_FORBIDDEN_ROLE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message: 'Seuls les administrateurs peuvent effectuer cette action.',
    },
    PROFESSIONALS_PROFILE_CREATED: {
      code: 'PROFESSIONALS_PROFILE_CREATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Profil professionnel cree avec succes.',
    },
    PROFESSIONALS_PROFILE_ALREADY_EXISTS: {
      code: 'PROFESSIONALS_PROFILE_ALREADY_EXISTS',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Un profil professionnel existe deja pour ce compte.',
    },
    PROFESSIONALS_PROFILE_NOT_FOUND: {
      code: 'PROFESSIONALS_PROFILE_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Profil professionnel introuvable.',
    },
    PROFESSIONALS_KYC_SUBMITTED: {
      code: 'PROFESSIONALS_KYC_SUBMITTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Document KYC soumis avec succes.',
    },
    PROFESSIONALS_PROFILE_UPDATED: {
      code: 'PROFESSIONALS_PROFILE_UPDATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Profil professionnel mis a jour avec succes.',
    },
    PROFESSIONALS_KYC_APPROVED: {
      code: 'PROFESSIONALS_KYC_APPROVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'KYC approuve avec succes.',
    },
    PROFESSIONALS_KYC_REJECTED: {
      code: 'PROFESSIONALS_KYC_REJECTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'KYC rejete avec succes.',
    },
    PROFESSIONALS_KYC_NOT_VERIFIED: {
      code: 'PROFESSIONALS_KYC_NOT_VERIFIED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message:
        'Votre profil KYC doit etre verifie pour effectuer cette action.',
    },
    PROFESSIONALS_CATEGORY_NOT_FOUND: {
      code: 'PROFESSIONALS_CATEGORY_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Categorie introuvable.',
    },
    PROFESSIONALS_SERVICE_NOT_FOUND: {
      code: 'PROFESSIONALS_SERVICE_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Service introuvable.',
    },
    PROFESSIONALS_SERVICE_CREATED: {
      code: 'PROFESSIONALS_SERVICE_CREATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Service cree avec succes.',
    },
    PROFESSIONALS_SERVICE_UPDATED: {
      code: 'PROFESSIONALS_SERVICE_UPDATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Service mis a jour avec succes.',
    },
    PROFESSIONALS_SERVICE_DISABLED: {
      code: 'PROFESSIONALS_SERVICE_DISABLED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Service desactive avec succes.',
    },
    PROFESSIONALS_PORTFOLIO_ITEM_CREATED: {
      code: 'PROFESSIONALS_PORTFOLIO_ITEM_CREATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Element portfolio ajoute avec succes.',
    },
    PROFESSIONALS_PORTFOLIO_ITEM_DELETED: {
      code: 'PROFESSIONALS_PORTFOLIO_ITEM_DELETED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Element portfolio supprime avec succes.',
    },
    PROFESSIONALS_PORTFOLIO_ITEM_NOT_FOUND: {
      code: 'PROFESSIONALS_PORTFOLIO_ITEM_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Element portfolio introuvable.',
    },
    PROFESSIONALS_AVAILABILITY_CREATED: {
      code: 'PROFESSIONALS_AVAILABILITY_CREATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Disponibilite ajoutee avec succes.',
    },
    PROFESSIONALS_AVAILABILITY_DISABLED: {
      code: 'PROFESSIONALS_AVAILABILITY_DISABLED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Disponibilite desactivee avec succes.',
    },
    PROFESSIONALS_AVAILABILITY_NOT_FOUND: {
      code: 'PROFESSIONALS_AVAILABILITY_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Disponibilite introuvable.',
    },
  },
  system: {
    SYSTEM_DATABASE_URL_MISSING: {
      code: 'SYSTEM_DATABASE_URL_MISSING',
      httpStatus: HTTP_STATUS_CODES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      message: "La variable d'environnement DATABASE_URL est obligatoire.",
    },
    SYSTEM_INTERNAL_SERVER_ERROR: {
      code: 'SYSTEM_INTERNAL_SERVER_ERROR',
      httpStatus: HTTP_STATUS_CODES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      message: 'Erreur interne du serveur.',
    },
  },
} as const satisfies Record<string, Record<string, AppMessageDefinition>>;

export const APP_MESSAGE_CATALOG = {
  ...APP_MESSAGES_BY_MODULE.validation,
  ...APP_MESSAGES_BY_MODULE.auth,
  ...APP_MESSAGES_BY_MODULE.users,
  ...APP_MESSAGES_BY_MODULE.professionals,
  ...APP_MESSAGES_BY_MODULE.system,
} as const satisfies Record<string, AppMessageDefinition>;

export type AppMessageKey = keyof typeof APP_MESSAGE_CATALOG;

export const VALIDATION_MESSAGES = {
  PHONE_REQUIRED: 'Le numero de telephone est obligatoire.',
  PHONE_FORMAT: 'Le numero de telephone doit etre au format international.',
  OTP_CODE_REQUIRED: 'Le code OTP est obligatoire.',
  OTP_CODE_LENGTH: 'Le code OTP doit contenir exactement 6 chiffres.',
  NAME_REQUIRED: 'Le nom est obligatoire.',
  NAME_MIN: 'Le nom doit contenir au moins 2 caracteres.',
  NAME_MAX: 'Le nom ne doit pas depasser 100 caracteres.',
  EMAIL_INVALID: "L'adresse email est invalide.",
  AVATAR_URL_INVALID: "L'URL de l'avatar est invalide.",
  ADDRESS_INVALID: "L'adresse est invalide.",
  ADDRESS_MAX: "L'adresse ne doit pas depasser 255 caracteres.",
  HISTORY_LIMIT_MIN: 'La limite minimale est 1.',
  HISTORY_LIMIT_MAX: 'La limite maximale est 100.',
  BIO_MAX: 'La biographie ne doit pas depasser 1000 caracteres.',
  COMPANY_NAME_MAX:
    "Le nom de l'entreprise ne doit pas depasser 150 caracteres.",
  CITY_MAX: 'La ville ne doit pas depasser 100 caracteres.',
  KYC_ID_CARD_URL_REQUIRED: "L'URL de la piece d'identite est obligatoire.",
  KYC_ID_CARD_URL_INVALID: "L'URL de la piece d'identite est invalide.",
  PROFESSIONALS_LIMIT_MIN: 'La limite minimale est 1.',
  PROFESSIONALS_LIMIT_MAX: 'La limite maximale est 50.',
  KYC_REJECT_REASON_REQUIRED: 'Le motif de rejet KYC est obligatoire.',
  KYC_REJECT_REASON_MIN:
    'Le motif de rejet KYC doit contenir au moins 10 caracteres.',
  KYC_REJECT_REASON_MAX:
    'Le motif de rejet KYC ne doit pas depasser 1000 caracteres.',
  CATEGORY_ID_REQUIRED: 'La categorie est obligatoire.',
  SERVICE_NAME_REQUIRED: 'Le nom du service est obligatoire.',
  SERVICE_NAME_MAX: 'Le nom du service ne doit pas depasser 200 caracteres.',
  SERVICE_DESCRIPTION_REQUIRED: 'La description du service est obligatoire.',
  SERVICE_PRICE_INVALID: 'Le prix du service est invalide.',
  SERVICE_PRICE_TYPE_INVALID: 'Le type de prix est invalide.',
  PORTFOLIO_TITLE_REQUIRED: 'Le titre du portfolio est obligatoire.',
  PORTFOLIO_TITLE_MAX:
    'Le titre du portfolio ne doit pas depasser 200 caracteres.',
  PORTFOLIO_IMAGE_URL_REQUIRED: "L'URL de l'image est obligatoire.",
  PORTFOLIO_IMAGE_URL_INVALID: "L'URL de l'image est invalide.",
  DAY_OF_WEEK_INVALID: 'Le jour de semaine doit etre entre 0 et 6.',
  START_TIME_REQUIRED: "L'heure de debut est obligatoire.",
  END_TIME_REQUIRED: "L'heure de fin est obligatoire.",
  TIME_FORMAT_INVALID: "Le format d'heure doit etre HH:mm.",
  PASSWORD_REQUIRED: 'Le mot de passe est obligatoire.',
  PASSWORD_LENGTH: 'Le mot de passe doit contenir entre 8 et 64 caracteres.',
  ID_TOKEN_REQUIRED: 'Le token Google est obligatoire.',
  ID_TOKEN_MIN: 'Le token Google est invalide.',
  REFRESH_TOKEN_REQUIRED: 'Le refresh token est obligatoire.',
  REFRESH_TOKEN_MIN: 'Le refresh token est invalide.',
  NON_WHITELISTED_FIELD:
    'La requete contient un champ non autorise par le backend.',
} as const;

export const ENV_MESSAGES = {
  INVALID_PORT: (value: string) =>
    `Variable d'environnement invalide: PORT=${value}. Le port doit etre un nombre positif.`,
  INVALID_SECRET_MIN_LENGTH: (name: string) =>
    `Variable d'environnement invalide: ${name} doit contenir au moins 16 caracteres.`,
  INVALID_NODE_ENV: (value: string) =>
    `Variable d'environnement invalide: NODE_ENV=${value}.`,
  INVALID_DATABASE_URL:
    "Variable d'environnement invalide: DATABASE_URL doit commencer par postgresql://.",
} as const;

export const TECHNICAL_MESSAGES = {
  DATABASE_HEALTH_TIMEOUT:
    'Le delai de verification de la base de donnees est depasse.',
} as const;
