<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Run this database setup script from the command line.\n");
}

$configPath = dirname(__DIR__) . '/config.php';
if (!is_file($configPath)) {
    fwrite(STDERR, "Missing config.php. Copy config.example.php to config.php and set your MySQL credentials.\n");
    exit(1);
}

$config = require $configPath;
$db = $config['db'] ?? [];
$host = (string)($db['host'] ?? '127.0.0.1');
$port = (string)($db['port'] ?? '3306');
$name = (string)($db['name'] ?? 'angelinas_dormitory');
$pdo = null;

try {
    $pdo = new PDO(
        "mysql:host={$host};port={$port};charset=utf8mb4",
        (string)($db['user'] ?? 'root'),
        (string)($db['password'] ?? ''),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $schema = file_get_contents(__DIR__ . '/schema.sql');
    if ($schema === false) {
        throw new RuntimeException('Could not read database/schema.sql.');
    }

    $statements = preg_split('/;\s*(?:\r?\n|$)/', $schema) ?: [];
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if ($statement !== '') $pdo->exec($statement);
    }

    fwrite(STDOUT, "Database and tables created. No demo users or records were added.\n");
} catch (Throwable $error) {
    fwrite(STDERR, "Database setup failed: {$error->getMessage()}\n");
    exit(1);
}
