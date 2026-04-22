<?php
// Shared bootstrap: starts session, parses JSON body, auth helpers, JSON responders.

require_once __DIR__ . '/db.php';

function pm_boot(): void {
    $c = pm_config();
    if (session_status() === PHP_SESSION_NONE) {
        session_name($c['session_name']);
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => !empty($c['cookie_secure']),
            'httponly' => true,
            'samesite' => $c['cookie_samesite'] ?? 'Lax',
        ]);
        session_start();
    }
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    // Minimal hardening appropriate for JSON API responses. No CSP here —
    // it's delivered by the static HTML shells — but clickjacking/referrer
    // protection costs nothing and the API never intentionally renders HTML.
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    if (!empty($c['cookie_secure'])) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

function pm_method(): string {
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

function pm_body(): array {
    static $body = null;
    if ($body !== null) return $body;
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') return $body = [];
    $j = json_decode($raw, true);
    return $body = (is_array($j) ? $j : []);
}

function pm_json($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function pm_error(string $msg, int $status = 400): void {
    pm_json(['error' => $msg], $status);
}

function pm_current_user_id(): ?int {
    return isset($_SESSION['uid']) ? (int)$_SESSION['uid'] : null;
}

function pm_require_auth(): int {
    $uid = pm_current_user_id();
    if (!$uid) pm_error('Not authenticated', 401);
    return $uid;
}

function pm_current_user(): ?array {
    $uid = pm_current_user_id();
    if (!$uid) return null;
    return pm_fetch_one(
        'SELECT id, email, name, role, initials, color, is_admin FROM users WHERE id = ?',
        [$uid]
    );
}

function pm_require_admin(): array {
    $u = pm_current_user();
    if (!$u) pm_error('Not authenticated', 401);
    if (empty($u['is_admin'])) pm_error('Admin only', 403);
    return $u;
}

function pm_param(string $key, $default = null) {
    if (array_key_exists($key, $_GET)) return $_GET[$key];
    $b = pm_body();
    return $b[$key] ?? $default;
}

function pm_int_param(string $key, ?int $default = null): ?int {
    $v = pm_param($key, $default);
    return $v === null || $v === '' ? $default : (int)$v;
}

// Return an HTML-safe user display shape (for responses).
function pm_public_user(array $row): array {
    return [
        'id'       => (int)$row['id'],
        'name'     => $row['name'],
        'role'     => $row['role'],
        'initials' => $row['initials'],
        'color'    => $row['color'],
        'email'    => $row['email'] ?? null,
        'is_admin' => !empty($row['is_admin']),
    ];
}
