"use client";

/**
 * ProfileTable
 * ─────────────────────────────────────────────────────────
 * Responsibilities (SRP):
 *  - Render the paginated profile list
 *  - Delegate pagination state to usePersistentPagination
 *  - Delegate data fetching to TanStack Query
 *  - Delegate CRUD side-effects to child modals
 *
 * Patterns used:
 *  - Observer    → TanStack Query reactive cache
 *  - Strategy    → column definitions injected into TanStack Table
 *  - Facade      → usePersistentPagination hides URL sync details
 * ─────────────────────────────────────────────────────────
 */

import Image from "next/image";
import { Suspense, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight,
  Search, Loader2, UserCircle2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { ProfileDetailSheet } from "@/components/profile/ProfileDetailSheet";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { ConfirmDeleteDialog } from "@/components/profile/ConfirmDeleteDialog";
import { usePersistentPagination } from "@/shared/usePersistentPagination";
import type { ProfileListItemDto } from "@/shared/dtos";

/* ─── API ──────────────────────────────────────────────────────── */
type ApiResponse = {
  profiles: ProfileListItemDto[];
  nextCursor: string | null;
};

async function fetchProfiles(cursor?: string): Promise<ApiResponse> {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/profiles?${params}`);
  if (!res.ok) throw new Error("Failed to load profiles");
  return res.json();
}

/* ─── Skeleton rows ────────────────────────────────────────────── */
function TableSkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          <td className="px-4 py-3">
            <Skeleton className="h-10 w-10 rounded-full" />
          </td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3" />
        </tr>
      ))}
    </>
  );
}

/* ─── Empty state ──────────────────────────────────────────────── */
function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <tr>
      <td colSpan={6}>
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
}

/* ─── Avatar cell ──────────────────────────────────────────────── */
function AvatarCell({ profile }: { profile: ProfileListItemDto }) {
  return (
    <div
      className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-100"
      aria-hidden="true"
    >
      {profile.thumbnailUrl ? (
        <Image
          src={profile.thumbnailUrl}
          alt=""
          fill
          className="object-cover"
          sizes="40px"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-100">
          <UserCircle2 className="h-6 w-6 text-slate-400" />
        </div>
      )}
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
function ProfileTableInner() {
  const queryClient = useQueryClient();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToast();

  /* Persistent cursor pagination — state lives in URL */
  const { cursor, cursorStack, goNext, goPrev } = usePersistentPagination();

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState<ProfileListItemDto | null>(null);
  const [deleteProfile, setDeleteProfile] = useState<ProfileListItemDto | null>(null);

  /* ── Data ─────────────────────────────────────────────────────── */
  const { data, isFetching, isError } = useQuery({
    queryKey: ["profiles", cursor],
    queryFn: () => fetchProfiles(cursor),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });

  /* Prefetch next page when data arrives */
  const prefetchNext = useCallback(
    (nextCursor: string) => {
      queryClient.prefetchQuery({
        queryKey: ["profiles", nextCursor],
        queryFn: () => fetchProfiles(nextCursor),
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );
  if (data?.nextCursor) prefetchNext(data.nextCursor);

  /* ── Delete mutation ──────────────────────────────────────────── */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setDeleteProfile(null);
      pushToast("Profile deleted successfully.", "success");
    },
    onError: () => {
      pushToast("Could not delete the profile. Please try again.", "error");
    },
  });

  /* ── Column definitions ───────────────────────────────────────── */
  const columns: ColumnDef<ProfileListItemDto>[] = [
    {
      id: "avatar",
      header: "",
      size: 56,
      cell: ({ row }) => <AvatarCell profile={row.original} />,
    },
    {
      accessorKey: "fullName",
      header: "Name",
      cell: ({ getValue }) => (
        <span className="font-medium text-slate-900">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "jobTitle",
      header: "Job Title",
      cell: ({ getValue }) => (
        <span className="text-slate-600">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "company",
      header: "Company",
      cell: ({ getValue }) => (
        <span className="text-slate-600">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Added",
      cell: ({ getValue }) => (
        <time
          dateTime={getValue<string>()}
          className="whitespace-nowrap text-sm text-slate-500"
        >
          {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
            new Date(getValue<string>())
          )}
        </time>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => setViewId(row.original.id)}
            aria-label={`View ${row.original.fullName}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50"
            onClick={() => setEditProfile(row.original)}
            aria-label={`Edit ${row.original.fullName}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => setDeleteProfile(row.original)}
            aria-label={`Delete ${row.original.fullName}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const profiles = data?.profiles ?? [];

  const table = useReactTable({
    data: profiles,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const searchValue =
    (table.getColumn("fullName")?.getFilterValue() as string) ?? "";
  const isFiltered = searchValue.length > 0;
  const visibleRows = table.getRowModel().rows;
  const hasPrev = cursorStack.length > 0;
  const hasNext = !!data?.nextCursor;

  /* ── Error state ──────────────────────────────────────────────── */
  if (isError && !isFetching) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-14 text-center"
      >
        <p className="text-sm font-semibold text-red-700">
          Could not load profiles. Check your connection and try again.
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["profiles"] })
          }
        >
          Retry
        </Button>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <Input
            aria-label="Search profiles by name"
            placeholder="Search by name…"
            className="pl-9"
            value={searchValue}
            onChange={(e) =>
              table.getColumn("fullName")?.setFilterValue(e.target.value)
            }
          />
        </div>

        {isFetching && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </span>
        )}
      </div>

      {/* ── Table card ──────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Profiles list" aria-live="polite">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-100 bg-slate-50/80">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                      style={{
                        width:
                          header.getSize() !== 150 ? header.getSize() : undefined,
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-slate-50">
              {isFetching && profiles.length === 0 ? (
                <TableSkeletonRows />
              ) : visibleRows.length === 0 ? (
                <EmptyState isFiltered={isFiltered} />
              ) : (
                visibleRows.map((row) => (
                  <tr
                    key={row.id}
                    className="group transition-colors hover:bg-slate-50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ─────────────────────────────────── */}
        <div
          className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-3"
          role="navigation"
          aria-label="Pagination"
        >
          <p className="text-xs text-slate-500">
            {isFetching
              ? "Loading…"
              : `${visibleRows.length} profile${visibleRows.length !== 1 ? "s" : ""}${isFiltered ? " matching" : ""}`}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPrev || isFetching}
              onClick={goPrev}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasNext || isFetching}
              onClick={() => data?.nextCursor && goNext(data.nextCursor)}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Overlays ────────────────────────────────────────────── */}
      <ProfileDetailSheet
        profileId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => {
          const p = profiles.find((x) => x.id === id);
          if (p) {
            setViewId(null);
            setEditProfile(p);
          }
        }}
      />

      <EditProfileModal
        profile={editProfile}
        onClose={() => setEditProfile(null)}
        onSaved={(name) => {
          queryClient.invalidateQueries({ queryKey: ["profiles"] });
          setEditProfile(null);
          pushToast(`${name} updated successfully.`, "success");
        }}
      />

      <ConfirmDeleteDialog
        profile={deleteProfile}
        isDeleting={deleteMutation.isPending}
        onCancel={() => setDeleteProfile(null)}
        onConfirm={() => {
          if (deleteProfile) deleteMutation.mutate(deleteProfile.id);
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

/* Wrap in Suspense — required for useSearchParams in RSC pages */
export function ProfileTable() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      }
    >
      <ProfileTableInner />
    </Suspense>
  );
}
