# Project Manager (Castle Tech Tasks)

A cPanel-friendly, multi-user project/task manager with a modern UI and a zero-build deployment model.

This repository is designed for shared hosting environments where you have **PHP + MySQL** but **no shell access**, **no Node.js**, and **no Composer**. Everything is plain HTML/CSS/JavaScript on the frontend and plain PHP + PDO on the backend.

---

## Table of contents

1. [What this app does](#what-this-app-does)
2. [Key capabilities](#key-capabilities)
3. [Tech stack and architecture](#tech-stack-and-architecture)
4. [Repository structure](#repository-structure)
5. [Requirements](#requirements)
6. [Installation and first-run setup (cPanel)](#installation-and-first-run-setup-cpanel)
7. [Configuration reference](#configuration-reference)
8. [Authentication and authorization model](#authentication-and-authorization-model)
9. [API reference](#api-reference)
10. [Database schema](#database-schema)
11. [Frontend behavior and UX notes](#frontend-behavior-and-ux-notes)
12. [Operations: backup, update, and maintenance](#operations-backup-update-and-maintenance)
13. [Troubleshooting](#troubleshooting)
14. [Security notes](#security-notes)
15. [Known gaps / roadmap](#known-gaps--roadmap)
16. [Local development (optional)](#local-development-optional)

---

## What this app does

Project Manager is a browser-based collaboration app for small teams. It supports:

- multi-user sign in
- task tracking across multiple projects
- kanban/list/calendar/checklist/dashboard views
- assignees, labels, subtasks, comments, due dates, priorities, and estimates
- activity feed and profile management

It is intentionally implemented with a small backend and static frontend files so it can be uploaded directly via cPanel File Manager.

---

## Key capabilities

- **Views:** Dashboard, Kanban, List, My Tasks checklist, Calendar.
- **Task model:** title, description, project, status, priority, due date, estimate, assignees, labels, subtasks, comments.
- **Navigation & productivity:** quick add, global search (`Ctrl/Cmd + K`), new task shortcut (`Ctrl/Cmd + N`).
- **Auth:** session-based login/logout, optional self-serve registration gate, admin controls.
- **Admin APIs:** manage users, projects, and labels.
- **Activity tracking:** mutation events are logged and shown in the dashboard feed.

---

## Tech stack and architecture

### Frontend

- Vanilla JavaScript (ES2020 style, no framework)
- Plain CSS with token-like custom properties
- Inline SVG icon helpers
- Static HTML entry points:
  - `index.html` (main app)
  - `login.html`
  - `register.html`

### Backend

- PHP 8+
- PDO for database access
- JSON-only API endpoints in `api/*.php`
- Session/cookie-based auth

### Database

- MySQL / MariaDB
- Schema bootstrapped via `install.php`
- Uses foreign keys and indexed join tables for relationships

### Request flow at a glance

1. Browser loads static HTML/JS/CSS.
2. `assets/js/app.js` checks `auth.php?action=me`.
3. On success, frontend bootstraps projects/labels/users/tasks.
4. UI actions call API endpoints (`tasks.php`, `projects.php`, etc.).
5. Backend validates auth/role, mutates DB via prepared statements, returns JSON.

---

## Repository structure

```text
.
├── .htaccess
├── README.md
├── PLAN.md
├── CLAUDE.md
├── index.html
├── login.html
├── register.html
├── install.php
├── api/
│   ├── .htaccess
│   ├── config.php
│   ├── bootstrap.php
│   ├── db.php
│   ├── auth.php
│   ├── tasks.php
│   ├── projects.php
│   ├── labels.php
│   ├── users.php
│   └── activity.php
├── assets/
│   ├── css/
│   │   ├── app.css
│   │   └── auth.css
│   └── js/
│       ├── api.js
│       ├── app.js
│       ├── icons.js
│       ├── ui.js
│       └── views/
│           ├── dashboard.js
│           ├── kanban.js
│           ├── list.js
│           ├── checklist.js
│           ├── calendar.js
│           └── detail.js
└── design/
    ├── Castle Tech Tasks.html
    └── src/
```

`design/` is reference material for the original mockup and is not required for runtime.

---

## Requirements

- PHP **8.0+** (shared-host compatible)
- MySQL or MariaDB database
- cPanel (or equivalent) file upload access
- Apache with `.htaccess` enabled (recommended)
- HTTPS strongly recommended in production

No Node, no Composer, no CLI tools required for deployment.

---

## Installation and first-run setup (cPanel)

### 1) Create DB + DB user

In cPanel:

- open **MySQL Databases**
- create a DB (example: `cpaneluser_pm`)
- create a DB user
- grant **ALL PRIVILEGES** for that user on the DB

### 2) Upload project files

Upload repository contents into `public_html/` (or a subdirectory such as `public_html/pm/`).

Recommended: upload everything except non-runtime files (`design/`, `.git/`).

### 3) Configure credentials

Edit `api/config.php`:

- `db_name`
- `db_user`
- `db_pass`
- optionally `cookie_secure` (set true once HTTPS is enforced)

### 4) Run installer

Visit:

- `https://your-domain.com/pm/install.php`

Then:

- click **Run install** to create tables + seed defaults
- create your first admin account in installer form

### 5) Remove installer

Delete `install.php` after setup.

Then log in at:

- `https://your-domain.com/pm/login.html`

---

## Configuration reference

`api/config.php` keys:

| Key | Type | Description |
|---|---|---|
| `db_host` | string | DB host (usually `localhost` on cPanel). |
| `db_name` | string | Database name. |
| `db_user` | string | Database username. |
| `db_pass` | string | Database password. |
| `db_charset` | string | Charset (default `utf8mb4`). |
| `session_name` | string | Session cookie name. |
| `cookie_secure` | bool | Set `true` when serving over HTTPS only. |
| `cookie_samesite` | string | SameSite mode (`Lax` by default). |
| `allow_public_register` | bool | If `true`, anyone can register from `register.html`. |
| `app_name` | string | Display/application label. |
| `project_key` | string | Fallback task ref prefix. |

---

## Authentication and authorization model

### Sessions

- Auth is handled with PHP sessions.
- Session cookie is HttpOnly and configured in bootstrap.
- Login stores `$_SESSION['uid']`.
- Logout clears session and cookie.

### Roles

- `is_admin = 1` users are administrators.
- Admin-only operations include:
  - create/update/delete projects
  - create/update/delete labels
  - patch/delete users
  - create users when public registration is disabled

### Registration modes

- **Public registration off (default):** only admins can register new users through API.
- **Public registration on:** `register.html` can create accounts without admin session.

---

## API reference

Base path: `api/`

All endpoints return JSON. Errors are shaped as `{ "error": "..." }` with proper HTTP status.

### `auth.php`

Action via query parameter `?action=...`:

- `GET auth.php?action=me`
  - returns current user (or null) + registration flag
- `POST auth.php?action=login`
  - body: `{ email, password }`
- `POST auth.php?action=logout`
- `POST auth.php?action=register`
  - body: `{ name, email, password, role }`
- `POST auth.php?action=update_profile`
  - body: `{ name, role, color, password?, current_password? }`

### `tasks.php`

- `GET tasks.php`
  - list tasks with labels, assignees, subtasks, comment counts
- `POST tasks.php`
  - create task
- `GET tasks.php?id={id}`
  - single task
- `PATCH tasks.php?id={id}`
  - patch mutable fields
- `DELETE tasks.php?id={id}`

Subtasks:

- `POST tasks.php?id={taskId}&subtasks=1`
- `PATCH tasks.php?id={taskId}&subtask_id={subtaskId}`
- `DELETE tasks.php?id={taskId}&subtask_id={subtaskId}`

Comments:

- `GET tasks.php?id={taskId}&comments=1`
- `POST tasks.php?id={taskId}&comments=1`

### `projects.php`

- `GET projects.php`
- `POST projects.php` (admin)
- `PATCH projects.php?id={id}` (admin)
- `DELETE projects.php?id={id}` (admin)

### `labels.php`

- `GET labels.php`
- `POST labels.php` (admin)
- `PATCH labels.php?id={id}` (admin)
- `DELETE labels.php?id={id}` (admin)

Allowed label colors are constrained to:
`red, blue, amber, green, violet, slate, pink, cyan`.

### `users.php`

- `GET users.php`
- `PATCH users.php?id={id}` (admin)
- `DELETE users.php?id={id}` (admin, cannot delete self)

### `activity.php`

- `GET activity.php`
  - returns latest activity entries joined with user/task context

---

## Database schema

Created by `install.php`.

### Tables

- `users`
- `projects`
- `labels`
- `tasks`
- `subtasks`
- `task_assignees` (many-to-many)
- `task_labels` (many-to-many)
- `comments`
- `activity`

### Data relationships

- `tasks.project_id -> projects.id`
- `subtasks.task_id -> tasks.id`
- `task_assignees.task_id -> tasks.id`
- `task_assignees.user_id -> users.id`
- `task_labels.task_id -> tasks.id`
- `task_labels.label_id -> labels.id`
- `comments.task_id -> tasks.id`
- `comments.user_id -> users.id` (nullable, `ON DELETE SET NULL`)

### Seeded defaults

Installer seeds:

- 5 sample projects
- 8 labels matching supported UI color names

---

## Frontend behavior and UX notes

- Boot process fetches me/projects/labels/users/tasks in parallel.
- Last-selected view is stored in `localStorage` (`pm_view`).
- Current project filter is persisted (`pm_project`).
- Task drawer can be deep-linked via hash (`#task=<id>`).
- Activity feed refresh is debounced after mutations.
- API wrapper in `assets/js/api.js` normalizes error handling.

---

## Operations: backup, update, and maintenance

### Backup strategy

Minimum recommended routine:

1. database dump via hosting panel
2. copy of deployed files (`public_html/pm`)
3. secure copy of `api/config.php`

### Updating app code

Because there is no build step:

1. replace changed files in File Manager (or upload zip + extract)
2. hard refresh browser (`Ctrl/Cmd + Shift + R`)
3. optionally version-bust script/link URLs in HTML (e.g. `app.js?v=2`)

### Re-running installer safely

- `install.php` uses `CREATE TABLE IF NOT EXISTS` and can be re-run for idempotent schema creation.
- It includes a guard to prevent unauthorized reinstallation once an admin exists.

---

## Troubleshooting

### “Cannot connect to DB” in installer

- verify `db_host`, `db_name`, `db_user`, `db_pass` in `api/config.php`
- ensure DB user has privileges on the selected DB

### Login fails with correct credentials

- verify account exists in `users`
- confirm password length/creation path met requirements
- clear cookies/session and retry

### API returns 401 from app

- session expired or cookie blocked
- confirm same-origin deployment and HTTPS settings
- check `cookie_secure` is not true on non-HTTPS site

### Changes not visible after upload

- browser cache is stale
- force hard refresh

### Register page says registration disabled

- set `allow_public_register` to `true` temporarily, then revert to `false`

---

## Security notes

- Passwords are hashed with PHP `password_hash()` and verified with `password_verify()`.
- SQL calls use prepared statements through PDO helpers.
- Session cookie uses HttpOnly and configurable `SameSite`/secure attributes.
- `api/.htaccess` denies direct access to `api/config.php`.
- Keep `install.php` deleted after setup.
- Enforce HTTPS and set `cookie_secure = true` in production.

---

## Known gaps / roadmap

Current intentionally missing features (documented in `PLAN.md`):

1. file attachments
2. real-time multi-client updates
3. dedicated admin UI screens for users/projects/labels

Implementation guidance for these features is already drafted in `PLAN.md`.

---

## Local development (optional)

If you do have shell access, you can run a local PHP server for quick testing:

```bash
php -S 127.0.0.1:8000
```

Then open:

- `http://127.0.0.1:8000/install.php` (first run)
- `http://127.0.0.1:8000/login.html`

You still need a reachable MySQL/MariaDB database configured in `api/config.php`.

---

If you want, I can also add:

- an ER diagram section (ASCII + Mermaid)
- sample `curl` commands for every endpoint
- a migration/versioning checklist for future releases
- a short admin runbook for onboarding/offboarding teammates
