<?php
declare(strict_types=1);

return [
    'db' => [
        'host' => getenv('DORM_DB_HOST') ?: '127.0.0.1',
        'port' => getenv('DORM_DB_PORT') ?: '3306',
        'name' => getenv('DORM_DB_NAME') ?: 'angelinas_dormitory',
        'user' => getenv('DORM_DB_USER') ?: 'root',
        'password' => getenv('DORM_DB_PASSWORD') ?: '',
    ],
    'mail' => [
        'host' => getenv('DORM_MAIL_HOST') ?: 'smtp.gmail.com',
        'port' => getenv('DORM_MAIL_PORT') ?: '587',
        'encryption' => getenv('DORM_MAIL_ENCRYPTION') ?: 'tls',
        'username' => getenv('DORM_MAIL_USERNAME') ?: '',
        'password' => getenv('DORM_MAIL_PASSWORD') ?: '',
        'from_email' => getenv('DORM_MAIL_FROM_EMAIL') ?: '',
        'from_name' => getenv('DORM_MAIL_FROM_NAME') ?: "Angelina's Dormitory",
    ],
    'app' => [
        'base_url' => getenv('DORM_APP_URL') ?: '',
    ],
];
