"use client";

import { memo, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ProfileRow,
  TableSkeletonRows,
  TableEmptyState,
} from "@/components/profile/ProfileTableRows";
import type { ProfileListItemDto } from "@/shared/dtos";

type Props = {
  profiles:   ProfileListItemDto[];
  isFetching: boolean;
  isError:    boolean;
  hasPrev:    boolean;
  hasNext:    boolean;
  onRetry:    () => void;
  onPrev:     () => void;
  onNext:     () => void;
};

export const ProfileGridView = memo(function ProfileGridView({
  profiles,
  isFetching,
  isError,
  hasPrev,
  hasNext,
  onRetry,
  onPrev,
  onNext,
}: Props) {
  const [searchValue, setSearchValue] = useState("");

  const filtered = useMemo(() => {
    if (!searchValue) return profiles;
    const q = searchValue.toLowerCase();
    return profiles.filter((p) => p.fullName.toLowerCase().includes(q));
  }, [profiles, searchValue]);

  if (isError && !isFetching) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-14 text-center"
      >
        <p className="text-sm font-semibold text-red-700">
          Could not load profiles. Check your connection and try again.
        </p>
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* ── Search toolbar ────────────────────────────────────── */}
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
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>
        {isFetching && (
          <span
            className="flex items-center gap-1.5 text-xs text-slate-500"
            aria-live="polite"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Loading…
          </span>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Profiles list">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th scope="col" className="px-4 py-3" style={{ width: 56 }} />
                {(["Name", "Job Title", "Company", "Resizing Strategy", "Filename", "Added"] as const).map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {h}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isFetching && profiles.length === 0 ? (
                <TableSkeletonRows />
              ) : filtered.length === 0 ? (
                <TableEmptyState isFiltered={!!searchValue} />
              ) : (
                filtered.map((profile) => (
                  <ProfileRow key={profile.id} profile={profile} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ─────────────────────────────── */}
        <div
          className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-3"
          role="navigation"
          aria-label="Pagination"
        >
          <p className="text-xs text-slate-500">
            {isFetching
              ? "Loading…"
              : `${filtered.length} profile${filtered.length !== 1 ? "s" : ""}${
                  searchValue ? " matching" : ""
                }`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPrev || isFetching}
              onClick={onPrev}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasNext || isFetching}
              onClick={onNext}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
});
