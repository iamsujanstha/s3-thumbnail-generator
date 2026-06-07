import {
  getProfile,
  updateProfile,
  deleteProfile,
} from "@/modules/profiles/profiles.controller";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export const GET    = (req: Request, ctx: Ctx) => getProfile(req, ctx.params.id);
export const PATCH  = (req: Request, ctx: Ctx) => updateProfile(req, ctx.params.id);
export const DELETE = (req: Request, ctx: Ctx) => deleteProfile(req, ctx.params.id);
