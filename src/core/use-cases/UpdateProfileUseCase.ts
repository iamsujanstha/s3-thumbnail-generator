import type { IProfileRepository, UpdateProfileData } from "@/core/domain/repositories/IProfileRepository";

export class UpdateProfileUseCase {
  constructor(private readonly profileRepository: IProfileRepository) {}

  async execute(id: string, data: UpdateProfileData) {
    return this.profileRepository.update(id, data);
  }
}
