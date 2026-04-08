"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV_MESSAGES = exports.VALIDATION_MESSAGES = exports.APP_MESSAGE_CATALOG = void 0;
const common_1 = require("@nestjs/common");
exports.APP_MESSAGE_CATALOG = {
    VALIDATION_REQUEST_INVALID: {
        code: 'VALIDATION_REQUEST_INVALID',
        httpStatus: common_1.HttpStatus.BAD_REQUEST,
        message: 'Les donnees envoyees sont invalides.',
    },
    AUTH_OTP_SENT: {
        code: 'AUTH_OTP_SENT',
        httpStatus: common_1.HttpStatus.OK,
        message: 'Code OTP envoye avec succes.',
    },
    AUTH_PHONE_ALREADY_USED: {
        code: 'AUTH_PHONE_ALREADY_USED',
        httpStatus: common_1.HttpStatus.CONFLICT,
        message: 'Ce numero de telephone est deja utilise.',
    },
    AUTH_INVALID_CREDENTIALS: {
        code: 'AUTH_INVALID_CREDENTIALS',
        httpStatus: common_1.HttpStatus.UNAUTHORIZED,
        message: 'Les identifiants sont invalides.',
    },
    AUTH_REFRESH_TOKEN_INVALID: {
        code: 'AUTH_REFRESH_TOKEN_INVALID',
        httpStatus: common_1.HttpStatus.UNAUTHORIZED,
        message: 'Le refresh token est invalide ou expire.',
    },
    AUTH_GOOGLE_NOT_CONFIGURED: {
        code: 'AUTH_GOOGLE_NOT_CONFIGURED',
        httpStatus: common_1.HttpStatus.UNAUTHORIZED,
        message: "La connexion Google n'est pas configuree.",
    },
    AUTH_GOOGLE_ACCOUNT_INVALID: {
        code: 'AUTH_GOOGLE_ACCOUNT_INVALID',
        httpStatus: common_1.HttpStatus.UNAUTHORIZED,
        message: 'Le compte Google est invalide.',
    },
    AUTH_GOOGLE_ACCOUNT_NOT_LINKED: {
        code: 'AUTH_GOOGLE_ACCOUNT_NOT_LINKED',
        httpStatus: common_1.HttpStatus.UNAUTHORIZED,
        message: 'Aucun compte lie a Google. Inscrivez-vous via OTP puis liez Google.',
    },
    AUTH_LOGOUT_SUCCESS: {
        code: 'AUTH_LOGOUT_SUCCESS',
        httpStatus: common_1.HttpStatus.OK,
        message: 'Deconnexion effectuee avec succes.',
    },
    AUTH_USER_NOT_FOUND: {
        code: 'AUTH_USER_NOT_FOUND',
        httpStatus: common_1.HttpStatus.NOT_FOUND,
        message: 'Utilisateur introuvable.',
    },
    AUTH_TOKEN_MISSING: {
        code: 'AUTH_TOKEN_MISSING',
        httpStatus: common_1.HttpStatus.UNAUTHORIZED,
        message: "Le token d'authentification est manquant.",
    },
    AUTH_TOKEN_INVALID: {
        code: 'AUTH_TOKEN_INVALID',
        httpStatus: common_1.HttpStatus.UNAUTHORIZED,
        message: "Le token d'authentification est invalide.",
    },
    AUTH_OTP_INVALID_OR_EXPIRED: {
        code: 'AUTH_OTP_INVALID_OR_EXPIRED',
        httpStatus: common_1.HttpStatus.UNAUTHORIZED,
        message: 'Le code OTP est invalide ou expire.',
    },
    AUTH_OTP_TOO_MANY_REQUESTS: {
        code: 'AUTH_OTP_TOO_MANY_REQUESTS',
        httpStatus: common_1.HttpStatus.TOO_MANY_REQUESTS,
        message: 'Trop de tentatives OTP. Reessayez plus tard.',
    },
    AUTH_OTP_RESEND_TOO_EARLY: {
        code: 'AUTH_OTP_RESEND_TOO_EARLY',
        httpStatus: common_1.HttpStatus.TOO_MANY_REQUESTS,
        message: 'Veuillez patienter avant de redemander un OTP.',
    },
    AUTH_PHONE_INVALID: {
        code: 'AUTH_PHONE_INVALID',
        httpStatus: common_1.HttpStatus.BAD_REQUEST,
        message: 'Le numero de telephone est invalide.',
    },
    USERS_USER_NOT_FOUND: {
        code: 'USERS_USER_NOT_FOUND',
        httpStatus: common_1.HttpStatus.NOT_FOUND,
        message: 'Utilisateur introuvable.',
    },
    SYSTEM_DATABASE_URL_MISSING: {
        code: 'SYSTEM_DATABASE_URL_MISSING',
        httpStatus: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
        message: "La variable d'environnement DATABASE_URL est obligatoire.",
    },
    SYSTEM_INTERNAL_SERVER_ERROR: {
        code: 'SYSTEM_INTERNAL_SERVER_ERROR',
        httpStatus: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Erreur interne du serveur.',
    },
};
exports.VALIDATION_MESSAGES = {
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
    NON_WHITELISTED_FIELD: 'La requete contient un champ non autorise par le backend.',
};
exports.ENV_MESSAGES = {
    INVALID_PORT: (value) => `Variable d'environnement invalide: PORT=${value}. Le port doit etre un nombre positif.`,
    INVALID_SECRET_MIN_LENGTH: (name) => `Variable d'environnement invalide: ${name} doit contenir au moins 16 caracteres.`,
    INVALID_NODE_ENV: (value) => `Variable d'environnement invalide: NODE_ENV=${String(value)}.`,
    INVALID_DATABASE_URL: "Variable d'environnement invalide: DATABASE_URL doit commencer par postgresql://.",
};
//# sourceMappingURL=message-catalog.js.map