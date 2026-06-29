# RootLink Content Platform Specification

> **Status:** Draft v2 — for review
> **Owner:** Platform / Rui
> **Last updated:** 2026-06-28
> **Scope:** Platform-wide definition of how and where content is created, reviewed, edited, and published, and who can do what.

This document is the single source of truth for the **content lifecycle, authoring surfaces, permissions, media handling, automated moderation, editable site copy, engagement metrics, and compliance** across every authored entity in RootLink. It supersedes the ad-hoc, per-module MVP behaviour that exists today.

Mockups for the user-facing surfaces live in [`mockups/`](./mockups/) (open `mockups/index.html`).

---

## Table of contents

1. Principles & the "Content Kind" abstraction
2. Unified content lifecycle
3. Trust tiers & the publisher promotion flow
4. Roles, permissions & the enforcement ladder
5. Authoring surfaces (incl. templates)
6. Media & video handling (incl. mandatory cover)
7. Automated moderation pipeline
8. Compliance (GDPR / DSA)
9. User experience (incl. engagement metrics)
10. Edge-case register
11. Phased implementation & migration plan
12. Editable site copy
13. Open decisions
- Appendix A — Design tokens
- Appendix B — Mockups

---

## 1. Principles & the "Content Kind" abstraction

Today every entity invents its own create/edit/publish flow: articles use Editor.js JSON, lessons use plain text, everything else uses bespoke forms, external URLs arrive through five different ingestion paths, and two overlapping status enums fight over what "published" means. The result is inconsistent for users and unsafe for the platform.

**This spec replaces that with one model.** There is a single lifecycle, a single permission model, and a single set of authoring primitives. Each entity type plugs into them by declaring itself as a **Content Kind**.

### 1.1 Design principles

1. **One lifecycle, many Kinds.** Consistency where it matters (states, permissions, media, moderation, help); flexibility where it doesn't (fields, layout).
2. **Visibility has exactly one gate.** A single `status` field decides what is public. Nothing else hides or reveals content.
3. **Trust is earned and explicit.** Who can publish without review is a deliberate, accepted responsibility — never an accident of code paths.
4. **Every image has provenance.** All media flows through one pipeline with attribution, license, dedup, and EXIF stripping. No raw external URLs as the source of truth.
5. **Automated-first, human-final.** Automated moderation gates everything; humans make the final, appealable call. Required by GDPR Art. 22 and the DSA.
6. **Compliance is built in, not bolted on.** Erasure, audit, and statements of reasons are part of the lifecycle, not an afterthought.
7. **The user always knows what happens next.** Status, "what happens next" messaging, and contextual `(i)` help are first-class.
8. **Nothing is ever blank.** Every published item has a cover (uploaded, linked, derived, or a category default).

### 1.2 The Content Kind declaration

Every Kind declares five things. This table is the contract; sections 2–9 define each column.

| Kind | Authoring surface | Lifecycle profile | Review policy | Media policy | Permission profile |
|------|------------------|-------------------|---------------|--------------|--------------------|
| **Article** | Editor.js (canonical) | Full | Tiered by trust | Inline + cover, license required | Owner + trust tier |
| **Lesson** | Editor.js (migrated) | Full (within course) | Tiered by trust | Inline + cover/poster | Owner + contributor |
| **Course / Learning Path** | Form + child lessons | Full | Tiered by trust | Cover | Owner + contributor |
| **Event** | Form | Full | Tiered by trust | Gallery + cover | Owner + trust tier |
| **Listing** | Form | Transactional | Post-moderation + report | Gallery (uploader only) | Owner (seller) |
| **Group** | Form | Lightweight | Post-moderation + report | Cover | Owner (group admin) |
| **Waste project** (Hub / Upcycling / Challenge) | Form | Lightweight | Post-moderation + report | Gallery | Owner |
| **Crawled / external content** | None (ingested) | Auto | Auto cross-reference + spot check | Ingest external → ImageAsset | System / admin |
| **Plant** | Admin form + crawler | Curated | Admin-curated | Ingest external → ImageAsset | Admin / contributor |
| **Comment** | Inline field | **Separate** (see §10.1) | Post-moderation + report | None | Author |

**Lifecycle profiles** (defined in §2):
- **Full** — `draft → in_review → published → archived`, with trust-based instant publish.
- **Transactional** — `active → sold/unavailable → archived` (Stripe-driven), no review queue.
- **Lightweight** — `published` on create (post-moderation), `archived` on delete; automated scan still applies.
- **Auto** — ingested as `unreviewed`, auto-promoted by cross-reference, or held for spot check.
- **Curated** — admin/contributor managed, no public submission.

---

## 2. Unified content lifecycle

### 2.1 The single state machine

```
                         ┌─────────────── (trusted author, ALLOW) ───────────────┐
                         │                                                        ▼
  create ──> [AUTO SCAN] ──ALLOW(untrusted)──> in_review ──approve──────────> published ──> archived
                 │                                  ▲   │                          ▲
                 ├──REVIEW (borderline)─────────────┘   └──needs_changes──┐        │
                 │                                                         │        │
                 └──BLOCK (high confidence)──> rejected (soft) <───reject──┘   (re-review on edit,
                                                   │                            see §2.4)
                                                   └── appeal ──> in_review
```

**`status` is the only visibility gate.** Only `published` content is public (listed, searchable, indexed, viewable by anyone). Everything else is visible only to its owner, moderators, and super_admin.

### 2.2 States

| State | Public? | Meaning |
|-------|---------|---------|
| `draft` | No | Being authored. Autosaved. Owner-only. |
| `in_review` | No | Submitted; awaiting human moderation (or held by automated REVIEW). |
| `published` | **Yes** | Live. The only public state. |
| `needs_changes` | No | Moderator returned it with feedback; owner can edit and resubmit. |
| `rejected` | No | Declined or auto-blocked. Soft state with a stated reason. Appealable. |
| `archived` | No | Retired by owner/admin or superseded. Recoverable. |

> **Migration note:** the legacy `ContentStatus` (`draft/published/archived`) is extended with `in_review`, `needs_changes`, `rejected`. The legacy `status` column stays as the gate.

### 2.3 Verification becomes a quality badge, not a gate

The old `verification_status` (`unreviewed / cross_referenced / community_reviewed`) **no longer controls visibility**. It becomes an orthogonal **quality/trust signal** displayed on already-`published` content:

- `community_reviewed` → "Community-reviewed" badge (a human approved an authored item).
- `cross_referenced` → "Verified by N sources" badge (crawled content corroborated by ≥3 sources).
- `unreviewed` → no badge.

Crawled content reaching `cross_referenced` **triggers `status = published`** (it no longer lives in the hidden side-channel it does today). This removes the "publish is a misnomer" bug: `POST /publish` now genuinely publishes for trusted authors, or moves to `in_review` for everyone else.

### 2.4 Editing published content (trust-based re-review)

| Editor | Effect of editing `published` content |
|--------|----------------------------------------|
| Trusted author (own content) | Stays `published`, marked "edited", re-scanned by automation; a BLOCK pulls it to `rejected`. |
| Untrusted author (own content) | Returns to `in_review` until re-approved. |
| Moderator / admin | Per their normal powers (see §4). |
| **super_admin** | May edit in **any** state; the current state is always shown in an editing banner; logged to the audit trail. |

### 2.5 Soft reject + appeal (GDPR/DSA)

`rejected` **never hard-deletes**. (This replaces today's hard `DELETE` on reject.) A rejection records:
- the reason (free text + category),
- the deciding actor (human or `automation@model-version`),
- a timestamp,
- and exposes an **Appeal** action to the author, which moves the item to `in_review` for human reconsideration.

This satisfies the DSA "statement of reasons" and GDPR Art. 22 right to human review of automated decisions.

---

## 3. Trust tiers & the publisher promotion flow

### 3.1 Tiers

| Tier | Create | Publish own (Full Kinds) | Review others |
|------|--------|--------------------------|---------------|
| New user | Yes (→ `in_review`) | No — pre-moderated | No |
| **Trusted author** (`can_self_publish = true`) | Yes | **Instant publish** | No |
| Contributor | Yes (+ courses/paths) | Instant (if also trusted) | No |
| Moderator | Yes | Instant | Yes |
| Admin | Yes | Instant | Yes |
| Super_admin | Yes | Instant | Yes + edit any state |

> Automated moderation (§7) still runs for **everyone**. A BLOCK overrides instant-publish regardless of tier.

### 3.2 The promotion flow (deliberate, not automatic)

`can_self_publish` is a **dedicated boolean flag** on the user (plus `self_publish_agreed_at`), decoupled from role grants.

```
Eligibility            Offer                 Acceptance                 Approval
email_verified == true ─┐
AND ≥3 approved items ──┴─> user is offered ─> user accepts the ─────> a moderator/admin
                            "Trusted Author"    "Publisher              grants can_self_publish
                            promotion           Responsibility"         (records grantor + timestamp)
                                                agreement
```

- **Eligibility** is computed (email-verified **and** ≥3 items that reached `published` via approval).
- **Acceptance** = the user explicitly accepts a *Publisher Responsibility Agreement* (they take responsibility for content going live without prior review). Stored with timestamp.
- **Approval** = a mod/admin makes the final grant.

### 3.3 Demotion / revocation

- Revoking `can_self_publish` is immediate; the user reverts to pre-moderation for **future** content.
- **Grandfathering:** content already `published` stays published (not retro-reviewed). Only new submissions are affected.
- Demotion of *role* and *account status* (suspension/ban) is the broader **enforcement ladder** in §4.4.

---

## 4. Roles, permissions & the enforcement ladder

### 4.1 Hierarchy

```
super_admin > admin > moderator > contributor > user
```

- **super_admin** *(new)* — the only role that can **edit any content in any state**, with the lifecycle state always visible in an editing banner; every such edit is written to the moderation audit log. Reserved for platform operators. Inherently holds `can_edit_copy` (§12).
- **admin** — unchanged from current definition: user management, content moderation, settings, taxonomy, broadcast. **No** edit-any-state superpower.
- **moderator** — review queue: approve / reject / needs_changes, comment moderation.
- **contributor** — enhanced creation (courses, learning paths); eligible for `can_self_publish`.
- **user** — CRUD on own entities, follow, RSVP, message, comment.

### 4.2 Verb matrix (Full-lifecycle Kinds)

| Verb | user (untrusted) | trusted author | moderator | admin | super_admin |
|------|------------------|----------------|-----------|-------|-------------|
| Create | ✓ → in_review | ✓ → published* | ✓ | ✓ | ✓ |
| Edit own | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit any | — | — | — | ✓ (published/archived) | ✓ (**any state**) |
| Submit for review | ✓ | n/a | — | — | — |
| Publish own | — | ✓* | ✓ | ✓ | ✓ |
| Approve / reject / needs_changes | — | — | ✓ | ✓ | ✓ |
| Archive | own | own | ✓ | ✓ | ✓ |
| Delete (hard) | — | — | — | ✓ | ✓ |
| Grant `can_self_publish` | — | — | — | ✓ | ✓ |
| Suspend / ban user | — | — | — | ✓ | ✓ |
| Grant `can_edit_copy` | — | — | — | — | ✓ |

\* subject to automated scan (§7).

### 4.3 Ownership rule (unchanged pattern)

```python
entity = await get_entity_or_404(entity_id)
if entity.created_by != current_user.id and current_user.role not in STAFF_ROLES:
    raise HTTPException(403, "Not authorized")
```
Ownership fields by Kind: `created_by` (Content, Event, Group, Course, Path, Waste), `seller_id` (Listing), `uploaded_by` (ImageAsset).

### 4.4 Enforcement ladder (demotion / restriction / suspension / ban)

Today there is **no** ban/suspend infrastructure: `User` has no status field (`user.py:37-74`), no endpoint, and `get_current_user` does no account check (`security.py:33-56`). We add it as a ladder along two independent axes — **privilege** (role/trust) and **access** (account status).

**New User fields:**
```
account_status: enum(active | suspended | banned)  default active
suspended_until: datetime | null
banned_at: datetime | null
ban_reason: text | null
banned_by: FK→users | null
```

**Enforcement check** added to `get_current_user` (and login in `auth.py`):
- `banned` → 403, all sessions invalid.
- `suspended` and `suspended_until > now` → read-only token (authoring/comment/rate endpoints reject); auto-restores after `suspended_until`.

| Rung | What it is | Mechanism | Reversible? | Effect on their content |
|------|-----------|-----------|-------------|-------------------------|
| **Demotion** | Lower privilege | role ↓ and/or revoke `can_self_publish` | Yes | Grandfathered; future content pre-moderated |
| **Restriction** | Keep access, remove authoring trust | force `can_self_publish=false`, flag "force review" | Yes | Stays; new content forced to `in_review` |
| **Suspension** | Temporary access curtailment | `account_status=suspended` + `suspended_until` | Auto-expires | **Authoring blocked, read allowed**; their content **hidden** until reinstated |
| **Ban** | Permanent removal | `account_status=banned` + reason | Appeal only | Published content **unpublished + author anonymized**; a mod may re-publish high-value items anonymized (author → tombstone) |

Every rung is written to the moderation audit log (actor, target, reason, timestamp). The license-misuse case (§6.2) is the top rung: delete content + ban. Banned-user content handling aligns with GDPR erasure (§8).

---

## 5. Authoring surfaces

### 5.1 Canonical rich-text format: Editor.js block JSON

**One representation for all long-form content.** Articles already use Editor.js JSON in `Content.body`. **Lessons migrate from plain `Text` to the same Editor.js JSON** (one-time migration, §11). One shared renderer renders read-only JSON everywhere; there is no second HTML/markdown path.

- Storage: `body` JSON column on the entity.
- Editor: a single `ContentEditor` component (generalised from `ArticleEditor.tsx`) used by Article and Lesson.
- Renderer: a single `ContentRenderer` (read-only Editor.js) — used by public views.

### 5.2 Structured forms

Events, Listings, Groups, Courses, Learning Paths, Waste projects, Plant (admin) use structured forms. These standardise on:
- the shared **autosave/draft hook** (§9.2),
- the shared **media uploader** (§6),
- the unified **status display + (i) help** (§9).

### 5.3 External ingestion (consolidate the five paths)

The five current ingestion paths (single-URL submit, search-and-crawl, RSS feeds, Scrapy spiders, UTAD plant crawler) converge on **one internal ingestion service** that:
1. fetches + parses (existing `crawler.py` / `feed_parser.py`),
2. **ingests every image through the ImageAsset pipeline** (§6.3) instead of storing raw URLs,
3. runs the **automated scan** (§7),
4. writes a `Content` row as `status` per profile and `verification_status = unreviewed`,
5. lets `cross_reference` promote it to `published` + "Verified by N sources".

The no-auth `POST /api/content/index` endpoint is **network-restricted** to the internal crawler (or gated by a service token) — never publicly reachable.

### 5.4 Long-form templates

Editor.js initializes from a `data` JSON of blocks, so a **template is simply a starter document** (pre-filled headings/placeholders such as `## Materials`, `## Steps`, `## Tips`) loaded into the editor. **No plugin is required.**

- A **template picker** appears on the create screen for Full Kinds (Article first).
- **Templates are admin-editable**, stored in a DB table (`content_templates`: id, kind, key, label_pt, label_en, body JSON, is_active) so non-developers can tune them without a deploy.
- Starter set (gardening/maker domain): **How-to / build log**, **Plant profile**, **Recipe**, **Project journal**, **Comparison / review**, **Blank**.
- Templates help users who lack design/storytelling structure get a coherent skeleton instantly.

---

## 6. Media & video handling

### 6.1 One pipeline rule

**Every image becomes an `ImageAsset`.** The robust content-addressed pipeline (SHA-256 dedup, WebP variants, attribution, license, provenance) becomes mandatory for *all* image entry points. Concretely:

- Replace the raw `image_url` text fields on **events and groups** with the shared `ImageUpload` component.
- Route **crawled / external / iNaturalist / plant** images through `/api/images/from-url` (async/lazy so crawling isn't blocked).
- Keep the raw URL only as a `canonical_url` fallback reference, never as the rendered source.

### 6.2 Attribution & license (first-class, enforced)

License/attribution moves out of hidden query params into an explicit authoring step:

| Source | License rule |
|--------|-------------|
| **External / API / crawled** | License/attribution **required to publish** — **no exception** (we cannot shift liability for third-party content). |
| **Own upload** | License **required to publish**, with **one exception**: the user may proceed by accepting a visible **liability-shift disclaimer** ("I own or have the rights to this image and accept full legal responsibility"). On misuse → delete content **and** ban user (§4.4 top rung). |

> ⚠️ **Legal review required:** whether a ToS disclaimer can fully shift liability under Portuguese / EU law is uncertain (typically you obtain indemnification, not a full disclaimer). Treat the upload exception as **provisional pending legal sign-off**. The disclaimer text is a legal artefact, not just UI copy.

### 6.3 EXIF / privacy

The pipeline (already WebP-normalising and auto-orienting) must **strip GPS/EXIF metadata** on ingest so uploaded photos cannot leak users' home coordinates (GDPR data-minimisation; ties into the existing lat/lng privacy rules).

### 6.4 Mandatory cover image

Today every image field is optional (`content.py:68`, `event.py:19`, …) and video/lessons have no poster. New rule:

**A cover is required to publish (drafts may be coverless).** It is satisfied by the first available of four sources, in priority order:

1. **Uploaded** image (→ ImageAsset).
2. **External link** (→ ingested to ImageAsset).
3. **Auto-derived**: article first body image (existing `_extract_first_image_from_body`, `articles.py:23-47`) **or** a **video poster** (next item).
4. **Category default cover** — a curated set of per-category images so nothing is ever blank.

### 6.5 Video

**Embeds only — no native upload** (cost + abuse surface). Standardise on a single `VideoEmbed` block (YouTube / Vimeo / oEmbed) used by **both** articles and lessons.

- Add a **`poster` field** to video-bearing entities (Lesson, and the VideoEmbed block). Auto-fetched from the YouTube/Vimeo oEmbed thumbnail where possible, user-overridable via upload/link. The poster counts as the cover for video content (§6.4 source 3).

---

## 7. Automated moderation pipeline

### 7.1 Posture: self-hosted, in-EU

All moderation inference runs **inside the EU backend perimeter** (the existing server + Celery workers). **Do not** use OpenAI/Google/Azure moderation APIs — they create a US data transfer (GDPR/DSA friction), and Google's Perspective API is sunsetting 2026-12-31.

### 7.2 Models

| Modality | Model(s) | License | Notes |
|----------|----------|---------|-------|
| **Text** | **Detoxify (multilingual)** | Apache-2.0 | Covers **PT + EN**. Scores toxicity, severe_toxicity, insult, threat, identity_hate, obscene. |
| **Image** | **Falconsai ViT** (binary gate) + **NudeNet** (granular) | Apache-2.0 / **AGPL-3.0** | Two-stage. Optional **NSFWJS** client-side pre-check. ⚠️ NudeNet AGPL — fine as internal service, note for compliance. |
| **Video** | Frame-sample → image models; **Whisper** (audio→text) → Detoxify | MIT / Apache | No single OSS video API; compose. |

> **Known gap:** OSS is strong on NSFW/toxicity, weak on **hate symbols / violence in imagery**. Route low-confidence imagery to human REVIEW rather than auto-ALLOW.

### 7.3 Decision model & placement

The scan runs on create/submit **and** on edit, *before* the trust-tier decision:

| Outcome | Action |
|---------|--------|
| **ALLOW** + trusted author | → `published` |
| **ALLOW** + untrusted | → `in_review` |
| **REVIEW** (borderline) | → `in_review`, flagged with the reason/score |
| **BLOCK** (high confidence) | → `rejected` (soft), logged, appealable to a human |

### 7.4 Rollout

Stage the rollout: **SHADOW** (log-only, no enforcement) → **ADVISORY** (BLOCK downgraded to REVIEW) → **ENFORCE**. Calibrate thresholds on *real RootLink content* before enforcing — published accuracy numbers do not transfer to your distribution.

---

## 8. Compliance (GDPR / DSA)

| Requirement | How the platform satisfies it |
|-------------|-------------------------------|
| **Art. 22 — automated decisions** | Every automated BLOCK is appealable to a human, with a stated reason (§2.5). |
| **DSA — statement of reasons** | `rejected` records reason + actor + timestamp; surfaced to the author. |
| **Art. 17 — right to erasure** | On account deletion **or ban**, **anonymise authorship** (`created_by` → tombstone, strip personal data from attribution); content may be retained under legitimate interest **or** deleted per the per-Kind retention policy. |
| **Art. 15 / 20 — access / portability** | "My Content" dashboard (§9.3) exposes export of the user's authored content. |
| **Moderation audit log** | Every automated + human decision (incl. ban/suspend, §4.4) logged: actor, action, reason, model version, timestamp. |
| **Data minimisation** | EXIF/GPS stripped (§6.3); email never in API responses; lat/lng gated (existing rules). |
| **Lawful basis / consent** | Captured at signup and at the Publisher Responsibility step. |
| **Retention policy** | Defined per Kind (drafts auto-clean after 30 days **with prior notice**, excluding `in_review`). |

---

## 9. User experience

### 9.1 Global "Create" entry point

A single **`+ Create`** affordance in the nav (desktop dropdown + mobile sheet) lists every Kind the current user is **permitted** to create, each with a one-line description; locked Kinds show a "Requires Contributor" hint. Replaces today's scattered `/new`, `/create`, and in-page `showForm` toggles. See `mockups/01-create-menu.html`.

### 9.2 Autosave & drafts everywhere

The article editor's autosave (5s debounce, "Saving… / Saved", Save Draft) becomes a **shared hook** used by all Full-lifecycle Kinds. Drafts honour the 30-day cleanup **with prior notice** and never delete `in_review` items.

### 9.3 "My Content" dashboard

One dashboard listing every authored item across all Kinds with: thumbnail, type chip, **status badge**, engagement counts (§9.6), and "what happens next" helper text (e.g. "In review — a moderator usually checks within 24h"). Rejected rows show the reason + **Appeal**. Hosts the GDPR export. See `mockups/03-lifecycle-dashboard.html`.

### 9.4 Contextual help: the `(i)` system

Build the reusable **`Tooltip` + `InfoPopover`** components that don't exist today (currently only native `title=`). Attach contextual help at each step:
- what each field means,
- what "Publish" actually does (differs by trust tier),
- why an item is in review,
- the license/attribution explainer + the liability disclaimer.

### 9.5 Status communication rules

- Color is never the only signal (badge + text + icon) — accessibility.
- Every transition produces user-facing feedback (toast or inline) and, where relevant, a notification.

### 9.6 Engagement metrics & signals

The counters already exist (`content.py:85-89`), double-voting is already prevented via a per-user `ContentRating` row (`rating.py:9-11`), and `ContentRating.tsx` already shows numbers. What we add is **consistency and an insight layer**:

- **Show counts everywhere.** Up / down / views surfaced uniformly on **all** cards and detail pages (today only some show them).
- **Unique, throttled views.** Replace the raw per-GET increment (`articles.py:255`, `marketplace.py:134`, `waste.py:307`) with **one view per (user-or-session, content) per time window**, implemented with a **Redis-backed throttle** (Redis is already deployed) so the DB isn't bloated. Make view tracking consistent across all Kinds.
- **Public "hidden gem" signal.** Derive an engagement-vs-reach ratio: high approval + low views → a **"hidden gem"** badge surfaced to all users so good-but-unseen content gets discovered.
- **Moderator early-warning.** The inverse (high dislikes + low views, or a sudden ratio spike) is surfaced to moderators via the ranking service for a closer look.
- **Privacy:** counts and ratios are public/aggregate; the per-user vote records stay private.

---

## 10. Edge-case register

| # | Case | Decision |
|---|------|----------|
| 10.1 | **Comments** | **Separate** lightweight flow: post-moderation + automated scan + report. Not the Full lifecycle. |
| 10.2 | Editing published content | Trust-based re-review (§2.4). |
| 10.3 | Trust revocation | Future content pre-moderated; already-published content **grandfathered** (§3.3). |
| 10.4 | Draft auto-delete vs autosave | 30-day cleanup **with prior notice**; excludes `in_review`. |
| 10.5 | Localization | Authored content is single-language but **surfaces to all users with a language badge** (PT/EN), not hidden. |
| 10.6 | `POST /content/index` no-auth | Network-restricted / service-token; never public. |
| 10.7 | Lesson body migration | One-time migration plain `Text` → Editor.js JSON (§11). |
| 10.8 | Reject = hard delete (current bug) | Replaced by soft `rejected` + reason + appeal. |
| 10.9 | Legacy `image_url` strings (events/groups/crawled) | Backfill through ImageAsset ingestion; keep raw as `canonical_url` fallback. |
| 10.10 | Cross-referenced content whose sources later vanish | Re-evaluate badge on source change; may drop "Verified" badge (stays published). |
| 10.11 | Liability disclaimer enforceability | **Provisional pending PT/EU legal sign-off** (§6.2). |
| 10.12 | NudeNet AGPL license | Acceptable as internal network service; documented in compliance notes. |
| 10.13 | Multi-author / collaborative editing | **Out of scope v1.** Single owner per item. |
| 10.14 | Banned user's published content | Unpublished + author anonymized; mod may re-publish high-value items anonymized (§4.4, §8). |
| 10.15 | Suspension scope | Authoring blocked, **read allowed**, content hidden, auto-expires at `suspended_until` (§4.4). |
| 10.16 | Mandatory cover | Required at **publish**; 4-source fallback (upload/link/derive-or-poster/category-default); video gains a `poster` field (§6.4-6.5). |
| 10.17 | Editable copy | Runtime DB override layer over static JSON; never requires redeploy (§12). |
| 10.18 | View inflation | **Unique/throttled** views via Redis; raw increment retired (§9.6). |

---

## 11. Phased implementation & migration plan

> This document defines the target. Below is the proposed sequencing.

**Phase 0 — Foundations (no user-visible change)**
- Add `in_review / needs_changes / rejected` to the status enum; keep `status` as the sole gate.
- Add `can_self_publish` + `self_publish_agreed_at`, `can_edit_copy`, and `account_status` (+ suspension/ban fields) to User; add `super_admin` role.
- Add the enforcement check to `get_current_user` + login.
- Stand up the moderation service in **SHADOW** mode (Detoxify + Falconsai/NudeNet + Whisper), log-only.
- Add the moderation audit-log table and the `content_templates` table.

**Phase 1 — Lifecycle unification**
- Repoint visibility off `verification_status` onto `status`; convert verification into the quality badge.
- Replace hard-delete-on-reject with soft `rejected` + reason + appeal.
- Migrate crawled content to publish via `status` on cross-reference.

**Phase 2 — Media unification**
- Make ImageAsset mandatory for events/groups (replace raw `image_url` fields).
- Route external/crawled images through `/from-url`; backfill legacy URLs.
- Add EXIF/GPS stripping; add license/attribution authoring step + liability disclaimer.
- Add `poster` field + oEmbed poster fetch; add category default covers; enforce cover-at-publish.

**Phase 3 — Authoring unification**
- Generalise `ArticleEditor` → `ContentEditor`; migrate lessons to Editor.js JSON.
- Shared autosave/draft hook across Full Kinds.
- Single `VideoEmbed` block; template picker + admin template editor.

**Phase 4 — Trust, enforcement & moderation**
- Ship the promotion flow (eligibility → Publisher Responsibility agreement → grant).
- Ship the enforcement-ladder endpoints (demote/restrict/suspend/ban) + audit.
- Move moderation SHADOW → ADVISORY → ENFORCE after threshold calibration.

**Phase 5 — UX surfaces**
- Global Create menu, "My Content" dashboard, `Tooltip`/`InfoPopover` `(i)` system, status messaging.
- Engagement metrics: uniform counts, Redis unique-view throttle, "hidden gem" signal + moderator early-warning.

**Phase 6 — Editable copy & compliance hardening**
- Copy-override layer + inline edit mode (§12).
- Erasure/anonymisation, data export, retention jobs, DSA statement-of-reasons surfacing.

---

## 12. Editable site copy

**Problem:** flat UI copy (page titles, subtitles, body text) lives in `messages/pt.json` + `messages/en.json` (**1227 lines each**), bundled at build (`locale-context.tsx:21-28`), changeable only by editing JSON + redeploying. A full CMS / website builder is overkill.

**Solution — a copy-override layer (no CMS, no redeploy):**

1. **Defaults stay in JSON.** A new DB store `copy_override` (key, locale, value, updated_by, updated_at) holds edits. `locale-context` fetches overrides at runtime (cached) and **merges them over** the static bundle. Missing override → static default → key (existing fallback chain).
2. **Inline "edit copy" mode.** A toggle visible only to authorised users turns every `t()`-rendered string into a click target. In edit mode, `t()` output is wrapped with its `data-i18n-key`; clicking opens the existing `InlineInput` pattern (`admin/content/page.tsx:31-70`) to edit **both PT and EN**, with **revert-to-default** and an audit entry.
3. **Permission model — `can_edit_copy`.** A dedicated boolean on User. **super_admin** holds it inherently and can grant it to specific user IDs (the "assigned users" model). Backend enforces it on the override write endpoint; frontend only shows edit mode to holders.
4. **Scope.** All `t()` keys are technically editable; practically, start with marketing/page-copy namespaces. Functional strings (errors, a11y labels) editable but flagged "system".

**Backend hook:** the existing `Setting` model + admin CRUD (`admin.py:672-725`) is the natural foundation, or a dedicated `copy_override` table for clean keying. Endpoints: `GET /api/copy?locale=` (public, cached), `PUT /api/copy/{key}` (`can_edit_copy`), `DELETE /api/copy/{key}` (revert).

**Known fix surfaced by this work:** `ContentRating.tsx:125` hardcodes the English string "What makes this helpful?" — it must be moved into the i18n system to be editable (current i18n bug).

---

## 13. Open decisions (tracked)

- [ ] Legal sign-off on the upload liability-shift disclaimer (§6.2 / 10.11).
- [ ] Per-Kind retention periods for the erasure policy (§8).
- [ ] Final Detoxify/NudeNet/ViT thresholds (set during SHADOW calibration, §7.4).
- [ ] Whether `can_self_publish` eligibility count (3) should vary by Kind.
- [ ] Suspension default duration(s) and whether bans are appealable to a fixed window.
- [ ] Unique-view throttle window (e.g. 24h per user/session) and whether logged-out views count.
- [ ] Initial set of category default covers and who curates them.

---

## Appendix A — Design tokens (for mockups & implementation)

From `rootlink/frontend/tailwind.config.ts`:
- **Fonts:** `Fraunces` (display), `Source Serif 4` (serif body).
- **primary** (taupe/brown) `#7a6040`(500) / `#4f3d2a`(700); **earth** (brown) `#8c6b48`(500); **rust** (terracotta) `#a8643d`(500); **cream** `#f8f6f2`.
- **Radius:** `xl2 = 16px`. Dark mode via `class`.
- **Status colors (proposed):** draft = stone/gray; in_review = amber; published = forest/earth green; needs_changes = rust; rejected = red; archived = muted stone.

## Appendix B — Mockups

Four standalone HTML mockups (built against Appendix A tokens) live in [`mockups/`](./mockups/):

1. `01-create-menu.html` — global Create menu with permission-gated Kinds.
2. `02-editor.html` — unified `ContentEditor`: template picker, autosave, `(i)` help, cover + attribution.
3. `03-lifecycle-dashboard.html` — lifecycle legend + "My Content" dashboard with status badges, engagement counts, Appeal.
4. `04-media-attribution.html` — media uploader with license dropdown + liability disclaimer.

Open `mockups/index.html` to browse all four.
