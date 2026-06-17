/**
 * profiles.controller.ts
 * Only job: parse request → call service → return response.
 * No business logic, no DB calls, no S3 calls.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ProfilesService } from "@/modules/profiles/profiles.service";
import {
  createProfileSchema,
  updateProfileSchema,
  presignUploadSchema,
  listQuerySchema,
  initiateMultipartSchema,
  completeMultipartSchema,
  deleteTempFileSchema,
} from "@/modules/profiles/profiles.schema";

// ── Response helpers ────────────────────────────────────────────
function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function validationFail(err: ZodError) {
  return NextResponse.json(
    { error: "Validation failed.", issues: err.flatten().fieldErrors },
    { status: 400 }
  );
}

function serverFail(context: string, err: unknown) {
  console.error(`[${context}]`, err);
  return fail("An unexpected error occurred.", 500);
}

// ── Handlers ────────────────────────────────────────────────────

export async function listProfiles(req: Request) {
  try {
    const url    = new URL(req.url);
    const parsed = listQuerySchema.safeParse({
      limit:  url.searchParams.get("limit"),
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    if (!parsed.success) return validationFail(parsed.error);

    return ok(await ProfilesService.list(parsed.data));
  } catch (err) {
    return serverFail("listProfiles", err);
  }
}

export async function createProfile(req: Request) {
  try {
    const parsed = createProfileSchema.safeParse(await req.json());
    if (!parsed.success) return validationFail(parsed.error);

    const profile = await ProfilesService.create(parsed.data);
    return ok({ profile }, 201);
  } catch (err) {
    return serverFail("createProfile", err);
  }
}

export async function getProfile(_req: Request, id: string) {
  try {
    const detail = await ProfilesService.getById(id);
    return detail ? ok(detail) : fail("Profile not found.", 404);
  } catch (err) {
    return serverFail("getProfile", err);
  }
}

export async function updateProfile(req: Request, id: string) {
  try {
    const parsed = updateProfileSchema.safeParse(await req.json());
    if (!parsed.success) return validationFail(parsed.error);

    const updated = await ProfilesService.update(id, parsed.data);
    return updated ? ok(updated) : fail("Profile not found.", 404);
  } catch (err) {
    return serverFail("updateProfile", err);
  }
}

export async function deleteProfile(_req: Request, id: string) {
  try {
    const deleted = await ProfilesService.delete(id);
    if (!deleted) return fail("Profile not found.", 404);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return serverFail("deleteProfile", err);
  }
}

export async function presignUpload(req: Request) {
  try {
    const parsed = presignUploadSchema.safeParse(await req.json());
    if (!parsed.success) return validationFail(parsed.error);

    const result = await ProfilesService.presignUpload(parsed.data);
    return ok(result, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[presignUpload]", msg);
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ error: "Upload failed.", detail: msg }, { status: 500 });
    }
    return fail("Unable to prepare upload.", 500);
  }
}

export async function initiateMultipartUpload(req: Request) {
  try {
    const parsed = initiateMultipartSchema.safeParse(await req.json());
    if (!parsed.success) return validationFail(parsed.error);

    const result = await ProfilesService.initiateMultipart(parsed.data);
    return ok(result, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[initiateMultipartUpload]", msg);
    return fail("Unable to initiate multipart upload.", 500);
  }
}

export async function completeMultipartUpload(req: Request) {
  try {
    const parsed = completeMultipartSchema.safeParse(await req.json());
    if (!parsed.success) return validationFail(parsed.error);

    await ProfilesService.completeMultipart(parsed.data);
    return ok({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[completeMultipartUpload]", msg);
    return fail("Unable to complete multipart upload.", 500);
  }
}

export async function deleteTempFile(req: Request) {
  try {
    const parsed = deleteTempFileSchema.safeParse(await req.json());
    if (!parsed.success) return validationFail(parsed.error);

    await ProfilesService.deleteTempFile(parsed.data.key);
    return ok({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[deleteTempFile]", msg);
    return fail("Unable to delete temporary file.", 500);
  }
}
