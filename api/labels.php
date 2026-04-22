<?php
require_once __DIR__ . '/bootstrap.php';
pm_boot();
pm_require_auth();

$method = pm_method();
$id = pm_int_param('id');

function pm_label_shape(array $r): array {
    return [
        'id'         => (int)$r['id'],
        'name'       => $r['name'],
        'color'      => $r['color'],
        'project_id' => isset($r['project_id']) && $r['project_id'] !== null ? (int)$r['project_id'] : null,
        'archived'   => !empty($r['archived']),
    ];
}

// The UI only styles these eight named colors. Anything else would render as
// an unstyled ghost tag, so reject it at the API boundary.
if (!defined('PM_LABEL_COLORS')) {
    define('PM_LABEL_COLORS', ['red','blue','amber','green','violet','slate','pink','cyan']);
}

if ($method === 'GET' && $id === null) {
    $includeArchived = !empty($_GET['include_archived']);
    $projectId       = pm_int_param('project_id');
    $where = [];
    $params = [];
    if (!$includeArchived) $where[] = 'archived = 0';
    if ($projectId !== null) {
        // Scope lookup: return labels that apply to this project
        // (either global project_id IS NULL or matching project_id).
        $where[]  = '(project_id IS NULL OR project_id = ?)';
        $params[] = $projectId;
    }
    $sql = 'SELECT id, name, color, project_id, archived FROM labels';
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY project_id IS NOT NULL, name';
    $rows = pm_fetch_all($sql, $params);
    pm_json(['labels' => array_map('pm_label_shape', $rows)]);
}

if ($method === 'POST' && $id === null) {
    pm_require_admin();
    $name      = trim((string)pm_param('name', ''));
    $color     = (string)pm_param('color', 'slate');
    $projectId = pm_int_param('project_id');
    if ($name === '') pm_error('Name required');
    if (!in_array($color, PM_LABEL_COLORS, true)) pm_error('Invalid color. Use one of: ' . implode(', ', PM_LABEL_COLORS));
    if ($projectId !== null) {
        $proj = pm_fetch_one('SELECT id FROM projects WHERE id = ?', [$projectId]);
        if (!$proj) pm_error('Invalid project_id');
    }
    // Duplicate prevention within scope. Case-insensitive comparison.
    $dupWhere = 'LOWER(name) = LOWER(?) AND archived = 0 AND ';
    $dupParams = [$name];
    if ($projectId === null) {
        $dupWhere .= 'project_id IS NULL';
    } else {
        $dupWhere .= 'project_id = ?';
        $dupParams[] = $projectId;
    }
    $dup = pm_fetch_one("SELECT id FROM labels WHERE $dupWhere LIMIT 1", $dupParams);
    if ($dup) pm_error('A label with that name already exists in this scope', 409);

    pm_exec('INSERT INTO labels (name, color, project_id) VALUES (?,?,?)',
        [$name, $color, $projectId]);
    $nid = pm_last_id();
    $row = pm_fetch_one('SELECT id, name, color, project_id, archived FROM labels WHERE id = ?', [$nid]);
    pm_json(['label' => pm_label_shape($row)]);
}

if ($method === 'PATCH' && $id !== null) {
    pm_require_admin();
    $body = pm_body();
    $f = []; $p = [];
    if (isset($body['name']))  {
        $n = trim((string)$body['name']);
        if ($n === '') pm_error('Name cannot be empty');
        $f[]='name = ?';  $p[]=$n;
    }
    if (isset($body['color'])) {
        $c = (string)$body['color'];
        if (!in_array($c, PM_LABEL_COLORS, true)) pm_error('Invalid color. Use one of: ' . implode(', ', PM_LABEL_COLORS));
        $f[]='color = ?'; $p[]=$c;
    }
    if (array_key_exists('project_id', $body)) {
        $pid = $body['project_id'];
        if ($pid === null || $pid === '') {
            $f[]='project_id = NULL';
        } else {
            $pid = (int)$pid;
            $proj = pm_fetch_one('SELECT id FROM projects WHERE id = ?', [$pid]);
            if (!$proj) pm_error('Invalid project_id');
            $f[]='project_id = ?'; $p[]=$pid;
        }
    }
    if (array_key_exists('archived', $body)) {
        $f[]='archived = ?'; $p[]=!empty($body['archived']) ? 1 : 0;
    }
    if (!$f) pm_error('Nothing to update');
    $p[] = $id;
    pm_exec('UPDATE labels SET ' . implode(',', $f) . ' WHERE id = ?', $p);
    $row = pm_fetch_one('SELECT id, name, color, project_id, archived FROM labels WHERE id = ?', [$id]);
    if (!$row) pm_error('Not found', 404);
    pm_json(['label' => pm_label_shape($row)]);
}

if ($method === 'DELETE' && $id !== null) {
    pm_require_admin();
    pm_exec('DELETE FROM labels WHERE id = ?', [$id]);
    pm_json(['ok' => true]);
}

pm_error('Method not allowed', 405);
