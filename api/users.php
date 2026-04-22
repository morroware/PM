<?php
require_once __DIR__ . '/bootstrap.php';
pm_boot();
pm_require_auth();

$method = pm_method();
$id = pm_int_param('id');

if ($method === 'GET' && $id === null) {
    $rows = pm_fetch_all('SELECT id, name, role, initials, color, is_admin FROM users ORDER BY name');
    pm_json(['users' => array_map('pm_public_user', $rows)]);
}

if ($method === 'DELETE' && $id !== null) {
    pm_require_admin();
    // Prevent deleting yourself
    if ($id === pm_current_user_id()) pm_error('Cannot delete yourself', 400);
    pm_exec('DELETE FROM users WHERE id = ?', [$id]);
    pm_json(['ok' => true]);
}

if ($method === 'PATCH' && $id !== null) {
    pm_require_admin();
    $body = pm_body();
    $f=[]; $p=[];
    if (isset($body['role']))    { $f[]='role = ?';    $p[]=(string)$body['role']; }
    if (isset($body['name']))    { $f[]='name = ?';    $p[]=trim((string)$body['name']); }
    if (isset($body['color'])) {
        $c = (string)$body['color'];
        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $c)) pm_error('Invalid color');
        $f[]='color = ?';   $p[]=$c;
    }
    if (isset($body['is_admin'])){ $f[]='is_admin = ?';$p[]=!empty($body['is_admin']) ? 1 : 0; }
    if (!$f) pm_error('Nothing to update');
    $p[] = $id;
    pm_exec('UPDATE users SET ' . implode(',', $f) . ' WHERE id = ?', $p);
    pm_json(['ok' => true]);
}

pm_error('Method not allowed', 405);
