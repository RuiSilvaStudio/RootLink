# Content Studio — UX Research

> Reference file for editor UX conventions across well-known visual/site editors.
> When deciding how the Content Studio overlay should behave, check here first.

## Esc key behavior in inline text editors (2026-07-09)

**Task:** Determine what Esc should do when the content owner is mid-typing into an inline text field on their live page (text edits are an unpublished draft — they go live on Publish; there's a separate Discard action).

**Sources surveyed:** Figma, Webflow, Wix Editor / Wix Studio, Squarespace, Shopify theme editor (OS 2.0), Notion, Medium, WordPress Gutenberg (block editor), plus generic `contentEditable` browser convention + WAI-ARIA guidance.

**Unanimous finding across all 9 tools: Esc NEVER discards or reverts typed text.**

| Tool | Esc behavior | Draft→Publish model? |
|------|-------------|----------------------|
| **Webflow** | Esc exits inline text; change kept in unpublished project; only live after Publish | Yes |
| **Wix Editor / Wix Studio** | Esc exits text field; edit autosaved into the saved-but-unpublished site; Publish to go live | Yes |
| **Squarespace** | Esc exits inline editor; text retained in working state until explicit Save (which publishes) | Yes |
| **Shopify theme editor (OS 2.0)** | Esc closes text block; text held as "Unsaved changes"; Save pushes live; Discard reverts | Yes |
| **WordPress Gutenberg** | Esc exits inline editing, moves focus to block; text kept in post draft; Publish/Update to go live | Yes |
| **Figma** | Esc exits text-edit mode; text already committed (Figma autosaves continuously; no Publish gate) | No (autosave) |
| **Notion** | Esc closes block menu / deselects; text autosaved per keystroke; no text revert | No (autosave) |
| **Medium** | Esc does not discard text; draft autosaves; separate Publish flow exists | No (autosave, but Publish for going live) |
| **Browser contentEditable** | No native Esc behavior; ARIA principle: Esc should never silently destroy user input | N/A |

**Decision (RootLink, 2026-07-09):** Esc = exit text editing, keep what was typed as a draft (unsaved). Publish makes it live; Discard throws it away; Cmd+Z undoes mistakes.

This is coherent with how style edits (color, font pickers) behave: Esc closes the control but keeps the staged change in the draft. The only thing that destroys a draft is the explicit Discard button — never a stray keypress.