<?php
// Recurring task templates. Each row describes a cadence that spawns real
// task rows. Generation is lazy: when a generated task is marked done
// (tasks.php), the next instance is created based on the rule's next_run.
//
// Admins or the rule's creator can edit/delete. All authenticated users can
// list so the sidebar/settings view can surface them.

require_once __DIR__ . '/bootstrap.php';
pm_boot();
pm_require_auth();

$method = pm_method();
$id     = pm_int_param('id');

if (!defined('PM_RECUR_CADENCES')) {
    define('PM_RECUR_CADENCES', ['daily','weekly','monthly','yearly']);
}

function pm_recurring_shape(array $r): array {
    return [
        'id'                => (int)$r['id'],
        'project_id'        => (int)$r['project_id'],
        'title'             => $r['title'],
        'description'       => $r['description'],
        'priority'          => (int)$r['priority'],
        'estimate'          => $r['estimate'],
        'assignees'         => pm_decode_id_list($r['assignees']),
        'labels'            => pm_decode_id_list($r['labels']),
        'cadence'           => $r['cadence'],
        'interval_n'        => max(1, (int)$r['interval_n']),
        'weekday'           => $r['weekday']       === null ? null : (int)$r['weekday'],
        'month_day'         => $r['month_day']     === null ? null : (int)$r['month_day'],
        'month_of_year'     => $r['month_of_year'] === null ? null : (int)$r['month_of_year'],
        'next_run'          => $r['next_run'],
        'ends_on'           => $r['ends_on'],
        'occurrences_left'  => $r['occurrences_left'] === null ? null : (int)$r['occurrences_left'],
        'paused'            => !empty($r['paused']),
        'last_task_id'      => $r['last_task_id'] === null ? null : (int)$r['last_task_id'],
    ];
}

function pm_decode_id_list($raw): array {
    if ($raw === null || $raw === '') return [];
    $decoded = json_decode((string)$raw, true);
    return is_array($decoded) ? array_values(array_map('intval', $decoded)) : [];
}

function pm_encode_id_list($v): ?string {
    if (!is_array($v)) return null;
    $clean = array_values(array_unique(array_map('intval', $v)));
    return $clean ? json_encode($clean) : null;
}

function pm_validate_cadence_fields(array &$r): void {
    if (!in_array($r['cadence'], PM_RECUR_CADENCES, true)) {
        pm_error('Invalid cadence; use one of: ' . implode(', ', PM_RECUR_CADENCES));
    }
    $r['interval_n'] = max(1, (int)($r['interval_n'] ?? 1));
    if ($r['cadence'] === 'weekly' && $r['weekday'] !== null) {
        $r['weekday'] = max(0, min(6, (int)$r['weekday']));
    }
    if ($r['cadence'] === 'monthly' && $r['month_day'] !== null) {
        $r['month_day'] = max(1, min(31, (int)$r['month_day']));
    }
    if ($r['cadence'] === 'yearly') {
        if ($r['month_of_year'] !== null) $r['month_of_year'] = max(1, min(12, (int)$r['month_of_year']));
        if ($r['month_day']     !== null) $r['month_day']     = max(1, min(31, (int)$r['month_day']));
    }
}

// Advance a date one step according to the rule. If after advancing we land on
// an invalid calendar day (e.g. "31st of Feb"), clamp to the month's last day.
function pm_recurring_next_date(string $fromYmd, array $rule): string {
    $ts = strtotime($fromYmd . ' 00:00:00');
    if ($ts === false) $ts = time();
    $interval = max(1, (int)$rule['interval_n']);
    switch ($rule['cadence']) {
        case 'daily':
            $ts = strtotime("+{$interval} day", $ts);
            break;
        case 'weekly':
            $ts = strtotime("+{$interval} week", $ts);
            if ($rule['weekday'] !== null) {
                $target = (int)$rule['weekday'];
                $cur = (int)date('w', $ts);
                $delta = ($target - $cur + 7) % 7;
                if ($delta) $ts = strtotime("+{$delta} day", $ts);
            }
            break;
        case 'monthly': {
            $y = (int)date('Y', $ts);
            $m = (int)date('m', $ts);
            $m += $interval;
            while ($m > 12) { $m -= 12; $y++; }
            $d = $rule['month_day'] !== null ? (int)$rule['month_day'] : (int)date('d', $ts);
            $lastDay = (int)date('t', strtotime(sprintf('%04d-%02d-01', $y, $m)));
            $d = min($d, $lastDay);
            $ts = mktime(0, 0, 0, $m, $d, $y);
            break;
        }
        case 'yearly': {
            $y = (int)date('Y', $ts) + $interval;
            $m = $rule['month_of_year'] !== null ? (int)$rule['month_of_year'] : (int)date('m', $ts);
            $d = $rule['month_day']     !== null ? (int)$rule['month_day']     : (int)date('d', $ts);
            $lastDay = (int)date('t', strtotime(sprintf('%04d-%02d-01', $y, $m)));
            $d = min($d, $lastDay);
            $ts = mktime(0, 0, 0, $m, $d, $y);
            break;
        }
    }
    return date('Y-m-d', $ts);
}

// Shared writer used by POST (create) and PATCH (update).
function pm_recurring_save(array $input, ?int $existingId = null): int {
    $title     = trim((string)($input['title'] ?? ''));
    if ($title === '') pm_error('Title required');
    $projectId = (int)($input['project_id'] ?? 0);
    if (!$projectId) pm_error('project_id required');
    $proj = pm_fetch_one('SELECT id FROM projects WHERE id = ?', [$projectId]);
    if (!$proj) pm_error('Invalid project_id');

    $shape = [
        'project_id'       => $projectId,
        'title'            => $title,
        'description'      => $input['description'] ?? null,
        'priority'         => isset($input['priority']) ? (int)$input['priority'] : 2,
        'estimate'         => isset($input['estimate']) ? (string)$input['estimate'] : null,
        'assignees'        => pm_encode_id_list($input['assignees'] ?? []),
        'labels'           => pm_encode_id_list($input['labels'] ?? []),
        'cadence'          => strtolower((string)($input['cadence'] ?? 'weekly')),
        'interval_n'       => (int)($input['interval_n'] ?? 1),
        'weekday'          => isset($input['weekday'])       && $input['weekday'] !== ''       ? (int)$input['weekday']       : null,
        'month_day'        => isset($input['month_day'])     && $input['month_day'] !== ''     ? (int)$input['month_day']     : null,
        'month_of_year'    => isset($input['month_of_year']) && $input['month_of_year'] !== '' ? (int)$input['month_of_year'] : null,
        'next_run'         => !empty($input['next_run']) ? (string)$input['next_run'] : date('Y-m-d'),
        'ends_on'          => !empty($input['ends_on']) ? (string)$input['ends_on'] : null,
        'occurrences_left' => isset($input['occurrences_left']) && $input['occurrences_left'] !== '' ? (int)$input['occurrences_left'] : null,
        'paused'           => !empty($input['paused']) ? 1 : 0,
    ];
    pm_validate_cadence_fields($shape);

    if ($existingId) {
        pm_exec(
            'UPDATE recurring_rules SET
                project_id=?, title=?, description=?, priority=?, estimate=?,
                assignees=?, labels=?, cadence=?, interval_n=?, weekday=?,
                month_day=?, month_of_year=?, next_run=?, ends_on=?, occurrences_left=?, paused=?
             WHERE id=?',
            [
                $shape['project_id'], $shape['title'], $shape['description'], $shape['priority'], $shape['estimate'],
                $shape['assignees'], $shape['labels'], $shape['cadence'], $shape['interval_n'], $shape['weekday'],
                $shape['month_day'], $shape['month_of_year'], $shape['next_run'], $shape['ends_on'],
                $shape['occurrences_left'], $shape['paused'], $existingId
            ]
        );
        return $existingId;
    }
    pm_exec(
        'INSERT INTO recurring_rules
            (project_id, title, description, priority, estimate, assignees, labels,
             cadence, interval_n, weekday, month_day, month_of_year,
             next_run, ends_on, occurrences_left, paused, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
            $shape['project_id'], $shape['title'], $shape['description'], $shape['priority'], $shape['estimate'],
            $shape['assignees'], $shape['labels'], $shape['cadence'], $shape['interval_n'], $shape['weekday'],
            $shape['month_day'], $shape['month_of_year'], $shape['next_run'], $shape['ends_on'],
            $shape['occurrences_left'], $shape['paused'], pm_current_user_id(),
        ]
    );
    return pm_last_id();
}

if ($method === 'GET' && $id === null) {
    $rows = pm_fetch_all('SELECT * FROM recurring_rules ORDER BY project_id, id');
    pm_json(['rules' => array_map('pm_recurring_shape', $rows)]);
}

if ($method === 'GET' && $id !== null) {
    $r = pm_fetch_one('SELECT * FROM recurring_rules WHERE id = ?', [$id]);
    if (!$r) pm_error('Not found', 404);
    pm_json(['rule' => pm_recurring_shape($r)]);
}

if ($method === 'POST' && $id === null) {
    pm_require_admin();
    $body = pm_body();
    $nid = pm_recurring_save($body, null);
    $r = pm_fetch_one('SELECT * FROM recurring_rules WHERE id = ?', [$nid]);
    pm_json(['rule' => pm_recurring_shape($r)]);
}

if ($method === 'PATCH' && $id !== null) {
    pm_require_admin();
    $r = pm_fetch_one('SELECT * FROM recurring_rules WHERE id = ?', [$id]);
    if (!$r) pm_error('Not found', 404);
    // Merge incoming over existing so partial updates are supported.
    $body = pm_body();
    $merged = array_merge(pm_recurring_shape($r), $body);
    pm_recurring_save($merged, $id);
    $r = pm_fetch_one('SELECT * FROM recurring_rules WHERE id = ?', [$id]);
    pm_json(['rule' => pm_recurring_shape($r)]);
}

if ($method === 'DELETE' && $id !== null) {
    pm_require_admin();
    pm_exec('DELETE FROM recurring_rules WHERE id = ?', [$id]);
    pm_json(['ok' => true]);
}

pm_error('Method not allowed', 405);
