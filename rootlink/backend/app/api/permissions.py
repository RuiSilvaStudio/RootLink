"""Serializes the permissions registry (`app/core/permissions_registry.py`)
to JSON — Phase 0 decision (d)'s "fetched endpoint" fallback
(`docs/roles-permissions/phase0-decisions.md`), used by the
frontend's `usePermission` hook (Phase 3, frontend half) so the registry has
exactly one source of truth instead of being hand-reimplemented in
TypeScript.

Public, read-only, no auth required — this is static configuration data
(action -> min_rank/entity_scope/delegable/notes), not anything
user-specific; there's nothing here to protect behind a login.
"""

import dataclasses

from fastapi import APIRouter

from app.core.permissions_registry import REGISTRY

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


@router.get("/registry")
async def get_permissions_registry():
    return {action: dataclasses.asdict(entry) for action, entry in REGISTRY.items()}
