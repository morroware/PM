<?php
require_once __DIR__ . '/bootstrap.php';
pm_boot();
pm_require_auth();

$rows = pm_fetch_all(
    "SELECT a.id, a.action, a.detail, a.created_at,
            a.user_id, u.name AS user_name, u.initials, u.color,
            a.task_id, t.ref AS task_ref, t.title AS task_title
     FROM activity a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN tasks t ON t.id = a.task_id
     ORDER BY a.id DESC
     LIMIT 40"
);

pm_json(['activity' => array_map(fn($r) => [
    'id'         => (int)$r['id'],
    'action'     => $r['action'],
    'detail'     => $r['detail'],
    'created_at' => $r['created_at'],
    'user'       => [
        'id'       => $r['user_id'] !== null ? (int)$r['user_id'] : null,
        'name'     => $r['user_name'] ?? 'Former teammate',
        'initials' => $r['initials']  ?? '??',
        'color'    => $r['color']     ?? '#64748B',
    ],
    'task' => $r['task_id'] ? [
        'id'    => (int)$r['task_id'],
        'ref'   => $r['task_ref'],
        'title' => $r['task_title'],
    ] : null,
], $rows)]);
