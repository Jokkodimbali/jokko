export type RegisterCommand = {
  phoneNumber: string;
  name: string;
  email?: string;
  password: string;
  role: 'CLIENT' | 'PRESTATAIRE';
  adresse: string;
};

export type LoginCommand = {
  phoneNumber: string;
  password: string;
};
