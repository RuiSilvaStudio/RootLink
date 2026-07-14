# RootLink Self-Sufficient Platform — North-Star Guide

> **Status:** Approved v1 (2026-07-13)
> **Owner:** Platform / Rui
> **Purpose:** The north-star contract for platform self-sufficiency — parallel to
> `docs/content-studio/CONTENT_STUDIO.md` (studio) and
> `docs/content-platform/CONTENT_PLATFORM.md` (content). Edit it lightly; it is the contract.
> **AGENTS.md rule:** Before any feature, fix, or expansion work, read this guide first — walk
> the per-feature rubric in §6.

---

## 1. The vision

RootLink is a community platform where **every feature ships full-circle**: the end-user
surface, the owner/manager surface, *and* the adjustment surface — and the adjustment surface is
usable by Rui (or a delegated manager) **without a developer**. The test of a well-shipped
feature is: *can a non-dev rename its nav label, change its form fields, reorder its footer
link, or retune its copy after launch — without a deploy?* If the answer is "no, that needs a
dev," the feature is incomplete by this spec's standard.

This is the lens for every new feature, every fix, and every expansion. The platform is not a
website builder for outsiders; it is a self-adjustable single-site community platform.

## 2. What "full-circle" means, concretely

Every feature has three surfaces. Ship all three, or the feature isn't done.

1. **End-user surface** — what a visitor or community member sees and does.
2. **Owner/manager surface** — what the person responsible for the feature sees and does (review
   submissions, manage listings, approve requests, see stats).
3. **Adjustment surface** — what Rui (or a delegated manager) uses to retune the feature
   post-launch *without code*: copy, nav placement, footer placement, form fields, labels,
   audience/role visibility.

Surfaces 1 and 2 are the feature. Surface 3 is what makes it self-sufficient. A feature that
ships 1 and 2 but not 3 is a **dev-debt feature** — it works today and costs you a deploy every
time it needs a tweak.

## 3. The adjustable surfaces that already exist — use these

Before building a new adjustment mechanism, check whether one of these already covers it:

| Surface | Mechanism | Where |
|---|---|---|
| Marketing/flat copy (headings, subtitles, buttons, labels) | `<Text k="copy.key">` + `/api/copy` overrides, edited in the overlay or `/admin/copy` | `components/ui/Text.tsx`, `docs/content-studio/CONTENT_STUDIO.md` §"Editable copy convention" |
| Per-element style (color, font, spacing, radius) | Overlay inspector + `/api/overrides` + draft/publish | `/studio` overlay |
| Global theme palette (multi-theme, light+dark, draft/publish) | `/studio/theming` + `Theme`/`ThemeToken` | `docs/content-studio/CONTENT_STUDIO.md` §4, §8, §9 |
| Page section composition (add/reorder/delete blocks, edit block props) | `/studio/blocks` + `BlockPage`/`BlockSection` + registry | `lib/block-registry.ts`, `app/p/[slug]/page.tsx` |
| Element catalog & property schemas | `/studio/catalog` + `ElementSchema` | `docs/content-studio/CONTENT_STUDIO.md` §5 |
| Fonts | `/studio/fonts` | same spec §3.1 |
| Override report & stale warnings | `/studio/overrides` | same spec §6 |

**Rule:** if a feature's adjustment need is covered by one of these, wire into it. Don't invent a
parallel hardcoded surface next to it. (The Content UI Editor retirement is the cautionary tale
— two parallel systems for the same job.)

## 4. The frontier — not-yet-adjustable surfaces to grow, opportunistically

These are the surfaces that today are *still hardcoded dev-only*. They are the platform's growth
edges. A feature that touches one of these is an **opportunity to grow that surface toward
editable** — not a license to bolt on another bespoke hardcoded version.

- **Chrome — nav + footer + icons.** `NavBar.tsx` and `Footer.tsx` are hardcoded React. You
  cannot add/hide/remove/reorder nav items or footer links without a deploy. *When a feature
  needs a new nav entry, that's the moment to start moving nav items to DB rows + a studio
  editor.* Don't build the whole editor at once — grow it the first time the pain actually
  blocks a feature.
- **Forms / intake.** Every form today is bespoke code + bespoke submissions table + bespoke
  management view. Volunteer enrollment, donation pledges, supply/demand intent, tool rental
  requests, contact/lead capture — all are forms. *When a feature needs a form, build/extend a
  `FormDefinition` primitive (fields, handler type, owner scope, submissions viewer + export)
  rather than a one-off.* The handler "store-as-X" is how one primitive becomes a volunteer
  enrollment vs. a donation pledge vs. a contact form.
- **Data binding for blocks.** Each block type hardcodes its own API call. *When a block
  genuinely needs to point at a different feed (latest 6 articles vs latest 4 events), that's
  the moment to introduce a feed/collection selector on the block — not before.*
- **Block nesting / containers.** A page is a flat list of sections today. *When a feature
  genuinely needs a column or a nested container, grow the block model to support one
  parent-child level — not before.*
- **Structural draft/publish.** Block add/reorder/delete flips `is_published` with no draft.
  *When a feature makes staging a redesign painful, port the overlay's draft/publish model to
  block structure.*
- **Generic block library.** Only 5 of 22 blocks are reusable; 17 are page-specific. *When a
  new landing page would force a new block type, ask first whether an existing generic block +
  a prop could cover it; if not, add a generic block to the library — not a page-specific one.*

**Sequencing heuristic:** grow the surface that the *next* VISION.md feature actually blocks
on. Don't pre-build machinery for hypothetical future features.

## 5. Non-goals — explicitly out of scope

These are "website-builder" machinery that the vision does **not** require. Do not drift
toward them; do not let future sessions suggest them as "natural next steps."

- ❌ Multi-tenancy / multiple sites / tenant isolation (`tenant_id`, `site_id`, `workspace`
  columns).
- ❌ Custom domains / DNS mapping / hostname-keyed routing. Single domain (or one bought
  domain replacing the subdomain) is the plan.
- ❌ Page export (HTML/JSON) or "publish to a separate static bundle."
- ❌ Per-tenant theming / per-tenant media / per-tenant user pools.
- ❌ A full Webflow/Framer-style generic block library *as a project*. Generic blocks are
  added reactively, when a feature needs one.
- ❌ Letting end-users (community members) compose pages. Page composition stays
  staff/manager-scoped.

## 6. The per-feature rubric — apply every time

Before shipping a new feature, or expanding/fixing an existing one, walk this checklist. Any
"no, that needs a dev" answer is the thing to grow next.

1. **Copy** — Are all static strings on the feature's pages in `<Text k="...">` (or
   `SectionHeader`/`LinkWithArrow`/`Button` with their `*Key` props)? Or are some hardcoded?
2. **Style** — Are colors/fonts/spacing on the feature's surfaces tagged
   `data-rl-component` so the overlay can adjust them? Or hardcoded?
3. **Nav entry** — If the feature needs a nav link, can Rui add it himself? If not → grow the
   editable chrome surface as part of this feature.
4. **Footer entry** — Same question for footer links.
5. **Intake form** — If the feature collects user input, is it built on the `FormDefinition`
   primitive (or, if that doesn't exist yet, is *building* it the work this feature triggers)?
   Or is it bespoke code + bespoke table?
6. **Owner/manager surface** — Does the person responsible have a view (submissions, listings,
   approvals, stats) that is itself built on adjustable surfaces (studio patterns, not bespoke
   admin pages)?
7. **Audience/role visibility** — If the feature is role-gated, is the gating expressed in a
   way that's adjustable (DB-driven nav visibility, role flags) or hardcoded in JSX
   conditionals?
8. **Block vs. bespoke page** — If the feature needs a new landing surface, is it expressible
   with existing generic blocks + props? If yes, use them. If no, *is the gap a generic block
   the library should grow*, or a one-off page that should stay bespoke?

A feature can ship with a "grows surface X" item deferred to a fast-follow, but the deferral
must be **written down** (in `TECH_DEBT.md` or the feature's own status doc), not silently
absorbed into "we'll handle it later."

## 7. Sequencing heuristics (not a roadmap)

- **Forms before chrome.** Three of four VISION.md features block first on forms (volunteer,
  donations, supply/demand, tool rentals all need intake). Chrome is mostly a do-once job;
  forms amortize across every future feature. So when the next business feature forces the
  issue, grow the form primitive first.
- **Chrome as a fast-follow** the first time a feature ships and you immediately want to
  retune its nav label.
- **Full-circle convention first, always.** This guide itself is the convention. Walk the
  rubric (§6) on every change; that's what stops the pain from regrowing — it's the
  highest-leverage action in the whole guide.
- **Don't pre-build generic blocks / data binding / nesting.** Add each reactively, the first
  time a concrete feature actually needs it. The guide's job is to make sure that *when* the
  moment comes, the choice is conscious and the surface grows rather than silently hardening
  into another bespoke path.

## 8. Anti-drift

This guide is the north star for platform self-sufficiency. Edit it lightly; it's the contract.
Update it when:
- A new adjustable surface is added to §3 (move it out of §4).
- A non-goal in §5 gets reclassified as a goal (rare; flag explicitly).
- A rubric question in §6 becomes obsolete because a surface became universally adjustable.
