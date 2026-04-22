# Product Upgrade Plan (Customization + Reliability)

This plan replaces the prior “known gaps only” scope with a full product upgrade roadmap focused on:

1. **Project customization** (create/rename/archive projects, richer labels, configurable workflows)
2. **Slack collaboration** (bot-token channel alerts for project/task events and comments)
3. **Team productivity parity** with tools like Monday/Asana (without breaking cPanel constraints), including recurring work
4. **Reliability hardening** (confirm existing features are wired and working end-to-end)

The implementation must preserve repo constraints in `CLAUDE.md`: no build step, no Node/Composer, vanilla JS + PHP, cPanel-friendly deployment.

---

## 0) Product goals and non-goals

### Goals

- Make the app **highly configurable** for real team workflows.
- Reduce tool switching by integrating core updates into Slack.
- Improve collaboration with task comments, project-level conventions, and clearer governance.
- Support recurring operational workflows (weekly/monthly/yearly tasks) with optional reminder automation.
- Increase confidence by adding systematic verification that all existing and new flows are fully wired.

### Non-goals (for now)

- Re-platforming to a framework.
- Introducing background workers/queues requiring shell daemons.
- Deep enterprise features (SSO/SCIM/custom app marketplace).

---

## 1) Foundation and validation first (stabilization sprint)

Before adding new UX, verify current behavior and fix wiring gaps so we don’t layer features on unstable foundations.

### 1.1 End-to-end baseline audit

Create a **manual + script-assisted test matrix** for all existing capabilities:

- Authentication: login/logout/register/profile update/role constraints.
- Views: Dashboard, Kanban drag/drop, List grouping/sorting, Checklist, Calendar.
- Task detail drawer: title, description, due date, priority, status, assignees, labels, estimate, subtasks, comments.
- Filters + search + keyboard shortcuts.
- Activity feed consistency.

### 1.2 API/UI wiring checks

For each feature above, confirm:

- API endpoint exists and is permission-guarded correctly.
- API response shape matches frontend expectation.
- UI updates local state consistently and survives refresh.
- Errors are surfaced via user-facing toast/inline feedback.

### 1.3 Regression suite definition

Define a light “no-build” regression checklist runnable during each release:

- Smoke tests for all critical paths.
- Role-based authorization checks (admin vs member).
- Data integrity checks (FK cascades and retained history behavior).

**Exit criteria:** team can run a repeatable checklist and trust current app behavior before feature expansion.

---

## 2) Project management upgrades

### 2.1 Project lifecycle management

Add complete project controls in UI and API:

- Create new project.
- Rename/edit project metadata.
- Archive/unarchive project (prefer archive over hard delete).
- Optional project color/icon for visual organization.
- Optional project owner and default assignees.

### 2.2 Project settings panel

Introduce a project settings experience (admin + delegated owners):

- Project name/key/description.
- Status model and default task fields for that project.
- Notification preferences (Slack channel mapping, event toggles).

### 2.3 Guardrails and migration behavior

- Prevent deleting/archiving active projects without confirmation and impact summary.
- Define behavior for existing tasks when project settings change.
- Add audit logs for project-level administrative actions.

---

## 3) Labels and taxonomy upgrades

### 3.1 Label CRUD improvements

Support richer label creation and maintenance:

- Create labels from task UI and project settings.
- Rename, recolor, merge, archive labels.
- Label scope modes:
  - Global labels
  - Project-scoped labels

### 3.2 Label governance

- Reserved/system labels (optional).
- Duplicate prevention (`name + scope`).
- Usage counts and “safe to archive” hints.

### 3.3 Better label UX

- Typeahead creation (“create label ‘Blocked’”).
- Label filtering improvements across all views.
- Bulk add/remove labels in list view for multiple tasks.

---

## 4) Comments and collaboration upgrades

### 4.1 Universal task comments

Ensure comments are consistently available from every task entry point:

- Detail drawer (existing, upgraded UX).
- Quick-access comments preview from list/kanban cards.
- Comment count badges in all major views.

### 4.2 Comment capabilities (phased)

- Phase A: Create + read comments reliably.
- Phase B: Edit/delete own comments; admin moderation controls.
- Phase C: @mention teammates and surface mention notifications.

### 4.3 Collaboration quality

- Timestamp and author clarity.
- Optional markdown-lite formatting.
- Large-thread usability (pagination/load more).

---

## 5) Slack integration (bot token + channel alerts)

### 5.1 Integration model

Provide workspace-level Slack settings:

- Bot token storage in server config/DB with secure handling.
- Connectivity validation (“test connection” and “test message”).
- Default channel and optional per-project channel overrides.

### 5.2 Event routing

Configurable events:

- Task completed.
- Project completed/archived.
- New task comments.
- Optional: task assigned, due date changed, priority escalated.

Each event should support:

- Enable/disable toggle.
- Channel target selection.
- Message template customization (basic placeholders).

### 5.3 Delivery reliability and safety

- Non-blocking UX: Slack failures should not block task/project saves.
- Retry policy for transient errors (within request-safe limits).
- Error logging visible to admins (last delivery status per event).
- Rate-limit awareness and graceful degradation.

### 5.4 Security

- Keep bot tokens out of frontend payloads and logs.
- Restrict integration settings to admin roles.
- Document token rotation process and revocation fallback.

---

## 6) “Asana/Monday-like” customization roadmap

Implement in pragmatic phases for maximum value with minimal risk.

### 6.1 Workflow customization

- Configurable status columns per project.
- Optional required fields by status transition.
- Task templates (e.g., Bug, Feature, Onboarding).

### 6.2 Views and productivity

- Saved filters/views per user.
- Bulk operations (status/assignee/labels/due date).
- Better calendar planning controls (drag to reschedule).

### 6.3 Planning and reporting

- Project progress indicators and health states.
- Workload balancing insights by assignee.
- Time estimate vs completion reporting.

### 6.4 Automations (rule-lite)

Simple “if-this-then-that” rules without external workers:

- When status changes to Done -> notify Slack.
- When due date is within X days and not done -> mark at-risk label.
- When comment contains @mention -> notify user + optional Slack ping.

### 6.5 Recurring tasks and optional reminders

Add first-class recurring task support with predictable generation behavior:

- Cadences: daily, weekly, monthly, yearly, plus “every N” interval variants.
- End conditions: never ends, ends on date, ends after N occurrences.
- Generation mode:
  - Rolling single-instance (create next when current is completed).
  - Pre-generated horizon (e.g., next 4 occurrences for planning views).
- Date rules:
  - Monthly by day-of-month (with short-month handling policy).
  - Weekly by weekday(s).
  - Yearly by month/day.
- Ownership/assignment inheritance rules from parent recurring template.

Reminder model (optional and configurable):

- In-app reminders per occurrence (e.g., 1 day before, day-of, overdue).
- Optional Slack reminders per recurrence rule or per task instance.
- Quiet hours / timezone-aware send windows to avoid noisy off-hours alerts.
- “Skip once” and “pause recurrence” controls to handle holidays/exceptions.

---

## 7) Data model and API evolution plan

Design changes should be additive and backwards-compatible where possible.

### 7.1 Schema evolution principles

- Use idempotent migration style consistent with `install.php`.
- Prefer `archived_at` soft lifecycle fields for projects/labels before hard deletes.
- Add settings tables for integrations and notification rules.
- Add recurrence tables/fields to track templates, next-run cursor, and generated instances safely.

### 7.2 API versioning strategy (lightweight)

- Maintain current endpoints; extend response payloads carefully.
- Add fields rather than replacing keys when possible.
- Document contract changes in `README.md` and release notes.

### 7.3 Activity/audit expansion

- Log admin actions (project rename/archive, label merges, integration edits).
- Distinguish user-facing feed events from admin audit events if needed.

---

## 8) UI/UX upgrade plan

### 8.1 Information architecture

Add a clear **Settings/Admin** area with sections for:

- Users & roles
- Projects
- Labels
- Integrations (Slack)
- Automation rules (future)

### 8.2 Interaction standards

- Consistent dialogs for create/rename/archive actions.
- Inline validation with clear error messages.
- Optimistic updates where safe; fallback to refetch on conflict.

### 8.3 Accessibility and polish

- Keyboard focus management in modals/drawers.
- ARIA labels for controls and icons.
- Color contrast checks for label chips/status badges.

---

## 9) Quality, reliability, and release process

### 9.1 Test plan categories

- Functional: every feature path.
- Permission/security: role boundaries and endpoint access.
- Integration: Slack connectivity and event delivery.
- Recurrence: schedule generation correctness, DST/month-end edge cases, and reminder timing.
- Regression: existing view behavior unchanged.
- Data integrity: project/label lifecycle effects on related tasks.

### 9.2 Rollout strategy

- Feature-flag major additions (Slack + advanced customization).
- Ship in small increments:
  1) Foundation validation + project/label CRUD UX
  2) Comment reliability + Slack core events
  3) Workflow customization + bulk/saved views
  4) Recurring tasks + optional reminders
  5) Automation + richer reporting

### 9.3 Observability

- Admin-visible diagnostics page:
  - Last API errors
  - Slack delivery failures
  - Version and schema status

---

## 10) Priority roadmap (recommended)

### Milestone A — “Core Admin Control” (High priority)

- Project create/rename/archive UI + API hardening.
- Label create/rename/archive + project-scoped labels.
- Baseline regression checklist for existing features.

### Milestone B — “Team Collaboration” (High priority)

- Universal comments improvements + comment badges.
- Slack bot token setup + channel mapping.
- Slack events for task complete + new comments.
- Recurring task templates with weekly/monthly/yearly cadence support.

### Milestone C — “Operational Maturity” (Medium priority)

- Project completion alerts and configurable event matrix.
- Admin audit trail and integration diagnostics.
- UI consistency/accessibility pass.
- Optional Slack reminders for recurring tasks with timezone-safe delivery windows.

### Milestone D — “Advanced Customization” (Medium priority)

- Configurable workflows/statuses per project.
- Saved views and bulk edits.
- Rule-lite automations.

---

## 11) Acceptance criteria for this upgrade program

The initiative is successful when:

- Teams can create and rename projects and manage labels fully in UI.
- Slack alerts reliably fire for configured task/project/comment events.
- Recurring tasks generate correctly on schedule, with optional Slack reminders working when enabled.
- Comments are easily accessible across all task surfaces.
- Existing functionality remains stable (validated by regression checklist).
- Admins can configure the system without API-only workarounds.

---

## 12) Documentation updates required alongside implementation

For each shipped milestone, update:

- `README.md` feature list and setup instructions.
- Integration setup docs (Slack token scopes, channel setup, troubleshooting).
- “What changed” section with any migration/re-run `install.php` instructions.

---

## 13) Risk register

- **Slack API failure/rate limits** → non-blocking sends + retries + visible admin logs.
- **Scope creep** from “Asana-like” breadth → strict phased delivery with acceptance criteria per milestone.
- **Permission bugs** in new admin UI → explicit role tests for every write endpoint.
- **UI regressions** due to expanded state complexity → mandatory regression checklist before release.
- **Recurrence edge cases** (DST, month-end, leap year, missed runs) → canonical scheduling rules + deterministic tests.
