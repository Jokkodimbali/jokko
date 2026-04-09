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
