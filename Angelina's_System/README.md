# Angelina's Dormitory Billing System

A PHP, MySQL, HTML, CSS, and JavaScript project for managing dormitory tenants, rooms and bed spaces, bills, payments, deposits, concerns, and occupancy observations.

## Run with XAMPP

1. Copy `config.example.php` to `config.php`:

   ```powershell
   Copy-Item config.example.php config.php
   ```

   For a default XAMPP install, the sample `root` account and blank password work; update the values if your MySQL account uses a password.
2. Start **Apache** and **MySQL** from the XAMPP Control Panel.
3. Open a terminal in this project folder and run:

   ```powershell
   C:\xampp\php\php.exe database\setup.php
   ```

   This creates the separate `angelinas_dormitory_app` database and its empty tables. Any existing `angelinas_dormitory` database and its data are left untouched and are not copied. No default accounts or sample data are created. The setup requires a MySQL account that can create a database and tables.
4. Open [http://localhost/Angelina's_System/](http://localhost/Angelina's_System/) in a browser. Camera preview requires `localhost` or HTTPS.
5. On the first visit, create the initial Admin account. This one-time setup is only available while the database has no user accounts.
6. Sign in as Admin. Use **User accounts** to create Staff and additional Admin accounts. Staff and Tenant may also submit registration requests from the sign-in screen. Review requests under **Registration requests**; approving a Tenant requires assigning an available room and bed.

Self-registered accounts remain pending until an Admin approves them. There are no pre-created accounts. Passwords are stored as PHP password hashes.

## Project structure

```text
Angelina's_System/
├── index.html
├── index.php
├── config.example.php
├── api/
│   └── index.php
├── database/
│   ├── schema.sql
│   └── setup.php
└── assets/
    ├── css/
    │   ├── base.css
    │   ├── layout.css
    │   ├── login.css
    │   ├── overlays.css
    │   ├── print.css
    │   └── responsive.css
    ├── images/
    │   └── favicon.svg
    └── js/
        ├── app.js
        ├── core/
        │   └── state.js
        ├── data/
        │   └── api-client.js
        ├── features/
        │   └── actions.js
        ├── forms/
        │   ├── modals.js
        │   └── submit.js
        └── views/
            ├── dashboard.js
            ├── login.js
            └── pages.js
```

The JavaScript frontend sends authenticated requests to the PHP API. The API uses PDO prepared statements, server-side role checks, PHP sessions, CSRF tokens, and a MySQL/MariaDB database. Styles, page rendering, forms, and browser actions are separated into their own files.

## Included workflows

- Role-specific dashboards and navigation
- Tenant records, individual tenant login accounts, room capacity, bed assignment, and move-out history
- Bills with configurable cutoff and due dates, rent, utilities, discounts, adjustments, and previous balances
- Multiple partial payments, payment methods, balance/status calculation, and printable receipts
- Deposit collection and refund records
- Tenant concerns, owner responses, and status tracking
- Manual occupancy counts, scan history, and optional local camera preview
- Audit history and visible email-notification status

## Limitations

Configure backups, secure MySQL credentials, HTTPS, and operational policies before using real tenant or payment information.

Email messages are recorded as **Not Configured**; delivery requires an email service. The camera feature only displays a local preview. Occupancy counts are entered manually; there is no automated person detection or facial recognition.
