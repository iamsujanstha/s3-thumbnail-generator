/**
 * Run once to apply the correct CORS policy to your S3 bucket.
 * Usage: node scripts/set-bucket-cors.mjs
 */
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read .env manually (no dotenv dependency needed)
const envPath = resolve(__dirname, "../.env");
const envLines = readFileSync(envPath, "utf-8").split("\n");
const env = {};
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) env[key.trim()] = rest.join("=").trim();
}

const client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const corsConfig = {
  CORSRules: [
    {
      AllowedOrigins: ["http://localhost:3000", "https://*"],
      AllowedMethods: ["PUT", "GET", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3000,
    },
  ],
};

try {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: env.S3_BUCKET_NAME,
      CORSConfiguration: corsConfig,
    })
  );
  console.log(`✅ CORS policy applied to bucket: ${env.S3_BUCKET_NAME}`);
  console.log("   Allowed origins:", corsConfig.CORSRules[0].AllowedOrigins);
  console.log("   Allowed methods:", corsConfig.CORSRules[0].AllowedMethods);
} catch (err) {
  console.error("❌ Failed to apply CORS policy:", err.message);
  process.exit(1);
}
