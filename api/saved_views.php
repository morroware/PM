<?php
require_once __DIR__ . '/bootstrap.php';
pm_boot();
$uid = pm_require_auth();

$method = pm_method();
$id = pm_int_param('id');

function pm_saved_view_shape(array $r): array {
    $filters = json_decode((string)$r['filters_json'], true);
    if (!is_array($filters)) $filters = [];
    return [
        'id' => (int)$r['id'],
        'name' => $r['name'],
        'view_key' => $r['view_key'] ?: 'list',
        'filters' => [
            'project' => isset($filters['project']) && $filters['project'] !== null ? (int)$filters['project'] : null,
            'assignee' => isset($filters['assignee']) && $filters['assignee'] !== null ? (int)$filters['assignee'] : null,
            'labels' => array_values(array_map('intval', (array)($filters['labels'] ?? []))),
            'search' => (string)($filters['search'] ?? ''),
        ],
        'is_default' => !empty($r['is_default']),
        'created_at' => $r['created_at'],
        'updated_at' => $r['updated_at'],
    ];
}

function pm_saved_view_payload(array $body): array {
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '') pm_error('Name is required');
    $view = trim((string)($body['view_key'] ?? 'list'));
    if (!in_array($view, ['dashboard','kanban','list','checklist','calendar'], true)) $view = 'list';
    $f = $body['filters'] ?? [];
    if (!is_array($f)) $f = [];
    $filters = [
        'project' => isset($f['project']) && $f['project'] !== '' ? (int)$f['project'] : null,
        'assignee' => isset($f['assignee']) && $f['assignee'] !== '' ? (int)$f['assignee'] : null,
        'labels' => array_values(array_unique(array_map('intval', (array)($f['labels'] ?? [])))),
        'search' => mb_substr((string)($f['search'] ?? ''), 0, 200),
    ];
    return [$name, $view, json_encode($filters), !empty($body['is_default']) ? 1 : 0];
}

if ($method === 'GET' && $id === null) {
    $rows = pm_fetch_all('SELECT * FROM saved_views WHERE user_id = ? ORDER BY is_default DESC, updated_at DESC, id DESC', [$uid]);
    pm_json(['saved_views' => array_map('pm_saved_view_shape', $rows)]);
}

if ($method === 'POST' && $id === null) {
    [$name, $view, $filters, $isDefault] = pm_saved_view_payload(pm_body());
    if ($isDefault) pm_exec('UPDATE saved_views SET is_default = 0 WHERE user_id = ?', [$uid]);
    pm_exec('INSERT INTO saved_views (user_id, name, view_key, filters_json, is_default) VALUES (?,?,?,?,?)',
        [$uid, $name, $view, $filters, $isDefault]);
    $row = pm_fetch_one('SELECT * FROM saved_views WHERE id = ?', [pm_last_id()]);
    pm_json(['saved_view' => pm_saved_view_shape($row)]);
}

if ($id !== null) {
    $row = pm_fetch_one('SELECT * FROM saved_views WHERE id = ? AND user_id = ?', [$id, $uid]);
    if (!$row) pm_error('Not found', 404);

    if ($method === 'PATCH') {
        $body = pm_body();
        $merged = [
            'name' => $body['name'] ?? $row['name'],
            'view_key' => $body['view_key'] ?? $row['view_key'],
            'filters' => array_merge((array)json_decode((string)$row['filters_json'], true), (array)($body['filters'] ?? [])),
            'is_default' => array_key_exists('is_default', $body) ? !empty($body['is_default']) : !empty($row['is_default']),
        ];
        [$name, $view, $filters, $isDefault] = pm_saved_view_payload($merged);
        if ($isDefault) pm_exec('UPDATE saved_views SET is_default = 0 WHERE user_id = ?', [$uid]);
        pm_exec('UPDATE saved_views SET name=?, view_key=?, filters_json=?, is_default=? WHERE id=? AND user_id=?',
            [$name, $view, $filters, $isDefault, $id, $uid]);
        $row = pm_fetch_one('SELECT * FROM saved_views WHERE id = ? AND user_id = ?', [$id, $uid]);
        pm_json(['saved_view' => pm_saved_view_shape($row)]);
    }

    if ($method === 'DELETE') {
        pm_exec('DELETE FROM saved_views WHERE id = ? AND user_id = ?', [$id, $uid]);
        pm_json(['ok' => true]);
    }
}

pm_error('Method not allowed', 405);
