import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ProfileListItem = {
  id: string;
  fullName: string;
  jobTitle: string;
  company: string;
  thumbnailUrl: string;
  createdAt: string;
};

type ProfileGridProps = {
  profiles: ProfileListItem[];
};

export function ProfileGrid({ profiles }: ProfileGridProps) {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Button asChild variant="ghost">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                New profile
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-slate-950 md:text-5xl">
                Profile directory
              </h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                A compact, fast-loading grid backed by thumbnail URLs generated from raw S3 uploads.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
            {profiles.length} visible profiles
          </div>
        </div>

        {profiles.length === 0 ? (
          <Card className="flex min-h-80 items-center justify-center border-dashed bg-white p-8 text-center">
            <div>
              <p className="text-lg font-semibold text-slate-900">No profiles yet</p>
              <p className="mt-2 text-sm text-slate-500">Create the first profile to populate this grid.</p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile, index) => (
              <Card key={profile.id} className="overflow-hidden bg-white">
                <div className="relative aspect-square bg-slate-100">
                  <Image
                    src={profile.thumbnailUrl}
                    alt={`${profile.fullName} profile thumbnail`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    priority={index < 6}
                    placeholder="blur"
                    blurDataURL="data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/v3AgAA="
                  />
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{profile.fullName}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Added {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(profile.createdAt))}
                    </p>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <BriefcaseBusiness className="h-4 w-4 text-blue-600" />
                      {profile.jobTitle}
                    </p>
                    <p className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      {profile.company}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
