<?php
// cPanel MySQL credentials.
// Fill these in with values from cPanel → MySQL Databases.
// The DB user must be attached to the database with ALL PRIVILEGES.

return [
    'db_host'     => 'localhost',
    'db_name'     => 'yourcpanel_pm',     // e.g. cpaneluser_pm
    'db_user'     => 'yourcpanel_pmuser', // e.g. cpaneluser_pmuser
    'db_pass'     => 'change-me',
    'db_charset'  => 'utf8mb4',

    // Security
    'session_name'   => 'pm_sid',
    'cookie_secure'  => false, // set true if site is HTTPS-only
    'cookie_samesite'=> 'Lax',

    // Feature flags
    'allow_public_register' => false, // if false, only admins can create users

    // App
    'app_name'    => 'Castle Tech Tasks',
    'project_key' => 'CTT',
];
