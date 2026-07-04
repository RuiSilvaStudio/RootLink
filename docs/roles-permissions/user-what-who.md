---
type: Note
_width: wide
---
# user-what-who

who can do what

## Baseline

- All users must be associated to an Entity
- Email verification at signup - verifying an email actually belongs to the person
- Any vistor that has registered but they haven't been verified are treated as visitors
- Self-service "forgot password" flow. letting someone reset their own forgotten password in a security way.
- being able to force-log-out a compromised account. Ability to force-expire a user's login \(e.g. after a password reset or a ban\), so a compromised or removed account can't keep using an old session.
- opt out of the platform.
- Every grant/suspend/ban/badge change is logged with who did it and why, and make it a hard rule for every future\\ permission-changing action, no exceptions.

## Exception to base line

when a user is associated to an entity there is not an individual or professinal entity

- user do not have opt out of the platform, only super admin has. this will be managed by the organization they are associated with.

## What is "verified user"

- its a registered persona with a verified email, or was a referal from a trusted user or any role created by a verified organization 

## What is "verified professional"

- its a registered professional with a NIF, activity registration number  and a verified email 

## What is a "tursted user"

its a verified persona that has at least 3 articles without negative reviews, and only if user explicitly sign a "Publisher Responsibility" agreement before self-publish is granted.

Trust is earned and revocable, and it's an audit trail, not a toggle.

## Account status

- **Active** — normal.
- **Suspended \(temporary, timed\)** — can still read, can't post/comment/rate; lifts automatically.
- **Banned \(indefinite\)** — fully locked out, including reading; their published content gets pulled down automatically.

This should stay completely independent from role — a Contributor and an Admin can both be suspended the same way.

## Special trust badges

- **Verified organization/practitioner** — a manually-checked "this is a real registered entity" badge. Should eventually require actual proof \(document upload + human review\), not just an admin's say-so.
- **Trusted publisher** — earned after a track record of approved content; skips the review queue. Should stay revocable and always logged.
- **Copy editor** — can edit site-wide marketing text. A delegation, not a role.

## **Entities**

The platform entity acts as a supper entity that ambrela all others

- individual: regular user, registered as individual. part of the comunity, iam to become more integrated and active contributer.
- professional: professional user, registered as professional, part of the community. the goal will be to provid professional services, otherwise it should register as an individual.
- organization: organizations \(private or public, for profit or non profit\)
- platform: owner and staff members that develop and manage the platform and a is the ambrella to other entities
- partners: platform partners \(laywers, accounts, other tech business\)
- suppliers:platform service supplyers \(tech companies like storage, server, ...\)

Registered but unverified entity - can't create users, and the owner will be treated as a persona until verifications is successfully done

## How entities can be created

- individual - its a default entity of the platform and that inclueds all users that are not professional and are not under any other entity
- professional  - its a default entity of the platform and that inclueds all preofessinal  that are not under any other entity
- Organization, Partners and Suppliers - can be created by the Platform super admin or by page a registration.

## Individual entity limitations

- as a user individual it can go up to contributor but not moderator, admin or super admin
- platform moderators handle individual/partners/suppliers content by default

## Professional entity limitations

- as a professional it can go up to admin, but not super admin

## Partners entity limitations

partners are entities that has a relashionship with the platform entity and not the platform itself.

- as a partner it can have persona level permision + a specific details user id permision granted only by the super admin \(ie. legal updates\)

## Suppliers entity limitations

Suppliers are entities that has a relashionship with the platform entity and not the platform itself.

- as a supplier it can have persona level permision + a specific details user id permision granted only by the super admin \(ie. software provider or other platforms connection to an API\)

## User attributes:

- user can be granted attributes by the super user. meaning super users can delegate some permision to specific user id within their entity. 
- some permission cant be delegated \(see super user allowed delegation matrix\).

## User roles

- visitor: non registered or not verified registered users
- persona: registered and verified
- contributor: registered and verified user with some permision to create and edit own content 
- moderator: registered and verified user with same permision as contributor but monitores contributors, verified users and inforces entity guidlines
- admin: registered and verified user with extended permisions on entity accountability 
- super admin: same as admin but can edit and archive anything for the user of that entity 

## User roles ranking

- 0-visitor
- 1-persona
- 2-contributor
- 3-moderator
- 4-admin
- 5- super admin

## Promote and Demote Users

- **Promoting**: each user role rank can only promote anyone up to below his level and never to his level or above
- **Demoting**: each user role rank can only demote anyone up to below his level and never to his level or above
- promotion and demotions always required to be logged and explained why.
- promotion and demotions required the rank above to aprove with exception for the super admin
- promotion and demotion is not a toggle but a process of submit for aproval

## List of actions applyable by entity/role

**Entity/role** mean this only applies within each entity and role and not platform wide. 

**Legend:** ✅ own  ☑️ others bellow his rank  🔑 permission over all other within the entity

|  action/ user | visitor | persona | contributor | moderator | admin | super admin | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| submit link |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| crawl articles |  |  | ✅ | ✅ | ✅ | ✅ |  |
| create/edit/archive article |  | ✅ | ✅ | ✅☑️ | ✅☑️ | ✅🔑  |  |
| review article |  |  | ☑️ | ☑️ | ☑️ | ✅🔑  |  |
| approve article |  |  |  | ☑️ | ✅☑️ | ✅🔑  |  |
| revert aproval article |  |  |  | ☑️ | ✅☑️ | ✅🔑  |  |
| add/archive feed rss |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| create/ edit plants |  |  |  | ✅ | ✅ | ✅🔑  |  |
| import plants |  |  |  |  | ✅ | ✅ |  |
| create/ edit group |  |  | ✅ | ✅ | ✅☑️ | ✅🔑  |  |
| create/edit/archive  products |  | ✅ | ✅ | ✅☑️ | ✅☑️ | ✅🔑  |  |
| create/ edit own compost |  |  | ✅ | ✅ | ✅ | ✅🔑  |  |
| add/ edit/ archive  comment |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| add/edit/cancel  events |  |  | ✅ | ✅ | ✅ | ✅🔑  | venue, comodities, schedule fall in same level of permissions |
| add/edit/cancel  own events/sponser |  |  | ✅ | ✅ | ✅ | ✅🔑  |  |
| add/edit/cancel own events/supplier |  |  | ✅ | ✅ | ✅ | ✅🔑  |  |
| send notifications to all |  |  |  |  | ✅ | ✅ |  |
| donate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| add/ revert likes |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| send direct messages 1 to 1 |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| create/edit/archive own course |  |  | ✅ | ✅ | ✅ | ✅🔑  |  |
| share/ edit/ archive upcylce project |  | ✅ | ✅ | ✅ | ✅ | ✅🔑  |  |
| follow/unfollow user |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| follow/unfollow organization |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| follow/unfollow professionals |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| Suspend / ban / unban a user |  |  |  |  |  | 🔑  |  |
| Join groups, RSVP |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| Browse & read public content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| Self-service password reset |  | ✅ | ✅ | ✅ | ✅ | ✅🔑  |  |
| Force-logout / revoke  sessions |  | ✅ | ✅ | ✅ | ✅☑️ | ✅🔑  |  |
| Demote |  |  |  |  | ☑️ | ☑️🔑 |  |
| Promote |  |  |  | ☑️ | ☑️ | ☑️🔑 |  |

## Platform entity exclusive permisions - platform wide

**Platform ambrella/role** means it applies across all entities.

| action/user | visitor | persona | contributor | moderator | admin | super admin |
| --- | --- | --- | --- | --- | --- | --- |
| create/ edit/ archive learning path |  |  |  | ✅ | ✅ | ✅ |
| add platform family |  |  |  |  |  | ✅ |
| edit platform family |  |  |  |  | ✅ | ✅ |
| archive platform family |  |  |  |  |  | ✅ |
| edit/update legal |  |  |  |  |  | ✅ |
| archive compost |  |  |  |  |  | ✅ |
| archive group |  |  |  |  |  | ✅ |
| remove crawled article |  |  |  |  | ✅ | ✅ |
| remove link added |  |  |  |  | ✅ | ✅ |
| archive plants |  |  |  |  |  | ✅ |
| Edit Platform UI Content |  |  |  |  |  | ✅ |
| Grant/revoke roles to other users |  |  |  |  |  | ✅ |
| Edit legal documents \(Terms, Privacy\) |  |  |  |  |  | ✅ |
| Reset another user's password |  |  |  |  | ✅ | ✅ |
| Suspend / ban / unban a user |  |  |  |  |  | ✅ |
| Grant/revoke "trusted publisher" \(skip review queue\) |  |  |  |  | ✅ | ✅ |
| Verify an organization/practitioner account |  |  |  |  | ✅ | ✅ |
| Manage platform settings, taxonomy |  |  |  |  |  | ✅ |
| Broadcast messages |  |  |  |  | ✅ | ✅ |

## List of page general visibility /auth protected

| page/user | visitor | persona | contributor | moderator | admin | super admin |
| --- | --- | --- | --- | --- | --- | --- |
| frontend | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| backend |  |  |  |  |  | ✅ |
| AP-Admin Panel |  |  | ✅ | ✅ | ✅ | ✅ |
| AP-Fila de Revisao |  |  |  | ✅ | ✅ | ✅ |
| AP-Plantas |  |  |  | ✅ | ✅ | ✅ |
| AP-Conteudo |  |  |  |  | ✅ | ✅ |
| AP-Comentarios |  |  |  |  | ✅ | ✅ |
| AP-Utilizadores |  |  |  |  | ✅ | ✅ |
| AP-Grupos |  |  |  |  | ✅ | ✅ |
| AP-Bilhetes |  |  |  |  | ✅ | ✅ |
| AP-Doacoes |  |  |  |  | ✅ | ✅ |
| AP-Patrocinadores |  |  |  |  | ✅ | ✅ |
| AP-Fornecedores |  |  |  |  | ✅ | ✅ |
| AP-Transmissao |  |  |  |  | ✅ | ✅ |
| AP-Submeter URL |  |  |  |  | ✅ | ✅ |
| AP-Texto do site |  |  |  |  |  | ✅ |
| AP-Configuracao |  |  |  |  |  | ✅ |
| AP-Legal |  |  |  |  |  | ✅ |

WIP: this table is incomplete and needs to be expanded to all entry points, pages and elements across the platform.

## Super admin allowed permisions delegation

This table shows to who the super admin can delegate permissions. this delegation of permissions can only be done by entity/role/user Id

| actions/user | visitor | persona | contributor | moderator | admin | super admin |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  | ✅ | ⬅️ |

## Platform only super admin allowed permisions delegation

This table shows to who the super admin can delegate permissions. this delegation of permissions can only be done by role/user Id

| actions/user | visitor | persona | contributor | moderator | admin | super admin |
| --- | --- | --- | --- | --- | --- | --- |
| archive platform family |  |  |  |  |  | ⬅️ |
| edit/update legal |  |  |  |  | ✅ | ⬅️ |
| archive compost |  |  |  |  |  | ⬅️ |
| archive group |  |  |  |  |  | ⬅️ |
| archive plants |  |  |  |  |  | ⬅️ |
| Edit Platform UI Content |  | ✅ | ✅ | ✅ | ✅ | ⬅️ |
| Suspend / ban / unban a user |  |  |  |  | ✅ | ⬅️ |

---

## Review notes \(added by assistant\)

Read the whole thing. This is a much stronger foundation than what I drafted —
the entity-ceiling idea and the "own X" pattern for every action are both
things the current codebase doesn't have at all. Below is what I think is
missing, contradictory, or worth deciding on before this becomes a build spec.

### Things that look solid, keep them

- **"Own X" always available from persona up** \(own article, own group, own

product, own compost, own comment, own course\) — this is the "ownership
always wins" idea done right, and it's applied consistently.

- **Entity ceilings** \(individual → contributor max, professional → admin max\)

— this doesn't exist in the app today at all; right now any account can be
promoted to any role regardless of account type. Good new rule, but it needs
to be enforced at the moment a role is assigned \(see "implementation note"
below\), not just documented.

- **Badges \(verified / trusted / copy editor\) kept separate from role** —

matches how it already works in the app, good to keep that split explicit.

- **Audit-log-everything rule** — already partly true in the app \(there's a

logging table for grants/suspends/bans\), this doc correctly makes it a hard
rule instead of a "when convenient" thing.

### Contradictions to resolve

1. **"Suspend / ban / unban a user" appears twice with different answers.**

In the main action table it's super*admin only. In "Platform entity
exclusive permissions" it's admin ***\*and**\** super*admin. Pick one — my guess
is this is actually the scope question below \(an org admin can suspend
someone *within their org*, only super\_admin can ban platform-wide\), but as
written it just looks like two different rules for the same action.

1. **"Edit Platform UI Content"** is super\_admin-only in "Platform entity

exclusive permissions" \(line ~151\), but shows persona/contributor/
moderator/admin all ✅ in the delegation table at the very bottom. I think
the delegation table means "these are the roles this *could* be delegated
down to," not "these roles have it by default" — but that's not labeled
anywhere, so as written it reads as a straight contradiction. Worth adding
a one-line legend for what ✅ vs ⬅️ mean in the delegation tables.

1. **"Approve article"**: contributor ✅, moderator blank, admin ✅. Same

pattern on "create plants" / "import plants" / "edit plants" — contributor
has it, moderator doesn't. Since moderator is supposed to outrank
contributor, this is almost certainly a copy/paste gap rather than
intentional — but worth a deliberate pass over the whole matrix checking
that every higher role includes everything the role below it has, *unless
*you deliberately want an exception \(and if so, flag it in the notes
column so it's clearly intentional, not a leftover\).

### Gaps — roles/entities defined but not fully specified

- \*\*No role ceiling stated for `organization`, `platform`, `partners`,

`suppliers` entities.\*\* You defined it for individual \(≤ contributor\) and
professional \(≤ admin\), but not the other four. I'd guess: organization ≤
admin \(same logic as professional — an org can manage its own team/content
but shouldn't reach platform-wide super*admin\), platform = only entity that
can reach super*admin, and partners/suppliers might not need roles at all
\(they may just be directory listings, not logins\) — but that's a guess,
needs a decision.

- **Gap between "visitor" and "persona".** `persona` = "registered and

verified," but what about someone who registered and hasn't verified their
email yet? Right now they fall through the cracks — are they treated as
`visitor` until verified, or is there a distinct "pending" state? The
Baseline section implies email verification is required to become a
`persona`, so it'd help to say explicitly what a registered-but-unverified
account can/can't do in the meantime.

- \*\*`unknown` entity type vs `visitor` role look like the same thing said

twice\*\* — one on the entity axis, one on the role axis. If they're meant to
always move together \(unknown entity ⇒ always visitor role\), say so
explicitly; if they can be independent \(e.g. a known/verified entity whose
specific user hasn't verified yet\), that's a different, more useful case —
worth being explicit either way.

- **Verification path only described for individuals** \("registered persona

with verified email, or referral from a trusted user, or created by an
org"\). How does a `professional` get verified — same three paths, or does
it require checking a license/registration number? How does an
`organization` get verified — same as today's admin-checked "verified
org" badge, or does that become the professional/org entity's baseline
instead of an extra badge?

- **"Trusted user" definition drops the agreement-acceptance step.** Today

the app requires the user to explicitly accept a "Publisher Responsibility"
agreement before self-publish is granted, on top of the 3-articles rule.
Worth deciding if that stays as a requirement or is intentionally dropped.

### The one big structural question: is every permission platform-wide, or entity-scoped?

This is the thing I'd nail down first, because it changes how several rows
should be read. You introduced entities specifically so that "the platform
entity acts as a super entity that umbrellas all others" — which suggests an
org's `admin` manages *their own org's* users/content, while only the
`platform` entity's `admin`/`super_admin` acts platform-wide. But the action
tables don't mark which is which. E.g.: does a professional-entity `admin
`"Reset another user's password" for anyone on the platform, or only for
people inside their own entity? Same question for suspend/ban \(see
contradiction \#1 above\), verify org, and grant trusted-publisher. I'd add a
"scope" column \(own entity / platform-wide\) next to the notes column on every
table — it's probably the single highest-value clarification to make before
this goes to engineering, because it's the difference between one shared
permission system and a two-tier one \(platform rules + per-entity rules\).

### Implementation note \(so this doesn't recreate the current bug\)

The technical audit found the app's current code has ~23 places where
`super_admin` doesn't actually get everything `admin` gets, because each
permission check was hand-written separately instead of coming from one
shared "rank" check. To avoid rebuilding that same bug from this new spec:
give each role a numeric rank \(visitor=0, persona=1, contributor=2,
moderator=3, admin=4, super\_admin=5\) and implement checks as "does this
user's rank meet the minimum for this action," in one shared place — not as
23+ separate hand-typed lists of allowed roles. The entity ceiling then
becomes a second, independent rule \("this account's entity type caps their
rank at X"\) rather than yet another hand-written check per feature.

Also worth noting: the codebase already has an `account_type
`\(individual/organization/practitioner\) and a separate `entity_type` enum
\(cooperative, association, municipality, company, etc.\) sitting mostly
unused today. The `entity` concept in this doc could likely extend those
existing fields \(adding `platform`, `partners`, `suppliers` as new values\)
rather than being a brand-new concept bolted on top — worth checking with
whoever picks this up for build.

### Small additions to consider for the matrix

- A row for **self-service password reset** and **email verification**

\(currently only described in prose in Baseline, not in the action table\).

- A row for **force-logout / revoke sessions** on a compromised or

removed account \(mentioned in Baseline, not in the table\).

- A row for **anonymous donation** \(visitor\) — worth a deliberate yes/no,

since right now "donate" starts at persona and visitors are blocked from
everything except browsing.

- A "**demote**" action \(drop someone a rank, e.g. contributor → persona\) is

implied by having ranks but isn't in either action table — today's app has
a `demote` action name reserved but never wired to anything; worth deciding
if this design finally uses it.

---

## Review notes round 2 \(added by assistant\)

Checked the new edits against round 1. Good progress — most of round 1 is
resolved. A few things below are new gaps that only became visible *because
*the doc got more precise \(that's a good sign, not a criticism\). Nothing here
should block you from continuing — flagging so you can decide, not asking you
to stop and fix first.

### Resolved from round 1 — no action needed

- Scope question — the "Entity/role" vs "Platform ambrella/role" table split

answers this cleanly. This was the biggest open item, it's handled.

- Numeric rank list added \(0–5\) — matches the implementation suggestion.
- Moderator no longer missing checkmarks contributor has \(approve article,

create/import/edit plants\) — hierarchy gap fixed.

- "Verified professional" definition added, separate from "verified user."
- "Trusted user" now includes the agreement-acceptance step.
- Visitor/persona gap closed \(Baseline bullet: unverified registered = visitor\).
- `unknown` entity dropped in favor of plain-language "registered but

unverified entity" — cleaner than before.

- Delegation tables now have an intro sentence explaining what they mean —

resolves the earlier "looks contradictory" confusion \(✅ = default holder,
⬅️ = where it originates/always stays\). One nit: that legend is prose above
each table — worth a one-line key directly in the table too, so it reads on
its own.

### New: entity-scoping now exposes a real gap for "individual" content

This is the most important new thing, and it exists *because* the
entity-scoping got clarified — good catch on your part led to a real
finding. `individual` is capped at **contributor** — no individual-entity
user can ever be a moderator. But rows like "review article," "approve
article," "archive comment" live in the **entity-scoped** table. If
moderation is scoped to your own entity, and most regular community members
belong to the `individual` entity \(which can never contain a moderator\),
then **nothing submitted by a regular community member ever has an
in-entity moderator to review it.** Same problem, smaller scale, for
`partners`/`suppliers` — capped even below persona-plus-grants, so also
can't self-moderate.

Probably a one-line fix rather than a redesign: state that content from
`individual`/`partners`/`suppliers` entities is reviewed by the `platform
`entity's moderators by default \(those entity types have no ceiling high
enough to self-moderate\), and entity-scoped moderation only really kicks in
for `professional` and `organization`, which can have their own in-house
moderator/admin. Worth a line making this explicit so it's a decision, not
an accident.

### New: two rows that may be mis-scoped

- **"Plants"** \(create/import/edit\) sits in the entity-scoped table, but a

shared plant database reads more like a platform-wide reference resource
\(similar to "learning path," which you correctly put in the platform-wide
table\) than something each entity keeps its own copy of. Worth double
checking whether plants should move to the platform-wide table.

- **"add/edit/archive supplier"** \(entity-scoped table\) uses the same word as

the `suppliers` platform entity type, but reads like a different thing \(an
org tagging a supplier contact for their own compost/marketplace use, vs.
actually creating a `supplier` platform entity, which per "How entities can
be created" is super\_admin/registration-only\). Worth renaming one of the
two so "supplier" doesn't mean two different things in the same doc.

### New: "force-logout / revoke sessions" row looks inconsistent

Currently: persona blank, contributor and up ✅. Two different things could
be meant here, and each implies a different fix:

- If it means **"log myself out of all my own devices"** — that should

start at persona \(any registered user should be able to do this to their
own account\), same as the password-reset row right above it.

- If it means **"force-logout someone else's session"** \(e.g. after a

suspension\) — that's a staff action and contributor shouldn't have it; it
should start at moderator or admin, not contributor.
As written it doesn't cleanly match either reading — worth a look.

### New: "Suspend/ban/unban a user" is now identical in both tables

Both the entity-scoped and platform-wide tables now say super*admin-only.
Given *`individual`* caps at contributor and *`professional`* caps at admin,
\*\*super*admin only ever exists inside the `platform` entity anyway\*\* — so a
super\_admin-gated row in the entity-scoped table is functionally the same as
platform-wide for this one. Not wrong, just redundant; could be trimmed to
one row, or kept in both for clarity if that reads better to you — your call.

### New: promote/demote rules need a bit more precision

"each user role rank can only take action to the rank bellow him and never
above" reads as: an admin\(4\) can manage ranks 0–3 but not other admins or
super\_admins, which makes sense. But "promotion and demotions required the
ranke above aproval with exception for the super admin" is ambiguous: does a
promotion need sign-off from someone one rank above the *actor*, or one rank
above the *new rank being granted*? And is that approval a real-time
second-person check, or an async request/approve queue? Also: the action
table has a `demote` row but no matching `promote` row — probably want both,
since right now "how do you make someone a contributor" isn't in the table
at all, only "how do you demote one."

### Small thing

"Organization" and "platform" still don't have their own "entity
limitations" section like individual/professional/partners/suppliers do —
you now have 4 out of 6 entities with a stated ceiling. Organization is
probably "≤ admin" \(same logic as professional\) and platform is presumably
the only entity that can reach super\_admin — but neither is written down
yet, worth adding for symmetry with the other four.

**Bottom line: nothing above blocks you from continuing.** The structural
skeleton \(entities, ranks, scope split, delegation\) is in good shape — this
round is mostly "fill in a few missing cells" rather than "rethink
something."
