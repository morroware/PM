<?php
require_once __DIR__ . '/bootstrap.php';

function pm_attachments_dir(): string {
    $cfg = pm_config();
    $raw = $cfg['attachments_dir'] ?? (__DIR__ . '/../storage/attachments');
    if (!is_string($raw) || $raw === '') {
        $raw = __DIR__ . '/../storage/attachments';
    }
    $resolved = realpath($raw);
    return $resolved !== false ? $resolved : $raw;
}

function pm_attachments_max_bytes(): int {
    $cfg = pm_config();
    $n = isset($cfg['attachments_max_bytes']) ? (int)$cfg['attachments_max_bytes'] : (10 * 1024 * 1024);
    return max(1024, $n);
}

function pm_ensure_attachments_dir(): string {
    $dir = pm_attachments_dir();
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
            pm_error('Attachment storage is not writable', 500);
        }
    }
    if (!is_writable($dir)) {
        pm_error('Attachment storage is not writable', 500);
    }
    return $dir;
}

function pm_attachment_safe_ext(string $name): string {
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if ($ext === '') return '';
    $ext = preg_replace('/[^a-z0-9]/', '', $ext);
    return mb_substr($ext, 0, 12);
}

function pm_attachment_shape(array $row): array {
    return [
        'id' => (int)$row['id'],
        'task_id' => (int)$row['task_id'],
        'name' => $row['original_name'],
        'mime' => $row['mime_type'] ?: 'application/octet-stream',
        'size' => (int)$row['size_bytes'],
        'uploaded_by' => isset($row['uploaded_by']) && $row['uploaded_by'] !== null ? (int)$row['uploaded_by'] : null,
        'created_at' => $row['created_at'],
        'download_url' => 'api/attachments.php?id=' . (int)$row['id'] . '&download=1',
    ];
}

function pm_attachment_abs_path(string $storedName): string {
    return rtrim(pm_attachments_dir(), '/\\') . DIRECTORY_SEPARATOR . $storedName;
}

function pm_attachment_delete_file(string $storedName): void {
    if ($storedName === '') return;
    $path = pm_attachment_abs_path($storedName);
    if (is_file($path)) {
        @unlink($path);
    }
}
