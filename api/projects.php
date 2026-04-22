<?php
require_once __DIR__ . '/bootstrap.php';
pm_boot();
pm_require_auth();

$method = pm_method();
$id = pm_int_param('id');

if ($method === 'GET' && $id === null) {
    $rows = pm_fetch_all('SELECT id, name, color, key_prefix, sort_order, archived FROM projects WHERE archived = 0 ORDER BY sort_order, id');
    pm_json(['projects' => array_map(fn($r) => [
        'id'         => (int)$r['id'],
        'name'       => $r['name'],
        'color'      => $r['color'],
        'key_prefix' => $r['key_prefix'],
    ], $rows)]);
}

if ($method === 'POST' && $id === null) {
    pm_require_admin();
    $name   = trim((string)pm_param('name', ''));
    $color  = (string)pm_param('color', '#3B82F6');
    $prefix = strtoupper(trim((string)pm_param('key_prefix', 'PRJ')));
    if ($name === '') pm_error('Name required');
    if ($prefix === '' || !preg_match('/^[A-Z0-9]{1,8}$/', $prefix)) pm_error('Invalid key_prefix');
    pm_exec('INSERT INTO projects (name, color, key_prefix) VALUES (?,?,?)',
        [$name, $color, $prefix]);
    $nid = pm_last_id();
    pm_json(['project' => [
        'id' => $nid, 'name' => $name, 'color' => $color, 'key_prefix' => $prefix
    ]]);
}

if ($method === 'PATCH' && $id !== null) {
    pm_require_admin();
    $body = pm_body();
    $f = []; $p = [];
    if (isset($body['name']))   { $f[]='name = ?';   $p[]=trim((string)$body['name']); }
    if (isset($body['color']))  { $f[]='color = ?';  $p[]=(string)$body['color']; }
    if (isset($body['archived'])){$f[]='archived = ?'; $p[]=!empty($body['archived']) ? 1 : 0; }
    if (!$f) pm_error('Nothing to update');
    $p[] = $id;
    pm_exec('UPDATE projects SET ' . implode(',', $f) . ' WHERE id = ?', $p);
    pm_json(['ok' => true]);
}

if ($method === 'DELETE' && $id !== null) {
    pm_require_admin();
    pm_exec('DELETE FROM projects WHERE id = ?', [$id]);
    pm_json(['ok' => true]);
}

pm_error('Method not allowed', 405);
