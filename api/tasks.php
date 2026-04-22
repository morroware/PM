<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/slack_client.php';
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

    $out = [];
    foreach ($rows as $t) {
        $id = (int)$t['id'];
        $shape = pm_task_base_shape($t);
        $shape['labels']    = $labelsByTask[$id]    ?? [];
        $shape['assignees'] = $assigneesByTask[$id] ?? [];
        $shape['subtasks']  = $subsByTask[$id]      ?? [];
        $shape['comments']  = $commentsByTask[$id]  ?? 0;
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

function pm_create_task(): void {
    $title = trim((string)pm_param('title', ''));
    if ($title === '') pm_error('Title required');
    $project  = pm_int_param('project');
    if (!$project) pm_error('project required');
    $status   = (string)pm_param('status', 'todo');
    $priority = (int)pm_param('priority', 2);
    $due      = pm_param('due');
    $estimate = pm_param('estimate');
    $desc     = pm_param('description');
    $labels   = (array)pm_param('labels', []);
    $assignees= (array)pm_param('assignees', []);

    $proj = pm_fetch_one('SELECT * FROM projects WHERE id = ?', [$project]);
    if (!$proj) pm_error('Invalid project');

    $labels = pm_validate_label_ids_for_project($labels, $project);

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
        foreach ($labels as $lid) {
            pm_exec('INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)', [$tid, (int)$lid]);
        }
        foreach ($assignees as $uid) {
            pm_exec('INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)', [$tid, (int)$uid]);
        }
        pm_log_activity(pm_current_user_id(), $tid, 'created', $title);
    } catch (Throwable $e) {
        error_log('pm_create_task metadata failed: ' . $e->getMessage());
        pm_error('Task was created but metadata could not be attached.', 500);
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
        $fields[] = 'project_id = ?';
        $params[] = (int)$body['project'];
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
        pm_exec('DELETE FROM task_assignees WHERE task_id = ?', [$id]);
        foreach ($body['assignees'] as $uid) {
            $uid = (int)$uid;
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
    // Log before the delete so activity.task_id can still FK-resolve the
    // title in the listing, and so the entry survives the cascade.
    pm_log_activity(pm_current_user_id(), null, 'deleted', $t['title'] ?? '');
    pm_exec('DELETE FROM tasks WHERE id = ?', [$id]);
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
    $rows = pm_fetch_all(
        'SELECT c.id, c.body, c.created_at, c.updated_at, c.user_id, u.name, u.initials, u.color
         FROM comments c LEFT JOIN users u ON u.id = c.user_id
         WHERE c.task_id = ? ORDER BY c.id ASC',
        [$taskId]
    );
    pm_json(['comments' => array_map('pm_comment_shape', $rows)]);
}

function pm_add_comment(int $taskId): void {
    $body = trim((string)pm_param('body', ''));
    if ($body === '') pm_error('Empty comment');
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
        if (array_key_exists('assignees', $patch) && is_array($patch['assignees'])) {
            pm_exec('DELETE FROM task_assignees WHERE task_id = ?', [$id]);
            foreach ($patch['assignees'] as $uid) {
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
        require_once __DIR__ . '/recurring.php';
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
