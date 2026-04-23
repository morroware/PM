<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/slack_client.php';
require_once __DIR__ . '/attachments_lib.php';
pm_boot();
pm_require_auth();

$id    = pm_int_param('id');
$subId = pm_int_param('subtask_id');
$commentId = pm_int_param('comment_id');
$method = pm_method();

if (isset($_GET['bulk'])) {
    if ($method === 'PATCH') pm_bulk_update_tasks();
    pm_error('Method not allowed', 405);
}

// Sub-routes
if ($id !== null && isset($_GET['comments'])) {
    if ($method === 'GET')  pm_list_comments($id);
    if ($method === 'POST') pm_add_comment($id);
    if ($method === 'PATCH' && $commentId !== null) pm_update_comment($id, $commentId);
    if ($method === 'DELETE' && $commentId !== null) pm_delete_comment($id, $commentId);
    pm_error('Method not allowed', 405);
}

if ($id !== null && isset($_GET['subtasks'])) {
    if ($method === 'POST') pm_add_subtask($id);
    pm_error('Method not allowed', 405);
}

if ($id !== null && $subId !== null) {
    if ($method === 'PATCH')  pm_update_subtask($id, $subId);
    if ($method === 'DELETE') pm_delete_subtask($id, $subId);
    pm_error('Method not allowed', 405);
}

// Core CRUD
if ($id !== null) {
    if ($method === 'GET')    pm_get_task($id);
    if ($method === 'PATCH')  pm_update_task($id);
    if ($method === 'DELETE') pm_delete_task($id);
    pm_error('Method not allowed', 405);
}

if ($method === 'GET')  pm_list_tasks();
if ($method === 'POST') pm_create_task();
pm_error('Method not allowed', 405);


// ----------- handlers -----------

// Status ids must match the frontend's STATUSES list (assets/js/ui.js). Keeping
// them as a whitelist here stops a malformed client (or a stale third-party
// integration) from persisting gibberish that later breaks filtering/kanban.
function pm_is_valid_status(string $s): bool {
    return in_array($s, ['backlog','todo','in_progress','review','done'], true);
}

// Accept YYYY-MM-DD. DATE columns will silently coerce weird input, so guard.
function pm_is_valid_date(string $d): bool {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) return false;
    [$y, $m, $day] = array_map('intval', explode('-', $d));
    return checkdate($m, $day, $y);
}

function pm_task_base_shape(array $t): array {
    return [
        'id'          => (int)$t['id'],
        'ref'         => $t['ref'],
        'title'       => $t['title'],
        'description' => $t['description'],
        'project'     => (int)$t['project_id'],
        'status'      => $t['status'],
        'priority'    => (int)$t['priority'],
        'due'         => $t['due'],
        'estimate'    => $t['estimate'],
        'recurring_rule_id' => isset($t['recurring_rule_id']) && $t['recurring_rule_id'] !== null
            ? (int)$t['recurring_rule_id'] : null,
        'labels'      => [],
        'assignees'   => [],
        'subtasks'    => [],
        'comments'    => 0,
        'attachments' => 0,
        'created_at'  => $t['created_at'],
        'updated_at'  => $t['updated_at'],
    ];
}

// Single-task version used after create/update. Does 4 small queries; cheap.
function pm_task_row_to_shape(array $t): array {
    $shape = pm_task_base_shape($t);
    $labels    = pm_fetch_all('SELECT label_id FROM task_labels WHERE task_id = ?', [$t['id']]);
    $assignees = pm_fetch_all('SELECT user_id  FROM task_assignees WHERE task_id = ?', [$t['id']]);
    $subs      = pm_fetch_all('SELECT id, text, done FROM subtasks WHERE task_id = ? ORDER BY sort_order, id', [$t['id']]);
    $cmtRow    = pm_fetch_one('SELECT COUNT(*) AS c FROM comments WHERE task_id = ?', [$t['id']]);
    $shape['labels']    = array_map(fn($r) => (int)$r['label_id'], $labels);
    $shape['assignees'] = array_map(fn($r) => (int)$r['user_id'],  $assignees);
    $shape['subtasks']  = array_map(fn($r) => [
        'id'   => (int)$r['id'],
        'text' => $r['text'],
        'done' => (bool)$r['done'],
    ], $subs);
    $shape['comments']  = (int)$cmtRow['c'];
    $attRow = pm_fetch_one('SELECT COUNT(*) AS c FROM task_attachments WHERE task_id = ?', [$t['id']]);
    $shape['attachments'] = (int)($attRow['c'] ?? 0);
    return $shape;
}

function pm_list_tasks(): void {
    $rows = pm_fetch_all('SELECT * FROM tasks ORDER BY id DESC');
    if (!$rows) { pm_json(['tasks' => []]); return; }

    // Avoid N+1: pull related rows in one shot per table, then bucket in PHP.
    $ids = array_map(fn($r) => (int)$r['id'], $rows);
    $ph  = implode(',', array_fill(0, count($ids), '?'));

    $labelsByTask    = [];
    $assigneesByTask = [];
    $subsByTask      = [];
    $commentsByTask  = [];
    $attachmentsByTask = [];

    foreach (pm_fetch_all("SELECT task_id, label_id FROM task_labels WHERE task_id IN ($ph)", $ids) as $r) {
        $labelsByTask[(int)$r['task_id']][] = (int)$r['label_id'];
    }
    foreach (pm_fetch_all("SELECT task_id, user_id FROM task_assignees WHERE task_id IN ($ph)", $ids) as $r) {
        $assigneesByTask[(int)$r['task_id']][] = (int)$r['user_id'];
    }
    foreach (pm_fetch_all(
        "SELECT id, task_id, text, done FROM subtasks
         WHERE task_id IN ($ph) ORDER BY sort_order, id",
        $ids
    ) as $r) {
        $subsByTask[(int)$r['task_id']][] = [
            'id'   => (int)$r['id'],
            'text' => $r['text'],
            'done' => (bool)$r['done'],
        ];
    }
    foreach (pm_fetch_all("SELECT task_id, COUNT(*) AS c FROM comments WHERE task_id IN ($ph) GROUP BY task_id", $ids) as $r) {
        $commentsByTask[(int)$r['task_id']] = (int)$r['c'];
    }
    foreach (pm_fetch_all("SELECT task_id, COUNT(*) AS c FROM task_attachments WHERE task_id IN ($ph) GROUP BY task_id", $ids) as $r) {
        $attachmentsByTask[(int)$r['task_id']] = (int)$r['c'];
    }

    $out = [];
    foreach ($rows as $t) {
        $id = (int)$t['id'];
        $shape = pm_task_base_shape($t);
        $shape['labels']    = $labelsByTask[$id]    ?? [];
        $shape['assignees'] = $assigneesByTask[$id] ?? [];
        $shape['subtasks']  = $subsByTask[$id]      ?? [];
        $shape['comments']  = $commentsByTask[$id]  ?? 0;
        $shape['attachments'] = $attachmentsByTask[$id] ?? 0;
        $out[] = $shape;
    }
    pm_json(['tasks' => $out]);
}

function pm_get_task(int $id): void {
    $t = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$id]);
    if (!$t) pm_error('Not found', 404);
    pm_json(['task' => pm_task_row_to_shape($t)]);
}

function pm_validate_label_ids_for_project(array $labelIds, int $projectId): array {
    $clean = array_values(array_unique(array_map('intval', $labelIds)));
    if (!$clean) return [];
    $ph = implode(',', array_fill(0, count($clean), '?'));
    $params = array_merge($clean, [$projectId]);
    $rows = pm_fetch_all(
        "SELECT id FROM labels
         WHERE id IN ($ph)
           AND archived = 0
           AND (project_id IS NULL OR project_id = ?)",
        $params
    );
    $ok = array_map(fn($r) => (int)$r['id'], $rows);
    sort($ok);
    $want = $clean;
    sort($want);
    if ($ok !== $want) {
        pm_error('One or more labels are invalid, archived, or out of project scope', 409);
    }
    return $clean;
}

function pm_validate_assignee_ids(array $assigneeIds): array {
    $clean = array_values(array_unique(array_map('intval', $assigneeIds)));
    if (!$clean) return [];
    $ph = implode(',', array_fill(0, count($clean), '?'));
    $rows = pm_fetch_all("SELECT id FROM users WHERE id IN ($ph)", $clean);
    $ok = array_map(fn($r) => (int)$r['id'], $rows);
    sort($ok);
    $want = $clean;
    sort($want);
    if ($ok !== $want) {
        pm_error('One or more assignees are invalid', 409);
    }
    return $clean;
}

function pm_create_task(): void {
    $title = trim((string)pm_param('title', ''));
    if ($title === '') pm_error('Title required');
    // Bound to the column width declared in install.php so the DB doesn't
    // silently truncate, or — worse — surface a raw length-violation error.
    if (mb_strlen($title) > 500) pm_error('Title is too long (max 500 characters)');
    $project  = pm_int_param('project');
    if (!$project) pm_error('project required');
    $status   = (string)pm_param('status', 'todo');
    if (!pm_is_valid_status($status)) pm_error('Invalid status');
    $priority = (int)pm_param('priority', 2);
    if ($priority < 0 || $priority > 3) pm_error('Invalid priority');
    $due      = pm_param('due');
    if ($due !== null && $due !== '' && !pm_is_valid_date((string)$due)) pm_error('Invalid due date');
    $estimate = pm_param('estimate');
    if ($estimate !== null && mb_strlen((string)$estimate) > 32) pm_error('Estimate is too long');
    $desc     = pm_param('description');
    if ($desc !== null && mb_strlen((string)$desc) > 20000) pm_error('Description is too long');
    $labels   = (array)pm_param('labels', []);
    $assignees= (array)pm_param('assignees', []);

    $proj = pm_fetch_one('SELECT * FROM projects WHERE id = ?', [$project]);
    if (!$proj) pm_error('Invalid project');
    if (!empty($proj['archived'])) pm_error('Cannot create tasks in an archived project', 409);

    $labels = pm_validate_label_ids_for_project($labels, $project);
    $assignees = pm_validate_assignee_ids($assignees);

    $prefix = $proj['key_prefix'] ?: pm_config()['project_key'];

    // Insert the task with a retry loop. Two concurrent creators can both read
    // the same MAX(ref)+1 and then collide on the UNIQUE(ref) constraint — on
    // collision we recompute and try again instead of bubbling a 500.
    $tid = null;
    $attempts = 0;
    while (true) {
        $maxRow = pm_fetch_one(
            "SELECT MAX(CAST(SUBSTRING_INDEX(ref, '-', -1) AS UNSIGNED)) AS m FROM tasks WHERE ref LIKE ?",
            [$prefix . '-%']
        );
        $next = ((int)($maxRow['m'] ?? 0)) + 1;
        if ($next < 100) $next = 100; // keep ids readable
        $ref = $prefix . '-' . $next;
        try {
            pm_exec(
                'INSERT INTO tasks (ref, project_id, status, title, description, priority, due, estimate, created_by)
                 VALUES (?,?,?,?,?,?,?,?,?)',
                [$ref, $project, $status, $title, $desc ?: null, $priority, $due ?: null, $estimate ?: null, pm_current_user_id()]
            );
            $tid = pm_last_id();
            break;
        } catch (PDOException $e) {
            // 23000 = integrity constraint violation (duplicate ref).
            if ($e->getCode() !== '23000' || ++$attempts >= 5) {
                // Log server-side for ops; don't leak schema/constraint names
                // (and Slack-bound message text) back to the caller.
                error_log('pm_create_task insert failed: ' . $e->getMessage());
                pm_error('Failed to create task. Please try again.', 500);
            }
            // brief jitter so two racers don't lock-step forever
            usleep(random_int(1000, 5000));
        }
    }

    try {
        pm_db()->beginTransaction();
        foreach ($labels as $lid) {
            pm_exec('INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)', [$tid, (int)$lid]);
        }
        foreach ($assignees as $uid) {
            pm_exec('INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)', [$tid, (int)$uid]);
        }
        pm_log_activity(pm_current_user_id(), $tid, 'created', $title);
        pm_db()->commit();
    } catch (Throwable $e) {
        if (pm_db()->inTransaction()) pm_db()->rollBack();
        pm_exec('DELETE FROM tasks WHERE id = ?', [$tid]);
        error_log('pm_create_task metadata failed: ' . $e->getMessage());
        pm_error('Failed to create task metadata.', 500);
    }
    $t = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$tid]);
    pm_slack_notify_task_event($t, $proj, 'task_created', 'created this task');
    pm_json(['task' => pm_task_row_to_shape($t)]);
}

function pm_update_task(int $id): void {
    $t = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$id]);
    if (!$t) pm_error('Not found', 404);
    $body = pm_body();

    // Snapshot the old status so the post-update side effects (Slack ping,
    // recurring respawn) can detect a real *transition into* done and not fire
    // again every time an already-done task is re-saved with no status change.
    $prevStatus = (string)$t['status'];

    // Snapshot the old assignees so we can detect *newly added* ones and fire
    // a Slack task_assigned event for each, while avoiding duplicate pings to
    // someone who was already on the task.
    $prevAssignees = [];
    foreach (pm_fetch_all('SELECT user_id FROM task_assignees WHERE task_id = ?', [$id]) as $r) {
        $prevAssignees[] = (int)$r['user_id'];
    }

    // Validate per-column before touching the DB so callers get a clean 400
    // instead of a PDOException bubbled up as a 500.
    if (array_key_exists('title', $body)) {
        $t = trim((string)$body['title']);
        if ($t === '') pm_error('Title cannot be empty');
        if (mb_strlen($t) > 500) pm_error('Title is too long (max 500 characters)');
    }
    if (array_key_exists('status', $body) && !pm_is_valid_status((string)$body['status'])) {
        pm_error('Invalid status');
    }
    if (array_key_exists('due', $body) && $body['due'] !== null && $body['due'] !== '' && !pm_is_valid_date((string)$body['due'])) {
        pm_error('Invalid due date');
    }
    if (array_key_exists('estimate', $body) && $body['estimate'] !== null && mb_strlen((string)$body['estimate']) > 32) {
        pm_error('Estimate is too long');
    }
    if (array_key_exists('description', $body) && $body['description'] !== null && mb_strlen((string)$body['description']) > 20000) {
        pm_error('Description is too long');
    }
    if (array_key_exists('priority', $body)) {
        $p = (int)$body['priority'];
        if ($p < 0 || $p > 3) pm_error('Invalid priority');
    }

    $fields = [];
    $params = [];
    foreach (['title','description','status','estimate','due'] as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = ?";
            $params[] = $body[$col] === '' ? null : $body[$col];
        }
    }
    if (array_key_exists('priority', $body)) {
        $fields[] = 'priority = ?';
        $params[] = (int)$body['priority'];
    }
    if (array_key_exists('project', $body)) {
        $nextProjectId = (int)$body['project'];
        $proj = pm_fetch_one('SELECT id, archived FROM projects WHERE id = ?', [$nextProjectId]);
        if (!$proj) pm_error('Invalid project', 409);
        if (!empty($proj['archived'])) pm_error('Cannot move tasks into an archived project', 409);
        $fields[] = 'project_id = ?';
        $params[] = $nextProjectId;
    }
    if ($fields) {
        $params[] = $id;
        pm_exec('UPDATE tasks SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
    }

    if (array_key_exists('labels', $body) && is_array($body['labels'])) {
        $labelProject = array_key_exists('project', $body) ? (int)$body['project'] : (int)$t['project_id'];
        $validLabels = pm_validate_label_ids_for_project($body['labels'], $labelProject);
        pm_exec('DELETE FROM task_labels WHERE task_id = ?', [$id]);
        foreach ($validLabels as $lid) {
            pm_exec('INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)', [$id, (int)$lid]);
        }
    }
    $newlyAssigned = [];
    if (array_key_exists('assignees', $body) && is_array($body['assignees'])) {
        $validAssignees = pm_validate_assignee_ids($body['assignees']);
        pm_exec('DELETE FROM task_assignees WHERE task_id = ?', [$id]);
        foreach ($validAssignees as $uid) {
            pm_exec('INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)', [$id, $uid]);
            if (!in_array($uid, $prevAssignees, true)) $newlyAssigned[] = $uid;
        }
    }

    // Activity (light)
    if (isset($body['status']) && $body['status'] !== $t['status']) {
        pm_log_activity(pm_current_user_id(), $id, 'moved', $t['status'] . ' → ' . $body['status']);
        if ($body['status'] === 'done') {
            pm_log_activity(pm_current_user_id(), $id, 'completed', $t['title']);
        }
    }

    $t = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$id]);

    // Fire Slack + recurring-generation side effects once the write is stable.
    // Must be a *transition into* done — otherwise re-saving an already-done
    // task would fire another Slack message and spawn another recurring
    // instance on every save.
    if ($prevStatus !== 'done' && $t['status'] === 'done') {
        $proj = pm_fetch_one('SELECT * FROM projects WHERE id = ?', [(int)$t['project_id']]);
        pm_slack_notify_task_event($t, $proj, 'task_completed', 'marked this task done');
        if (!empty($t['recurring_rule_id'])) {
            pm_generate_next_recurring_task((int)$t['recurring_rule_id']);
        }
    }
    if ($newlyAssigned) {
        $proj = pm_fetch_one('SELECT * FROM projects WHERE id = ?', [(int)$t['project_id']]);
        $names = [];
        foreach ($newlyAssigned as $uid) {
            $u = pm_fetch_one('SELECT name FROM users WHERE id = ?', [$uid]);
            if ($u) $names[] = $u['name'];
        }
        $verb = 'assigned ' . (count($names) ? implode(', ', $names) : 'someone');
        pm_slack_notify_task_event($t, $proj, 'task_assigned', $verb);
    }

    pm_json(['task' => pm_task_row_to_shape($t)]);
}

function pm_delete_task(int $id): void {
    $t = pm_fetch_one('SELECT id, title FROM tasks WHERE id = ?', [$id]);
    if (!$t) pm_error('Not found', 404);
    $atts = pm_fetch_all('SELECT stored_name FROM task_attachments WHERE task_id = ?', [$id]);
    // Log before the delete so activity.task_id can still FK-resolve the
    // title in the listing, and so the entry survives the cascade.
    pm_log_activity(pm_current_user_id(), null, 'deleted', $t['title'] ?? '');
    pm_exec('DELETE FROM tasks WHERE id = ?', [$id]);
    foreach ($atts as $a) pm_attachment_delete_file((string)($a['stored_name'] ?? ''));
    pm_json(['ok' => true]);
}

// ---- subtasks ----
function pm_add_subtask(int $taskId): void {
    // Validate the parent task exists up-front. Without this, an INSERT for a
    // bogus task_id raises a FK violation and we'd surface a raw PDOException
    // (leaking schema) instead of a clean 404.
    $task = pm_fetch_one('SELECT id FROM tasks WHERE id = ?', [$taskId]);
    if (!$task) pm_error('Task not found', 404);
    $text = trim((string)pm_param('text', ''));
    if ($text === '') pm_error('Text required');
    if (mb_strlen($text) > 500) pm_error('Subtask is too long (max 500 characters)');
    $maxRow = pm_fetch_one('SELECT COALESCE(MAX(sort_order), 0) AS m FROM subtasks WHERE task_id = ?', [$taskId]);
    $next = ((int)($maxRow['m'] ?? 0)) + 1;
    pm_exec('INSERT INTO subtasks (task_id, text, done, sort_order) VALUES (?,?,0,?)',
        [$taskId, $text, $next]);
    $sid = pm_last_id();
    $s = pm_fetch_one('SELECT id, text, done FROM subtasks WHERE id = ?', [$sid]);
    pm_json(['subtask' => [
        'id'=>(int)$s['id'],'text'=>$s['text'],'done'=>(bool)$s['done']
    ]]);
}

function pm_update_subtask(int $taskId, int $subId): void {
    // Verify the subtask actually belongs to this task before doing anything
    // else. The composite WHERE in the UPDATE already enforces that, but the
    // early check lets us distinguish 404 (not ours) from 200 with zero rows.
    $existing = pm_fetch_one('SELECT id FROM subtasks WHERE id = ? AND task_id = ?', [$subId, $taskId]);
    if (!$existing) pm_error('Subtask not found', 404);
    $body = pm_body();
    $fields = [];
    $params = [];
    if (array_key_exists('text', $body)) {
        $text = trim((string)$body['text']);
        if ($text === '') pm_error('Subtask text cannot be empty');
        if (mb_strlen($text) > 500) pm_error('Subtask is too long (max 500 characters)');
        $fields[] = 'text = ?';
        $params[] = $text;
    }
    if (array_key_exists('done', $body)) { $fields[] = 'done = ?'; $params[] = !empty($body['done']) ? 1 : 0; }
    if (!$fields) pm_error('Nothing to update');
    $params[] = $subId;
    $params[] = $taskId;
    pm_exec('UPDATE subtasks SET ' . implode(',', $fields) . ' WHERE id = ? AND task_id = ?', $params);
    $s = pm_fetch_one('SELECT id, text, done FROM subtasks WHERE id = ? AND task_id = ?', [$subId, $taskId]);
    if (!$s) pm_error('Subtask not found', 404);
    pm_json(['subtask' => [
        'id'=>(int)$s['id'],'text'=>$s['text'],'done'=>(bool)$s['done']
    ]]);
}

function pm_delete_subtask(int $taskId, int $subId): void {
    $n = pm_exec('DELETE FROM subtasks WHERE id = ? AND task_id = ?', [$subId, $taskId]);
    if ($n === 0) pm_error('Subtask not found', 404);
    pm_json(['ok' => true]);
}

// ---- comments ----
function pm_comment_shape(array $r): array {
    return [
        'id'         => (int)$r['id'],
        'body'       => $r['body'],
        'created_at' => $r['created_at'],
        'updated_at' => $r['updated_at'] ?? null,
        'user'       => [
            'id'       => $r['user_id'] !== null ? (int)$r['user_id'] : null,
            'name'     => $r['name']     ?? 'Former teammate',
            'initials' => $r['initials'] ?? '??',
            'color'    => $r['color']    ?? '#64748B',
        ],
    ];
}

function pm_list_comments(int $taskId): void {
    // Distinguish "task exists, has no comments" (200, []) from "task gone"
    // (404) so the drawer can show an accurate empty state vs. an error.
    $taskExists = pm_fetch_one('SELECT id FROM tasks WHERE id = ?', [$taskId]);
    if (!$taskExists) pm_error('Task not found', 404);
    $rows = pm_fetch_all(
        'SELECT c.id, c.body, c.created_at, c.updated_at, c.user_id, u.name, u.initials, u.color
         FROM comments c LEFT JOIN users u ON u.id = c.user_id
         WHERE c.task_id = ? ORDER BY c.id ASC',
        [$taskId]
    );
    pm_json(['comments' => array_map('pm_comment_shape', $rows)]);
}

function pm_add_comment(int $taskId): void {
    // Confirm the task exists up-front; otherwise the INSERT will fail on the
    // FK with a schema-leaking 500 instead of a clean 404.
    $taskExists = pm_fetch_one('SELECT id FROM tasks WHERE id = ?', [$taskId]);
    if (!$taskExists) pm_error('Task not found', 404);
    $body = trim((string)pm_param('body', ''));
    if ($body === '') pm_error('Empty comment');
    // Bound the comment at a comfortable-but-sane size. The DB column is TEXT
    // (~65KB), but letting users paste multi-MB content degrades the rest of
    // the UI (and Slack post-truncation downstream) for everyone else.
    if (mb_strlen($body) > 5000) pm_error('Comment is too long (max 5000 characters)');
    pm_exec('INSERT INTO comments (task_id, user_id, body) VALUES (?,?,?)',
        [$taskId, pm_current_user_id(), $body]);
    pm_log_activity(pm_current_user_id(), $taskId, 'commented', mb_substr($body, 0, 200));
    $cid = pm_last_id();
    $r = pm_fetch_one(
        'SELECT c.id, c.body, c.created_at, c.updated_at, c.user_id, u.name, u.initials, u.color
         FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?',
        [$cid]
    );
    $task = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$taskId]);
    if ($task) {
        $proj = pm_fetch_one('SELECT * FROM projects WHERE id = ?', [(int)$task['project_id']]);
        pm_slack_notify_task_event($task, $proj, 'comment_added', 'commented', $body);
        pm_notify_mentions($task, $proj, $body);
    }
    pm_json(['comment' => pm_comment_shape($r)]);
}

function pm_update_comment(int $taskId, int $commentId): void {
    $comment = pm_fetch_one('SELECT * FROM comments WHERE id = ? AND task_id = ?', [$commentId, $taskId]);
    if (!$comment) pm_error('Comment not found', 404);
    $me = pm_current_user();
    if (!$me) pm_error('Not authenticated', 401);
    $isOwner = (int)($comment['user_id'] ?? 0) === (int)$me['id'];
    if (!$isOwner && empty($me['is_admin'])) pm_error('Not allowed', 403);
    $body = trim((string)pm_param('body', ''));
    if ($body === '') pm_error('Empty comment');
    if (mb_strlen($body) > 5000) pm_error('Comment is too long (max 5000 characters)');
    pm_exec('UPDATE comments SET body = ?, updated_at = NOW() WHERE id = ? AND task_id = ?', [$body, $commentId, $taskId]);
    $r = pm_fetch_one(
        'SELECT c.id, c.body, c.created_at, c.updated_at, c.user_id, u.name, u.initials, u.color
         FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ? AND c.task_id = ?',
        [$commentId, $taskId]
    );
    $task = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$taskId]);
    if ($task) {
        $proj = pm_fetch_one('SELECT * FROM projects WHERE id = ?', [(int)$task['project_id']]);
        pm_notify_mentions($task, $proj, $body);
    }
    pm_json(['comment' => pm_comment_shape($r)]);
}

function pm_delete_comment(int $taskId, int $commentId): void {
    $comment = pm_fetch_one('SELECT * FROM comments WHERE id = ? AND task_id = ?', [$commentId, $taskId]);
    if (!$comment) pm_error('Comment not found', 404);
    $me = pm_current_user();
    if (!$me) pm_error('Not authenticated', 401);
    $isOwner = (int)($comment['user_id'] ?? 0) === (int)$me['id'];
    if (!$isOwner && empty($me['is_admin'])) pm_error('Not allowed', 403);
    pm_exec('DELETE FROM comments WHERE id = ? AND task_id = ?', [$commentId, $taskId]);
    pm_json(['ok' => true]);
}

function pm_notify_mentions(array $task, ?array $project, string $text): void {
    preg_match_all('/@([A-Za-z0-9._-]{2,80})/', $text, $m);
    $names = array_values(array_unique($m[1] ?? []));
    if (!$names) return;
    $hits = [];
    foreach ($names as $n) {
        $row = pm_fetch_one('SELECT id, name FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(initials) = LOWER(?)', [$n, $n]);
        if ($row) $hits[] = $row;
    }
    if (!$hits) return;
    $actor = pm_current_user();
    $who = $actor['name'] ?? 'Someone';
    $mentioned = implode(', ', array_map(fn($u) => $u['name'], $hits));
    pm_log_activity(pm_current_user_id(), (int)$task['id'], 'mention', "{$who} mentioned {$mentioned}");
    if (!pm_slack_event_on('mention_added')) return;
    $channel = pm_slack_channel_for_project($project);
    if ($channel === '') return;
    $msg = pm_slack_format_task($task, "mentioned {$mentioned}", $actor, $project, $text);
    pm_slack_post($channel, $msg, ['event_key' => 'mention_added']);
}

function pm_bulk_update_tasks(): void {
    // pm_require_admin() both guards auth and returns a guaranteed-non-null
    // array, so downstream code never has to defend against $me being null
    // (which caused PHP 8 fatals on mid-session user deletion).
    pm_require_admin();
    $body = pm_body();
    $ids = array_values(array_unique(array_map('intval', (array)($body['task_ids'] ?? []))));
    if (!$ids) pm_error('task_ids required');
    $patch = is_array($body['patch'] ?? null) ? $body['patch'] : [];
    if (!$patch) pm_error('patch required');
    // Reject bad patches once, before the loop — otherwise we'd partially
    // mutate the first N tasks and then bail on the N+1th with a mismatched
    // 400 that makes the rollback picture confusing for the caller.
    if (array_key_exists('title', $patch)) {
        $t = trim((string)$patch['title']);
        if ($t === '' || mb_strlen($t) > 500) pm_error('Invalid title');
    }
    if (array_key_exists('status', $patch) && !pm_is_valid_status((string)$patch['status'])) {
        pm_error('Invalid status');
    }
    if (array_key_exists('priority', $patch)) {
        $p = (int)$patch['priority'];
        if ($p < 0 || $p > 3) pm_error('Invalid priority');
    }
    if (array_key_exists('due', $patch) && $patch['due'] !== null && $patch['due'] !== '' && !pm_is_valid_date((string)$patch['due'])) {
        pm_error('Invalid due date');
    }
    if (array_key_exists('estimate', $patch) && $patch['estimate'] !== null && mb_strlen((string)$patch['estimate']) > 32) {
        pm_error('Estimate is too long');
    }
    if (array_key_exists('project', $patch)) {
        $np = (int)$patch['project'];
        $proj = pm_fetch_one('SELECT id, archived FROM projects WHERE id = ?', [$np]);
        if (!$proj) pm_error('Invalid project', 409);
        if (!empty($proj['archived'])) pm_error('Cannot move tasks into an archived project', 409);
    }
    // Pre-validate the assignees list once so a bogus id doesn't get caught
    // mid-loop after we've already written to N tasks.
    $preValidatedAssignees = null;
    if (array_key_exists('assignees', $patch) && is_array($patch['assignees'])) {
        $preValidatedAssignees = pm_validate_assignee_ids($patch['assignees']);
    }
    $updated = 0;
    foreach ($ids as $id) {
        $task = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$id]);
        if (!$task) continue;
        $fields = [];
        $params = [];
        foreach (['title','description','status','estimate','due'] as $col) {
            if (array_key_exists($col, $patch)) {
                $fields[] = "$col = ?";
                $params[] = $patch[$col] === '' ? null : $patch[$col];
            }
        }
        if (array_key_exists('priority', $patch)) {
            $fields[] = 'priority = ?';
            $params[] = (int)$patch['priority'];
        }
        if (array_key_exists('project', $patch)) {
            $fields[] = 'project_id = ?';
            $params[] = (int)$patch['project'];
        }
        if ($fields) {
            $params[] = $id;
            pm_exec('UPDATE tasks SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
        }
        if (array_key_exists('labels', $patch) && is_array($patch['labels'])) {
            $labelProject = array_key_exists('project', $patch) ? (int)$patch['project'] : (int)$task['project_id'];
            $valid = pm_validate_label_ids_for_project($patch['labels'], $labelProject);
            pm_exec('DELETE FROM task_labels WHERE task_id = ?', [$id]);
            foreach ($valid as $lid) pm_exec('INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)', [$id, (int)$lid]);
        }
        if ($preValidatedAssignees !== null) {
            pm_exec('DELETE FROM task_assignees WHERE task_id = ?', [$id]);
            foreach ($preValidatedAssignees as $uid) {
                pm_exec('INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)', [$id, (int)$uid]);
            }
        }
        $updated++;
    }
    pm_json(['ok' => true, 'updated' => $updated]);
}

function pm_log_activity(int $uid, ?int $taskId, string $action, ?string $detail = null): void {
    pm_exec('INSERT INTO activity (user_id, task_id, action, detail) VALUES (?,?,?,?)',
        [$uid, $taskId, $action, $detail]);
}

// Best-effort Slack notification. Never bubbles errors up: the request-level
// write has already succeeded at this point, and a Slack outage shouldn't
// turn a successful save into a 500.
function pm_slack_notify_task_event(array $task, ?array $project, string $event, string $verb, ?string $extra = null): void {
    try {
        if (!pm_slack_event_on($event)) return;
        $channel = pm_slack_channel_for_project($project);
        if ($channel === '') return;
        $actor = pm_current_user();
        $fallback  = pm_slack_format_task($task, $verb, $actor, $project, $extra);
        $text = pm_slack_render_event_text($event, [
            'project' => $project['name'] ?? '',
            'ref' => $task['ref'] ?? ('#' . (int)$task['id']),
            'title' => $task['title'] ?? '',
            'actor' => $actor['name'] ?? 'Someone',
            'verb' => $verb,
            'extra' => $extra ?? '',
        ], $fallback);
        pm_slack_post($channel, $text, ['event_key' => $event]);
    } catch (Throwable $_) { /* silent */ }
}

// When a task tied to a recurring rule is completed, spawn the next instance.
// Missed runs (rule.next_run in the past) are "caught up" to today so we don't
// create a pile of back-dated tasks the moment someone finally checks in.
function pm_generate_next_recurring_task(int $ruleId): void {
    try {
        $rule = pm_fetch_one('SELECT * FROM recurring_rules WHERE id = ?', [$ruleId]);
        if (!$rule) return;
        if (!empty($rule['paused'])) return;

        // Decide the date we'll schedule on.
        $base = $rule['next_run'] ?: date('Y-m-d');
        // If base is in the past, advance until it's >= today. The guard
        // counter prevents an infinite loop if pm_recurring_next_date ever
        // returns the same date (e.g. malformed rule with interval 0).
        $today = date('Y-m-d');
        $guard = 0;
        while ($base < $today && $guard++ < 3650) {
            $next = pm_recurring_next_date($base, $rule);
            if ($next <= $base) break;
            $base = $next;
        }
        $scheduleFor = $base;
        $nextAfter   = pm_recurring_next_date($scheduleFor, $rule);

        // End conditions: stop if ends_on already passed or occurrences exhausted.
        if (!empty($rule['ends_on']) && $scheduleFor > $rule['ends_on']) {
            pm_exec('UPDATE recurring_rules SET paused = 1 WHERE id = ?', [$ruleId]);
            return;
        }
        if ($rule['occurrences_left'] !== null && (int)$rule['occurrences_left'] <= 0) {
            pm_exec('UPDATE recurring_rules SET paused = 1 WHERE id = ?', [$ruleId]);
            return;
        }

        $proj = pm_fetch_one('SELECT * FROM projects WHERE id = ?', [(int)$rule['project_id']]);
        if (!$proj) return;
        $prefix = $proj['key_prefix'] ?: pm_config()['project_key'];

        // Same retry-on-collision loop as pm_create_task.
        $tid = null;
        $attempts = 0;
        while (true) {
            $maxRow = pm_fetch_one(
                "SELECT MAX(CAST(SUBSTRING_INDEX(ref, '-', -1) AS UNSIGNED)) AS m FROM tasks WHERE ref LIKE ?",
                [$prefix . '-%']
            );
            $next = ((int)($maxRow['m'] ?? 0)) + 1;
            if ($next < 100) $next = 100;
            $ref = $prefix . '-' . $next;
            try {
                pm_exec(
                    'INSERT INTO tasks (ref, project_id, status, title, description, priority, due, estimate, recurring_rule_id, created_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?)',
                    [
                        $ref, (int)$rule['project_id'], 'todo',
                        $rule['title'], $rule['description'],
                        (int)$rule['priority'], $scheduleFor,
                        $rule['estimate'] ?: null,
                        $ruleId, pm_current_user_id(),
                    ]
                );
                $tid = pm_last_id();
                break;
            } catch (PDOException $e) {
                if ($e->getCode() !== '23000' || ++$attempts >= 5) return;
                usleep(random_int(1000, 5000));
            }
        }

        $assignees = json_decode((string)($rule['assignees'] ?? ''), true);
        $labels    = json_decode((string)($rule['labels']    ?? ''), true);
        if (is_array($assignees)) foreach ($assignees as $uid) {
            pm_exec('INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)', [$tid, (int)$uid]);
        }
        if (is_array($labels)) foreach ($labels as $lid) {
            pm_exec('INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)', [$tid, (int)$lid]);
        }

        // Advance the rule cursor.
        $occLeft = $rule['occurrences_left'] === null ? null : max(0, (int)$rule['occurrences_left'] - 1);
        pm_exec(
            'UPDATE recurring_rules SET next_run = ?, last_task_id = ?, occurrences_left = ? WHERE id = ?',
            [$nextAfter, $tid, $occLeft, $ruleId]
        );

        pm_log_activity(pm_current_user_id() ?: 0, $tid, 'recurring_spawn', 'Generated from recurring rule');
        $created = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$tid]);
        pm_slack_notify_task_event($created, $proj, 'task_created', 'scheduled a recurring task');
    } catch (Throwable $_) { /* best effort */ }
}

function pm_recurring_next_date(string $fromYmd, array $rule): string {
    $ts = strtotime($fromYmd . ' 00:00:00');
    if ($ts === false) $ts = time();
    $interval = max(1, (int)($rule['interval_n'] ?? 1));
    switch ($rule['cadence'] ?? 'weekly') {
        case 'daily':
            $ts = strtotime("+{$interval} day", $ts);
            break;
        case 'weekly':
            $ts = strtotime("+{$interval} week", $ts);
            if (array_key_exists('weekday', $rule) && $rule['weekday'] !== null) {
                $target = (int)$rule['weekday'];
                $cur = (int)date('w', $ts);
                $delta = ($target - $cur + 7) % 7;
                if ($delta) $ts = strtotime("+{$delta} day", $ts);
            }
            break;
        case 'monthly': {
            $y = (int)date('Y', $ts);
            $m = (int)date('m', $ts) + $interval;
            while ($m > 12) { $m -= 12; $y++; }
            $d = (array_key_exists('month_day', $rule) && $rule['month_day'] !== null)
                ? (int)$rule['month_day']
                : (int)date('d', $ts);
            $lastDay = (int)date('t', strtotime(sprintf('%04d-%02d-01', $y, $m)));
            $d = min($d, $lastDay);
            $ts = mktime(0, 0, 0, $m, $d, $y);
            break;
        }
        case 'yearly': {
            $y = (int)date('Y', $ts) + $interval;
            $m = (array_key_exists('month_of_year', $rule) && $rule['month_of_year'] !== null)
                ? (int)$rule['month_of_year']
                : (int)date('m', $ts);
            $d = (array_key_exists('month_day', $rule) && $rule['month_day'] !== null)
                ? (int)$rule['month_day']
                : (int)date('d', $ts);
            $lastDay = (int)date('t', strtotime(sprintf('%04d-%02d-01', $y, $m)));
            $d = min($d, $lastDay);
            $ts = mktime(0, 0, 0, $m, $d, $y);
            break;
        }
    }
    return date('Y-m-d', $ts);
}
