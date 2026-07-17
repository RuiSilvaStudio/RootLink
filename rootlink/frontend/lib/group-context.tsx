"use client";

/**
 * Shared per-group state for every page under /groups/[slug].
 *
 * The layout fetches the group + the caller's relationship to it ONCE and
 * provides it here, so sub-pages don't refetch (the old pages each refetched
 * the group and one even requested /groups/0/members before data arrived).
 *
 * `viewer` drives the three view modes from the definition doc §9:
 * owner/manager, member, visitor. `viewer.visibility` is the server-resolved
 * section config (true = public) — the server enforces it; the client only
 * uses it to decide what to render (blur/hide/gate).
 */

import { createContext, useContext } from "react";
import type { Group, GroupViewer } from "@/lib/groups-types";

export interface GroupContextValue {
  group: Group;
  viewer: GroupViewer;
  /** Refetch group + viewer (after join/leave/save). */
  refresh: () => Promise<void>;
}

const GroupContext = createContext<GroupContextValue | null>(null);

export const GroupProvider = GroupContext.Provider;

export function useGroup(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroup must be used inside /groups/[slug] pages");
  return ctx;
}

/** Section visibility helper: can the current viewer see this section? */
export function canSee(viewer: GroupViewer, section: string): boolean {
  if (viewer.is_member || viewer.is_manager) return true;
  return viewer.visibility[section] !== false;
}
