import { z } from "zod";

const schema = z.object({
  MONGODB_URI:           z.string().url(),
  AWS_ACCESS_KEY_ID:     z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION:            z.string().min(1),
  S3_BUCKET_NAME:        z.string().min(1),
});

export type Env = z.infer<typeof schema>;

let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Missing env vars:\n${result.error.message}`);
    }
    _env = result.data;
  }
  return _env;
}
