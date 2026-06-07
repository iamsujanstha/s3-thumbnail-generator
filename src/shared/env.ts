import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().url(),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1)
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv() {
  if (!cachedEnv) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment: ${parsed.error.message}`);
    }

    cachedEnv = parsed.data;
  }

  return cachedEnv;
}
