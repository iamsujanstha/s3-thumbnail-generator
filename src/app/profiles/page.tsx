import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, UserPlus, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileTable } from "@/components/profile/ProfileTable";

export const metadata: Metadata = {
  title: "Profile directory",
};

export const dynamic = "force-dynamic";

export default function ProfilesPage() {
  return (
    <main id="main-content" className="min-h-screen bg-slate-50" tabIndex={-1}>
      <section className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8">

        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1 text-xs text-slate-500">
            <li>
              <Link
                href="/"
                className="flex items-center gap-1 hover:text-slate-800 transition-colors focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3 w-3" />
            </li>
            <li aria-current="page" className="font-medium text-slate-800">
              Profiles
            </li>
          </ol>
        </nav>

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Profile directory
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Browse, search, view, edit, and delete profiles. Thumbnails are served
              from S3 — click the eye icon to see the full original image.
            </p>
          </div>

          <Button asChild className="shrink-0">
            <Link href="/">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              New profile
            </Link>
          </Button>
        </div>

        {/* ── Table (client boundary) ──────────────────────────────── */}
        <ProfileTable />
      </section>
    </main>
  );
}
