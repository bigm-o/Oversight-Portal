# Design Proposal: Dynamic Jira Project Alignment & Team Attribution

## 1. Problem Statement
Current implementation hardcodes only 4 Jira Projects (`SKP`, `IR`, `CASP`, `BARP3`) to fixed Teams.
However, Jira contains **112+ projects** (e.g., `NIP V3` [NCC], `Authentication Prompter` [SSP]), and tickets belong to these projects even if they lack an Epic link.
Tickets without Epics are currently orphaned or ignored if their Project isn't in the hardcoded list.

## 2. Proposed Solution
We need a dynamic system to discover Jira Projects, align them to our internal "Teams", and ensure every ticket has a home (even without an Epic).

### A. Dynamic Project Discovery
Instead of a static list, `JiraSyncService` will:
1. Fetch **all** visible Jira Projects (`GET /rest/api/3/project`).
2. Filter relevant projects (e.g., exclude `Service Desk` or archived, keep `Software`).
3. Create/Update a `Project` record in our DB for each Jira Project (representing the *Scope*, not just an Epic).
   * *Note:* Currently our DB `Project` entity represents an Epic. We might need a new entity `JiraProject` or use a "Root Project" concept.
   * *Recommendation*: Keep `Project` as Epic-level. Add a `JiraProjectKey` column to `Project` table.
   * `General Workload` projects will be created for each Jira Project to hold orphan tickets.

### B. Team Alignment Strategy
Since `customfield_10501` (Team) is often null (verified via API), we need a reliable mapping strategy:
1. **Unassigned Bucket**: New Jira Projects default to "Unassigned" Team.
2. **Admin Mapping**: A new UI in "User Management" or "Team Settings" to map Jira Projects -> Development Teams.
   * Example: Allocating `NIP V3` (NCC) to `Core Switching`.
3. **Smart Defaults**: Use `Project Category` (e.g., "Identity" -> Data & Identity Team) where possible.

### C. General Workload Module (Refined)
For every Jira Project (e.g., `NCC`):
1. Create a **"General Workload - NCC"** pseudo-Epic in the DB.
2. **Ticket Sync Logic**:
   * If `Epic Link` exists: Link to that specific Epic (Project).
   * If `Epic Link` is missing: Link to "General Workload - NCC".
   * Ensure the "General Workload" project is assigned to the same Team as the main Jira Project.

## 3. Implementation Steps
1. **Database Schema**:
   * Add `jira_project_key` to `projects` table (to group Epics).
   * Add `team_mapping` table or config (JiraKey -> TeamId).
2. **Backend**:
   * Update `JiraSyncService` to iterate `GetProjectsAsync()` instead of hardcoded dictionary.
   * Implement auto-creation of "General Workload" for *every* discovered project.
   * Implement "Smart Mapping" logic (Category-based).
3. **Frontend**:
   * Add "Unassigned Projects" view for Admins to assign teams.

## 4. Workflows Verification
* **User Onboarding**: Admins can now assign users to *specific* Jira Projects (via Teams) because all projects are visible.
* **Development Tracker**: "General Workload" rows will appear for every active project, ensuring no hidden work.

## 5. Sync Logic with JQL
* Updated JQL: `project in (ALL_KEYS) AND ...` or just fetch all updated issues and sort them into buckets in code.
* Paged fetching is required for 112+ projects.

---
**Does this approach align with your vision for "Jira Teams(Spaces)" alignment?**
**Specifically, do you want to manually map the 100+ projects, or should we filter strictly by "Software" type to reduce noise?**
