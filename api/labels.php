<?php
require_once __DIR__ . '/bootstrap.php';
pm_boot();
pm_require_auth();

$method = pm_method();
$id = pm_int_param('id');

if ($method === 'GET' && $id === null) {
    $rows = pm_fetch_all('SELECT id, name, color FROM labels ORDER BY id');
    pm_json(['labels' => array_map(fn($r) => [
        'id'=>(int)$r['id'], 'name'=>$r['name'], 'color'=>$r['color']
    ], $rows)]);
}

// The UI only styles these eight named colors. Anything else would render as
// an unstyled ghost tag, so reject it at the API boundary.
if (!defined('PM_LABEL_COLORS')) {
    define('PM_LABEL_COLORS', ['red','blue','amber','green','violet','slate','pink','cyan']);
}

if ($method === 'POST' && $id === null) {
    pm_require_admin();
    $name  = trim((string)pm_param('name', ''));
    $color = (string)pm_param('color', 'slate');
    if ($name === '') pm_error('Name required');
    if (!in_array($color, PM_LABEL_COLORS, true)) pm_error('Invalid color. Use one of: ' . implode(', ', PM_LABEL_COLORS));
    pm_exec('INSERT INTO labels (name, color) VALUES (?,?)', [$name, $color]);
    $nid = pm_last_id();
    pm_json(['label' => ['id'=>$nid,'name'=>$name,'color'=>$color]]);
}

if ($method === 'PATCH' && $id !== null) {
    pm_require_admin();
    $body = pm_body();
    $f = []; $p = [];
    if (isset($body['name']))  { $f[]='name = ?';  $p[]=trim((string)$body['name']); }
    if (isset($body['color'])) {
        $c = (string)$body['color'];
        if (!in_array($c, PM_LABEL_COLORS, true)) pm_error('Invalid color. Use one of: ' . implode(', ', PM_LABEL_COLORS));
        $f[]='color = ?'; $p[]=$c;
    }
    if (!$f) pm_error('Nothing to update');
    $p[] = $id;
    pm_exec('UPDATE labels SET ' . implode(',', $f) . ' WHERE id = ?', $p);
    pm_json(['ok' => true]);
}

if ($method === 'DELETE' && $id !== null) {
    pm_require_admin();
    pm_exec('DELETE FROM labels WHERE id = ?', [$id]);
    pm_json(['ok' => true]);
}

pm_error('Method not allowed', 405);
