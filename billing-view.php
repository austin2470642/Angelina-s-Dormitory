<?php
declare(strict_types=1);

header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");

function escapeHtml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function money(float $amount): string
{
    return '₱' . number_format($amount, 2);
}

$token = (string)($_GET['token'] ?? '');
if (!preg_match('/^[a-f0-9]{64}$/i', $token)) {
    http_response_code(404);
    $bill = null;
} else {
    try {
        $config = require __DIR__ . '/config.php';
        $db = $config['db'] ?? [];
        $pdo = new PDO(
            'mysql:host=' . (string)($db['host'] ?? '127.0.0.1')
                . ';port=' . (string)($db['port'] ?? '3306')
                . ';dbname=' . (string)($db['name'] ?? 'angelinas_dormitory')
                . ';charset=utf8mb4',
            (string)($db['user'] ?? 'root'),
            (string)($db['password'] ?? ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
        $statement = $pdo->prepare(
            "SELECT b.id, b.billing_period, b.cutoff_date, b.due_date,
                    b.rent, b.electricity, b.water, b.previous_balance,
                    t.full_name,
                    COALESCE(SUM(CASE WHEN a.kind = 'Discount' THEN a.amount ELSE 0 END), 0) AS discount,
                    COALESCE(SUM(CASE WHEN a.kind = 'Adjustment' THEN a.amount ELSE 0 END), 0) AS adjustment,
                    COALESCE(MAX(CASE WHEN a.kind = 'Adjustment' THEN a.reason ELSE '' END), '') AS adjustment_reason,
                    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.billing_id = b.id), 0) AS amount_paid
             FROM billing_qr_codes q
             JOIN billing b ON b.id = q.billing_id
             JOIN tenants t ON t.id = b.tenant_id
             LEFT JOIN billing_adjustments a ON a.billing_id = b.id
             WHERE q.token_hash = ?
             GROUP BY b.id LIMIT 1"
        );
        $statement->execute([hash('sha256', strtolower($token))]);
        $bill = $statement->fetch() ?: null;
        if ($bill) {
            $paymentsQuery = $pdo->prepare(
                'SELECT amount, method, payment_date, reference
                 FROM payments WHERE billing_id = ? ORDER BY payment_date, id'
            );
            $paymentsQuery->execute([(int)$bill['id']]);
            $payments = $paymentsQuery->fetchAll();
            $total = max(
                0,
                (float)$bill['rent'] + (float)$bill['electricity'] + (float)$bill['water']
                    - (float)$bill['discount'] + (float)$bill['adjustment'] + (float)$bill['previous_balance']
            );
            $paid = (float)$bill['amount_paid'];
            $balance = max(0, round($total - $paid, 2));
            $status = $balance <= 0
                ? 'Paid'
                : ($paid > 0
                    ? 'Partially Paid'
                    : ($bill['due_date'] < date('Y-m-d') ? 'Overdue' : 'Unpaid'));
        } else {
            http_response_code(404);
        }
    } catch (Throwable $error) {
        error_log('Angelina Dormitory public billing view error: ' . $error->getMessage());
        http_response_code(503);
        $bill = null;
    }
}

$pageTitle = $bill ? 'Billing statement' : (http_response_code() === 503 ? 'Temporarily unavailable' : 'Statement unavailable');
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="referrer" content="no-referrer">
  <title><?= escapeHtml($pageTitle) ?> | Angelina's Dormitory</title>
  <style>
    :root{font-family:Arial,sans-serif;color:#202b3c;background:#f5f6f8;font-synthesis:none}
    *{box-sizing:border-box}
    body{margin:0;padding:24px}
    main{max-width:680px;margin:32px auto;padding:28px;background:#fff;border:1px solid #e8ebf0;border-radius:14px;box-shadow:0 12px 32px rgb(34 46 65 / 8%)}
    h1{margin:0;font-size:23px}
    h2{margin:24px 0 5px;font-size:18px}
    p,.muted{color:#788496;line-height:1.55}
    .reference{margin-top:8px;font-size:13px;color:#788496}
    .lines{margin:20px 0;border-top:1px solid #e8ebf0}
    .line{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid #e8ebf0}
    .line strong{text-align:right}
    .status{display:inline-block;padding:6px 10px;border-radius:20px;background:#edf3fd;color:#4775ba;font-size:13px;font-weight:bold}
    .status.paid{background:#e7f5f0;color:#17866f}
    .status.overdue{background:#fff0ef;color:#bd4d50}
    .warning{margin-top:20px;padding:12px;border-radius:8px;background:#fff4dc;color:#80570c;font-size:13px;line-height:1.5}
    @media(max-width:520px){body{padding:10px}main{margin:10px auto;padding:20px}}
  </style>
</head>
<body>
<main>
<?php if (!$bill): ?>
  <h1><?= escapeHtml($pageTitle) ?></h1>
  <p><?= http_response_code() === 503
      ? 'We could not load this statement right now. Please try again later.'
      : 'This billing link is invalid or unavailable. Ask the administrator to send you a current QR code.' ?></p>
<?php else: ?>
  <div class="muted">Angelina's Dormitory</div>
  <h1>Billing statement</h1>
  <div class="reference">BILL-<?= escapeHtml((string)$bill['id']) ?> · <?= escapeHtml((string)$bill['billing_period']) ?></div>
  <h2><?= escapeHtml((string)$bill['full_name']) ?></h2>
  <div class="muted">Cutoff: <?= escapeHtml((string)$bill['cutoff_date']) ?> · Due: <?= escapeHtml((string)$bill['due_date']) ?></div>
  <div class="lines">
    <?php foreach ([
        'Rent' => (float)$bill['rent'],
        'Electricity' => (float)$bill['electricity'],
        'Water' => (float)$bill['water'],
        'Discount' => -(float)$bill['discount'],
        'Adjustment' . ($bill['adjustment_reason'] !== '' ? ' · ' . $bill['adjustment_reason'] : '') => (float)$bill['adjustment'],
        'Previous balance' => (float)$bill['previous_balance'],
        'Total billed' => $total,
        'Payments recorded' => $paid,
        'Remaining balance' => $balance,
    ] as $label => $amount): ?>
    <div class="line"><span><?= escapeHtml($label) ?></span><strong><?= escapeHtml(money($amount)) ?></strong></div>
    <?php endforeach; ?>
  </div>
  <div>Payment status: <span class="status <?= $status === 'Paid' ? 'paid' : ($status === 'Overdue' ? 'overdue' : '') ?>"><?= escapeHtml($status) ?></span></div>
  <?php if ($payments): ?>
  <h2>Recorded payments</h2>
  <div class="lines">
    <?php foreach ($payments as $payment): ?>
    <div class="line">
      <span><?= escapeHtml((string)$payment['payment_date']) ?> · <?= escapeHtml((string)$payment['method']) ?>
        <?php if ($payment['reference']): ?> · Ref: <?= escapeHtml((string)$payment['reference']) ?><?php endif; ?>
      </span>
      <strong><?= escapeHtml(money((float)$payment['amount'])) ?></strong>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
  <div class="warning">This page shows payments recorded by the dormitory system. Scanning this QR does not submit a payment or change your payment status. Contact the administrator if a payment is missing.</div>
<?php endif; ?>
</main>
</body>
</html>
