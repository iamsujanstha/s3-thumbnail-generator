/** Shared TypeScript types used by both client and server */

export type ProfileListItemDto = {
  id:           string;
  fullName:     string;
  jobTitle:     string;
  company:      string;
  imageKey:     string;
  thumbnailUrl: string;
  createdAt:    string;
};

export type ProfileDetailDto = {
  id:           string;
  fullName:     string;
  jobTitle:     string;
  company:      string;
  imageKey:     string;
  thumbnailUrl: string;
  originalUrl:  string;
  createdAt:    string;
  updatedAt:    string;
};
