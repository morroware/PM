<?php
// One-time installer. Run by visiting /install.php in a browser.
// Creates tables, seeds default projects/labels/statuses, and creates the first admin user.
// DELETE THIS FILE after running once.

require_once __DIR__ . '/api/bootstrap.php';

$errors  = [];
$ok      = [];
$step    = $_GET['step'] ?? '';
$cfg     = null;

try { $cfg = pm_config(); } catch (Throwable $e) { $errors[] = $e->getMessage(); }

// Start a session so we can detect an already-logged-in admin.
if (!$errors && session_status() === PHP_SESSION_NONE) {
    $c = pm_config();
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

// Guard: if an admin already exists, require them to log in before re-running.
$adminExists = false;
$currentAdmin = null;
if (!$errors) {
    try {
        pm_db();
        $row = pm_fetch_one("SELECT COUNT(*) AS c FROM users WHERE is_admin = 1");
        $adminExists = !empty($row) && (int)$row['c'] > 0;
        if ($adminExists) {
            $currentAdmin = pm_current_user();
            if ($currentAdmin && empty($currentAdmin['is_admin'])) $currentAdmin = null;
        }
    } catch (Throwable $e) {
        // tables probably don't exist yet — that's fine
        $adminExists = false;
    }
}

// Block privileged actions once an admin exists unless the caller IS an admin.
// Prevents anyone who stumbles onto install.php from seizing the app.
$installLocked = $adminExists && !$currentAdmin;

// -- Form submission --
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$errors) {
    $action = $_POST['action'] ?? '';

    if ($installLocked) {
        $errors[] = 'This app has already been installed. Sign in as an admin on login.html before re-running, or delete install.php.';
    } elseif ($action === 'install') {
        try {
            pm_install_schema();
            pm_seed_defaults();
            $ok[] = 'Schema created and defaults seeded.';
        } catch (Throwable $e) {
            $errors[] = 'Install failed: ' . $e->getMessage();
        }
    } elseif ($action === 'create_admin') {
        $name  = trim($_POST['name']  ?? '');
        $email = strtolower(trim($_POST['email'] ?? ''));
        $pass  = $_POST['password']   ?? '';
        if ($name === '' || $email === '' || $pass === '') {
            $errors[] = 'Name, email and password are all required.';
        } elseif (strlen($pass) < 8) {
            $errors[] = 'Password must be at least 8 characters.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Invalid email.';
        } else {
            try {
                $existing = pm_fetch_one('SELECT id FROM users WHERE email = ?', [$email]);
                if ($existing) {
                    $errors[] = 'An account with that email already exists.';
                } else {
                    $parts = preg_split('/\s+/', $name);
                    $initials = strtoupper(
                        count($parts) === 1
                            ? mb_substr($parts[0], 0, 2)
                            : mb_substr($parts[0], 0, 1) . mb_substr(end($parts), 0, 1)
                    );
                    pm_exec(
                        'INSERT INTO users (email, password_hash, name, role, initials, color, is_admin)
                         VALUES (?,?,?,?,?,?,1)',
                        [$email, password_hash($pass, PASSWORD_DEFAULT), $name, 'Admin', $initials, '#3B82F6']
                    );
                    $ok[] = 'Admin account created. You can now log in.';
                    $adminExists = true;
                }
            } catch (Throwable $e) {
                $errors[] = 'Could not create admin: ' . $e->getMessage();
            }
        }
    }
}

function pm_install_schema(): void {
    $pdo = pm_db();
    $sql = [
        "CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(120) NOT NULL,
            role VARCHAR(80) DEFAULT NULL,
            initials VARCHAR(4) NOT NULL,
            color VARCHAR(16) NOT NULL DEFAULT '#3B82F6',
            is_admin TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS projects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            color VARCHAR(16) NOT NULL,
            key_prefix VARCHAR(8) NOT NULL DEFAULT 'CTT',
            sort_order INT NOT NULL DEFAULT 0,
            archived TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS labels (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(80) NOT NULL,
            color VARCHAR(16) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ref VARCHAR(24) NOT NULL UNIQUE,
            project_id INT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'todo',
            title VARCHAR(500) NOT NULL,
            description TEXT,
            priority TINYINT NOT NULL DEFAULT 2,
            due DATE NULL,
            estimate VARCHAR(32) NULL,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_project (project_id),
            CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS subtasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            text VARCHAR(500) NOT NULL,
            done TINYINT(1) NOT NULL DEFAULT 0,
            sort_order INT NOT NULL DEFAULT 0,
            INDEX idx_sub_task (task_id),
            CONSTRAINT fk_sub_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS task_assignees (
            task_id INT NOT NULL,
            user_id INT NOT NULL,
            PRIMARY KEY (task_id, user_id),
            CONSTRAINT fk_ta_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            CONSTRAINT fk_ta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS task_labels (
            task_id INT NOT NULL,
            label_id INT NOT NULL,
            PRIMARY KEY (task_id, label_id),
            CONSTRAINT fk_tl_task  FOREIGN KEY (task_id)  REFERENCES tasks(id)  ON DELETE CASCADE,
            CONSTRAINT fk_tl_label FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            user_id INT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cmt_task (task_id),
            CONSTRAINT fk_cmt_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            CONSTRAINT fk_cmt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS activity (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            task_id INT NULL,
            action VARCHAR(40) NOT NULL,
            detail VARCHAR(500) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_act_user (user_id),
            INDEX idx_act_task (task_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    ];
    foreach ($sql as $q) $pdo->exec($q);

    // Re-run safe migrations for installs created before this version.
    pm_migrate_comment_user_nullable();
}

function pm_migrate_comment_user_nullable(): void {
    $pdo = pm_db();
    try {
        $row = pm_fetch_one("SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
                             WHERE TABLE_SCHEMA = DATABASE()
                               AND TABLE_NAME   = 'comments'
                               AND COLUMN_NAME  = 'user_id'");
        if ($row && strtoupper((string)$row['IS_NULLABLE']) === 'NO') {
            // Drop & re-add the FK with ON DELETE SET NULL, and make column nullable.
            // Constraint name matches the one defined in pm_install_schema().
            try { $pdo->exec('ALTER TABLE comments DROP FOREIGN KEY fk_cmt_user'); } catch (Throwable $_) {}
            $pdo->exec('ALTER TABLE comments MODIFY user_id INT NULL');
            $pdo->exec('ALTER TABLE comments
                        ADD CONSTRAINT fk_cmt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        }
        $row = pm_fetch_one("SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
                             WHERE TABLE_SCHEMA = DATABASE()
                               AND TABLE_NAME   = 'activity'
                               AND COLUMN_NAME  = 'user_id'");
        if ($row && strtoupper((string)$row['IS_NULLABLE']) === 'NO') {
            pm_db()->exec('ALTER TABLE activity MODIFY user_id INT NULL');
        }
    } catch (Throwable $_) { /* best effort */ }
}

function pm_seed_defaults(): void {
    // Seed projects (matches the original mockup) if none exist.
    $c = pm_fetch_one('SELECT COUNT(*) AS c FROM projects');
    if ((int)$c['c'] === 0) {
        $projects = [
            ['Server Infrastructure', '#3B82F6', 'CTT'],
            ['Facility Maintenance',  '#22C55E', 'CTT'],
            ['Network Upgrades',      '#A855F7', 'CTT'],
            ['HVAC & Power',          '#F59E0B', 'CTT'],
            ['Security Systems',      '#EF4444', 'CTT'],
        ];
        foreach ($projects as $i => [$n, $col, $k]) {
            pm_exec('INSERT INTO projects (name, color, key_prefix, sort_order) VALUES (?,?,?,?)', [$n, $col, $k, $i]);
        }
    }

    $c = pm_fetch_one('SELECT COUNT(*) AS c FROM labels');
    if ((int)$c['c'] === 0) {
        $labels = [
            ['Bug','red'], ['Feature','blue'], ['Urgent','amber'], ['Preventive','green'],
            ['Routine','slate'], ['Research','violet'], ['Safety','pink'], ['Compliance','cyan'],
        ];
        foreach ($labels as [$n, $c2]) {
            pm_exec('INSERT INTO labels (name, color) VALUES (?,?)', [$n, $c2]);
        }
    }
}

?><!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Install · Project Manager</title>
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; background: #0B0F17; color: #E8ECF4; margin: 0; padding: 40px 20px; }
.wrap { max-width: 560px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
.sub { color: #8A94A8; font-size: 13px; margin-bottom: 24px; }
.card { background: #151B27; border: 1px solid #222B3B; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.card h2 { font-size: 14px; margin: 0 0 12px; color: #C6CDDC; letter-spacing: 0.06em; text-transform: uppercase; }
label { display: block; font-size: 12px; color: #8A94A8; margin-bottom: 4px; margin-top: 10px; font-weight: 500; }
input[type=text], input[type=email], input[type=password] {
    width: 100%; background: #1B2230; border: 1px solid #2B354A; color: #E8ECF4;
    padding: 9px 11px; border-radius: 7px; font: inherit; outline: none;
}
input:focus { border-color: rgba(59,130,246,0.5); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
.btn { display: inline-block; background: #3B82F6; color: white; border: 0; padding: 9px 16px; border-radius: 7px; font-weight: 500; cursor: pointer; font: inherit; margin-top: 14px; }
.btn:hover { background: #60A5FA; }
.btn.gray { background: #232B3C; }
.err { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #FCA5A5; padding: 10px 12px; border-radius: 7px; font-size: 13px; margin-bottom: 16px; }
.ok  { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #86EFAC; padding: 10px 12px; border-radius: 7px; font-size: 13px; margin-bottom: 16px; }
.warn { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #FCD34D; padding: 10px 12px; border-radius: 7px; font-size: 13px; margin-bottom: 16px; }
code { font-family: ui-monospace, Menlo, monospace; background: #1B2230; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
ol { padding-left: 20px; line-height: 1.7; font-size: 13.5px; color: #C6CDDC; }
a { color: #60A5FA; }
</style>
</head><body><div class="wrap">
<h1>Install · Project Manager</h1>
<p class="sub">One-time setup. <strong>Delete this file after you&rsquo;re done.</strong></p>

<?php foreach ($errors as $e): ?><div class="err"><?= htmlspecialchars($e) ?></div><?php endforeach; ?>
<?php foreach ($ok as $m): ?><div class="ok"><?= htmlspecialchars($m) ?></div><?php endforeach; ?>

<?php if ($installLocked): ?>
    <div class="warn">
        This installer is <strong>locked</strong>: an admin already exists.
        <a href="login.html">Sign in as an admin</a> first, then return here.
        Better yet — delete <code>install.php</code> and you&rsquo;re done.
    </div>
<?php endif; ?>

<div class="card">
    <h2>1. Verify database connection</h2>
    <?php if ($cfg): ?>
        <div class="ok">Config loaded. DB: <code><?= htmlspecialchars($cfg['db_name']) ?></code> @ <code><?= htmlspecialchars($cfg['db_host']) ?></code></div>
        <?php try { pm_db(); echo '<div class="ok">Connection successful.</div>'; } catch (Throwable $e) { echo '<div class="err">Cannot connect. Edit <code>api/config.php</code> with your cPanel MySQL credentials.</div>'; } ?>
    <?php else: ?>
        <div class="err">Edit <code>api/config.php</code> with your DB credentials, then reload this page.</div>
    <?php endif; ?>
</div>

<div class="card">
    <h2>2. Create tables + seed defaults</h2>
    <p style="color:#8A94A8;font-size:13px;margin:0 0 8px;">Creates all tables and seeds 5 projects + 8 labels from the original mockup. Safe to re-run.</p>
    <form method="post">
        <input type="hidden" name="action" value="install">
        <button class="btn" type="submit"<?= $installLocked ? ' disabled style="opacity:.5;cursor:not-allowed"' : '' ?>>Run install</button>
    </form>
</div>

<div class="card">
    <h2>3. Create the first admin user</h2>
    <?php if ($adminExists && !$installLocked): ?>
        <div class="warn">At least one admin already exists. You can still create another.</div>
    <?php endif; ?>
    <?php if ($installLocked): ?>
        <p style="color:#8A94A8;font-size:13px;margin:0;">Locked — see the warning above.</p>
    <?php else: ?>
    <form method="post">
        <input type="hidden" name="action" value="create_admin">
        <label>Your name</label>
        <input type="text" name="name" required value="<?= htmlspecialchars($_POST['name'] ?? '') ?>">
        <label>Email</label>
        <input type="email" name="email" required value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
        <label>Password (min 8 chars)</label>
        <input type="password" name="password" required minlength="8">
        <button class="btn" type="submit">Create admin</button>
    </form>
    <?php endif; ?>
</div>

<div class="card">
    <h2>4. Delete this installer</h2>
    <p style="color:#C6CDDC;font-size:13.5px;">Use cPanel &rarr; <strong>File Manager</strong> to delete <code>install.php</code> from this directory. Then visit <a href="login.html">login.html</a>.</p>
</div>

</div></body></html>
