<?php
declare(strict_types=1);

session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

final class ApiError extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $message): never
{
    throw new ApiError($status, $message);
}

function input(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($data)) {
        fail(400, 'Invalid JSON request body.');
    }
    return $data;
}

function requiredString(array $data, string $key, int $maxLength): string
{
    $value = trim((string)($data[$key] ?? ''));
    if ($value === '' || mb_strlen($value) > $maxLength) {
        fail(422, "A valid {$key} is required.");
    }
    return $value;
}

function validDate(array $data, string $key): string
{
    $value = (string)($data[$key] ?? '');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        fail(422, "A valid {$key} is required.");
    }
    return $value;
}

function amount(array $data, string $key, bool $allowNegative = false): float
{
    $value = filter_var($data[$key] ?? null, FILTER_VALIDATE_FLOAT);
    if ($value === false || !is_finite((float)$value) || (!$allowNegative && $value < 0)) {
        fail(422, "A valid {$key} is required.");
    }
    return round((float)$value, 2);
}

function db(): PDO
{
    static $connection;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $configPath = dirname(__DIR__) . '/config.php';
    if (!is_file($configPath)) {
        fail(503, 'Database is not configured. Copy config.example.php to config.php, then import database/schema.sql.');
    }
    $config = require $configPath;
    $db = $config['db'] ?? [];
    $host = (string)($db['host'] ?? '127.0.0.1');
    $port = (string)($db['port'] ?? '3306');
    $name = (string)($db['name'] ?? 'angelinas_dormitory_app');
    $charset = 'utf8mb4';
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
    $connection = new PDO($dsn, (string)($db['user'] ?? 'root'), (string)($db['password'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $connection;
}

function currentUser(): array
{
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user)) {
        fail(401, 'Please sign in to continue.');
    }
    $account = db()->prepare("SELECT username, role, tenant_id, status FROM users WHERE id = ? LIMIT 1");
    $account->execute([(int)$user['id']]);
    $account = $account->fetch();
    $accountTenantId = $account && $account['tenant_id'] !== null ? (int)$account['tenant_id'] : null;
    $sessionTenantId = isset($user['tenant_id']) ? (int)$user['tenant_id'] : null;
    if (
        !$account
        || $account['status'] !== 'Active'
        || $account['username'] !== ($user['username'] ?? null)
        || $account['role'] !== ($user['role'] ?? null)
        || $accountTenantId !== $sessionTenantId
    ) {
        unset($_SESSION['user']);
        fail(401, 'Your account is no longer active. Please sign in again.');
    }
    return $user;
}

function requireRole(array $roles): array
{
    $user = currentUser();
    if (!in_array($user['role'], $roles, true)) {
        fail(403, 'You do not have permission to perform this action.');
    }
    return $user;
}

function verifyCsrf(): void
{
    $expected = (string)($_SESSION['csrf'] ?? '');
    $received = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $received === '' || !hash_equals($expected, $received)) {
        fail(403, 'Your session token expired. Refresh the page and try again.');
    }
}

function recordAudit(PDO $pdo, ?int $userId, string $action): void
{
    $statement = $pdo->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)');
    $statement->execute([$userId, mb_substr($action, 0, 255)]);
}

function recordNotification(PDO $pdo, int $tenantId, string $type): void
{
    $statement = $pdo->prepare(
        "INSERT INTO notifications (tenant_id, notification_type, delivery_status) VALUES (?, ?, 'Not Configured')"
    );
    $statement->execute([$tenantId, $type]);
}

function loadState(PDO $pdo, array $user): array
{
    $tenantId = $user['role'] === 'Tenant' ? (int)$user['tenant_id'] : null;
    $tenantWhere = $tenantId ? ' WHERE t.id = :tenant_id' : '';
    $billWhere = $tenantId ? ' WHERE b.tenant_id = :tenant_id' : '';
    $idParams = $tenantId ? [':tenant_id' => $tenantId] : [];

    $tenants = $pdo->prepare(
        "SELECT t.id, t.full_name AS name, t.phone, t.email, t.status, t.move_in_date AS moveIn,
                t.move_out_date AS moveOut, r.id AS roomId, r.room_name AS roomName,
                bs.bed_number AS bed
        FROM tenants t
        LEFT JOIN tenant_assignments ta ON ta.id = (
            SELECT ta2.id FROM tenant_assignments ta2
            WHERE ta2.tenant_id = t.id
            ORDER BY (ta2.end_date IS NULL) DESC, ta2.start_date DESC, ta2.id DESC
            LIMIT 1
        )
        LEFT JOIN bed_spaces bs ON bs.id = ta.bed_space_id
        LEFT JOIN rooms r ON r.id = bs.room_id{$tenantWhere}
        ORDER BY t.id"
    );
    $tenants->execute($idParams);
    $tenantRows = array_map(static function (array $row): array {
        $row['id'] = (string)$row['id'];
        $row['roomId'] = $row['roomId'] === null ? null : (string)$row['roomId'];
        $row['bed'] = $row['bed'] === null ? null : (int)$row['bed'];
        return $row;
    }, $tenants->fetchAll());

    $roomWhere = '';
    if ($tenantId) {
        $roomWhere = ' WHERE r.id IN (
            SELECT bs.room_id FROM tenant_assignments ta
            JOIN bed_spaces bs ON bs.id = ta.bed_space_id
            WHERE ta.tenant_id = :tenant_id
        )';
    }
    $rooms = $pdo->prepare(
        "SELECT r.id, r.room_name AS name, r.status,
                COUNT(bs.id) AS capacity,
                SUM(CASE WHEN bs.status = 'Occupied' THEN 1 ELSE 0 END) AS occupied
        FROM rooms r LEFT JOIN bed_spaces bs ON bs.room_id = r.id{$roomWhere}
        GROUP BY r.id ORDER BY r.room_name"
    );
    $rooms->execute($idParams);
    $roomRows = array_map(static function (array $row): array {
        $row['id'] = (string)$row['id'];
        $row['capacity'] = (int)$row['capacity'];
        return $row;
    }, $rooms->fetchAll());

    $bills = $pdo->prepare(
        "SELECT b.id, b.tenant_id AS tenantId, b.billing_period AS period,
                b.cutoff_date AS cutoff, b.due_date AS dueDate,
                b.rent, b.electricity, b.water, b.previous_balance AS previousBalance,
                b.created_at AS createdAt,
                COALESCE(SUM(CASE WHEN ba.kind = 'Discount' THEN ba.amount ELSE 0 END), 0) AS discount,
                COALESCE(SUM(CASE WHEN ba.kind = 'Adjustment' THEN ba.amount ELSE 0 END), 0) AS adjustment,
                COALESCE(MAX(CASE WHEN ba.kind = 'Adjustment' THEN ba.reason ELSE '' END), '') AS adjustmentReason
        FROM billing b
        LEFT JOIN billing_adjustments ba ON ba.billing_id = b.id{$billWhere}
        GROUP BY b.id ORDER BY b.created_at DESC, b.id DESC"
    );
    $bills->execute($idParams);
    $billRows = array_map(static function (array $row): array {
        foreach (['id', 'tenantId'] as $key) $row[$key] = (string)$row[$key];
        foreach (['rent', 'electricity', 'water', 'previousBalance', 'discount', 'adjustment'] as $key) $row[$key] = (float)$row[$key];
        $row['createdAt'] = substr($row['createdAt'], 0, 10);
        return $row;
    }, $bills->fetchAll());

    $payments = $pdo->prepare(
        "SELECT p.id, p.billing_id AS billId, p.amount, p.method, p.payment_date AS date,
                p.reference, p.payer_name AS payer, COALESCE(u.username, 'Former user') AS receiver
        FROM payments p
        JOIN billing b ON b.id = p.billing_id
        LEFT JOIN users u ON u.id = p.received_by{$billWhere}
        ORDER BY p.payment_date DESC, p.id DESC"
    );
    $payments->execute($idParams);
    $paymentRows = array_map(static function (array $row): array {
        foreach (['id', 'billId'] as $key) $row[$key] = (string)$row[$key];
        $row['amount'] = (float)$row['amount'];
        return $row;
    }, $payments->fetchAll());

    $deposits = $pdo->prepare(
        'SELECT id, tenant_id AS tenantId, amount, received_date AS date, status, refund_amount AS refund
        FROM deposits' . ($tenantId ? ' WHERE tenant_id = :tenant_id' : '') . ' ORDER BY id DESC'
    );
    $deposits->execute($idParams);
    $depositRows = array_map(static function (array $row): array {
        foreach (['id', 'tenantId'] as $key) $row[$key] = (string)$row[$key];
        foreach (['amount', 'refund'] as $key) $row[$key] = (float)$row[$key];
        return $row;
    }, $deposits->fetchAll());

    $concerns = $pdo->prepare(
        'SELECT id, tenant_id AS tenantId, category, subject, message, status,
                owner_response AS response, DATE(created_at) AS date
        FROM tenant_concerns' . ($tenantId ? ' WHERE tenant_id = :tenant_id' : '') . ' ORDER BY id DESC'
    );
    $concerns->execute($idParams);
    $concernRows = array_map(static function (array $row): array {
        $row['id'] = (string)$row['id'];
        $row['tenantId'] = (string)$row['tenantId'];
        return $row;
    }, $concerns->fetchAll());

    $scans = $tenantId
        ? []
        : array_map(static function (array $row): array {
            $row['id'] = (string)$row['id'];
            $row['roomId'] = (string)$row['roomId'];
            $row['count'] = (int)$row['count'];
            $row['capacity'] = (int)$row['capacity'];
            return $row;
        }, $pdo->query(
            "SELECT s.id, s.room_id AS roomId, s.observed_count AS `count`, s.capacity,
                    s.scan_date AS date, s.note, COALESCE(u.username, 'Former user') AS actor
            FROM occupancy_scans s LEFT JOIN users u ON u.id = s.recorded_by
            ORDER BY s.scan_date DESC, s.id DESC"
        )->fetchAll());

    $notifications = $pdo->prepare(
        'SELECT id, tenant_id AS tenantId, notification_type AS type,
                delivery_status AS status, created_at AS date
        FROM notifications' . ($tenantId ? ' WHERE tenant_id = :tenant_id' : '') . ' ORDER BY id DESC'
    );
    $notifications->execute($idParams);
    $notificationRows = array_map(static function (array $row): array {
        $row['id'] = (string)$row['id'];
        $row['tenantId'] = (string)$row['tenantId'];
        $row['date'] = date(DATE_ATOM, strtotime($row['date']));
        return $row;
    }, $notifications->fetchAll());

    $auditRows = [];
    $accountRows = [];
    if (!$tenantId) {
        $auditRows = array_map(static function (array $row): array {
            $row['id'] = (string)$row['id'];
            $row['actor'] = $row['actor'] ?: 'System';
            $row['date'] = date(DATE_ATOM, strtotime($row['date']));
            return $row;
        }, $pdo->query(
            'SELECT a.id, a.action AS message, COALESCE(u.username, "System") AS actor,
                    a.created_at AS date
            FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
            ORDER BY a.id DESC LIMIT 150'
        )->fetchAll());
    }
    if ($user['role'] === 'Admin') {
        $accountRows = array_map(static function (array $row): array {
            $row['id'] = (string)$row['id'];
            $row['createdAt'] = substr($row['createdAt'], 0, 10);
            return $row;
        }, $pdo->query(
            "SELECT id, username, role, status, created_at AS createdAt
            FROM users WHERE role IN ('Admin', 'Staff') ORDER BY role, username"
        )->fetchAll());
    }
    $registrationRows = [];
    if ($user['role'] === 'Admin') {
        $registrationRows = array_map(static function (array $row): array {
            $row['id'] = (string)$row['id'];
            return $row;
        }, $pdo->query(
            'SELECT id, username, role, full_name AS fullName, phone, email,
                    move_in_date AS moveIn, created_at AS createdAt
            FROM registration_requests ORDER BY created_at, id'
        )->fetchAll());
    }

    return [
        'user' => ['id' => (string)$user['id'], 'name' => $user['username'], 'role' => $user['role'], 'tenantId' => $tenantId ? (string)$tenantId : null],
        'state' => [
            'tenants' => $tenantRows, 'rooms' => $roomRows, 'bills' => $billRows,
            'payments' => $paymentRows, 'deposits' => $depositRows,
            'concerns' => $concernRows, 'scans' => $scans,
            'notifications' => $notificationRows, 'audit' => $auditRows,
            'accounts' => $accountRows,
            'registrationRequests' => $registrationRows,
        ],
    ];
}

function applyAction(PDO $pdo, array $user, array $data, string $action): void
{
    $userId = (int)$user['id'];
    switch ($action) {
        case 'approve_registration':
            requireRole(['Admin']);
            $requestId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$requestId) fail(422, 'Registration request not found.');
            $requestQuery = $pdo->prepare('SELECT * FROM registration_requests WHERE id = ? FOR UPDATE');
            $requestQuery->execute([$requestId]);
            $request = $requestQuery->fetch();
            if (!$request) fail(404, 'Registration request is no longer available.');
            $existingUser = $pdo->prepare('SELECT id FROM users WHERE username = ?');
            $existingUser->execute([$request['username']]);
            if ($existingUser->fetchColumn()) fail(409, 'That username is already in use by another account.');

            if ($request['role'] === 'Staff') {
                $pdo->prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
                    ->execute([$request['username'], $request['password_hash'], 'Staff']);
            } else {
                $roomId = filter_var($data['roomId'] ?? null, FILTER_VALIDATE_INT);
                $bedNumber = filter_var($data['bed'] ?? null, FILTER_VALIDATE_INT);
                if (!$roomId || !$bedNumber || !$request['move_in_date']) {
                    fail(422, 'Choose an available room and bed for this tenant.');
                }
                $bed = $pdo->prepare(
                    "SELECT bs.id FROM bed_spaces bs JOIN rooms r ON r.id = bs.room_id
                    WHERE bs.room_id = ? AND bs.bed_number = ?
                    AND bs.status = 'Available' AND r.status = 'Open' FOR UPDATE"
                );
                $bed->execute([$roomId, $bedNumber]);
                $bedId = $bed->fetchColumn();
                if (!$bedId) fail(409, 'That bed space is no longer available.');

                $pdo->prepare(
                    "INSERT INTO tenants (full_name, phone, email, status, move_in_date)
                    VALUES (?, ?, ?, 'Active', ?)"
                )->execute([
                    $request['full_name'],
                    $request['phone'] ?: null,
                    $request['email'] ?: null,
                    $request['move_in_date'],
                ]);
                $tenantId = (int)$pdo->lastInsertId();
                $pdo->prepare('INSERT INTO users (tenant_id, username, password_hash, role) VALUES (?, ?, ?, ?)')
                    ->execute([$tenantId, $request['username'], $request['password_hash'], 'Tenant']);
                $pdo->prepare('INSERT INTO tenant_assignments (tenant_id, bed_space_id, start_date) VALUES (?, ?, ?)')
                    ->execute([$tenantId, $bedId, $request['move_in_date']]);
                $pdo->prepare("UPDATE bed_spaces SET status = 'Occupied' WHERE id = ?")->execute([$bedId]);
            }

            $pdo->prepare('DELETE FROM registration_requests WHERE id = ?')->execute([$requestId]);
            recordAudit($pdo, $userId, "Approved {$request['role']} registration for {$request['username']}");
            break;

        case 'reject_registration':
            requireRole(['Admin']);
            $requestId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$requestId) fail(422, 'Registration request not found.');
            $requestQuery = $pdo->prepare('SELECT username, role FROM registration_requests WHERE id = ? FOR UPDATE');
            $requestQuery->execute([$requestId]);
            $request = $requestQuery->fetch();
            if (!$request) fail(404, 'Registration request is no longer available.');
            $pdo->prepare('DELETE FROM registration_requests WHERE id = ?')->execute([$requestId]);
            recordAudit($pdo, $userId, "Rejected {$request['role']} registration for {$request['username']}");
            break;

        case 'create_account':
            requireRole(['Admin']);
            $username = requiredString($data, 'username', 80);
            if (!preg_match('/^[a-zA-Z0-9._-]{3,80}$/', $username)) {
                fail(422, 'Usernames must be 3–80 letters, numbers, dots, underscores or hyphens.');
            }
            $role = (string)($data['role'] ?? '');
            if (!in_array($role, ['Admin', 'Staff'], true)) fail(422, 'Choose Admin or Staff as the account role.');
            $password = (string)($data['password'] ?? '');
            if (strlen($password) < 8 || strlen($password) > 100) {
                fail(422, 'Passwords must be 8–100 characters.');
            }
            $existingUser = $pdo->prepare('SELECT id FROM users WHERE username = ?');
            $existingUser->execute([$username]);
            if ($existingUser->fetchColumn()) fail(409, 'That username is already in use.');
            $pdo->prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
                ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $role]);
            recordAudit($pdo, $userId, "Created {$role} account {$username}");
            break;

        case 'create_tenant':
            requireRole(['Admin']);
            $name = requiredString($data, 'name', 120);
            $roomId = filter_var($data['roomId'] ?? null, FILTER_VALIDATE_INT);
            $bedNumber = filter_var($data['bed'] ?? null, FILTER_VALIDATE_INT);
            if (!$roomId || !$bedNumber || $bedNumber < 1) fail(422, 'Select an available room and bed.');
            $phone = trim((string)($data['phone'] ?? ''));
            $email = trim((string)($data['email'] ?? ''));
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(422, 'Enter a valid email address.');
            $username = requiredString($data, 'username', 80);
            if (!preg_match('/^[a-zA-Z0-9._-]{3,80}$/', $username)) {
                fail(422, 'Tenant usernames must be 3–80 letters, numbers, dots, underscores or hyphens.');
            }
            $password = (string)($data['password'] ?? '');
            if (strlen($password) < 8 || strlen($password) > 100) {
                fail(422, 'Tenant passwords must be 8–100 characters.');
            }
            $existingUser = $pdo->prepare('SELECT id FROM users WHERE username = ?');
            $existingUser->execute([$username]);
            if ($existingUser->fetchColumn()) fail(409, 'That username is already in use.');
            $moveIn = validDate($data, 'moveIn');
            $bed = $pdo->prepare(
                "SELECT bs.id FROM bed_spaces bs JOIN rooms r ON r.id = bs.room_id
                WHERE bs.room_id = ? AND bs.bed_number = ? AND bs.status = 'Available' AND r.status = 'Open'
                FOR UPDATE"
            );
            $bed->execute([$roomId, $bedNumber]);
            $bedId = $bed->fetchColumn();
            if (!$bedId) fail(409, 'That bed space is no longer available.');
            $insert = $pdo->prepare(
                "INSERT INTO tenants (full_name, phone, email, status, move_in_date)
                VALUES (?, ?, ?, 'Active', ?)"
            );
            $insert->execute([$name, $phone ?: null, $email ?: null, $moveIn]);
            $tenantId = (int)$pdo->lastInsertId();
            $pdo->prepare('INSERT INTO users (tenant_id, username, password_hash, role) VALUES (?, ?, ?, ?)')
                ->execute([$tenantId, $username, password_hash($password, PASSWORD_DEFAULT), 'Tenant']);
            $pdo->prepare("INSERT INTO tenant_assignments (tenant_id, bed_space_id, start_date) VALUES (?, ?, ?)")
                ->execute([$tenantId, $bedId, $moveIn]);
            $pdo->prepare("UPDATE bed_spaces SET status = 'Occupied' WHERE id = ?")->execute([$bedId]);
            recordAudit($pdo, $userId, "Added tenant {$name}");
            break;

        case 'create_room':
            requireRole(['Admin']);
            $name = requiredString($data, 'name', 60);
            $capacity = filter_var($data['capacity'] ?? null, FILTER_VALIDATE_INT);
            if (!$capacity || $capacity < 1 || $capacity > 40) fail(422, 'Room capacity must be between 1 and 40.');
            $pdo->prepare("INSERT INTO rooms (room_name) VALUES (?)")->execute([$name]);
            $roomId = (int)$pdo->lastInsertId();
            $bedInsert = $pdo->prepare("INSERT INTO bed_spaces (room_id, bed_number) VALUES (?, ?)");
            for ($bed = 1; $bed <= $capacity; $bed++) $bedInsert->execute([$roomId, $bed]);
            recordAudit($pdo, $userId, "Added room {$name} with {$capacity} bed spaces");
            break;

        case 'create_bill':
            requireRole(['Admin']);
            $tenantId = filter_var($data['tenantId'] ?? null, FILTER_VALIDATE_INT);
            if (!$tenantId) fail(422, 'Select a tenant.');
            $period = requiredString($data, 'period', 80);
            $cutoff = validDate($data, 'cutoff');
            $due = validDate($data, 'dueDate');
            if ($due < $cutoff) fail(422, 'The due date must be on or after the cutoff date.');
            $check = $pdo->prepare("SELECT id FROM tenants WHERE id = ? AND status = 'Active'");
            $check->execute([$tenantId]);
            if (!$check->fetchColumn()) fail(422, 'The selected tenant is not active.');
            $rent = amount($data, 'rent');
            $electricity = amount($data, 'electricity');
            $water = amount($data, 'water');
            $discount = amount($data, 'discount');
            $adjustment = amount($data, 'adjustment', true);
            $previous = amount($data, 'previousBalance');
            if ($rent + $electricity + $water - $discount + $adjustment + $previous < 0) {
                fail(422, 'The total bill cannot be negative.');
            }
            $pdo->prepare(
                'INSERT INTO billing (tenant_id, billing_period, cutoff_date, due_date, rent, electricity, water, previous_balance)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([$tenantId, $period, $cutoff, $due, $rent, $electricity, $water, $previous]);
            $billId = (int)$pdo->lastInsertId();
            $addAdjustment = $pdo->prepare(
                'INSERT INTO billing_adjustments (billing_id, kind, amount, reason, created_by) VALUES (?, ?, ?, ?, ?)'
            );
            if ($discount > 0) $addAdjustment->execute([$billId, 'Discount', $discount, 'Discount', $userId]);
            if ($adjustment != 0) {
                $reason = trim((string)($data['adjustmentReason'] ?? ''));
                if ($reason === '') fail(422, 'Enter a reason for the billing adjustment.');
                $addAdjustment->execute([$billId, 'Adjustment', $adjustment, mb_substr($reason, 0, 255), $userId]);
            }
            recordNotification($pdo, $tenantId, 'Billing statement');
            recordAudit($pdo, $userId, "Created {$period} billing for tenant #{$tenantId}");
            break;

        case 'record_payment':
            requireRole(['Admin', 'Staff']);
            $billId = filter_var($data['billId'] ?? null, FILTER_VALIDATE_INT);
            if (!$billId) fail(422, 'Select a billing statement.');
            $billStatement = $pdo->prepare(
                "SELECT b.id, b.tenant_id, b.rent + b.electricity + b.water + b.previous_balance
                    + COALESCE(SUM(CASE WHEN a.kind = 'Adjustment' THEN a.amount ELSE -a.amount END), 0) AS total_due,
                    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.billing_id = b.id), 0) AS total_paid
                FROM billing b LEFT JOIN billing_adjustments a ON a.billing_id = b.id
                WHERE b.id = ? GROUP BY b.id FOR UPDATE"
            );
            $billStatement->execute([$billId]);
            $bill = $billStatement->fetch();
            if (!$bill) fail(404, 'Billing statement not found.');
            $paymentAmount = amount($data, 'amount');
            if ($paymentAmount <= 0 || $paymentAmount > (float)$bill['total_due'] - (float)$bill['total_paid'] + 0.0001) {
                fail(422, 'Payment must be greater than zero and no more than the remaining balance.');
            }
            $method = (string)($data['method'] ?? '');
            if (!in_array($method, ['GCash', 'Personal Payment'], true)) fail(422, 'Choose a valid payment method.');
            $date = validDate($data, 'date');
            $payer = requiredString($data, 'payer', 120);
            $reference = trim((string)($data['reference'] ?? ''));
            $pdo->prepare(
                'INSERT INTO payments (billing_id, amount, method, payment_date, reference, payer_name, received_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([$billId, $paymentAmount, $method, $date, $reference ?: null, $payer, $userId]);
            recordNotification($pdo, (int)$bill['tenant_id'], 'Payment receipt');
            recordAudit($pdo, $userId, "Recorded payment {$paymentAmount} for bill #{$billId}");
            break;

        case 'create_deposit':
            requireRole(['Admin']);
            $tenantId = filter_var($data['tenantId'] ?? null, FILTER_VALIDATE_INT);
            if (!$tenantId) fail(422, 'Select a tenant.');
            $depositAmount = amount($data, 'amount');
            if ($depositAmount <= 0) fail(422, 'Deposit amount must be greater than zero.');
            $date = validDate($data, 'date');
            $pdo->prepare("INSERT INTO deposits (tenant_id, amount, received_date) VALUES (?, ?, ?)")
                ->execute([$tenantId, $depositAmount, $date]);
            recordAudit($pdo, $userId, "Recorded security deposit for tenant #{$tenantId}");
            break;

        case 'refund_deposit':
            requireRole(['Admin']);
            $depositId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            $refund = amount($data, 'refund');
            if (!$depositId) fail(422, 'Deposit record not found.');
            $depositQuery = $pdo->prepare("SELECT id, amount FROM deposits WHERE id = ? AND status = 'Held' FOR UPDATE");
            $depositQuery->execute([$depositId]);
            $deposit = $depositQuery->fetch();
            if (!$deposit) fail(404, 'Held deposit not found.');
            if ($refund > (float)$deposit['amount']) fail(422, 'Refund cannot exceed the deposit amount.');
            $status = $refund == (float)$deposit['amount'] ? 'Refunded' : ($refund == 0.0 ? 'Retained' : 'Partially Refunded');
            $pdo->prepare('UPDATE deposits SET refund_amount = ?, status = ? WHERE id = ?')
                ->execute([$refund, $status, $depositId]);
            recordAudit($pdo, $userId, "Recorded security deposit refund for deposit #{$depositId}");
            break;

        case 'create_concern':
            $tenantId = $user['role'] === 'Tenant'
                ? (int)$user['tenant_id']
                : (int)($data['tenantId'] ?? 0);
            if ($tenantId < 1) fail(422, 'Select a tenant.');
            $tenantCheck = $pdo->prepare('SELECT id FROM tenants WHERE id = ?');
            $tenantCheck->execute([$tenantId]);
            if (!$tenantCheck->fetchColumn()) fail(404, 'Tenant not found.');
            $category = requiredString($data, 'category', 80);
            $subject = requiredString($data, 'subject', 120);
            $message = requiredString($data, 'message', 10000);
            $pdo->prepare(
                "INSERT INTO tenant_concerns (tenant_id, category, subject, message) VALUES (?, ?, ?, ?)"
            )->execute([$tenantId, $category, $subject, $message]);
            recordNotification($pdo, $tenantId, 'New tenant concern');
            recordAudit($pdo, $userId, "Submitted concern: {$subject}");
            break;

        case 'respond_concern':
            requireRole(['Admin']);
            $concernId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            $status = (string)($data['status'] ?? '');
            if (!$concernId || !in_array($status, ['New', 'In Review', 'Responded', 'Closed'], true)) {
                fail(422, 'Choose a valid concern and status.');
            }
            $response = trim((string)($data['response'] ?? ''));
            if (mb_strlen($response) > 10000) fail(422, 'The response is too long.');
            $exists = $pdo->prepare('SELECT id FROM tenant_concerns WHERE id = ?');
            $exists->execute([$concernId]);
            if (!$exists->fetchColumn()) fail(404, 'Concern not found.');
            $pdo->prepare('UPDATE tenant_concerns SET status = ?, owner_response = ? WHERE id = ?')
                ->execute([$status, $response ?: null, $concernId]);
            recordAudit($pdo, $userId, "Updated concern #{$concernId} to {$status}");
            break;

        case 'move_out':
            requireRole(['Admin']);
            $tenantId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$tenantId) fail(422, 'Tenant record not found.');
            $tenantQuery = $pdo->prepare("SELECT id FROM tenants WHERE id = ? AND status = 'Active' FOR UPDATE");
            $tenantQuery->execute([$tenantId]);
            if (!$tenantQuery->fetchColumn()) fail(404, 'Active tenant not found.');
            $date = date('Y-m-d');
            $pdo->prepare("UPDATE tenants SET status = 'Moved Out', move_out_date = ? WHERE id = ?")
                ->execute([$date, $tenantId]);
            $pdo->prepare(
                'UPDATE bed_spaces bs JOIN tenant_assignments ta ON ta.bed_space_id = bs.id
                SET bs.status = \'Available\', ta.end_date = ?
                WHERE ta.tenant_id = ? AND ta.end_date IS NULL'
            )->execute([$date, $tenantId]);
            recordAudit($pdo, $userId, "Recorded move-out for tenant #{$tenantId}; history retained");
            break;

        case 'record_scan':
            requireRole(['Admin']);
            $roomId = filter_var($data['roomId'] ?? null, FILTER_VALIDATE_INT);
            $count = filter_var($data['count'] ?? null, FILTER_VALIDATE_INT);
            if (!$roomId || $count === false || $count < 0 || $count > 100) fail(422, 'Enter a valid room and observed count.');
            $roomQuery = $pdo->prepare('SELECT COUNT(*) FROM bed_spaces WHERE room_id = ?');
            $roomQuery->execute([$roomId]);
            $capacity = (int)$roomQuery->fetchColumn();
            if ($capacity < 1) fail(404, 'Room not found.');
            $date = validDate($data, 'date');
            $note = trim((string)($data['note'] ?? ''));
            $pdo->prepare(
                'INSERT INTO occupancy_scans (room_id, observed_count, capacity, scan_date, note, recorded_by)
                VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([$roomId, $count, $capacity, $date, $note ?: null, $userId]);
            recordAudit($pdo, $userId, "Recorded occupancy count {$count} for room #{$roomId}");
            break;

        default:
            fail(404, 'Unknown API action.');
    }
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = (string)($_GET['action'] ?? '');

    if ($method === 'GET' && $action === 'csrf') {
        if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
        respond(['csrf' => $_SESSION['csrf']]);
    }

    if ($method === 'GET' && $action === 'health') {
        db();
        respond(['ok' => true]);
    }

    if ($method === 'GET' && $action === 'setup_status') {
        $userCount = (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
        respond(['setupRequired' => $userCount === 0]);
    }

    if ($method === 'POST') {
        verifyCsrf();
        $data = input();
        if ($action === 'register') {
            $role = (string)($data['role'] ?? '');
            if (!in_array($role, ['Staff', 'Tenant'], true)) fail(422, 'Choose Staff or Tenant as the account type.');
            $username = requiredString($data, 'username', 80);
            if (!preg_match('/^[a-zA-Z0-9._-]{3,80}$/', $username)) {
                fail(422, 'Usernames must be 3–80 letters, numbers, dots, underscores or hyphens.');
            }
            $password = (string)($data['password'] ?? '');
            if (strlen($password) < 8 || strlen($password) > 100) {
                fail(422, 'Passwords must be 8–100 characters.');
            }
            if (!hash_equals($password, (string)($data['confirmPassword'] ?? ''))) {
                fail(422, 'The passwords do not match.');
            }
            $fullName = requiredString($data, 'fullName', 120);
            $phone = trim((string)($data['phone'] ?? ''));
            if (mb_strlen($phone) > 40) fail(422, 'The phone number is too long.');
            $email = trim((string)($data['email'] ?? ''));
            if ($email !== '' && (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190)) {
                fail(422, 'Enter a valid email address.');
            }
            $moveIn = null;
            if ($role === 'Tenant') $moveIn = validDate($data, 'moveIn');

            $pdo = db();
            $pdo->beginTransaction();
            try {
                $existing = $pdo->prepare(
                    'SELECT username FROM users WHERE username = ?
                    UNION ALL SELECT username FROM registration_requests WHERE username = ? LIMIT 1'
                );
                $existing->execute([$username, $username]);
                if ($existing->fetchColumn()) fail(409, 'That username is already in use or awaiting review.');
                $pdo->prepare(
                    'INSERT INTO registration_requests
                    (username, password_hash, role, full_name, phone, email, move_in_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)'
                )->execute([
                    $username, password_hash($password, PASSWORD_DEFAULT), $role,
                    $fullName, $phone ?: null, $email ?: null, $moveIn,
                ]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            respond(['ok' => true, 'message' => 'Registration sent for Admin review.']);
        }
        if ($action === 'setup_admin') {
            $username = requiredString($data, 'username', 80);
            if (!preg_match('/^[a-zA-Z0-9._-]{3,80}$/', $username)) {
                fail(422, 'Admin usernames must be 3–80 letters, numbers, dots, underscores or hyphens.');
            }
            $password = (string)($data['password'] ?? '');
            if (strlen($password) < 8 || strlen($password) > 100) {
                fail(422, 'Admin passwords must be 8–100 characters.');
            }
            if (!hash_equals($password, (string)($data['confirmPassword'] ?? ''))) {
                fail(422, 'The passwords do not match.');
            }
            $pdo = db();
            $lock = $pdo->query("SELECT GET_LOCK('angelinas_dormitory_app_initial_admin', 5)")->fetchColumn();
            if ((int)$lock !== 1) fail(503, 'First-run setup is busy. Please try again.');
            try {
                if ((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() !== 0) {
                    fail(409, 'An account already exists. Sign in with an Admin account instead.');
                }
                $pdo->beginTransaction();
                $pdo->prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
                    ->execute([$username, password_hash($password, PASSWORD_DEFAULT), 'Admin']);
                $userId = (int)$pdo->lastInsertId();
                recordAudit($pdo, $userId, 'Created the first Admin account');
                $pdo->commit();
            } finally {
                $pdo->query("SELECT RELEASE_LOCK('angelinas_dormitory_app_initial_admin')");
            }
            session_regenerate_id(true);
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            $_SESSION['user'] = ['id' => $userId, 'username' => $username, 'role' => 'Admin', 'tenant_id' => null];
            respond(['csrf' => $_SESSION['csrf'], ...loadState($pdo, $_SESSION['user'])]);
        }
        if ($action === 'login') {
            $role = (string)($data['role'] ?? '');
            $username = trim((string)($data['username'] ?? ''));
            $password = (string)($data['password'] ?? '');
            if (!in_array($role, ['Admin', 'Staff', 'Tenant'], true) || $username === '' || $password === '') {
                fail(422, 'Choose an account type and enter your username and password.');
            }
            $pdo = db();
            $statement = $pdo->prepare(
                "SELECT id, username, password_hash, role, tenant_id
                FROM users WHERE username = ? AND role = ? AND status = 'Active' LIMIT 1"
            );
            $statement->execute([$username, $role]);
            $account = $statement->fetch();
            if (!$account || !password_verify($password, $account['password_hash'])) {
                fail(401, 'Invalid account type, username or password.');
            }
            session_regenerate_id(true);
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            $_SESSION['user'] = [
                'id' => (int)$account['id'],
                'username' => $account['username'],
                'role' => $account['role'],
                'tenant_id' => $account['tenant_id'] === null ? null : (int)$account['tenant_id'],
            ];
            $pdo->beginTransaction();
            recordAudit($pdo, (int)$account['id'], 'Signed in');
            $pdo->commit();
            respond(['csrf' => $_SESSION['csrf'], ...loadState($pdo, $_SESSION['user'])]);
        }
        if ($action === 'logout') {
            if (isset($_SESSION['user'])) {
                $pdo = db();
                $account = $pdo->prepare('SELECT id FROM users WHERE id = ?');
                $account->execute([(int)$_SESSION['user']['id']]);
                if ($account->fetchColumn()) {
                    recordAudit($pdo, (int)$_SESSION['user']['id'], 'Signed out');
                }
            }
            $cookie = session_get_cookie_params();
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                setcookie(session_name(), '', [
                    'expires' => time() - 42000,
                    'path' => $cookie['path'],
                    'domain' => $cookie['domain'],
                    'secure' => $cookie['secure'],
                    'httponly' => $cookie['httponly'],
                    'samesite' => $cookie['samesite'] ?? 'Lax',
                ]);
            }
            session_destroy();
            respond(['ok' => true]);
        }

        $user = currentUser();
        $pdo = db();
        $pdo->beginTransaction();
        try {
            applyAction($pdo, $user, $data, $action);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        respond(['ok' => true, ...loadState($pdo, $user)]);
    }

    if ($method === 'GET' && $action === 'state') {
        $user = currentUser();
        respond(loadState(db(), $user));
    }

    fail(404, 'API endpoint not found.');
} catch (ApiError $error) {
    respond(['error' => $error->getMessage()], $error->status);
} catch (PDOException $error) {
    error_log('Angelina Dormitory database error: ' . $error->getMessage());
    respond(['error' => 'Database connection or query failed. Check XAMPP MySQL and database setup.'], 503);
} catch (Throwable $error) {
    error_log('Angelina Dormitory API error: ' . $error->getMessage());
    respond(['error' => 'The server could not complete this request.'], 500);
}
