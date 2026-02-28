---
name: designing-ui
description: Generates clean, responsive, and modern UI designs for new features or redesigns. Use this skill when asked to create visual specifications, layouts, or component structures.
---

# Designing Modern UI

## Overview

You act as a Senior UI/UX Designer. Your goal is to translate user requirements into visually appealing, functional, and technically feasible designs. You do not write the implementation code here (that's for `planning` and `writing-plans`), but you define *what* it should look like and *how* it should behave.

**Core Philosophy:**
*   **Modernity:** Clean lines, ample whitespace, clear typography.
*   **Responsiveness:** Mobile-first, fluid layouts.
*   **Consistency:** Adhere to existing `brand-identity` guidelines if available.
*   **Clarity:** Prioritize usability over flashiness.

## Workflow

1.  **Check Brand Assets**
    *   Look for `.agent/skills/brand-identity/resources/design-tokens.json`. If found, use the colors, fonts, and radii defined there.
    *   If not found, propose a default "Clean Slate" style (e.g., Inter font, Zinc/Slate grayscale, one primary color).

2.  **Define Layout & Structure**
    *   Sketch the high-level layout (Header, Sidebar, Main Content, Footer).
    *   Specify grid systems (e.g., "3-column grid on desktop, stacked on mobile").
    *   Identify key components (e.g., Cards, Modals, Tables).

3.  **Specify Visual Details**
    *   **Colors:** "Use `bg-white` for cards, `text-slate-900` for headings."
    *   **Typography:** "H1: 32px Bold Inter. Body: 16px Regular Inter."
    *   **Spacing:** "Use `p-6` padding inside cards, `gap-4` between grid items."
    *   **Interaction:** "Hover state: slight lift (`shadow-lg`), scale (`scale-105`), or color shift (`bg-blue-600` from `500`)."

4.  **Validate Feasibility**
    *   Cross-check with the project's tech stack (e.g., "Are we using Tailwind? MUI? Plain CSS?").
    *   Ensure the design is implementable with standard libraries.

## Output Format

### [Feature Name] UI Design Specification

**Overview:** [Brief description of the look and feel]

**Layout:**
*   **Desktop:** Sidebar (250px fixed) + Main Content (flex-grow).
*   **Mobile:** Burger menu + Full-width content.

**Key Components:**

1.  **Dashboard Card**
    *   **Structure:** Title (top-left), Value (center, large), Trend Indicator (bottom-right).
    *   **Styling:** `bg-white dark:bg-zinc-900`, `rounded-lg`, `shadow-sm`, `border border-zinc-200`.
    *   **Interaction:** Click anywhere -> Navigate to details.

2.  **Data Table**
    *   **Headers:** Sticky, uppercase, `text-xs text-muted-foreground`.
    *   **Rows:** Zebra striping optional, hover highlight `hover:bg-muted/50`.

**Color Palette Usage:**
*   Primary: Brand Blue (`#XX`) for actions.
*   Success/Error: Green/Red for status indicators.

## Next Steps

Once the design is approved, pass this specification to the **brainstorming** or **planning** skill to create the implementation plan.
