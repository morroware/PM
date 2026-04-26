# Castle Tech Readiness Audit (April 26, 2026)

## Scope

This pass focused on **code-level readiness** for handoff to the Castle tech team,
with executable static checks available in this environment (syntax + surface
verification). Full browser/database end-to-end verification still requires a
staging deployment.

## Checks executed

1. `./scripts/beta-smoke.sh`
   - PHP lint over `api/*.php` and `install.php`
   - JavaScript syntax check over `assets/js/**`
   - Admin Settings UI smoke assertions for Slack + recurring sections

## Result

- **Pass:** Static regression smoke completed with `beta-smoke: OK`.
- **No new blocking syntax/runtime parse issues** were identified in backend or
  frontend source during this run.

## Functional surface reviewed (code audit)

The following functional areas were reviewed at the code level to confirm
coverage and expected controls are in place:

- Authentication and profile update flows (`api/auth.php`, `api/bootstrap.php`).
- Task CRUD, subtasks, comments, bulk updates, and activity logging (`api/tasks.php`).
- Admin-only governance for projects/labels/slack/recurring endpoints.
- Attachment upload/download/delete handling and storage boundary checks.
- Frontend shell routing and modal/shortcut behavior (`assets/js/app.js`),
  plus per-view renderer presence under `assets/js/views/`.

## Release gate status for Castle team onboarding

**Recommended status: Conditionally ready for team onboarding in staging.**

Rationale:

- Static checks are clean in this audit pass.
- Existing regression checklist already defines the required end-to-end
  validation matrix for auth, CRUD parity across views, permissions,
  recurring behavior, and Slack integrations.
- This container cannot execute full browser + MySQL integration tests,
  so production sign-off should be contingent on running
  `docs/regression-checklist.md` in staging with seeded data.

## Required before production go-live

1. Run the full checklist in `docs/regression-checklist.md` against a live
   staging environment with real session/cookie settings.
2. Execute member-vs-admin authorization matrix checks (section 6).
3. Validate recurring + Slack side effects with realistic channels/tokens.
4. Confirm `install.php` and `seed.php` are removed/locked on production.

