export type UpdateMyProfileCommand = {
  name?: string;
  email?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
};

export type UpdateMyAvatarCommand = {
  avatarUrl: string;
};

export type GetMyHistoryQuery = {
  limit?: number;
};
