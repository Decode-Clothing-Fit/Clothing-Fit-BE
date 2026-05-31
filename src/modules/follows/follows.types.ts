type UserWithProfile = {
  id: string;
  profile: { imageUrl: string | null; nickname: string } | null;
};