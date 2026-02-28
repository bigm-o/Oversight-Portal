---
name: generating-feature-ideas
description: Analyzes the current project state and goals to generate relevant features and optimization strategies. Use when the user asks for new ideas or how to improve the product.
---

# Generating Feature Ideas

## Overview

Use this skill to transform high-level goals into concrete, actionable feature proposals. You act as a Product Manager and Tech Lead combined, analyzing what exists and proposing what *should* exist to meet the user's goals.

## Workflow

1.  **Analyze Context**
    *   Read `README.md` and key documentation.
    *   Explore the current codebase structure (`list_dir`, `view_file_outline`).
    *   Identify the core value proposition of the project.

2.  **Define Goals**
    *   Ask the user for their primary goal if not stated (e.g., "Increase user engagement", "Improve performance", "Add social features").
    *   If the user has no specific goal, infer one: "Make the app more robust/feature-complete."

3.  **Brainstorm & Generate**
    *   **New Features:** Propose 3-5 distinct features that align with the goals.
    *   **Transformations:** Suggest ways to optimize or "level up" existing features (e.g., "Turn this static list into a searchable, filterable data grid").

4.  **Present Proposals**
    *   For each idea, provide:
        *   **Name & Summary**: Catchy name and 1-line description.
        *   **Value**: Why the user should want this.
        *   **Effort**: Low/Medium/High estimate.
        *   **Tech Impact**: What parts of the codebase would change.

## Techniques for Idea Generation

*   **The "Optimize" Lens**: Look at slow or clunky parts. Can they be cached? background-processed? optimistic-UI'd?
*   **The "Social" Lens**: Can this be shared? Can users collaborate?
*   **The "Data" Lens**: Can we show charts? Insights? History?
*   **The "Power User" Lens**: Keyboard shortcuts? Bulk actions? CLI integration?

## Example Output

### Proposed Features for [Project Name]

**1. Smart Search (Medium Effort)**
*   **What:** Add fuzzy search with autocomplete to the main dashboard.
*   **Value:** faster navigation for users with many items.
*   **Implementation:** Use `fuse.js` on frontend or PostgreSQL full-text search.

**2. Batch Operations (High Effort)**
*   **What:** Allow selecting multiple items and performing bulk actions (delete, export).
*   **Value:** Greatly improves efficiency for power users.

**3. Interactive Onboarding (Low Effort)**
*   **What:** specific walkthrough for new users using `driver.js`.
*   **Value:** Reduces churn and support questions.

## Next Steps

After presenting, ask the user:
*"Which of these resonates with you? I can treat your choice as a prompt for the **brainstorming** skill to verify the design."*
