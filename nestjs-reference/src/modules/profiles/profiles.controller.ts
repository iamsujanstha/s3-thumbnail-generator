import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto, UpdateProfileDto, ListProfilesQueryDto } from './dto/profiles.dto';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  async getProfiles(@Query() query: ListProfilesQueryDto) {
    return this.profilesService.list(query);
  }

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return this.profilesService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProfile(@Body() dto: CreateProfileDto) {
    return this.profilesService.create(dto);
  }

  @Patch(':id')
  async updateProfile(@Param('id') id: string, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProfile(@Param('id') id: string) {
    const success = await this.profilesService.delete(id);
    return { success };
  }
}
