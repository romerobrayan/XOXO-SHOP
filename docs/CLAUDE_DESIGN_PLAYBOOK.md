# Claude Design Playbook — XoXo PDP

How to run the Phase 0 design session. Companion to `DESIGN_BRIEF_PDP.md`.

Claude Design is at `claude.ai/design` or the Claude Desktop sidebar. **Web and desktop
only — this cannot be done from the phone.**

---

## Before you open it

### 1. Check which design system is attached

New projects automatically inherit your organization's design system. If you're on a
company workspace, your project will silently start from that brand — which is not XoXo's
brand. Check this first and override it. A whole session spent fighting inherited tokens
is a session wasted.

### 2. Decide how the tokens get in

**Path A — fast.** The `@theme` block is already in the brief. Attach the brief and go.
Fine for Phase 0.

**Path B — better, ~20 minutes.** Scaffold the Next.js project first, put the `@theme`
block in `src/app/globals.css`, then run `/design-sync` from Claude Code to import it.
Claude Design then builds with your real tokens, checks its own output against them, and
the handoff back to Claude Code lands on an existing codebase instead of a screenshot.

Path B is also the order of work already in the spec (§10), so it costs nothing extra.

### 3. Gather attachments

**Attach:**

| File | Why |
| --- | --- |
| `DESIGN_BRIEF_PDP.md` | The brief. This is the main input |
| The logo, highest resolution available | It *is* the display type and the source of the palette. Not the Instagram screenshot — get the original file from the client |
| 2–3 Instagram screenshots | Product and catalog context |

**Do not attach:**

- `XOXO_TECHNICAL_SPEC.md` — 1,200 lines of Prisma schema and payment adapters. It dilutes
  the brief and buys nothing on the canvas.
- `CLAUDE.md` — that's the operating manual for Claude Code, not for design.

### 4. Frame the Instagram screenshots explicitly

This matters more than it sounds. Their current posts have prices burned into the image,
red tag graphics, and a WhatsApp number over the product. If you attach those without
saying what they are, you risk getting that visual language back.

Say it in the message: *these show the products and the current state we are replacing —
they are not the target aesthetic.*

---

## The opening message

Attach the brief and the logo, then paste this:

```text
I'm designing the product detail page for a Colombian adult products retailer moving off Instagram. The full brief is attached as DESIGN_BRIEF_PDP.md — read it before responding.

The attached logo is the brand's existing wordmark. It's the source of the palette and it serves as the display type — keep it as an image, don't recreate it in a webfont.

The Instagram screenshots show the products and the current state we're replacing. They are NOT the target aesthetic. The site should look like a well-run pharmacy that happens to have a great neon sign — the opposite of the feed.

For this first message: do not write any code. Give me only the design plan the brief asks for — palette as named values, type roles and scale, a layout concept with an ASCII wireframe for the 375px view, and the one signature element the page will be remembered by. Then tell me which parts of your own plan you'd have produced for any other product page, and what you changed.

Mobile-first at 375px. All customer-facing copy in Colombian Spanish.
```

You can switch to Spanish for the rest of the conversation once the plan comes back.

---

## Session flow

**Step 1 — Plan only.** The message above. Read the plan critically. You know the client
and the buyer; Claude doesn't. This is the cheapest place to change direction.

**Step 2 — Push back once, specifically.** If anything in the plan reads generic, say so
and name it. "The trust section is three icons with two words each — the brief rules that
out, give me plain sentences instead."

**Step 3 — Ask for the build.** Only after the plan is right. Ask for the two-axis case
(*Conjunto Tiras*) first, complete, at 375px.

**Step 4 — Ask for the second state.** The zero-option product (*Lovense Lush*). This is
the real test: the picker should not exist and the layout should not shift. If it renders
an empty or disabled picker, that's the bug to fix before anything else.

**Step 5 — Ask for a review.** Claude can audit its own output. Specifically ask for:

> Review this for contrast and accessibility. The palette is light text on a near-black
> ground — check the blush and mist tones against the background for body text
> specifically, and flag anything that fails WCAG AA.

Do this. The lavender and pink in the palette are the ones most likely to fail on
`#0B0A0F`, and it's much cheaper to find out now than after the client approves.

**Step 6 — Then the other breakpoints.** 768 and 1280, after mobile is settled.

**Step 7 — Handoff.** Export → Handoff to Claude Code. It packages the design with its
intent, so Claude Code continues from the actual work rather than reverse-engineering a
screenshot.

---

## How to give feedback

Three channels, and they are not interchangeable:

| Channel | Use it for |
| --- | --- |
| **Inline comment** (click the element) | Component-level: "make this button padding larger", "this swatch needs the color name next to it" |
| **Chat** | Structural: new sections, rearranging, anything needing explanation |
| **Direct canvas edit** (drag, resize, align) | Quick visual and spacing adjustments |

Two rules that decide whether iteration works:

**Be specific.** "This doesn't look right" is unactionable. "Tighten the gap between the
option groups to 12px" is one change, done.

**One thing at a time.** Batching five unrelated changes into one message gets you a
rewrite instead of an edit.

**Known issue:** inline comments occasionally get lost before Claude reads them. If a
comment doesn't land, paste the same feedback into chat.

---

## Worth knowing

**Ask for variations when you're unsure.** "Show me 2–3 options for the discretion block."
Comparing is much faster than guessing, and it's the section you have the least prior art
for.

**Park a direction instead of losing it.** "Save what we have and try a completely
different approach." Claude saves the current state so you can go back.

**Usage is shared.** Design draws from the same pool as chat, Claude Code, and Cowork —
there's no separate design allowance. Long iteration sessions on a complex project consume
real budget, which is the practical argument for planning in a normal chat first and
generating on the canvas only once the direction is settled.

**Chat upstream error?** Start a new chat tab inside the same project.

---

## What "done" looks like for Phase 0

- Two-axis PDP, complete at 375px
- Zero-option PDP, no picker, no layout shift
- Contrast reviewed and failures fixed
- 768 and 1280 behaving
- Deployed to a preview URL with a visible note that images are placeholders
- Link sent to the client — a link on her phone, not screenshots

---

Official guide: https://support.claude.com/en/articles/14604416-get-started-with-claude-design
