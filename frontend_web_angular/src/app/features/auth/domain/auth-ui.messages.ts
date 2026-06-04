export const AUTH_UI_MESSAGES = {
  loginFailed: 'Une erreur est survenue lors de la connexion.',
  loginSuccess: 'Connexion effectuee avec succes.',
  logoutSuccess: 'Deconnexion effectuee avec succes.',
  registerSuccess: 'Compte cree avec succes.',
  registerFailed: 'Une erreur est survenue lors de l’inscription.',
  otpInvalid: 'Code OTP invalide ou expiré.',
  otpResendFailed: 'Erreur lors du renvoi du code.',
  otpResent: 'Un nouveau code a été envoyé.',
  phoneRequired:
    'Veuillez entrer un numero senegalais valide au format +221770000000.',
  emailInvalid: 'Veuillez entrer une adresse email valide.',
  loginIdentifierInvalid:
    'Veuillez entrer un numero senegalais valide ou une adresse email valide.',
  passwordLength: 'Le mot de passe doit contenir entre 8 et 64 caractères.',
  otpCodeInvalid: 'Veuillez entrer un code de vérification valide (exactement 6 chiffres).',
  missingPhoneForOtp: 'Le numéro de téléphone est requis pour vérifier le code.',
  nameInvalid: 'Nom invalide (2-100 caractères).',
  phoneInvalidShort: 'Numero senegalais invalide. Exemple : +221770000000.',
} as const;
