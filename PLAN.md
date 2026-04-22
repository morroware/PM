# Product Upgrade Plan (Customization + Reliability)

## Progress snapshot (updated April 22, 2026)

- ✅ **Phase 1 (stabilization):** regression checklist and end-to-end verification document exist in `docs/regression-checklist.md`.
- ✅ **Phase 2 (project management):** project CRUD, archive/unarchive, and admin project settings UI are implemented.
- ✅ **Phase 3 (labels/taxonomy):** label scope (global/project), duplicate protection by scope, usage-aware governance, merge/archive flows, typeahead label creation in task flows, and list-view bulk add/remove label operations are now implemented.
- 🔄 **Phases 4–7:** partially implemented in codebase, but still planned for completion/hardening per sections below.

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

---

## 14) Current state review (codebase snapshot)

Snapshot based on current repository implementation.

### 14.1 Already implemented (baseline to preserve)

- **Core app shell + multi-view task management exists**: dashboard, kanban, list, checklist, calendar, task drawer, filters/search, and activity polling hooks are wired in vanilla JS.
- **Project lifecycle is partially upgraded already**:
  - Project create/read/update/delete endpoints exist.
  - Archiving and `archived_at` exist.
  - Optional `description` and `slack_channel` exist.
  - Hard-delete guard rails exist (`force=1` required when tasks/rules are linked).
- **Label model is partially upgraded already**:
  - Label create/read/update/delete exists.
  - Project-scoped labels (`project_id`) and `archived` flag exist.
  - Duplicate-prevention by scope exists on create.
- **Comments are implemented and surfaced in UI**:
  - Comment CRUD route support (create/list in task detail).
  - Comment counts are included in task payload and displayed in list rows.
- **Slack integration foundation exists**:
  - Admin-only Slack settings endpoint exists.
  - Event toggle model exists (`task_completed`, `task_created`, `task_assigned`, `comment_added`, `project_archived`).
  - Test message flow and last-error/last-ok telemetry fields exist.
- **Recurring tasks foundation exists**:
  - `recurring_rules` table and CRUD API exist.
  - Cadences implemented (`daily/weekly/monthly/yearly`) with interval and end controls.
  - Lazy generation hook is integrated when a recurring task is marked done.

### 14.2 Partially implemented / gaps to close

- **No dedicated Admin/Settings UI yet** for projects, labels, users, Slack, and recurring rules; many features are API-capable but not first-class in product UX.
- **Comment collaboration parity is incomplete** (edit/delete own comments, moderation, and @mentions are not complete end-to-end).
- **Slack delivery reliability is basic**; we still need explicit retry/backoff policy definition, stronger diagnostics UI, and template customization.
- **Workflow customization is not exposed** (project-specific statuses, required fields by transition, and task templates).
- **Saved views, bulk operations, advanced reporting, and automation rules** are not yet implemented.
- **Regression process is still mostly manual and not codified into a release gate checklist in-repo.**

### 14.3 Architectural constraints confirmed

- No build tooling/framework dependency has been introduced.
- Backend remains endpoint-per-file PHP + PDO with cPanel-compatible deployment assumptions.
- Migration pattern remains idempotent via `install.php` helpers.

---

## 15) Completed implementation plan (execution-ready)

Use this as the canonical delivery plan going forward.

### Phase 0 — Stabilize and baseline (1 sprint)

1. Create `docs/regression-checklist.md` with release-gate smoke tests.
2. Add API/UI wiring verification checklist (auth, task CRUD, comments, subtasks, labels, projects, recurring, Slack test).
3. Add explicit role-boundary checks (admin/member) and expected HTTP status outcomes.
4. Add a short “known-good seed data” recipe for manual QA.

**Definition of done:** Every release runs a repeatable checklist with pass/fail outcomes recorded.

### Phase 1 — Admin settings surface (1–2 sprints)

1. Add a new in-app **Settings/Admin** area.
2. Implement project management UI:
   - create/edit/archive/unarchive
   - optional color/key/description/slack channel
   - archive confirmation with task/rule impact summary
3. Implement label management UI:
   - create/edit/archive/unarchive
   - global vs project-scoped labels
   - in-use count + safe-archive prompts
4. Add recurring rules management UI (list/create/edit/pause/delete).
5. Add Slack settings UI (token save/rotate, test connection, event toggles, default channel).

**Definition of done:** All already-supported admin APIs are reachable from UI without external tools.

### Phase 2 — Collaboration hardening (1 sprint)

1. Upgrade comments:
   - edit/delete own comments
   - admin moderation controls
   - stronger thread UX for long discussions (pagination/load-more)
2. Add comment badges in remaining views where absent.
3. Add mention parsing and mention notification model (in-app first, Slack optional).

**Definition of done:** Comment workflows are consistent across task entry points and safe for team-scale usage.

### Phase 3 — Slack reliability + customization (1 sprint)

1. Add per-event delivery status history visible in admin diagnostics.
2. Add bounded retry strategy for transient Slack API failures.
3. Add per-project channel overrides in settings UX.
4. Add simple template placeholders for message customization.

**Definition of done:** Slack failures are observable, non-blocking, and operationally manageable.

### Phase 4 — Productivity parity features (2 sprints)

1. Saved views/filters per user.
2. Bulk operations (status/assignee/labels/due date).
3. Configurable status workflow per project.
4. Task templates.
5. Calendar interaction upgrades (drag-to-reschedule).

**Definition of done:** Teams can model distinct project workflows and execute high-volume edits efficiently.

### Phase 5 — Reporting + automations (1–2 sprints)

1. Workload and progress reporting refinements.
2. Rule-lite automations with guarded triggers/actions.
3. Recurring reminder windows (timezone-aware, quiet-hours aware).

**Definition of done:** Operational visibility and low-code automations support routine project management at scale.

---

## 16) Priority matrix (current)

### Must-have next

- Regression checklist in-repo.
- Settings/Admin UI for existing project/label/slack/recurring capabilities.
- Comment edit/delete + moderation.

### Should-have next

- Slack diagnostics + retries + template controls.
- Saved views + bulk edit operations.

### Could-have after

- Workflow-required fields by transition.
- Advanced reporting and automation/rule engine.
