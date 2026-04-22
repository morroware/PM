<?php
// Slack Web API helper. All sends are non-blocking: failures are logged into
// app_settings (slack.last_error) so admins can see status, and return false
// instead of bubbling exceptions that would break user writes.

require_once __DIR__ . '/settings.php';

function pm_slack_settings(): array {
    $defaults = [
        'enabled'         => false,
        'bot_token'       => '',
        'default_channel' => '',
        'events'          => [
            'task_completed'  => true,
            'task_created'    => false,
            'task_assigned'   => false,
            'comment_added'   => true,
            'project_archived'=> false,
        ],
        'last_ok_at'      => null,
        'last_error'      => null,
        'last_error_at'   => null,
    ];
    $stored = pm_setting_get('slack', []);
    if (!is_array($stored)) $stored = [];
    return array_replace_recursive($defaults, $stored);
}

function pm_slack_is_enabled(): bool {
    $s = pm_slack_settings();
    return !empty($s['enabled']) && !empty($s['bot_token']);
}

function pm_slack_event_on(string $event): bool {
    $s = pm_slack_settings();
    return !empty($s['enabled']) && !empty($s['bot_token']) && !empty($s['events'][$event]);
}

// Resolve the channel to post into: explicit override > project override > default.
function pm_slack_channel_for_project(?array $project = null): string {
    $s = pm_slack_settings();
    if ($project && !empty($project['slack_channel'])) return (string)$project['slack_channel'];
    return (string)($s['default_channel'] ?? '');
}

// Non-blocking: returns true on OK, false on any failure. Stores last error.
function pm_slack_post(string $channel, string $text, array $opts = []): bool {
    if ($channel === '') {
        pm_slack_note_error('No channel configured');
        return false;
    }
    $s = pm_slack_settings();
    $token = (string)($s['bot_token'] ?? '');
    if ($token === '') {
        pm_slack_note_error('No bot token configured');
        return false;
    }
    $payload = array_merge([
        'channel' => $channel,
        'text'    => $text,
    ], $opts);

    $ch = curl_init('https://slack.com/api/chat.postMessage');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 4,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json; charset=utf-8',
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($body === false) {
        pm_slack_note_error('Network error: ' . ($err ?: "HTTP $code"));
        return false;
    }
    $decoded = json_decode((string)$body, true);
    if (!is_array($decoded) || empty($decoded['ok'])) {
        $msg = is_array($decoded) ? ($decoded['error'] ?? 'Unknown Slack error') : 'Invalid response';
        pm_slack_note_error('Slack API: ' . $msg);
        return false;
    }
    pm_slack_note_ok();
    return true;
}

function pm_slack_note_error(string $msg): void {
    try {
        $s = pm_slack_settings();
        $s['last_error']    = mb_substr($msg, 0, 400);
        $s['last_error_at'] = date('Y-m-d H:i:s');
        pm_setting_set('slack', $s);
    } catch (Throwable $_) { /* ignore */ }
}

function pm_slack_note_ok(): void {
    try {
        $s = pm_slack_settings();
        $s['last_ok_at']  = date('Y-m-d H:i:s');
        $s['last_error']  = null;
        $s['last_error_at'] = null;
        pm_setting_set('slack', $s);
    } catch (Throwable $_) { /* ignore */ }
}

// Build the standard "task" Slack line. Caller provides the action verb.
function pm_slack_format_task(array $task, string $verb, ?array $actor = null, ?array $project = null, ?string $extra = null): string {
    $proj   = $project ? "[{$project['name']}] " : '';
    $ref    = $task['ref'] ?? ('#' . (int)($task['id'] ?? 0));
    $title  = $task['title'] ?? '';
    $who    = $actor ? ($actor['name'] ?? 'Someone') : 'Someone';
    $base   = "{$proj}*{$ref}* {$title}\n{$who} {$verb}";
    if ($extra !== null && $extra !== '') $base .= "\n> " . mb_substr($extra, 0, 400);
    return $base;
}
