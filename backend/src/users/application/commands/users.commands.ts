export type UpdateMyProfileCommand = {
  name?: string;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
};

export type UpdateMyAvatarCommand = {
  avatarUrl: string;
};

export type ChangeMyPasswordCommand = {
  currentPassword?: string;
  newPassword: string;
};

export type GetMyHistoryQuery = {
  limit?: number;
};

export type UploadMyProfessionalCredentialCommand = {
  title: string;
  institution: string;
  graduationYear?: string | null;
  referenceNumber?: string | null;
  documentUrl: string;
};

export type UpdateMyProfessionalExpertiseCommand = {
  name: string;
};

export type UpdateMyProfessionalAboutCommand = {
  about: string;
};
