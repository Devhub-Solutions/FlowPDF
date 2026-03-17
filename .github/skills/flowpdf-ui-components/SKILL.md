---
name: flowpdf-ui-components
description: "Use when adding or refactoring FlowPDF UI components (forms, cards, upload zones, preview panes, status chips) while preserving current style tokens and behavior. Keywords: component library, ui consistency, card, drop-zone, preview panel, form controls."
---

# FlowPDF UI Components Skill

## Goal
Add or modify UI components that feel native to the existing FlowPDF interface.

## Reuse Rules
- Reuse existing utility classes from `frontend/src/index.css`:
1. `card`
2. `card-header`
3. `card-title`
4. `drop-zone`
5. `input`
6. `icon-btn`
7. `btn-secondary`
8. `field-label`

## Visual Rules
- Background: zinc dark layers, subtle borders, translucent cards.
- Accent: lime for primary actions, blue for image fields, red for destructive actions.
- Labels: monospace uppercase for metadata and status.
- Buttons: clear enabled/disabled states with contrast.

## UX Rules
- Keep loading, success, error states explicit.
- Keep drag/drop affordances obvious.
- Keep preview pane behavior stable and scroll-safe.
- Use concise microcopy in English unless a task requests localization.

## Refactor Rules
- Extract large JSX chunks into named components.
- Avoid changing API behavior during purely visual refactors.
- Keep prop contracts explicit with TypeScript types.

## Output Checklist
- Component matches existing rhythm and spacing.
- No duplicate style logic when shared classes already exist.
- No regression in interactions (upload, remove, generate, preview).
- Vite build succeeds.
