import { HttpStatus } from '@nestjs/common';
export type AppMessageDefinition = {
    code: string;
    httpStatus: HttpStatus;
    message: string;
};
export declare const APP_MESSAGE_CATALOG: {
    readonly VALIDATION_REQUEST_INVALID: {
        readonly code: "VALIDATION_REQUEST_INVALID";
        readonly httpStatus: HttpStatus.BAD_REQUEST;
        readonly message: "Les donnees envoyees sont invalides.";
    };
    readonly AUTH_OTP_SENT: {
        readonly code: "AUTH_OTP_SENT";
        readonly httpStatus: HttpStatus.OK;
        readonly message: "Code OTP envoye avec succes.";
    };
    readonly AUTH_PHONE_ALREADY_USED: {
        readonly code: "AUTH_PHONE_ALREADY_USED";
        readonly httpStatus: HttpStatus.CONFLICT;
        readonly message: "Ce numero de telephone est deja utilise.";
    };
    readonly AUTH_INVALID_CREDENTIALS: {
        readonly code: "AUTH_INVALID_CREDENTIALS";
        readonly httpStatus: HttpStatus.UNAUTHORIZED;
        readonly message: "Les identifiants sont invalides.";
    };
    readonly AUTH_REFRESH_TOKEN_INVALID: {
        readonly code: "AUTH_REFRESH_TOKEN_INVALID";
        readonly httpStatus: HttpStatus.UNAUTHORIZED;
        readonly message: "Le refresh token est invalide ou expire.";
    };
    readonly AUTH_GOOGLE_NOT_CONFIGURED: {
        readonly code: "AUTH_GOOGLE_NOT_CONFIGURED";
        readonly httpStatus: HttpStatus.UNAUTHORIZED;
        readonly message: "La connexion Google n'est pas configuree.";
    };
    readonly AUTH_GOOGLE_ACCOUNT_INVALID: {
        readonly code: "AUTH_GOOGLE_ACCOUNT_INVALID";
        readonly httpStatus: HttpStatus.UNAUTHORIZED;
        readonly message: "Le compte Google est invalide.";
    };
    readonly AUTH_GOOGLE_ACCOUNT_NOT_LINKED: {
        readonly code: "AUTH_GOOGLE_ACCOUNT_NOT_LINKED";
        readonly httpStatus: HttpStatus.UNAUTHORIZED;
        readonly message: "Aucun compte lie a Google. Inscrivez-vous via OTP puis liez Google.";
    };
    readonly AUTH_LOGOUT_SUCCESS: {
        readonly code: "AUTH_LOGOUT_SUCCESS";
        readonly httpStatus: HttpStatus.OK;
        readonly message: "Deconnexion effectuee avec succes.";
    };
    readonly AUTH_USER_NOT_FOUND: {
        readonly code: "AUTH_USER_NOT_FOUND";
        readonly httpStatus: HttpStatus.NOT_FOUND;
        readonly message: "Utilisateur introuvable.";
    };
    readonly AUTH_TOKEN_MISSING: {
        readonly code: "AUTH_TOKEN_MISSING";
        readonly httpStatus: HttpStatus.UNAUTHORIZED;
        readonly message: "Le token d'authentification est manquant.";
    };
    readonly AUTH_TOKEN_INVALID: {
        readonly code: "AUTH_TOKEN_INVALID";
        readonly httpStatus: HttpStatus.UNAUTHORIZED;
        readonly message: "Le token d'authentification est invalide.";
    };
    readonly AUTH_OTP_INVALID_OR_EXPIRED: {
        readonly code: "AUTH_OTP_INVALID_OR_EXPIRED";
        readonly httpStatus: HttpStatus.UNAUTHORIZED;
        readonly message: "Le code OTP est invalide ou expire.";
    };
    readonly AUTH_OTP_TOO_MANY_REQUESTS: {
        readonly code: "AUTH_OTP_TOO_MANY_REQUESTS";
        readonly httpStatus: HttpStatus.TOO_MANY_REQUESTS;
        readonly message: "Trop de tentatives OTP. Reessayez plus tard.";
    };
    readonly AUTH_OTP_RESEND_TOO_EARLY: {
        readonly code: "AUTH_OTP_RESEND_TOO_EARLY";
        readonly httpStatus: HttpStatus.TOO_MANY_REQUESTS;
        readonly message: "Veuillez patienter avant de redemander un OTP.";
    };
    readonly AUTH_PHONE_INVALID: {
        readonly code: "AUTH_PHONE_INVALID";
        readonly httpStatus: HttpStatus.BAD_REQUEST;
        readonly message: "Le numero de telephone est invalide.";
    };
    readonly USERS_USER_NOT_FOUND: {
        readonly code: "USERS_USER_NOT_FOUND";
        readonly httpStatus: HttpStatus.NOT_FOUND;
        readonly message: "Utilisateur introuvable.";
    };
    readonly SYSTEM_DATABASE_URL_MISSING: {
        readonly code: "SYSTEM_DATABASE_URL_MISSING";
        readonly httpStatus: HttpStatus.INTERNAL_SERVER_ERROR;
        readonly message: "La variable d'environnement DATABASE_URL est obligatoire.";
    };
    readonly SYSTEM_INTERNAL_SERVER_ERROR: {
        readonly code: "SYSTEM_INTERNAL_SERVER_ERROR";
        readonly httpStatus: HttpStatus.INTERNAL_SERVER_ERROR;
        readonly message: "Erreur interne du serveur.";
    };
};
export type AppMessageKey = keyof typeof APP_MESSAGE_CATALOG;
export declare const VALIDATION_MESSAGES: {
    readonly PHONE_REQUIRED: "Le numero de telephone est obligatoire.";
    readonly PHONE_FORMAT: "Le numero de telephone doit etre au format international.";
    readonly OTP_CODE_REQUIRED: "Le code OTP est obligatoire.";
    readonly OTP_CODE_LENGTH: "Le code OTP doit contenir exactement 6 chiffres.";
    readonly NAME_REQUIRED: "Le nom est obligatoire.";
    readonly NAME_MIN: "Le nom doit contenir au moins 2 caracteres.";
    readonly NAME_MAX: "Le nom ne doit pas depasser 100 caracteres.";
    readonly EMAIL_INVALID: "L'adresse email est invalide.";
    readonly PASSWORD_REQUIRED: "Le mot de passe est obligatoire.";
    readonly PASSWORD_LENGTH: "Le mot de passe doit contenir entre 8 et 64 caracteres.";
    readonly ID_TOKEN_REQUIRED: "Le token Google est obligatoire.";
    readonly ID_TOKEN_MIN: "Le token Google est invalide.";
    readonly REFRESH_TOKEN_REQUIRED: "Le refresh token est obligatoire.";
    readonly REFRESH_TOKEN_MIN: "Le refresh token est invalide.";
    readonly NON_WHITELISTED_FIELD: "La requete contient un champ non autorise par le backend.";
};
export declare const ENV_MESSAGES: {
    readonly INVALID_PORT: (value: string) => string;
    readonly INVALID_SECRET_MIN_LENGTH: (name: string) => string;
    readonly INVALID_NODE_ENV: (value: unknown) => string;
    readonly INVALID_DATABASE_URL: "Variable d'environnement invalide: DATABASE_URL doit commencer par postgresql://.";
};
