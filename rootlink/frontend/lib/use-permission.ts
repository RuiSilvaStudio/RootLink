"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";

/**
 * `usePermission()` — Phase 3 (frontend half), per
 * `docs/roles-permissions/phase0-decisions.md` (d): a single,
 * entity-aware permission-check hook that reads from the same permissions
 * registry the backend `can()` helper (`app/core/permissions.py`) uses,
 * fetched from `GET /api/permissions/registry` (not hand-reimplemented by
 * guessing at the Python source — one real source of truth, fetched).
 *
 * This is new, additive infrastructure proving the pattern end-to-end on
 * the specific `isStaff`/ownership sites fixed this same session — it is
 * **not** a replacement for every hand-rolled permission check in the
 * frontend. Migrating the rest is future, incremental work (see this file's
 * own "Known simplifications" section below for what's deliberately out of
 * scope today).
 *
 * ## Known simplifications vs. the backend `can()` helper
 *
 * 1. **Real `entity_kind`/`rank`/`entity_id` now come from the API where
 *    present** (Phase 5 — `UserResponse` was extended to expose
 *    `User.entity_kind`/`rank`/`entity_id` directly, closing the gap this
 *    docstring used to describe: the hook previously had to re-derive an
 *    equivalent value from `role`/`account_type` for EVERY user, with no
 *    way to know if that derivation matched the backend's real stored
 *    value). `resolveEntityAndRank` below is now only a **fallback** for
 *    the (increasingly rare) case where the user object's `entity_kind` is
 *    still `null` — e.g. a row that predates the Phase 1 migration and
 *    hasn't been touched by `entity_resolution.py`'s live-fallback path
 *    yet either. When `entity_kind` IS present on the user object, it (and
 *    `rank`/`entity_id`) are used directly — no re-derivation, no
 *    possible drift from the backend's authoritative value.
 * 2. **Real `entity_id` matching** for `organization`/`partners`/
 *    `suppliers`-kind users now works when the user object carries a real
 *    `entity_id` (Phase 5) — the backend's `can()` matches the target
 *    `entityId` against it exactly the same way. Falls back to the old
 *    conservative "never a false yes" behavior only when `entity_id` is
 *    genuinely absent from the user object (pre-Phase-5 cached data, or a
 *    row this hook's fallback derivation can't resolve an entity_id for at
 *    all, since that FK isn't derivable from role/account_type).
 * 3. **No delegation-grant lookups**, same limitation the backend `can()`
 *    itself has today (see its own docstring) — delegable actions are
 *    evaluated purely on rank, not on whether a specific grant exists.
 */

// Mirrors app/core/permissions_registry.py's `Rank` enum.
const ROLE_RANK: Record<string, number> = {
  user: 1,
  contributor: 2,
  moderator: 3,
  admin: 4,
  super_admin: 5,
};

// Mirrors app/core/entity_resolution.py's `ENTITY_CEILING`.
const ENTITY_CEILING: Record<string, number> = {
  individual: 2,
  professional: 4,
  organization: 5,
  platform: 5,
  partners: 1,
  suppliers: 1,
};

const ENTITY_ROW_KINDS = new Set(["organization", "partners", "suppliers"]);

interface RegistryEntry {
  min_rank: number;
  entity_scope: "platform" | "entity";
  delegable: boolean;
  notes: string;
}

type Registry = Record<string, RegistryEntry>;

// Module-level cache: the registry is static config data, fetched once per
// page load and shared by every `usePermission()` call site, not re-fetched
// per component.
let cachedRegistry: Registry | null = null;
let inFlightFetch: Promise<Registry> | null = null;

async function fetchRegistry(): Promise<Registry> {
  if (cachedRegistry) return cachedRegistry;
  if (!inFlightFetch) {
    inFlightFetch = api.permissions.registry().then((data: Registry) => {
      cachedRegistry = data;
      return data;
    });
  }
  return inFlightFetch;
}

/** Fallback derivation (TypeScript port of `resolve_entity_and_rank`) for
 * when the user object has no real `entity_kind` yet — see this file's
 * module docstring point 1. Prefer the real stored values whenever present.
 */
function resolveEntityAndRank(user: any): { entityKind: string; rank: number; entityId: number | null } {
  if (user?.entity_kind) {
    return {
      entityKind: user.entity_kind,
      rank: typeof user.rank === "number" ? user.rank : 0,
      entityId: typeof user.entity_id === "number" ? user.entity_id : null,
    };
  }

  const role: string = user?.role || "user";
  const accountType: string = user?.account_type || "individual";

  if (role === "admin" || role === "super_admin") {
    return { entityKind: "platform", rank: ROLE_RANK[role], entityId: null };
  }

  let entityKind: string;
  if (accountType === "practitioner") entityKind = "professional";
  else if (accountType === "organization") entityKind = "organization";
  else entityKind = "individual";

  const rank = ROLE_RANK[role] ?? 1;
  const ceiling = ENTITY_CEILING[entityKind] ?? 1;
  if (rank > ceiling) return { entityKind: "platform", rank, entityId: null };
  return { entityKind, rank, entityId: null };
}

function evaluate(
  entry: RegistryEntry | undefined,
  entityKind: string,
  rank: number,
  userEntityId: number | null,
  targetEntityId?: number | null
): boolean {
  if (!entry) return false;

  // Entity precedence (docs/roles-permissions/ROLES_PERMISSIONS.md §3): platform overrides everything,
  // unconditionally — mirrors app/core/permissions.py's `can()` exactly.
  if (entityKind === "platform") return rank >= entry.min_rank;

  if (entry.entity_scope === "platform") return false;

  if (rank < entry.min_rank) return false;

  if (ENTITY_ROW_KINDS.has(entityKind)) {
    // Phase 5: real entity_id matching, mirroring app/core/permissions.py's
    // `can()` exactly — an org/partners/suppliers member only passes for
    // actions scoped to THEIR OWN entity, never a different one just
    // because the rank number is high enough. Falls back to `false` (never
    // a false "yes") only when `userEntityId` genuinely isn't known.
    return userEntityId !== null && userEntityId === targetEntityId;
  }

  return targetEntityId === undefined || targetEntityId === null;
}

export function usePermission() {
  const { user } = useAuth();
  const [registry, setRegistry] = useState<Registry | null>(cachedRegistry);

  useEffect(() => {
    let alive = true;
    fetchRegistry().then((data) => {
      if (alive) setRegistry(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const can = useCallback(
    (action: string, opts?: { entityId?: number | null }): boolean => {
      if (!user || !registry) return false;
      const { entityKind, rank, entityId } = resolveEntityAndRank(user);
      return evaluate(registry[action], entityKind, rank, entityId, opts?.entityId);
    },
    [user, registry]
  );

  // Phase 5 convenience — several new entity-scoped pages need the current
  // user's own (entityKind, rank, entityId) directly (e.g. to decide which
  // section of the team panel to render), not just a yes/no `can()` answer.
  const my = useCallback(() => {
    if (!user) return { entityKind: "individual", rank: 0, entityId: null as number | null };
    return resolveEntityAndRank(user);
  }, [user]);

  return { can, loading: registry === null, my };
}
