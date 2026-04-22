# Project Manager — cPanel-friendly build

A multi-user project/task manager (Kanban / List / Calendar / Dashboard / My-Tasks).
Designed to run on any shared **cPanel** host with **PHP 8+** and **MySQL / MariaDB**
— no shell access, no Node.js, no Composer, no build step.

The UI matches the [original mockup](design/Castle%20Tech%20Tasks.html) from
Claude Design (preserved under `design/` for reference), reimplemented as
vanilla HTML/CSS/JavaScript on top of a small PHP + PDO backend.

## Stack

| Layer    | What                                                     |
|----------|----------------------------------------------------------|
| Frontend | Vanilla ES-2020 JavaScript, plain CSS (custom property tokens), inline SVG icons. Loaded from `<script src>` — no bundler. |
| Backend  | Plain PHP files, one per resource, using PDO. Sessions for auth. |
| Database | MySQL / MariaDB (any version shipped with cPanel for the last ~10 years). |
| Fonts    | Google Fonts CDN (`Inter`, `JetBrains Mono`) — swap to local if you're offline. |

## Deploy to cPanel in 5 steps (no shell needed)

1. **Create a MySQL database + user.**
   In cPanel → **MySQL Databases**: add a new DB (e.g. `cpaneluser_pm`), add a
   new user, set a strong password, and grant **ALL PRIVILEGES** on that DB.

2. **Upload files.**
   In cPanel → **File Manager**, go into `public_html` (or a subdirectory like
   `public_html/pm/`). Either:
   - **Drag & drop** the contents of this repository (everything except
     `design/`, `README.md`, and the `.git/` folder) into that directory, **or**
   - Compress this repo locally into a zip, upload the zip, then right-click →
     **Extract**.

3. **Edit `api/config.php`.**
   Right-click → **Edit** in File Manager. Fill in `db_name`, `db_user`,
   `db_pass` with the values from step 1. Save.

4. **Run the installer.**
   Visit `https://yourdomain.com/pm/install.php` (adjust the path).
   - Click **Run install** to create tables + seed projects/labels.
   - Fill out the form to create your **first admin user**.

5. **Delete `install.php`** from File Manager, then go to
   `https://yourdomain.com/pm/login.html` and sign in. Done.

## Post-install: adding teammates

By default, public registration is **off**. Two ways to add more users:

- **Flip the flag temporarily.** Edit `api/config.php` and set
  `'allow_public_register' => true`. Share `register.html` with your team,
  then turn it back off once everyone is in.
- **Create from the admin session.** While logged in as admin, POST to
  `api/auth.php?action=register` with `{name, email, password, role}`. A
  proper admin UI for this is a natural next improvement.

## File layout

```
/                       ← upload the contents of this directory to cPanel
├── index.html          ← main app (after login)
├── login.html          ← sign-in page
├── register.html       ← self-serve registration (gated by config)
├── install.php         ← one-time setup; DELETE after running
├── .htaccess           ← sets index.html as default, hides dotfiles
├── api/
│   ├── config.php      ← edit this with your MySQL credentials
│   ├── db.php          ← PDO connection helpers
│   ├── bootstrap.php   ← session + JSON helpers + auth guards
│   ├── auth.php        ← login / logout / register / me / update_profile
│   ├── tasks.php       ← task + subtask + comment CRUD
│   ├── projects.php    ← project CRUD (admin-only for writes)
│   ├── labels.php      ← label CRUD
│   ├── users.php       ← list / patch / delete team members
│   ├── activity.php    ← recent activity feed
│   └── .htaccess       ← denies direct access to config.php
├── assets/
│   ├── css/
│   │   ├── app.css     ← all app styling (token-based)
│   │   └── auth.css    ← login / register page styles
│   └── js/
│       ├── api.js      ← fetch wrapper
│       ├── icons.js    ← Lucide-style inline SVGs
│       ├── ui.js       ← h() helper + avatars, tags, popovers, pickers
│       ├── app.js      ← shell: sidebar, topbar, filters, quick-add
│       └── views/
│           ├── dashboard.js
│           ├── kanban.js
│           ├── list.js
│           ├── checklist.js
│           ├── calendar.js
│           └── detail.js
└── design/             ← original Claude Design mockup (reference only)
```

## Updating the app later

There's no build step, so editing a file in File Manager takes effect
immediately. Your browser may cache JS and CSS — hard-reload with
`Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac). For production cache-busting,
append `?v=2` (and bump the number) to the `<script>` / `<link>` tags in
`index.html`, `login.html`, and `register.html`.

## Security notes

- Sessions use an HttpOnly cookie. Set `cookie_secure` to `true` in
  `api/config.php` once your site is HTTPS-only.
- Passwords are bcrypt-hashed via `password_hash(PASSWORD_DEFAULT)`.
- All DB access goes through PDO prepared statements.
- `api/.htaccess` denies direct HTTP access to `api/config.php` — don't
  remove this file.
- Admin-only endpoints (creating projects/labels, changing another user's
  role, deleting users) check `is_admin` server-side.

## Features

- **Five views**: Dashboard (stats, workload, activity), Kanban (drag-drop),
  List (groupable + sortable), My-Tasks checklist, Month Calendar.
- **Task detail drawer** with inline-editable title/description/due/priority/
  status/assignees/labels/estimate, subtasks, and comments.
- **Filters**: project / assignee / labels, plus global search (`Ctrl+K`).
- **Saved views + bulk actions**: save personal filter presets and run list-view bulk updates (labels, status, due date).
- **Shortcuts**: `Ctrl+K` search, `Ctrl+N` new task.
- **Collaboration upgrades**: comment edit/delete (owner or admin moderation), @mention detection hooks, and richer Slack delivery diagnostics/retries.
- **Persistence**: view + project filter remembered in `localStorage`.

## Known gaps

- No file attachments. Straightforward to add: a `uploads/` directory and a
  small PHP endpoint. Skipped here to keep security surface minimal.
- No real-time updates. Reload or switch views to see changes from other
  users; polling or SSE would be an easy follow-up.
- Admin UI for user / project / label management is API-only for now.
