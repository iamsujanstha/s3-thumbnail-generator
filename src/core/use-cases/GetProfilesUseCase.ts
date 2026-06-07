import type { IProfileRepository } from "@/core/domain/repositories/IProfileRepository";

export class GetProfilesUseCase {
  constructor(private readonly profileRepository: IProfileRepository) {}

  async execute(options?: { limit?: number; cursor?: string }) {
    return this.profileRepository.findMany(options);
  }
}
