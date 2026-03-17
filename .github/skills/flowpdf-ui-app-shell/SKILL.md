---
name: flowpdf-ui-app-shell
description: "Use when creating app-level navigation, tab layout, route shell, and shared page framing for FlowPDF React UI. Keywords: app shell, navbar, tabs, routes, layout, react-router."
---

# FlowPDF App Shell Skill

## Goal
Create or refactor the main application shell while preserving current FlowPDF UX.

## Routing Pattern
- Use `react-router-dom` with:
1. `/` for landing page.
2. `/render`, `/merge`, `/builder` inside a shared layout.
3. Fallback route to `/`.

## Layout Pattern
- Shared shell component with:
1. Sticky header.
2. Brand button linking to `/`.
3. Route tabs for render/merge/builder.
4. Version badge on right.
5. Content area via `<Outlet />`.

## State and Boundaries
- Keep route-level state inside each page component.
- Keep app shell stateless except route awareness (`useLocation`).
- Do not place heavy page logic into `App.tsx`.

## File Organization
- `src/components/layout/AppLayout.tsx`
- `src/pages/*Page.tsx`
- `src/components/icons/Ico.tsx`
- `src/components/ui/StepBadge.tsx`
- `src/types/index.ts`

## Output Checklist
- Navigation highlights active route.
- Header style remains consistent with existing theme.
- No broken imports after moving files.
- Build passes with Vite.
