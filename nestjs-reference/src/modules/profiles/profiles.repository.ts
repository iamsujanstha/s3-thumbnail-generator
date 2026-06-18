import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile, ProfileDocument } from './schemas/profile.schema';
import { CreateProfileDto, UpdateProfileDto } from './dto/profiles.dto';

@Injectable()
export class ProfilesRepository {
  constructor(
    @InjectModel(Profile.name)
    private readonly profileModel: Model<ProfileDocument>,
  ) {}

  async create(data: CreateProfileDto): Promise<ProfileDocument> {
    const doc = new this.profileModel(data);
    return doc.save();
  }

  async findMany(opts: { limit: number; cursor?: string }) {
    const filter = opts.cursor && Types.ObjectId.isValid(opts.cursor)
      ? { _id: { $lt: new Types.ObjectId(opts.cursor) } }
      : {};

    const docs = await this.profileModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(opts.limit + 1)
      .exec();

    const hasMore = docs.length > opts.limit;
    const visible = hasMore ? docs.slice(0, opts.limit) : docs;

    return {
      profiles: visible,
      nextCursor: hasMore && visible.at(-1)?._id
        ? (visible.at(-1)!._id as Types.ObjectId).toHexString()
        : null,
    };
  }

  async findById(id: string): Promise<ProfileDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.profileModel.findById(id).exec();
  }

  async update(id: string, data: UpdateProfileDto): Promise<ProfileDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.profileModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const result = await this.profileModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
    return result.deletedCount === 1;
  }
}
