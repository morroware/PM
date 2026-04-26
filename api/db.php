<?php
// PDO connection + tiny helpers. Required by every endpoint.

function pm_config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $path = __DIR__ . '/config.php';
        if (!file_exists($path)) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Missing api/config.php. Copy config from template and edit credentials.']);
            exit;
        }
        $cfg = require $path;
    }
    return $cfg;
}

function pm_db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $c = pm_config();
    $dsn = "mysql:host={$c['db_host']};dbname={$c['db_name']};charset={$c['db_charset']}";
    try {
        $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        // Pin the session time zone to UTC so TIMESTAMP reads/writes are
        // consistent regardless of the cPanel host's local TZ. The frontend
        // (relTime in dashboard.js, detail.js) already parses these strings
        // as UTC, so without this clients see "X ago" off by hours.
        try { $pdo->exec("SET time_zone = '+00:00'"); } catch (Throwable $_) { /* best effort */ }
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Database connection failed. Check api/config.php.']);
        exit;
    }
    return $pdo;
}

function pm_fetch_all(string $sql, array $params = []): array {
    $st = pm_db()->prepare($sql);
    $st->execute($params);
    return $st->fetchAll();
}

function pm_fetch_one(string $sql, array $params = []): ?array {
    $st = pm_db()->prepare($sql);
    $st->execute($params);
    $row = $st->fetch();
    return $row === false ? null : $row;
}

function pm_exec(string $sql, array $params = []): int {
    $st = pm_db()->prepare($sql);
    $st->execute($params);
    return $st->rowCount();
}

function pm_last_id(): int {
    return (int) pm_db()->lastInsertId();
}
