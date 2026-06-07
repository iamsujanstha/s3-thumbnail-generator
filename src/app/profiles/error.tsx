"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfilesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 text-center shadow-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-950">Profiles could not load</h1>
        <p className="mt-2 text-sm text-slate-500">
          Check MongoDB, AWS credentials, and S3 thumbnail availability, then try again.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Form
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
