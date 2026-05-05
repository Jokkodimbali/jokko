export const AUTH_UI_MESSAGES = {
  loginFailed: 'Une erreur est survenue lors de la connexion.',
  registerFailed: 'Une erreur est survenue lors de l’inscription.',
  otpInvalid: 'Code OTP invalide ou expiré.',
  otpResendFailed: 'Erreur lors du renvoi du code.',
  otpResent: 'Un nouveau code a été envoyé.',
  phoneRequired: 'Veuillez entrer un numéro de téléphone valide (ex: +221770000000).',
  passwordLength: 'Le mot de passe doit contenir entre 8 et 64 caractères.',
  otpCodeInvalid: 'Veuillez entrer un code de vérification valide (exactement 6 chiffres).',
  missingPhoneForOtp: 'Le numéro de téléphone est requis pour vérifier le code.',
  nameInvalid: 'Nom invalide (2-100 caractères).',
  phoneInvalidShort: 'Numéro invalide.',
} as const;
