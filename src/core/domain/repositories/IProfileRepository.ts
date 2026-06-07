import { Profile } from "@/core/domain/entities/Profile";

export type ProfileQueryOptions = {
  limit?: number;
  cursor?: string;
};

export type ProfileQueryResult = {
  profiles: Profile[];
  nextCursor: string | null;
};

export type UpdateProfileData = {
  fullName: string;
  jobTitle: string;
  company: string;
};

export interface IProfileRepository {
  create(profile: Profile): Promise<Profile>;
  findMany(options?: ProfileQueryOptions): Promise<ProfileQueryResult>;
  findById(id: string): Promise<Profile | null>;
  update(id: string, data: UpdateProfileData): Promise<Profile | null>;
  delete(id: string): Promise<boolean>;
}
