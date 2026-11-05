<?php
declare(strict_types=1);

return [
    'db' => [
        'host' => getenv('DORM_DB_HOST') ?: '127.0.0.1',
        'port' => getenv('DORM_DB_PORT') ?: '3306',
        'name' => getenv('DORM_DB_NAME') ?: 'angelinas_dormitory_app',
        'user' => getenv('DORM_DB_USER') ?: 'root',
        'password' => getenv('DORM_DB_PASSWORD') ?: '',
    ],
];
