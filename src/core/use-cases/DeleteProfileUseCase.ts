import type { IProfileRepository } from "@/core/domain/repositories/IProfileRepository";

export class DeleteProfileUseCase {
  constructor(private readonly profileRepository: IProfileRepository) {}

  async execute(id: string): Promise<boolean> {
    return this.profileRepository.delete(id);
  }
}
