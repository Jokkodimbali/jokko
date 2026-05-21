import type { HttpStatus } from '@nestjs/common';
import { HTTP_STATUS_CODES } from '../http/http-status-codes';

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
    AUTH_ACCOUNT_INACTIVE: {
      code: 'AUTH_ACCOUNT_INACTIVE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message: 'Ce compte est bloque ou desactive par un administrateur.',
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
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Photo de profil mise a jour avec succes.',
    },
    USERS_ACCOUNT_ANONYMIZED: {
      code: 'USERS_ACCOUNT_ANONYMIZED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Compte anonymise avec succes.',
    },
    USERS_ADMIN_FORBIDDEN_ROLE: {
      code: 'USERS_ADMIN_FORBIDDEN_ROLE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message: 'Seuls les administrateurs peuvent effectuer cette action.',
    },
    USERS_LISTED: {
      code: 'USERS_LISTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Utilisateurs recuperes avec succes.',
    },
    USERS_HISTORY_RETRIEVED: {
      code: 'USERS_HISTORY_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: "Historique de l'utilisateur recupere avec succes.",
    },
    USERS_BLOCKED: {
      code: 'USERS_BLOCKED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Utilisateur bloque avec succes.',
    },
    USERS_UNBLOCKED: {
      code: 'USERS_UNBLOCKED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Utilisateur debloque avec succes.',
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
    PROFESSIONALS_UPDATE_EMPTY: {
      code: 'PROFESSIONALS_UPDATE_EMPTY',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'Au moins un champ doit etre fourni pour la mise a jour.',
    },
    PROFESSIONALS_REJECT_REASON_EMPTY: {
      code: 'PROFESSIONALS_REJECT_REASON_EMPTY',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'Le motif de rejet ne peut pas etre vide.',
    },
    PROFESSIONALS_AVAILABILITY_NOT_FOUND: {
      code: 'PROFESSIONALS_AVAILABILITY_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Disponibilite introuvable.',
    },
  },
  categories: {
    CATEGORIES_ADMIN_FORBIDDEN_ROLE: {
      code: 'CATEGORIES_ADMIN_FORBIDDEN_ROLE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message: 'Seuls les administrateurs peuvent effectuer cette action.',
    },
    CATEGORIES_CATEGORY_NOT_FOUND: {
      code: 'CATEGORIES_CATEGORY_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Categorie introuvable.',
    },
    CATEGORIES_NAME_ALREADY_USED: {
      code: 'CATEGORIES_NAME_ALREADY_USED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Une categorie avec ce nom existe deja.',
    },
    CATEGORIES_CATEGORY_CREATED: {
      code: 'CATEGORIES_CATEGORY_CREATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Categorie creee avec succes.',
    },
    CATEGORIES_CATEGORY_UPDATED: {
      code: 'CATEGORIES_CATEGORY_UPDATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Categorie mise a jour avec succes.',
    },
    CATEGORIES_CATEGORY_DISABLED: {
      code: 'CATEGORIES_CATEGORY_DISABLED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Categorie desactivee avec succes.',
    },
    CATEGORIES_COMMISSION_RATE_INVALID: {
      code: 'CATEGORIES_COMMISSION_RATE_INVALID',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'Le taux de commission de la categorie est invalide.',
    },
    CATEGORIES_UPDATE_EMPTY: {
      code: 'CATEGORIES_UPDATE_EMPTY',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'Au moins un champ doit etre fourni pour la mise a jour.',
    },
  },
  search: {
    SEARCH_RESULTS_RETRIEVED: {
      code: 'SEARCH_RESULTS_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Resultats de recherche recuperes avec succes.',
    },
    SEARCH_COORDINATES_PAIR_REQUIRED: {
      code: 'SEARCH_COORDINATES_PAIR_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message:
        'La latitude et la longitude doivent etre fournies ensemble pour une recherche geolocalisee.',
    },
  },
  negotiations: {
    NEGOTIATIONS_CLIENT_ROLE_REQUIRED: {
      code: 'NEGOTIATIONS_CLIENT_ROLE_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message:
        'Seuls les clients peuvent initier ou annuler une negotiation de prix.',
    },
    NEGOTIATIONS_PROFESSIONAL_ROLE_REQUIRED: {
      code: 'NEGOTIATIONS_PROFESSIONAL_ROLE_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message:
        'Seuls les prestataires peuvent repondre a cette action de negotiation.',
    },
    NEGOTIATIONS_NOT_FOUND: {
      code: 'NEGOTIATIONS_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Negotiation introuvable.',
    },
    NEGOTIATIONS_UNAUTHORIZED: {
      code: 'NEGOTIATIONS_UNAUTHORIZED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message: "Vous n'etes pas autorise a acceder a cette negotiation.",
    },
    NEGOTIATIONS_SERVICE_NOT_NEGOTIABLE: {
      code: 'NEGOTIATIONS_SERVICE_NOT_NEGOTIABLE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Ce service ne permet pas la negotiation de prix.',
    },
    NEGOTIATIONS_ALREADY_ACTIVE: {
      code: 'NEGOTIATIONS_ALREADY_ACTIVE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'Une negotiation active existe deja pour ce service et ce client.',
    },
    NEGOTIATIONS_SELF_NEGOTIATION_FORBIDDEN: {
      code: 'NEGOTIATIONS_SELF_NEGOTIATION_FORBIDDEN',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'Un prestataire ne peut pas negocier son propre service en tant que client.',
    },
    NEGOTIATIONS_WRONG_TURN: {
      code: 'NEGOTIATIONS_WRONG_TURN',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'Cette action ne correspond pas au tour actuel de la negotiation.',
    },
    NEGOTIATIONS_ALREADY_CLOSED: {
      code: 'NEGOTIATIONS_ALREADY_CLOSED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Cette negotiation est deja cloturee.',
    },
    NEGOTIATIONS_ACCEPTED_REQUIRED: {
      code: 'NEGOTIATIONS_ACCEPTED_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'La negotiation doit etre acceptee avant de creer une reservation.',
    },
    NEGOTIATIONS_ALREADY_CONVERTED: {
      code: 'NEGOTIATIONS_ALREADY_CONVERTED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Cette negotiation est deja convertie en reservation.',
    },
    NEGOTIATIONS_AMOUNT_INVALID: {
      code: 'NEGOTIATIONS_AMOUNT_INVALID',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'Le montant propose est invalide.',
    },
    NEGOTIATIONS_CREATED: {
      code: 'NEGOTIATIONS_CREATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Negotiation creee avec succes.',
    },
    NEGOTIATIONS_COUNTERED: {
      code: 'NEGOTIATIONS_COUNTERED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Contre-proposition enregistree avec succes.',
    },
    NEGOTIATIONS_ACCEPTED: {
      code: 'NEGOTIATIONS_ACCEPTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Negotiation acceptee avec succes.',
    },
    NEGOTIATIONS_REJECTED: {
      code: 'NEGOTIATIONS_REJECTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Negotiation rejetee avec succes.',
    },
    NEGOTIATIONS_CANCELLED: {
      code: 'NEGOTIATIONS_CANCELLED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Negotiation annulee avec succes.',
    },
  },
  messaging: {
    MESSAGING_CONVERSATION_CREATED: {
      code: 'MESSAGING_CONVERSATION_CREATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Conversation disponible avec succes.',
    },
    MESSAGING_MESSAGES_RETRIEVED: {
      code: 'MESSAGING_MESSAGES_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Messages recuperes avec succes.',
    },
    MESSAGING_MESSAGE_SENT: {
      code: 'MESSAGING_MESSAGE_SENT',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Message envoye avec succes.',
    },
    MESSAGING_NOT_FOUND: {
      code: 'MESSAGING_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Conversation introuvable.',
    },
    MESSAGING_UNAUTHORIZED: {
      code: 'MESSAGING_UNAUTHORIZED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message: "Vous n'etes pas autorise a acceder a cette conversation.",
    },
    MESSAGING_PROFESSIONAL_NOT_FOUND: {
      code: 'MESSAGING_PROFESSIONAL_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Professionnel introuvable pour cette conversation.',
    },
    MESSAGING_CLIENT_NOT_FOUND: {
      code: 'MESSAGING_CLIENT_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Client introuvable pour cette conversation.',
    },
    MESSAGING_RESERVATION_NOT_FOUND: {
      code: 'MESSAGING_RESERVATION_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Reservation introuvable pour cette conversation.',
    },
    MESSAGING_RESERVATION_REQUIRED: {
      code: 'MESSAGING_RESERVATION_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'Une reservation est obligatoire pour ouvrir une conversation.',
    },
    MESSAGING_RESERVATION_PARTICIPANTS_MISMATCH: {
      code: 'MESSAGING_RESERVATION_PARTICIPANTS_MISMATCH',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'La reservation ne correspond pas aux participants de cette conversation.',
    },
    MESSAGING_SELF_CONVERSATION_FORBIDDEN: {
      code: 'MESSAGING_SELF_CONVERSATION_FORBIDDEN',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'Impossible de creer une conversation avec soi-meme sur la plateforme.',
    },
  },
  disputes: {
    DISPUTES_CREATED: {
      code: 'DISPUTES_CREATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Litige ouvert avec succes.',
    },
    DISPUTES_LISTED: {
      code: 'DISPUTES_LISTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Litiges recuperes avec succes.',
    },
    DISPUTES_RETRIEVED: {
      code: 'DISPUTES_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Litige recupere avec succes.',
    },
    DISPUTES_MARKED_IN_REVIEW: {
      code: 'DISPUTES_MARKED_IN_REVIEW',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Litige pris en charge avec succes.',
    },
    DISPUTES_RESOLVED: {
      code: 'DISPUTES_RESOLVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Litige resolu avec succes.',
    },
    DISPUTES_REJECTED: {
      code: 'DISPUTES_REJECTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Litige rejete avec succes.',
    },
    DISPUTES_MESSAGE_SENT: {
      code: 'DISPUTES_MESSAGE_SENT',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Message de mediation envoye avec succes.',
    },
    DISPUTES_NOT_FOUND: {
      code: 'DISPUTES_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Litige introuvable.',
    },
    DISPUTES_INVALID_STATUS: {
      code: 'DISPUTES_INVALID_STATUS',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Le statut actuel du litige ne permet pas cette action.',
    },
    DISPUTES_INVALID_RESOLUTION: {
      code: 'DISPUTES_INVALID_RESOLUTION',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message: 'La decision de resolution du litige est invalide.',
    },
  },
  liveTracking: {
    LIVE_TRACKING_ON_THE_WAY_MARKED: {
      code: 'LIVE_TRACKING_ON_THE_WAY_MARKED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Le trajet du prestataire vers la reservation a ete active.',
    },
    LIVE_TRACKING_STATUS_RETRIEVED: {
      code: 'LIVE_TRACKING_STATUS_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message:
        'Le suivi temps reel de la reservation a ete recupere avec succes.',
    },
    LIVE_TRACKING_PRESENCE_RETRIEVED: {
      code: 'LIVE_TRACKING_PRESENCE_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'La presence du prestataire a ete recuperee avec succes.',
    },
    LIVE_TRACKING_INVALID_RESERVATION_STATUS: {
      code: 'LIVE_TRACKING_INVALID_RESERVATION_STATUS',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'Le suivi en route ne peut etre active que pour une reservation payee et non demarree.',
    },
    LIVE_TRACKING_ACTIVE_SESSION_REQUIRED: {
      code: 'LIVE_TRACKING_ACTIVE_SESSION_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'Aucune session de suivi active nest disponible pour cette reservation.',
    },
    LIVE_TRACKING_PROFESSIONAL_PROFILE_NOT_FOUND: {
      code: 'LIVE_TRACKING_PROFESSIONAL_PROFILE_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Profil professionnel introuvable pour le suivi temps reel.',
    },
  },
  reservations: {
    RESERVATIONS_FORBIDDEN_ROLE: {
      code: 'RESERVATIONS_FORBIDDEN_ROLE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message:
        'Ce role ne peut pas effectuer cette action sur les reservations.',
    },
    RESERVATIONS_NOT_FOUND: {
      code: 'RESERVATIONS_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Reservation introuvable.',
    },
    RESERVATIONS_UNAUTHORIZED: {
      code: 'RESERVATIONS_UNAUTHORIZED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message: "Vous n'etes pas autorise a acceder a cette reservation.",
    },
    RESERVATIONS_SERVICE_NOT_FOUND: {
      code: 'RESERVATIONS_SERVICE_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Service introuvable.',
    },
    RESERVATIONS_PROFESSIONAL_NOT_FOUND: {
      code: 'RESERVATIONS_PROFESSIONAL_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Professionnel introuvable.',
    },
    RESERVATIONS_SERVICE_NOT_AVAILABLE: {
      code: 'RESERVATIONS_SERVICE_NOT_AVAILABLE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Ce service nest pas disponible pour reservation.',
    },
    RESERVATIONS_SERVICE_PROFESSIONAL_MISMATCH: {
      code: 'RESERVATIONS_SERVICE_PROFESSIONAL_MISMATCH',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Ce service n appartient pas au professionnel selectionne.',
    },
    RESERVATIONS_SELF_BOOKING_FORBIDDEN: {
      code: 'RESERVATIONS_SELF_BOOKING_FORBIDDEN',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'Un prestataire ne peut pas reserver son propre service en tant que client.',
    },
    RESERVATIONS_NEGOTIATION_REQUIRED: {
      code: 'RESERVATIONS_NEGOTIATION_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'Ce service necessite une negotiation de prix avant de creer une reservation.',
    },
    RESERVATIONS_NEGOTIATION_NOT_AVAILABLE: {
      code: 'RESERVATIONS_NEGOTIATION_NOT_AVAILABLE',
      httpStatus: HTTP_STATUS_CODES.SERVER_ERROR.NOT_IMPLEMENTED,
      message:
        'Le flux de reservation depuis une negotiation nest pas encore disponible.',
    },
    RESERVATIONS_TIME_SLOT_UNAVAILABLE: {
      code: 'RESERVATIONS_TIME_SLOT_UNAVAILABLE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Ce creneau horaire nest pas disponible.',
    },
    RESERVATIONS_STATUS_PENDING_REQUIRED: {
      code: 'RESERVATIONS_STATUS_PENDING_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'La reservation doit etre en attente pour cette action.',
    },
    RESERVATIONS_STATUS_ACTIVE_REQUIRED: {
      code: 'RESERVATIONS_STATUS_ACTIVE_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        'La reservation doit etre confirmee ou en cours pour cette action.',
    },
    RESERVATIONS_ALREADY_CLOSED: {
      code: 'RESERVATIONS_ALREADY_CLOSED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'La reservation est deja terminee ou annulee.',
    },
    RESERVATIONS_CREATED: {
      code: 'RESERVATIONS_CREATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Reservation creee avec succes.',
    },
    RESERVATIONS_CONFIRMED: {
      code: 'RESERVATIONS_CONFIRMED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Reservation confirmee avec succes.',
    },
    RESERVATIONS_CANCELLED: {
      code: 'RESERVATIONS_CANCELLED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Reservation annulee avec succes.',
    },
    RESERVATIONS_RESCHEDULED: {
      code: 'RESERVATIONS_RESCHEDULED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Reservation reprogrammee avec succes.',
    },
    RESERVATIONS_PRICE_ADJUSTMENT_PROPOSED: {
      code: 'RESERVATIONS_PRICE_ADJUSTMENT_PROPOSED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: "Demande d'ajustement de prix envoyee au client avec succes.",
    },
    RESERVATIONS_PRICE_ADJUSTMENT_ACCEPTED: {
      code: 'RESERVATIONS_PRICE_ADJUSTMENT_ACCEPTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Ajustement de prix accepte avec succes.',
    },
    RESERVATIONS_PRICE_ADJUSTMENT_REJECTED: {
      code: 'RESERVATIONS_PRICE_ADJUSTMENT_REJECTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Ajustement de prix refuse avec succes.',
    },
    RESERVATIONS_COMPLETED: {
      code: 'RESERVATIONS_COMPLETED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Reservation terminee avec succes.',
    },
    RESERVATIONS_REVIEW_SUBMITTED: {
      code: 'RESERVATIONS_REVIEW_SUBMITTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Avis client enregistre avec succes.',
    },
    RESERVATIONS_NO_SHOW_MARKED: {
      code: 'RESERVATIONS_NO_SHOW_MARKED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Absence du client enregistree avec succes.',
    },
    RESERVATIONS_DATE_RANGE_REQUIRED: {
      code: 'RESERVATIONS_DATE_RANGE_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
      message:
        'Les dates de debut et de fin sont obligatoires pour cette requete.',
    },
    RESERVATIONS_PRICE_ADJUSTMENT_FORBIDDEN_AFTER_PAYMENT: {
      code: 'RESERVATIONS_PRICE_ADJUSTMENT_FORBIDDEN_AFTER_PAYMENT',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message:
        "Impossible d'ajuster le prix car un paiement est deja en cours ou enregistre pour cette reservation.",
    },
    RESERVATIONS_REVIEW_ALREADY_SUBMITTED: {
      code: 'RESERVATIONS_REVIEW_ALREADY_SUBMITTED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Un avis client existe deja pour cette reservation.',
    },
    RESERVATIONS_REVIEW_COMPLETED_REQUIRED: {
      code: 'RESERVATIONS_REVIEW_COMPLETED_REQUIRED',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.CONFLICT,
      message: 'Seules les reservations terminees peuvent etre notees.',
    },
  },
  payments: {
    PAYMENTS_FORBIDDEN_ROLE: {
      code: 'PAYMENTS_FORBIDDEN_ROLE',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
      message:
        'Seuls les utilisateurs autorises peuvent consulter ces paiements.',
    },
    PAYMENTS_NOT_FOUND: {
      code: 'PAYMENTS_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Paiement introuvable.',
    },
    PAYMENTS_INITIATED: {
      code: 'PAYMENTS_INITIATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Paiement initie avec succes.',
    },
    PAYMENTS_WEBHOOK_PROCESSED: {
      code: 'PAYMENTS_WEBHOOK_PROCESSED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Webhook de paiement traite avec succes.',
    },
    PAYMENTS_ESCROW_RELEASED: {
      code: 'PAYMENTS_ESCROW_RELEASED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Fonds liberes avec succes au prestataire.',
    },
    PAYMENTS_ESCROW_DISPUTED: {
      code: 'PAYMENTS_ESCROW_DISPUTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Le paiement a ete place en litige.',
    },
    PAYMENTS_ESCROW_REFUNDED: {
      code: 'PAYMENTS_ESCROW_REFUNDED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Le paiement a ete rembourse.',
    },
    PAYMENTS_WITHDRAWAL_REQUESTED: {
      code: 'PAYMENTS_WITHDRAWAL_REQUESTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.CREATED,
      message: 'Demande de retrait initiee avec succes.',
    },
  },
  notifications: {
    NOTIFICATIONS_NOT_FOUND: {
      code: 'NOTIFICATIONS_NOT_FOUND',
      httpStatus: HTTP_STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
      message: 'Notification introuvable.',
    },
    NOTIFICATIONS_MARKED_AS_READ: {
      code: 'NOTIFICATIONS_MARKED_AS_READ',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Notification marquee comme lue avec succes.',
    },
    NOTIFICATIONS_ALL_MARKED_AS_READ: {
      code: 'NOTIFICATIONS_ALL_MARKED_AS_READ',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Toutes les notifications ont ete marquees comme lues.',
    },
    NOTIFICATIONS_FCM_TOKEN_UPDATED: {
      code: 'NOTIFICATIONS_FCM_TOKEN_UPDATED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Token de notification mis a jour avec succes.',
    },
    NOTIFICATIONS_ADMIN_BROADCAST_SENT: {
      code: 'NOTIFICATIONS_ADMIN_BROADCAST_SENT',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Notification de masse envoyee avec succes.',
    },
  },
  admin: {
    ADMIN_DASHBOARD_RETRIEVED: {
      code: 'ADMIN_DASHBOARD_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Tableau de bord admin recupere avec succes.',
    },
    ADMIN_MEDICAL_CREDENTIALS_RETRIEVED: {
      code: 'ADMIN_MEDICAL_CREDENTIALS_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Diplomes medecins recuperes avec succes.',
    },
    ADMIN_MEDICAL_CREDENTIALS_CERTIFIED: {
      code: 'ADMIN_MEDICAL_CREDENTIALS_CERTIFIED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Diplomes medecins certifies avec succes.',
    },
    ADMIN_MEDICAL_CREDENTIALS_REJECTED: {
      code: 'ADMIN_MEDICAL_CREDENTIALS_REJECTED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Diplomes medecins rejetes avec succes.',
    },
    ADMIN_PROVIDERS_RETRIEVED: {
      code: 'ADMIN_PROVIDERS_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Prestataires admin recuperes avec succes.',
    },
    ADMIN_REVENUE_RETRIEVED: {
      code: 'ADMIN_REVENUE_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: "Chiffre d'affaires admin recupere avec succes.",
    },
    ADMIN_REGIONS_RETRIEVED: {
      code: 'ADMIN_REGIONS_RETRIEVED',
      httpStatus: HTTP_STATUS_CODES.SUCCESS.OK,
      message: 'Couverture regionale admin recuperee avec succes.',
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
  ...APP_MESSAGES_BY_MODULE.categories,
  ...APP_MESSAGES_BY_MODULE.search,
  ...APP_MESSAGES_BY_MODULE.negotiations,
  ...APP_MESSAGES_BY_MODULE.messaging,
  ...APP_MESSAGES_BY_MODULE.disputes,
  ...APP_MESSAGES_BY_MODULE.liveTracking,
  ...APP_MESSAGES_BY_MODULE.reservations,
  ...APP_MESSAGES_BY_MODULE.payments,
  ...APP_MESSAGES_BY_MODULE.notifications,
  ...APP_MESSAGES_BY_MODULE.admin,
  ...APP_MESSAGES_BY_MODULE.system,
} as const satisfies Record<string, AppMessageDefinition>;

export type AppMessageKey = keyof typeof APP_MESSAGE_CATALOG;
