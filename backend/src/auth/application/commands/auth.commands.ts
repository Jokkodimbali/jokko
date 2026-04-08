export type RegisterCommand = {
  phoneNumber: string;
  name: string;
  email?: string;
  password: string;
};

export type LoginCommand = {
  phoneNumber: string;
  password: string;
};
