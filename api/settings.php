<?php
// Key/value helpers for the app_settings table. Values are JSON-encoded scalars
// or objects; reads return the decoded structure (or $default on miss).

require_once __DIR__ . '/db.php';

function pm_setting_get(string $name, $default = null) {
    try {
        $row = pm_fetch_one('SELECT value FROM app_settings WHERE name = ?', [$name]);
    } catch (Throwable $_) {
        return $default; // table may not exist on stale installs
    }
    if (!$row || $row['value'] === null) return $default;
    $decoded = json_decode((string)$row['value'], true);
    return is_array($decoded) || is_scalar($decoded) ? $decoded : $default;
}

function pm_setting_set(string $name, $value): void {
    $json = $value === null ? null : json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    pm_exec(
        'INSERT INTO app_settings (name, value) VALUES (?,?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [$name, $json]
    );
}
