<?php
require_once __DIR__ . '/bootstrap.php';
pm_boot();
pm_require_auth();

$id    = pm_int_param('id');
$subId = pm_int_param('subtask_id');
$method = pm_method();

// Sub-routes
if ($id !== null && isset($_GET['comments'])) {
    if ($method === 'GET')  pm_list_comments($id);
    if ($method === 'POST') pm_add_comment($id);
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

function pm_task_row_to_shape(array $t): array {
    $labels    = pm_fetch_all('SELECT label_id FROM task_labels WHERE task_id = ?', [$t['id']]);
    $assignees = pm_fetch_all('SELECT user_id  FROM task_assignees WHERE task_id = ?', [$t['id']]);
    $subs      = pm_fetch_all('SELECT id, text, done FROM subtasks WHERE task_id = ? ORDER BY sort_order, id', [$t['id']]);
    $cmtRow    = pm_fetch_one('SELECT COUNT(*) AS c FROM comments WHERE task_id = ?', [$t['id']]);
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
        'labels'      => array_map(fn($r) => (int)$r['label_id'], $labels),
        'assignees'   => array_map(fn($r) => (int)$r['user_id'],  $assignees),
        'subtasks'    => array_map(fn($r) => [
            'id'   => (int)$r['id'],
            'text' => $r['text'],
            'done' => (bool)$r['done'],
        ], $subs),
        'comments'    => (int)$cmtRow['c'],
        'created_at'  => $t['created_at'],
        'updated_at'  => $t['updated_at'],
    ];
}

function pm_list_tasks(): void {
    $rows = pm_fetch_all('SELECT * FROM tasks ORDER BY id DESC');
    $out = array_map('pm_task_row_to_shape', $rows);
    pm_json(['tasks' => $out]);
}

function pm_get_task(int $id): void {
    $t = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$id]);
    if (!$t) pm_error('Not found', 404);
    pm_json(['task' => pm_task_row_to_shape($t)]);
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

    $pdo = pm_db();
    $pdo->beginTransaction();
    try {
        // Next ref number for this project's prefix
        $prefix = $proj['key_prefix'] ?: pm_config()['project_key'];
        $maxRow = pm_fetch_one(
            "SELECT MAX(CAST(SUBSTRING_INDEX(ref, '-', -1) AS UNSIGNED)) AS m FROM tasks WHERE ref LIKE ?",
            [$prefix . '-%']
        );
        $next = ((int)($maxRow['m'] ?? 0)) + 1;
        if ($next < 100) $next = 100; // keep ids readable
        $ref = $prefix . '-' . $next;

        pm_exec(
            'INSERT INTO tasks (ref, project_id, status, title, description, priority, due, estimate, created_by)
             VALUES (?,?,?,?,?,?,?,?,?)',
            [$ref, $project, $status, $title, $desc ?: null, $priority, $due ?: null, $estimate ?: null, pm_current_user_id()]
        );
        $tid = pm_last_id();

        foreach ($labels as $lid) {
            pm_exec('INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)', [$tid, (int)$lid]);
        }
        foreach ($assignees as $uid) {
            pm_exec('INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)', [$tid, (int)$uid]);
        }
        pm_log_activity(pm_current_user_id(), $tid, 'created', $title);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        pm_error('Failed to create task: ' . $e->getMessage(), 500);
    }
    $t = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$tid]);
    pm_json(['task' => pm_task_row_to_shape($t)]);
}

function pm_update_task(int $id): void {
    $t = pm_fetch_one('SELECT * FROM tasks WHERE id = ?', [$id]);
    if (!$t) pm_error('Not found', 404);
    $body = pm_body();

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
        pm_exec('DELETE FROM task_labels WHERE task_id = ?', [$id]);
        foreach ($body['labels'] as $lid) {
            pm_exec('INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)', [$id, (int)$lid]);
        }
    }
    if (array_key_exists('assignees', $body) && is_array($body['assignees'])) {
        pm_exec('DELETE FROM task_assignees WHERE task_id = ?', [$id]);
        foreach ($body['assignees'] as $uid) {
            pm_exec('INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?,?)', [$id, (int)$uid]);
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
    pm_json(['task' => pm_task_row_to_shape($t)]);
}

function pm_delete_task(int $id): void {
    $t = pm_fetch_one('SELECT id FROM tasks WHERE id = ?', [$id]);
    if (!$t) pm_error('Not found', 404);
    pm_exec('DELETE FROM tasks WHERE id = ?', [$id]);
    pm_json(['ok' => true]);
}

// ---- subtasks ----
function pm_add_subtask(int $taskId): void {
    $text = trim((string)pm_param('text', ''));
    if ($text === '') pm_error('Text required');
    pm_exec('INSERT INTO subtasks (task_id, text, done, sort_order) VALUES (?,?,0,?)',
        [$taskId, $text, time() % 2147483647]);
    $sid = pm_last_id();
    $s = pm_fetch_one('SELECT id, text, done FROM subtasks WHERE id = ?', [$sid]);
    pm_json(['subtask' => [
        'id'=>(int)$s['id'],'text'=>$s['text'],'done'=>(bool)$s['done']
    ]]);
}

function pm_update_subtask(int $taskId, int $subId): void {
    $body = pm_body();
    $fields = [];
    $params = [];
    if (array_key_exists('text', $body)) { $fields[] = 'text = ?'; $params[] = $body['text']; }
    if (array_key_exists('done', $body)) { $fields[] = 'done = ?'; $params[] = !empty($body['done']) ? 1 : 0; }
    if (!$fields) pm_error('Nothing to update');
    $params[] = $subId;
    $params[] = $taskId;
    pm_exec('UPDATE subtasks SET ' . implode(',', $fields) . ' WHERE id = ? AND task_id = ?', $params);
    $s = pm_fetch_one('SELECT id, text, done FROM subtasks WHERE id = ?', [$subId]);
    pm_json(['subtask' => [
        'id'=>(int)$s['id'],'text'=>$s['text'],'done'=>(bool)$s['done']
    ]]);
}

function pm_delete_subtask(int $taskId, int $subId): void {
    pm_exec('DELETE FROM subtasks WHERE id = ? AND task_id = ?', [$subId, $taskId]);
    pm_json(['ok' => true]);
}

// ---- comments ----
function pm_list_comments(int $taskId): void {
    $rows = pm_fetch_all(
        'SELECT c.id, c.body, c.created_at, c.user_id, u.name, u.initials, u.color
         FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.task_id = ? ORDER BY c.id ASC',
        [$taskId]
    );
    pm_json(['comments' => array_map(fn($r) => [
        'id'         => (int)$r['id'],
        'body'       => $r['body'],
        'created_at' => $r['created_at'],
        'user'       => [
            'id'=>(int)$r['user_id'],'name'=>$r['name'],
            'initials'=>$r['initials'],'color'=>$r['color']
        ],
    ], $rows)]);
}

function pm_add_comment(int $taskId): void {
    $body = trim((string)pm_param('body', ''));
    if ($body === '') pm_error('Empty comment');
    pm_exec('INSERT INTO comments (task_id, user_id, body) VALUES (?,?,?)',
        [$taskId, pm_current_user_id(), $body]);
    pm_log_activity(pm_current_user_id(), $taskId, 'commented', mb_substr($body, 0, 200));
    $cid = pm_last_id();
    $r = pm_fetch_one(
        'SELECT c.id, c.body, c.created_at, c.user_id, u.name, u.initials, u.color
         FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?',
        [$cid]
    );
    pm_json(['comment' => [
        'id'         => (int)$r['id'],
        'body'       => $r['body'],
        'created_at' => $r['created_at'],
        'user'       => [
            'id'=>(int)$r['user_id'],'name'=>$r['name'],
            'initials'=>$r['initials'],'color'=>$r['color']
        ],
    ]]);
}

function pm_log_activity(int $uid, ?int $taskId, string $action, ?string $detail = null): void {
    pm_exec('INSERT INTO activity (user_id, task_id, action, detail) VALUES (?,?,?,?)',
        [$uid, $taskId, $action, $detail]);
}
