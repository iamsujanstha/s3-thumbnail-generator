import { ObjectId, type Collection, type Document, type Filter } from "mongodb";
import { Profile } from "@/core/domain/entities/Profile";
import type {
  IProfileRepository,
  ProfileQueryOptions,
  ProfileQueryResult,
  UpdateProfileData
} from "@/core/domain/repositories/IProfileRepository";
import { getMongoDatabase } from "@/infrastructure/database/mongo/MongoConnection";

type ProfileDocument = {
  _id?: ObjectId;
  fullName: string;
  jobTitle: string;
  company: string;
  imageKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export class MongoProfileRepository implements IProfileRepository {
  private async collection(): Promise<Collection<ProfileDocument>> {
    const db = await getMongoDatabase();
    const collection = db.collection<ProfileDocument>("profiles");
    await collection.createIndex({ createdAt: -1, _id: -1 });
    return collection;
  }

  async create(profile: Profile): Promise<Profile> {
    const collection = await this.collection();
    const doc = this.toDocument(profile);
    const result = await collection.insertOne(doc);

    return this.toEntity({ ...doc, _id: result.insertedId });
  }

  async findMany(options: ProfileQueryOptions = {}): Promise<ProfileQueryResult> {
    const collection = await this.collection();
    const limit = Math.min(Math.max(options.limit ?? 12, 1), 50);
    const filter = this.cursorFilter(options.cursor);
    const documents = await collection
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasNextPage = documents.length > limit;
    const visibleDocs = hasNextPage ? documents.slice(0, limit) : documents;
    const lastDoc = visibleDocs.at(-1);

    return {
      profiles: visibleDocs.map((document) => this.toEntity(document)),
      nextCursor: hasNextPage && lastDoc?._id ? lastDoc._id.toHexString() : null
    };
  }

  async findById(id: string): Promise<Profile | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const collection = await this.collection();
    const document = await collection.findOne({ _id: new ObjectId(id) });
    return document ? this.toEntity(document) : null;
  }

  async update(id: string, data: UpdateProfileData): Promise<Profile | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const now = new Date();
    const collection = await this.collection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          fullName: data.fullName.trim(),
          jobTitle: data.jobTitle.trim(),
          company: data.company.trim(),
          updatedAt: now
        }
      },
      { returnDocument: "after" }
    );

    return result ? this.toEntity(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
      return false;
    }

    const collection = await this.collection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  private cursorFilter(cursor?: string): Filter<ProfileDocument> {
    if (!cursor || !ObjectId.isValid(cursor)) {
      return {};
    }

    return { _id: { $lt: new ObjectId(cursor) } } as Filter<ProfileDocument>;
  }

  private toDocument(profile: Profile): ProfileDocument {
    return {
      fullName: profile.fullName,
      jobTitle: profile.jobTitle,
      company: profile.company,
      imageKey: profile.imageKey,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };
  }

  private toEntity(document: ProfileDocument & Document): Profile {
    return Profile.create({
      id: document._id?.toHexString() ?? "",
      fullName: document.fullName,
      jobTitle: document.jobTitle,
      company: document.company,
      imageKey: document.imageKey,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    });
  }
}
