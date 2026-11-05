<?php
declare(strict_types=1);

header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");

function escapeHtml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function money(float $amount): string
{
    return '₱' . number_format($amount, 2);
}

$token = (string)($_GET['token'] ?? '');
$tenant = null;
$bills = [];
$paymentsByBill = [];
$httpStatus = 200;

if (!preg_match('/^[a-f0-9]{64}$/i', $token)) {
    $httpStatus = 404;
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
        $tenantQuery = $pdo->prepare(
            'SELECT t.id, t.full_name
             FROM tenant_billing_qr_codes q
             JOIN tenants t ON t.id = q.tenant_id
             WHERE q.token_hash = ? LIMIT 1'
        );
        $tenantQuery->execute([hash('sha256', strtolower($token))]);
        $tenant = $tenantQuery->fetch() ?: null;
        if ($tenant) {
            $billsQuery = $pdo->prepare(
                "SELECT b.id, b.billing_period, b.cutoff_date, b.due_date,
                        b.rent, b.electricity, b.water, b.previous_balance,
                        COALESCE(a.discount, 0) AS discount,
                        COALESCE(a.adjustment, 0) AS adjustment,
                        COALESCE(a.adjustment_reason, '') AS adjustment_reason,
                        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.billing_id = b.id), 0) AS amount_paid
                 FROM billing b
                 LEFT JOIN (
                    SELECT billing_id,
                           SUM(CASE WHEN kind = 'Discount' THEN amount ELSE 0 END) AS discount,
                           SUM(CASE WHEN kind = 'Adjustment' THEN amount ELSE 0 END) AS adjustment,
                           MAX(CASE WHEN kind = 'Adjustment' THEN reason ELSE '' END) AS adjustment_reason
                    FROM billing_adjustments GROUP BY billing_id
                 ) a ON a.billing_id = b.id
                 WHERE b.tenant_id = ?
                 ORDER BY b.created_at DESC, b.id DESC"
            );
            $billsQuery->execute([(int)$tenant['id']]);
            $bills = $billsQuery->fetchAll();

            if ($bills) {
                $paymentQuery = $pdo->prepare(
                    'SELECT p.billing_id, p.amount, p.method, p.payment_date, p.reference
                     FROM payments p
                     JOIN billing b ON b.id = p.billing_id
                     WHERE b.tenant_id = ?
                     ORDER BY p.payment_date, p.id'
                );
                $paymentQuery->execute([(int)$tenant['id']]);
                foreach ($paymentQuery->fetchAll() as $payment) {
                    $paymentsByBill[(int)$payment['billing_id']][] = $payment;
                }
            }
        } else {
            $httpStatus = 404;
        }
    } catch (Throwable $error) {
        error_log('Angelina Dormitory public tenant billing view error: ' . $error->getMessage());
        $httpStatus = 503;
        $tenant = null;
    }
}

http_response_code($httpStatus);
$pageTitle = $tenant ? 'Billing information' : ($httpStatus === 503 ? 'Temporarily unavailable' : 'Billing link unavailable');
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
    main{max-width:760px;margin:32px auto;padding:28px;background:#fff;border:1px solid #e8ebf0;border-radius:14px;box-shadow:0 12px 32px rgb(34 46 65 / 8%)}
    h1{margin:0;font-size:23px}
    h2{margin:25px 0 5px;font-size:18px}
    p,.muted{color:#788496;line-height:1.55}
    .lines{margin:16px 0;border-top:1px solid #e8ebf0}
    .line{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid #e8ebf0}
    .line strong{text-align:right}
    .status{display:inline-block;padding:6px 10px;border-radius:20px;background:#edf3fd;color:#4775ba;font-size:13px;font-weight:bold}
    .status.paid{background:#e7f5f0;color:#17866f}
    .status.overdue{background:#fff0ef;color:#bd4d50}
    .warning{margin-top:20px;padding:12px;border-radius:8px;background:#fff4dc;color:#80570c;font-size:13px;line-height:1.5}
    .bill{padding-top:10px;border-top:1px solid #e8ebf0}
    @media(max-width:520px){body{padding:10px}main{margin:10px auto;padding:20px}}
  </style>
</head>
<body>
<main>
<?php if (!$tenant): ?>
  <h1><?= escapeHtml($pageTitle) ?></h1>
  <p><?= $httpStatus === 503
      ? 'We could not load your billing information right now. Please try again later.'
      : 'This billing link is invalid or unavailable. Ask the administrator to send you a new QR code.' ?></p>
<?php else: ?>
  <div class="muted">Angelina's Dormitory</div>
  <h1>Your billing information</h1>
  <p><?= escapeHtml((string)$tenant['full_name']) ?> · Your statements and recorded payments</p>
  <?php if (!$bills): ?>
    <div class="lines"><p>No billing statements are available yet. This page will show new statements when they are added to your account.</p></div>
  <?php else: ?>
    <?php foreach ($bills as $bill):
        $billId = (int)$bill['id'];
        $payments = $paymentsByBill[$billId] ?? [];
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
    ?>
    <section class="bill">
      <h2><?= escapeHtml((string)$bill['billing_period']) ?> · BILL-<?= escapeHtml((string)$bill['id']) ?></h2>
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
    </section>
    <?php endforeach; ?>
  <?php endif; ?>
  <div class="warning">This private link shows billing information for this tenant. Anyone with this QR or link can view it. Scanning does not submit a payment or change its status.</div>
<?php endif; ?>
</main>
</body>
</html>
