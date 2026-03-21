---
name: flowpdf-mobile-responsive
description: "Use when making FlowPDF layouts responsive on mobile while preserving existing dark neon style. Keywords: responsive, mobile, small-screen, flex wrap, stacked cards."
---

# FlowPDF Mobile Responsive Skill

## Goal
Ensure all FlowPDF pages remain usable and readable on small screens without breaking the current aesthetic.

## Layout Rules
- Prefer column layouts on mobile (`grid-cols-1` / `flex-col`), then expand to multi-column at `md`/`lg`.
- Allow nav/tab rows to wrap or scroll horizontally; avoid fixed widths that force overflow.
- Keep safe padding: `px-4` on mobile, `px-6`/`px-8` on larger screens.
- Use `gap` utilities instead of absolute positioning to preserve rhythm when stacking.

## Component Rules
- Cards and drop-zones should stay full width on mobile; avoid hard min-widths.
- Preview panes may set a `min-h` but should still shrink to fit mobile viewports.
- Buttons should remain tappable (height ≥ 44px) with clear disabled states.

## Testing Checklist
- Header/nav is readable and reachable on a 375px wide viewport (no clipped tabs).
- Key pages (`/render`, `/merge`, `/builder`, landing) stack gracefully with no horizontal scroll.
- Preview iframes remain scrollable and do not push content off-screen.
- Vite build still succeeds.
