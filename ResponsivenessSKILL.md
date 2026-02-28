---
name: implementing-responsiveness
description: Implements responsive design strategies to ensure optimized layout and usability across all screen sizes (Mobile, Tablet, Desktop). Use when the UI is broken on small screens, or when starting a new frontend feature.
---

# Implementing Responsiveness

## Overview

Use this skill to transform desktop-only interfaces into fully responsive experiences. The strategy is almost always **Mobile-First**.

## Core Principles

1.  **Mobile-First:** Design for the smallest screen (e.g., `< 640px`) first. Add complexity as screen real estate increases (`min-width` media queries).
2.  **Fluid Layouts:** Use percentages (`%`), flex-grow (`flex: 1`), and CSS Grid (`fr`) instead of fixed pixels (`px`).
3.  **Media Queries:** Breakpoints should be content-driven, but standardized (e.g., specific to Tailwind or Bootstrap).
    *   **sm:** 640px (Mobile Landscape/Pro Max devices)
    *   **md:** 768px (Tablets)
    *   **lg:** 1024px (Small Laptops/Tablets in Landscape)
    *   **xl:** 1280px (Desktops)
    *   **2xl:** 1536px (Large Monitors)

## Implementation Strategies

### 1. Identify the Breakpoints (Tailwind Example)
Start with the base classes (mobile default). Then use `md:` or `lg:` specific overrides.

```jsx
// Bad: Desktop-first logic (verbose, harder to override)
<div className="flex-row max-md:flex-col">...</div>

// Good: Mobile-first logic
<div className="flex flex-col md:flex-row">
  <Sidebar className="w-full md:w-64" />
  <MainContent className="flex-1" />
</div>
```

### 2. Common Patterns

**The Stack-to-Row:**
*   **Mobile:** Items stack vertically (`flex-col`).
*   **Desktop:** Items flow horizontally (`flex-row`).
*   **Code:** `flex flex-col md:flex-row gap-4`

**The Hidden Toggle (Burger Menu):**
*   **Mobile:** Nav links are hidden; a hamburger button toggles a drawer/modal.
*   **Desktop:** Nav links are visible; hamburger button is hidden.
*   **Code:**
    *   Links: `hidden md:flex`
    *   Button: `block md:hidden`

**Grid Auto-Fit:**
*   Automatically reflow items based on available width without media queries.
*   **Code:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`

### 3. Typography Scaling
Reduce font sizes on small screens to prevent overflow and improve readability.
*   **Headings:** `text-2xl md:text-4xl lg:text-5xl`
*   **Body:** `text-sm md:text-base`

### 4. Testing Responsiveness

**Chrome DevTools:**
1.  Open DevTools (`Cmd+Opt+I`).
2.  Click the "Device Toolbar" icon (`Cmd+Shift+M`).
3.  Test standard presets: iPhone SE, iPad Mini, standardized Desktop (1280px, 1920px).
4.  **Throttle Network:** Test loading speeds on "Fast 3G".

**Visual Regression Checks:**
*   **Text Overflow:** Does long text break the layout? (Use `truncate` or `break-words`).
*   **Touch Targets:** Are buttons at least 44x44px heavily tapable on mobile?
*   **Horizontal Scroll:** Is there unwanted horizontal scrolling? (Check `overflow-x-hidden` on `body`).

## Remediation Workflow

When the user says "the UI looks broken on mobile":

1.  **Isolate Component:** Identify the specific component causing the issue.
2.  **Check Fixed Widths:** Search for `w-[500px]` or hardcoded widths. Replace with `w-full max-w-[500px]`.
3.  **Check Flex Direction:** If items are squashed, switch from `row` to `col` on small screens.
4.  **Check Padding/Margin:** Reduce heavy `p-10` to `p-4` on mobile.
