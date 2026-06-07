import { Profile } from "@/core/domain/entities/Profile";
import type { IProfileRepository } from "@/core/domain/repositories/IProfileRepository";
import type { CreateProfileDto } from "@/shared/dtos";

export class CreateProfileUseCase {
  constructor(private readonly profileRepository: IProfileRepository) {}

  async execute(input: CreateProfileDto) {
    const profile = Profile.create(input);
    return this.profileRepository.create(profile);
  }
}
