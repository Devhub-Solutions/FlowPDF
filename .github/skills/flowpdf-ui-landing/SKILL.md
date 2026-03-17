---
name: flowpdf-ui-landing
description: "Use when creating or updating a landing page that must match FlowPDF visual style, hero structure, CTA pattern, and dark neon-lime aesthetic. Keywords: landing page, hero, CTA, marketing section, flowpdf homepage."
---

# FlowPDF Landing Skill

## Goal
Build a landing page that matches the current FlowPDF style and interaction pattern.

## Style Contract
- Theme: dark zinc surfaces with lime accent.
- Typography: keep current app font stack and mono labels.
- Components: card, drop-zone, input, icon-btn, btn-secondary class names should remain compatible with `frontend/src/index.css`.
- Spacing: same max widths used in app (`max-w-[1200px]`, `max-w-[1600px]`).

## Required Sections
1. Sticky header with brand + primary CTA.
2. Hero section with one main promise and two CTA actions.
3. Feature grid with at least 4 cards.
4. "How it works" section with 3 steps.
5. Footer CTA.

## Interaction Rules
- Primary CTA navigates to the tool page (`/render`).
- Secondary CTA opens API docs (`/api-docs`).
- Keep motion minimal and intentional (`animate-fade-up`, soft glow, hover states).

## Output Checklist
- Works on desktop and mobile.
- No hardcoded inline colors that break theme consistency.
- No visual style drift from existing tabs/pages.
- Keep JSX split into small readable sections/components where possible.
