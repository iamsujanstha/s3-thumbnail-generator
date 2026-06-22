"use client";

import { memo } from "react";
import { Eye, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileImage } from "@/components/ui/ProfileImage";
import { useOverlayActions } from "@/components/profile/ProfileTableContext";
import type { ProfileListItemDto } from "@/shared/dtos";
import { getOriginalFilename } from "@/shared/utils";

export const AvatarCell = memo(function AvatarCell({
  thumbnailUrl,
  fullName,
}: {
  thumbnailUrl: string | null;
  fullName: string;
}) {
  return (
    <div aria-hidden="true">
      <ProfileImage
        src={thumbnailUrl}
        alt={fullName}
        variant="avatar"
      />
    </div>
  );
});

/* ─── Row ─────────────────────────────────────────────────────── */
export const ProfileRow = memo(function ProfileRow({
  profile,
}: {
  profile: ProfileListItemDto;
}) {
  const { openView, openEdit, openDelete } = useOverlayActions();

  return (
    <tr className="group transition-colors hover:bg-slate-50">
      <td className="px-4 py-3 align-middle" style={{ width: 56 }}>
        <AvatarCell
          thumbnailUrl={profile.thumbnailUrl}
          fullName={profile.fullName}
        />
      </td>

      <td className="px-4 py-3 align-middle">
        <span className="font-medium text-slate-900">{profile.fullName}</span>
      </td>

      <td className="px-4 py-3 align-middle">
        <span className="text-slate-600">{profile.jobTitle}</span>
      </td>

      <td className="px-4 py-3 align-middle">
        <span className="text-slate-600">{profile.company}</span>
      </td>

      <td className="px-4 py-3 align-middle">
        {profile.imageKey?.startsWith("uploads/dynamic/") ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Pure CDN
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            S3 Trigger
          </span>
        )}
      </td>

      <td className="px-4 py-3 align-middle max-w-[160px] truncate" title={getOriginalFilename(profile.imageKey)}>
        <span className="text-slate-600 truncate">{getOriginalFilename(profile.imageKey)}</span>
      </td>

      <td className="px-4 py-3 align-middle">
        <time
          dateTime={profile.createdAt}
          className="whitespace-nowrap text-sm text-slate-500"
        >
          {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
            new Date(profile.createdAt)
          )}
        </time>
      </td>

      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => openView(profile.id)}
            aria-label={`View ${profile.fullName}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50"
            onClick={() => openEdit(profile)}
            aria-label={`Edit ${profile.fullName}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => openDelete(profile)}
            aria-label={`Delete ${profile.fullName}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
});

/* ─── Skeleton rows ──────────────────────────────────────────────  */
export const TableSkeletonRows = memo(function TableSkeletonRows({
  count = 8,
}: {
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          <td className="px-4 py-3"><Skeleton className="h-10 w-10 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
          <td className="px-4 py-3"><Skeleton className="h-6 w-16 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3" />
        </tr>
      ))}
    </>
  );
});

/* ─── Empty state ────────────────────────────────────────────────  */
export const TableEmptyState = memo(function TableEmptyState({
  isFiltered,
}: {
  isFiltered: boolean;
}) {
  return (
    <tr>
      <td colSpan={8}>
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Users className="h-7 w-7 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {isFiltered ? "No matching profiles" : "No profiles yet"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {isFiltered
                ? "Try a different search term"
                : "Create your first profile to get started"}
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
});
