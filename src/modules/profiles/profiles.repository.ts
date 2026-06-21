import { ObjectId, type Collection, type Document, type Filter } from "mongodb";
import { getDb } from "@/lib/mongo";
import type { CreateProfileDto } from "@/modules/profiles/profiles.schema";

// ── Document shape stored in MongoDB ─────────────────────────────
type ProfileDoc = {
  _id?:      ObjectId;
  fullName:  string;
  jobTitle:  string;
  company:   string;
  imageKey:  string;
  createdAt: Date;
  updatedAt: Date;
};

// ── Plain data shapes passed between layers ───────────────────────
export type ProfileRecord = {
  id:        string;
  fullName:  string;
  jobTitle:  string;
  company:   string;
  imageKey:  string;
  createdAt: Date;
  updatedAt: Date;
};

export type FindManyResult = {
  profiles:   ProfileRecord[];
  nextCursor: string | null;
};

export type UpdateData = {
  fullName:  string;
  jobTitle:  string;
  company:   string;
  imageKey?: string;
};

// ── Repository ────────────────────────────────────────────────────
async function col(): Promise<Collection<ProfileDoc>> {
  const db = await getDb();
  const c  = db.collection<ProfileDoc>("profiles");
  await c.createIndex({ createdAt: -1, _id: -1 });
  return c;
}

function toRecord(doc: ProfileDoc & Document): ProfileRecord {
  return {
    id:        doc._id?.toHexString() ?? "",
    fullName:  doc.fullName,
    jobTitle:  doc.jobTitle,
    company:   doc.company,
    imageKey:  doc.imageKey,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const ProfilesRepository = {
  async create(data: CreateProfileDto): Promise<ProfileRecord> {
    const now = new Date();
    const doc: ProfileDoc = {
      fullName:  data.fullName.trim(),
      jobTitle:  data.jobTitle.trim(),
      company:   data.company.trim(),
      imageKey:  data.imageKey,
      createdAt: now,
      updatedAt: now,
    };
    const c      = await col();
    const result = await c.insertOne(doc);
    return toRecord({ ...doc, _id: result.insertedId });
  },

  async findMany(opts: { limit: number; cursor?: string }): Promise<FindManyResult> {
    const limit  = Math.min(Math.max(opts.limit, 1), 50);
    const filter = opts.cursor && ObjectId.isValid(opts.cursor)
      ? ({ _id: { $lt: new ObjectId(opts.cursor) } } as Filter<ProfileDoc>)
      : {};

    const c   = await col();
    const docs = await c
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const visible = hasMore ? docs.slice(0, limit) : docs;

    return {
      profiles:   visible.map(toRecord),
      nextCursor: hasMore && visible.at(-1)?._id
        ? visible.at(-1)!._id!.toHexString()
        : null,
    };
  },

  async findById(id: string): Promise<ProfileRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const c   = await col();
    const doc = await c.findOne({ _id: new ObjectId(id) });
    return doc ? toRecord(doc) : null;
  },

  async update(id: string, data: UpdateData): Promise<ProfileRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const c      = await col();
    const result = await c.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    return result ? toRecord(result) : null;
  },

  async delete(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const c      = await col();
    const result = await c.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  },
};
