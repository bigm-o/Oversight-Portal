# Design Specification: SLA & Executive Governance Redesign
**Date**: 2026-02-25
**Status**: Draft

## 1. Vision
To transform the current data-heavy pages into "Insight-First" dashboards that provide immediate situational awareness for executives and management. The focus is on **Stability vs. Velocity** and **Institutional Health**.

## 2. SLA Compliance Redesign

### Layout
- **Top Row**: 3 KPI Cards (Overall Compliance, Total Active Breaches, Overdue Value Weight).
- **Left Panel (60%)**: **SLA Breach Heatmap**. A visual matrix of teams vs. priority levels.
- **Right Panel (40%)**: **Institution Health Treemap**. Interactive tiles representing the status of different banks (institutions).
- **Bottom Row**: **Breach Aging Histogram** & **Justification Action Log**.

### Key Visualizations
1. **The Heatmap**: Uses `recharts` or custom CSS Grid.
   - Axes: `[L1, L2, L3, L4]` (Levels) vs. `[Collections, Core, Switch, etc.]` (Teams).
   - Color: Dynamic HSL interpolation based on breach density.
2. **Treemap**: Visualizes the distribution of service requests across clients. 
   - Size = Ticket Volume.
   - Color = Breach Percentage.
3. **Aging Chart**: Grouping `updated_at - sla_due_date` into categorical buckets.

---

## 3. Executive Dashboard Redesign

### Vision: The "North Star" Dashboard
A central source of truth showing the correlation between development output and operational stability.

### Key Components
1. **Stability vs. Velocity Pulse (Dual Axis)**:
   - **X-Axis**: Date (Weekly).
   - **Y1 (Bars)**: Total Delivery Points (Value delivered).
   - **Y2 (Line)**: Incident Count (Operational friction).
   - *Insight*: If the line goes up while bars go up, we have a quality problem. If the line drops while bars go up, we have an efficiency gain.
2. **Accountability Leaderboard**:
   - Table showing Teams ranked by a "Health Score" (weighted average of points, compliance, and resolution time).
   - Includes 7-day trend sparklines.
3. **Infrastructure Governance Tracker**:
   - High-level overview of sync status and system health indicators.

---

## 4. Technical Requirements

### Backend (C# / Dapper)
New analytical endpoints in `GovernanceController`:
- `GET /api/governance/analytics/institution-health`: Returns `{ institution, total, breached, compliantPercentage }`.
- `GET /api/governance/analytics/team-matrix`: Returns `{ team, priority, breachCount }`.
- `GET /api/governance/analytics/trends`: Returns 30-day snapshot of volume vs. compliance.

### Frontend (React / Recharts)
- Implementation of `Treemap` and `ComposedChart` components.
- Modernized CSS using `Glassmorphism` effects for card backgrounds.
- Enhanced tooltips for deeper data exploration on hover.

## 5. Success Criteria
1. Executives can identify the "Worst Performing Institution" in under 5 seconds.
2. Management can identify the specific team holding up L4 Dev tickets instantly.
3. The page "WOWs" the user as per design aesthetics guidelines.
