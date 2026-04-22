# Known-Gaps Implementation Plan

This plan covers the three deliberately-unimplemented features listed in
`README.md:125-131`:

1. File attachments on tasks
2. Real-time updates across clients
3. Admin UI for user / project / label management

Every proposal preserves the repo's hard constraints (no build step, no
Composer, no Node, cPanel-editable files only; see `CLAUDE.md`). Each
section is self-contained so the three can ship in any order or in
parallel PRs.

---

## Gap 1 — File attachments

### Goal

Let any authenticated user attach files to a task (images, docs, logs),
see them in the task detail drawer, download them, and delete their own
uploads. Admins can delete any upload.

### Constraints & threats

- Shared cPanel host: no S3, no object store, no antivirus daemon. Files
  live on disk next to the app.
- Must not turn `uploads/` into a public code-execution directory. PHP,
  HTML, SVG (with inline `<script>`), and `.htaccess` are all hostile if
  served back with the wrong `Content-Type` or as executables.
- Must not expose arbitrary filesystem reads. Download path must route
  through PHP and check auth + ownership.
- Free-tier cPanel disk is small; cap size per file and total.

### Schema

New table, added to `pm_install_schema` in `install.php`:

```sql
CREATE TABLE IF NOT EXISTS attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NULL,                    -- uploader; NULL if user deleted
    original_name VARCHAR(255) NOT NULL, -- what the user saw
    stored_name   VARCHAR(80)  NOT NULL, -- random, on disk
    mime_type     VARCHAR(120) NOT NULL,
    size_bytes    INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_att_task (task_id),
    CONSTRAINT fk_att_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Storage layout

- Directory: `uploads/` at the repo root, created by `install.php` with
  mode `0775`. Protected by a dedicated `uploads/.htaccess`:

  ```apache
  # Deny direct script execution in the uploads folder.
  <FilesMatch "\.(php|phtml|phar|pl|py|cgi|rb|jsp|asp|aspx|sh)$">
      Require all denied
  </FilesMatch>
  # Strip default PHP handler in case the FilesMatch is bypassed.
  <IfModule mod_php7.c>   php_flag engine off </IfModule>
  <IfModule mod_php.c>    php_flag engine off </IfModule>
  # Force safe Content-Type on served files — keep this when adding
  # direct-serve later; for now all reads go through api/attachments.php.
  Options -Indexes -ExecCGI
  ```

- File naming: `stored_name = bin2hex(random_bytes(16)) . '.' . $safeExt`.
  Never reuse the user's filename; keep the original only in the DB
  column we render in the UI.
- Per-task subdir optional (e.g. `uploads/t<id>/…`) if we ever need
  cleanup by task; start flat to keep it simple.

### New endpoint: `api/attachments.php`

Follows the same shape as the other resource files.

- `GET  api/attachments.php?task_id=N` — list attachments for a task
  (authenticated).
- `POST api/attachments.php?task_id=N` — multipart upload; one file per
  request (the drawer can loop for multi-select). Validation:
  - `pm_require_auth()`.
  - Confirm task exists.
  - Inspect `$_FILES['file']['error']`, cap size (e.g. 10 MiB per file
    via config flag `upload_max_bytes`, default `10 * 1024 * 1024`).
  - Re-derive MIME via `finfo_file($tmp, FILEINFO_MIME_TYPE)`. Whitelist
    a conservative set: images, PDFs, text, office docs, archives.
    Reject SVG (inline scripts), `text/html`, anything unrecognised.
  - Sanitise the extension against the detected MIME (build an inverse
    map; reject mismatches).
  - `move_uploaded_file()` into `uploads/…`. On failure, do not leave
    orphan DB rows.
  - Return the row + public shape.
  - `pm_log_activity($uid, $task_id, 'attached', $original_name)`.
- `GET  api/attachments.php?id=N` — stream the file back:
  - Auth check.
  - Look up row + stored_name from DB.
  - `header('Content-Type: ' . $mime)`,
    `Content-Disposition: inline; filename="<sanitised original>"`
    (attachment for non-preview types).
  - Add `X-Content-Type-Options: nosniff`,
    `Content-Security-Policy: default-src 'none'`.
  - `readfile()` with `header('Content-Length: ' . filesize)`.
- `DELETE api/attachments.php?id=N` — owner-or-admin; `unlink()` then
  delete the row. Tolerate missing file.

### Config additions (`api/config.php`)

```php
'upload_max_bytes' => 10 * 1024 * 1024,
'upload_mime_whitelist' => [
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/csv',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
],
```

### API.js additions

```js
listAttachments(taskId) { return this.get(`attachments.php?task_id=${taskId}`); }
uploadAttachment(taskId, file) {
  const fd = new FormData();
  fd.append('file', file);
  // FormData upload: bypass the JSON wrapper in API.request().
  return fetch(`${this.base}/attachments.php?task_id=${taskId}`, {
    method: 'POST', body: fd, credentials: 'same-origin',
  }).then(async r => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { status: r.status });
    return j;
  });
}
deleteAttachment(id) { return this.del(`attachments.php?id=${id}`); }
attachmentUrl(id) { return `${this.base}/attachments.php?id=${id}`; }
```

### UI: task detail drawer (`assets/js/views/detail.js`)

Add an "Attachments" section between Subtasks and Comments:

- Drag-drop zone + `<input type="file" multiple>` (falls back on iOS).
- List existing attachments with filename, size, uploader, time, download
  icon (links to `attachmentUrl`), delete icon (owner / admin only).
- Inline previews for images (thumbnail) via the same endpoint.
- Uses the same `pm_log_activity` path so the dashboard feed notes the
  upload.

`state.tasks[*].attachments_count` can be added to the `tasks.php` list
shape (another small query grouped like `comments`) so the drawer head
can show `📎 3` without an extra request; initial list fetch happens on
drawer open (same pattern as comments caching — see
`window._pmCommentsCache` in `detail.js:4`).

### Install/migration steps

- `install.php`:
  - Add the `CREATE TABLE IF NOT EXISTS attachments` to
    `pm_install_schema`.
  - Create `uploads/` directory and drop the `.htaccess` file into it
    programmatically the first time (idempotent check on existence).
- README: document the `uploads/` folder write-permission requirement
  and the ability to tune `upload_max_bytes`.

### Testing checklist

- Upload small + near-limit + over-limit files; verify rejection + 413.
- Upload `evil.php` renamed to `.jpg` — confirm MIME sniff rejects.
- Delete an attachment as non-owner / non-admin → 403.
- Delete a task → attachments cascade → files orphaned on disk; add a
  cleanup step in the task-delete handler (`pm_delete_task` in
  `api/tasks.php:249`) that `SELECT`s attachment paths before the task
  DELETE and `unlink()`s them after the row cascades.
- Hit `uploads/foo.php` directly → 403 from Apache.
- Sign out, hit `api/attachments.php?id=…` → 401.

### Effort

~1 day. Biggest risks are MIME whitelisting and making sure shared-host
Apache honours the `uploads/.htaccess` rules. Keep the whitelist
conservative and document how to extend it.

---

## Gap 2 — Real-time updates

### Goal

When teammate A changes a task, teammate B's open browser reflects the
change within ~5 seconds without a manual reload. Works on vanilla shared
cPanel hosting (no websockets, no long-lived worker processes guaranteed).

### Why polling beats SSE here

- cPanel hosts frequently kill scripts exceeding `max_execution_time`
  (typically 30 s) and PHP-FPM workers are shared — an SSE connection
  pinning a worker per client is a bad fit for a free-tier box.
- HTTP/1.1 browsers limit connections per origin; a long-lived SSE stream
  eats one of six.
- The app is already stateless; polling is trivial to add and easy to
  turn off. Start here; upgrade to SSE only if polling cost becomes an
  issue.

**Decision**: incremental polling with ETag-style cheap dedup, every
~8 s while the tab is visible, backoff when hidden.

### Schema

Reuse the existing `activity` table as a change feed. Every mutation path
in `api/tasks.php` already calls `pm_log_activity`; extend comparably for
`projects.php`, `labels.php`, `users.php`, `attachments.php` for write
actions that should broadcast. Add an index:

```sql
ALTER TABLE activity ADD INDEX idx_act_id (id);
-- already the PK, but double-checking because InnoDB clusters on PK and
-- we'll query `WHERE id > ? ORDER BY id ASC LIMIT 100`.
```

Optional, cheaper path: add a dedicated `changes` table with fewer
columns (`id BIGINT PK AUTO_INCREMENT`, `kind ENUM`, `ref_id INT`,
`created_at`). Defer until polling lag justifies it.

### New endpoint: `api/changes.php`

```
GET api/changes.php?since=<lastSeenActivityId>
  ← { "cursor": <max_id>, "changes": [ { "kind": "task|comment|...", "id": N }, ... ] }
```

- `pm_require_auth()`.
- If `since` is null (first call), return `cursor = MAX(activity.id)` and
  `changes = []`. Clients are then bootstrapped for the diff loop.
- Otherwise SELECT the activity rows with `id > ?` (cap at 100). Collapse
  rows per `(kind, ref_id)` so the client only re-fetches each affected
  entity once.
- Add `Cache-Control: no-store` (the bootstrap already sets it) and a
  short-circuit `304` when `since == MAX(id)` to keep responses tiny.

### Client changes (`assets/js/app.js`)

- Add `state.changeCursor = null`.
- On boot, call `API.getChanges(null)` once to seed the cursor.
- Start a poll loop:

  ```js
  let pollTimer = null;
  function startPolling() {
    stopPolling();
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await API.getChanges(state.changeCursor);
        state.changeCursor = r.cursor;
        if (r.changes.length) applyChanges(r.changes);
      } catch (_) { /* swallow; next tick retries */ }
    };
    pollTimer = setInterval(tick, 8000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });
  }
  ```

- `applyChanges(changes)` branches on `kind`:
  - `task` / `subtask` / `comment` / `attached` → refetch the affected
    task via `API.get('tasks.php?id=' + id)` and merge into
    `state.tasks`. If the drawer is open on that task, redraw. If a
    comment affected the open task, invalidate
    `window._pmCommentsCache[task.id]` and re-fetch.
  - `project|label|user` → call the respective `list*` method and replace
    the collection in `state`.
  - `deleted` → drop the row from `state.tasks`; if the drawer was
    showing it, close the drawer and toast "This task was deleted".
- Re-render only when at least one change actually affected visible
  state (compare before/after JSON length; it's a tiny app).
- Expose `window.pmStopPolling()` so we can disable during tests and
  `state.pollIntervalMs` (default 8000) for debugging.

### Conflict handling

The UI already optimistically updates on user action. With polling we can
get a server version that disagrees with a field the user is mid-edit.
Rules:

- When the drawer is open and the user's textarea/input has focus, skip
  overwriting that specific field (check `document.activeElement`'s
  `dataset.field` attribute; add `data-field="description"` etc to the
  inputs in `detail.js`).
- For everything else, last-write-wins — accept the server's row.

### Testing checklist

- Two browsers side-by-side: status change in A appears in B within one
  poll cycle.
- Background tab for 5 minutes → foreground → tick immediately fires.
- DB unreachable → polling logs but never spams the user.
- Delete a task in A while it's open in B → drawer closes, toast shown.
- Field-edit conflict: user typing in description in B while A saves —
  B's in-flight buffer is not clobbered.

### Effort

~0.5 day for the happy path, +0.5 day for the conflict-handling polish.

---

## Gap 3 — Admin UI

### Goal

Give admins a settings page to manage users, projects, and labels through
the UI instead of `curl`. Non-admins should not see the page at all.

### Layout

Add an "Admin" entry in the sidebar footer menu (or as an extra
view-tab gated by `state.me.is_admin`). Picked in that order because the
topbar / filters row is already busy on narrow screens. Route key:
`state.view = 'admin'`. Persisted like every other view.

The admin page has three tabs, rendered in a new
`assets/js/views/admin.js` file added to `index.html` before `app.js`:

1. **Users** — table of all users; columns: avatar, name, email, role,
   admin toggle, actions. Buttons:
   - `Invite user` → modal that posts to
     `auth.php?action=register` (admin path allows arbitrary roles). On
     success, show the one-time password (admin set) or a generated
     temporary one that the admin copies to share.
   - Row actions: edit name/role/color, toggle `is_admin`, delete
     (confirm; blocks self-delete, mirrors `api/users.php:17`).
2. **Projects** — list of projects with add / edit / archive / delete;
   wraps `api/projects.php`. Name, color swatch picker, `key_prefix`
   (validated `^[A-Z0-9]{1,8}$`; surface the server-side rule in the
   form).
3. **Labels** — list of labels using the eight allowed colors
   (`api/labels.php:19`). Add / rename / recolor / delete.

### Client-side guard

`renderApp` refuses to even render the admin view unless
`state.me.is_admin` is true. This is a UX affordance only — all writes
are already guarded server-side in the respective PHP files.

### API additions

Most endpoints exist. Two small gaps to close first:

- `api/users.php` currently doesn't handle `GET api/users.php?id=N`. Add
  a single-user GET so the edit modal can hydrate without scanning the
  list. (Trivial.)
- Admin-invite flow: `auth.php?action=register` already works when the
  caller is an admin (see `auth.php:44-47`). Add an optional `is_admin`
  pass-through from the body so an invited user can be created as an
  admin in one call. Without it, the admin has to PATCH the user
  afterwards — acceptable but clunky.

### File plan

- New: `assets/js/views/admin.js` — one `renderAdmin(state, handlers)`
  function; internal tab state via closure; posts through the existing
  `API.*` methods.
- Edit: `assets/js/app.js`
  - Add `'admin'` to the view switch in `renderMain` (guarded by
    `state.me.is_admin`).
  - Add a sidebar-footer "Admin" shortcut icon, visible only for admins.
- Edit: `index.html` — add the `<script src>` tag.
- Edit: `assets/js/api.js` — add `inviteUser`, `updateUser`,
  `deleteUser`, `createProject`, `updateProject`, `deleteProject`,
  `createLabel`, `updateLabel`, `deleteLabel`. Most of these are
  one-liners over the existing `post/patch/del` helpers.
- Edit: `api/users.php` — implement the `GET ?id=N` branch, admin-only.
- Edit: `api/auth.php` — allow `is_admin` in `register` only when the
  caller is already admin.

### UX details

- Color picker for projects reuses the profile-modal palette in
  `app.js:621`.
- Label color picker uses the eight-color named list; map names to the
  same hex values used in `labelCssColor` (`app.js:291-295`).
- After any write, re-fetch the full collection (`list*`) and replace
  `state.projects` / `state.labels` / `state.users`. Toast on success
  and error.
- The admin page is the only place that can flip `is_admin`; hide the
  control from the current user's own row (you can't demote yourself
  while you're logged in).

### Testing checklist

- Non-admin visits `#admin` (or clicks the entry) → nothing happens;
  they stay on their previous view.
- Admin adds a user → appears in assignee picker immediately without a
  full reload (state list was updated).
- Admin archives a project → it disappears from the sidebar and filter
  pills (projects endpoint already filters `archived = 0`).
- Delete a label that's attached to tasks → cascade removes the join
  rows; verify task tag chips disappear on next render.
- Delete a user referenced by comments / activity → comments survive
  with "Former teammate" author (matches
  `pm_comment_shape` in `tasks.php:299`).

### Effort

~1 day, mostly UI scaffolding. The backend is already 90% there.

---

## Sequencing recommendation

1. **Admin UI first** — no new security surface, pure frontend wiring
   on top of already-hardened endpoints. Ships in a day and removes the
   main "API-only" papercut.
2. **Real-time updates second** — independent of everything else, and
   unlocks the collaborative feel that justifies the other two features.
3. **File attachments last** — biggest security surface; lands better
   once we have the admin UI to manage per-user storage quotas (a
   possible v2 feature) and the polling channel to notify peers of new
   attachments instantly.

Each lands as its own PR against `main` for a smaller review diff.

## Out of scope (explicit non-goals)

- Notifications (email, push). Needs SMTP creds we don't have in the
  stock cPanel flow. Revisit separately.
- Per-project access control. Today any authenticated user sees every
  project. Adding a membership table is a separate feature and would
  ripple through filters, activity, and every query in `tasks.php`.
- Export / import. Not requested; out of this plan.
- Mobile app. The current UI is responsive-enough; a wrapper is a
  separate project.
