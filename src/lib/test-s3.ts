import { MongoClient } from "mongodb";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

// Parse .env.local manually
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

async function main() {
  console.log("Connecting to MongoDB...");
  const mongoClient = new MongoClient(process.env.MONGODB_URI || "");
  await mongoClient.connect();
  const db = mongoClient.db();
  const profilesCol = db.collection("profiles");

  // Get latest profile
  const latestProfile = await profilesCol.findOne({}, { sort: { createdAt: -1 } });
  if (!latestProfile) {
    console.log("No profiles found in database.");
    await mongoClient.close();
    return;
  }

  console.log("\n--- MongoDB Profile ---");
  console.log("ID:", latestProfile._id);
  console.log("Full Name:", latestProfile.fullName);
  console.log("Image Key:", latestProfile.imageKey);
  console.log("Created At:", latestProfile.createdAt);

  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });

  console.log("\n--- S3 Original Object Metadata ---");
  try {
    const rawHead = await s3Client.send(
      new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key:    latestProfile.imageKey,
      })
    );
    console.log("Content Length (Size):", rawHead.ContentLength, "bytes");
    console.log("Content Type:", rawHead.ContentType);
    console.log("ETag:", rawHead.ETag);
    console.log("Metadata:", rawHead.Metadata);
  } catch (err) {
    console.error("Failed to fetch S3 original object:", (err as Error).message);
  }

  console.log("\n--- S3 Thumbnail Object Metadata ---");
  const thumbnailKey = latestProfile.imageKey.replace("uploads/raw/", "uploads/thumbnails/") + ".webp";
  try {
    const thumbHead = await s3Client.send(
      new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key:    thumbnailKey,
      })
    );
    console.log("Thumbnail Key:", thumbnailKey);
    console.log("Content Length (Size):", thumbHead.ContentLength, "bytes");
    console.log("Content Type:", thumbHead.ContentType);
    console.log("ETag:", thumbHead.ETag);
  } catch (err) {
    console.error("Failed to fetch S3 thumbnail object:", (err as Error).message);
  }

  await mongoClient.close();
}

main().catch(console.error);
