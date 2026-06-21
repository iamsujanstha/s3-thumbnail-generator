/** Shared TypeScript types used by both client and server */

export type ProfileListItemDto = {
  id:           string;
  fullName:     string;
  jobTitle:     string;
  company:      string;
  imageKey:     string;
  thumbnailUrl: string | null;
  createdAt:    string;
};

export type ProfileDetailDto = {
  id:           string;
  fullName:     string;
  jobTitle:     string;
  company:      string;
  imageKey:     string;
  thumbnailUrl: string | null;
  originalUrl:  string | null;
  createdAt:    string;
  updatedAt:    string;
};
