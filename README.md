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

   This creates `angelinas_dormitory` and its empty tables. No default accounts or sample data are created. The setup requires a MySQL account that can create a database and tables.
4. Open [http://localhost/Angelina's_System/](http://localhost/Angelina's_System/) in a browser. Camera preview requires `localhost` or HTTPS.
5. On the first visit, create the initial Admin account. This one-time setup is only available while the database has no user accounts.
6. Sign in as Admin. Use **User accounts** to create Staff and additional Admin accounts. Staff and Tenant may also submit registration requests from the sign-in screen. Review requests under **Registration requests**; approving a Tenant requires assigning an available room and bed.

Self-registered accounts remain pending until an Admin approves them. There are no pre-created accounts. Passwords are stored as PHP password hashes.

## Project structure

```text
Angelina's_System/
├── index.html
├── index.php
├── tenant-billing-view.php
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
- One tenant-level billing QR is emailed when a tenant is added or approved; Admin can resend it for existing tenants
- Scanning the tenant QR opens all that tenant's billing statements and recorded payments
- Bills with configurable cutoff and due dates, rent, utilities, discounts, adjustments, and previous balances
- Multiple partial payments, payment methods, balance/status calculation, and printable receipts
- Deposit collection and refund records
- Tenant concerns, owner responses, and status tracking
- Manual occupancy counts, scan history, and optional local camera preview
- Audit history and visible email-notification status

## Limitations

Configure backups, secure MySQL credentials, HTTPS, and operational policies before using real tenant or payment information.

### Configure tenant billing QR email

1. Use a dormitory-owned Gmail account with 2-Step Verification enabled and create a Gmail **App Password**. Do not use the normal Gmail password.
2. Set `DORM_MAIL_USERNAME` and `DORM_MAIL_FROM_EMAIL` to the sender's Gmail address, and `DORM_MAIL_PASSWORD` to its App Password. Set `DORM_APP_URL` to the address tenants use to open this app, without a trailing slash (for example `https://dorm.example.com` or `http://192.168.1.25/Angelina's_System` for a server on the same Wi-Fi). Tenants' phones must be able to reach this URL; do not use `localhost` or `127.0.0.1`.
3. Optional mail settings are `DORM_MAIL_HOST` (`smtp.gmail.com`), `DORM_MAIL_PORT` (`587`), `DORM_MAIL_ENCRYPTION` (`tls`), and `DORM_MAIL_FROM_NAME`. These can also be added under `mail` and `app.base_url` in the local, git-ignored `config.php`.
4. `config.php` changes take effect immediately. Restart Apache after changing its environment variables. Keep the App Password private and never put it in JavaScript or commit it to source control.
5. Add a tenant or approve a Tenant registration to automatically email one private billing QR to the tenant's recorded address. Existing tenants can be sent a QR again from **Tenant management → Send billing QR**.

The tenant QR opens one private page showing all of that tenant's billing statements and recorded payments, including new statements added later. If no bill exists yet, the page explains that and automatically shows statements after they are created. Resending replaces the previous QR link. The QR URL is a private bearer link: anyone with the current QR or email link can view that tenant's billing information. A scan only displays records; it does not submit payment or change its status. The occupancy camera only displays a local preview. Occupancy counts are entered manually; there is no automated person detection or facial recognition.

Tenant billing QR generation loads its QR image library from a public CDN, so sending a QR requires internet access in the Admin's browser. The local XAMPP configuration uses this computer's current Wi-Fi address (`http://192.168.254.111/Angelina's_System`). If the computer's Wi-Fi address changes, update `app.base_url` in `config.php` or set `DORM_APP_URL` to the new address. For use outside the same Wi-Fi network, configure a public HTTPS domain and make it reachable from tenants' phones.
