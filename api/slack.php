<?php
// Slack integration settings. Admin-only. The bot token is never returned to
// the client in full: GET exposes a masked preview so admins can confirm
// something is set without leaking the secret through browser dev tools.

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/slack_client.php';
pm_boot();
pm_require_auth();

$method = pm_method();

function pm_slack_public_shape(array $s): array {
    $token = (string)($s['bot_token'] ?? '');
    return [
        'enabled'         => !empty($s['enabled']),
        'has_token'       => $token !== '',
        'token_preview'   => $token === '' ? '' : (substr($token, 0, 8) . '…' . substr($token, -4)),
        'default_channel' => $s['default_channel'] ?? '',
        'events'          => $s['events'] ?? [],
        'templates'       => $s['templates'] ?? [],
        'delivery_history'=> $s['delivery_history'] ?? [],
        'last_ok_at'      => $s['last_ok_at'] ?? null,
        'last_error'      => $s['last_error'] ?? null,
        'last_error_at'   => $s['last_error_at'] ?? null,
    ];
}

if ($method === 'GET') {
    pm_require_admin();
    pm_json(['slack' => pm_slack_public_shape(pm_slack_settings())]);
}

if ($method === 'POST') {
    pm_require_admin();
    $action = (string)pm_param('action', 'save');
    $s = pm_slack_settings();

    if ($action === 'save') {
        $body = pm_body();
        if (array_key_exists('enabled', $body))         $s['enabled'] = !empty($body['enabled']);
        if (array_key_exists('default_channel', $body)) $s['default_channel'] = trim((string)$body['default_channel']);
        if (array_key_exists('bot_token', $body)) {
            $tok = trim((string)$body['bot_token']);
            // Allow clearing with empty string; otherwise require plausible
            // xoxb- prefix to surface obvious copy-paste mistakes early.
            if ($tok !== '' && strpos($tok, 'xoxb-') !== 0 && strpos($tok, 'xoxp-') !== 0) {
                pm_error('Token should start with xoxb- or xoxp-');
            }
            $s['bot_token'] = $tok;
        }
        if (isset($body['events']) && is_array($body['events'])) {
            foreach (['task_completed','task_created','task_assigned','comment_added','project_archived','mention_added'] as $k) {
                if (array_key_exists($k, $body['events'])) {
                    $s['events'][$k] = !empty($body['events'][$k]);
                }
            }
        }
        if (isset($body['templates']) && is_array($body['templates'])) {
            foreach (['task_completed','task_created','task_assigned','comment_added','project_archived','mention_added'] as $k) {
                if (array_key_exists($k, $body['templates'])) {
                    $s['templates'][$k] = mb_substr(trim((string)$body['templates'][$k]), 0, 500);
                }
            }
        }
        if ($s['default_channel'] !== '' && !preg_match('/^[#@]?[A-Za-z0-9\-_.]{1,80}$/', (string)$s['default_channel'])) {
            pm_error('Invalid default channel');
        }
        pm_setting_set('slack', $s);
        pm_json(['slack' => pm_slack_public_shape($s)]);
    }

    if ($action === 'test') {
        $channel = trim((string)pm_param('channel', $s['default_channel'] ?? ''));
        if ($channel === '') pm_error('No channel to test');
        $me = pm_current_user();
        $who = $me['name'] ?? 'An admin';
        $ok = pm_slack_post($channel,
            ":white_check_mark: {$who} sent a test message from the Project Manager.");
        if (!$ok) {
            $err = pm_slack_settings()['last_error'] ?? 'Unknown error';
            pm_error('Slack test failed: ' . $err, 502);
        }
        pm_json(['ok' => true]);
    }

    pm_error('Unknown action');
}

pm_error('Method not allowed', 405);
