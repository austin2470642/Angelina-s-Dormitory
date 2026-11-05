"use strict";

function tenantDashboard() {
  const bills = currentTenantBills().slice().sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const ownPayments = state.payments.filter(payment => bills.some(bill => bill.id === payment.billId)).slice().reverse();
  const deposits = state.deposits.filter(item => item.tenantId === session.tenantId);
  const concerns = state.concerns.filter(item => item.tenantId === session.tenantId);
  const latest = bills[0];
  return `${heading(`Hello, ${esc(session.name)}`, "Your billing and payment account at a glance.", `<button class="btn btn-primary" data-action="add-concern">＋ Submit a concern</button>`)}
    <div class="metrics">${metric("Current balance", money(latest ? balance(latest) : 0), latest ? `${esc(billStatus(latest))} · ${esc(latest.period)}` : "No billing record yet", "₱")}${metric("Next due date", latest ? formatDate(latest.dueDate) : "—", "Check your bill for the cutoff and due date", "◷")}${metric("Payment transactions", ownPayments.length, "Receipts are available in payment history", "▤")}${metric("Deposit held", money(deposits.filter(item => item.status === "Held").reduce((sum, item) => sum + Number(item.amount), 0)), "Security deposit is separate from monthly rent", "◈")}</div>
    <div class="info-banner"><div>ⓘ</div><div><strong>Account privacy</strong>This view only shows billing, payment, deposit, and concern records linked to your tenant account.</div></div>
    <section class="table-card"><div class="table-head"><h2>Your latest billing statements</h2><button class="panel-link" data-page="billing">View all →</button></div>${table(["Billing period", "Total due", "Paid", "Balance", "Due date", "Status", "Receipt"], billRows(bills.slice(0, 5)))}</section>
    <div class="two-column" style="margin-top:16px"><section class="table-card"><div class="table-head"><h2>Recent payments</h2><button class="panel-link" data-page="payments">History →</button></div>${table(["Amount", "Method", "Date", "Reference", "Receipt"], ownPayments.slice(0, 4).map(payment => `<tr><td class="money"><strong>${money(payment.amount)}</strong></td><td>${esc(payment.method)}</td><td>${formatDate(payment.date)}</td><td>${esc(payment.reference || "—")}</td><td><button class="text-action" data-action="payment-receipt" data-id="${esc(payment.id)}">View receipt</button></td></tr>`).join(""))}</section><section class="panel"><div class="panel-header"><div><h2>Your concerns</h2><p>${concerns.length} submitted record${concerns.length === 1 ? "" : "s"}</p></div><button class="panel-link" data-page="concerns">View all →</button></div>${concerns.slice(0, 3).map(item => `<div class="concern-card"><div class="concern-card-head"><h3>${esc(item.subject)}</h3>${badge(item.status)}</div><p>${esc(item.message)}</p></div>`).join("") || `<div class="empty-state">No concerns submitted.</div>`}</section></div>`;
}

function tenantsPage() {
  const rows = state.tenants.map(tenant => {
    const room = roomById(tenant.roomId);
    return `<tr><td><div class="cell-primary"><strong>${esc(tenant.name)}</strong><span>${esc(tenant.email)}</span></div></td><td>${esc(tenant.phone || "—")}</td><td>${esc(room?.name || "—")} ${tenant.bed ? `· Bed ${tenant.bed}` : ""}</td><td>${formatDate(tenant.moveIn)}</td><td>${tenant.moveOut ? formatDate(tenant.moveOut) : "—"}</td><td>${badge(tenant.status)}</td><td>${tenant.status === "Active" ? `<button class="text-action" data-action="move-out" data-id="${esc(tenant.id)}">Move out</button>` : "—"}</td></tr>`;
  }).join("");
  return `${heading("Tenant management", "Keep tenant contact details, assignments and move-out history.", `<button class="btn btn-primary" data-action="add-tenant">＋ Add tenant</button>`)}<section class="table-card"><div class="table-head"><h2>Tenant records <span class="muted">· ${state.tenants.length}</span></h2><input class="toolbar-search" data-filter="tenant-table" placeholder="Search tenants..." aria-label="Search tenants"></div><div id="tenant-table">${table(["Tenant", "Contact", "Room / bed", "Move-in", "Move-out", "Status", "Action"], rows)}</div></section>`;
}

function accountsPage() {
  const rows = state.accounts.map(account => `<tr><td><strong>${esc(account.username)}</strong></td><td>${badge(account.role)}</td><td>${formatDate(account.createdAt)}</td><td>${badge(account.status)}</td></tr>`).join("");
  return `${heading("User accounts", "Admin accounts and staff accounts are created here. Tenant accounts are created together with their tenant record.", `<button class="btn btn-primary" data-action="add-account">＋ Create account</button>`)}
    <div class="info-banner"><div>ⓘ</div><div><strong>Account access</strong>Only an Admin can create other Admin and Staff accounts. Create each Tenant login in the Add tenant form so it is linked to their billing records.</div></div>
    <section class="table-card"><div class="table-head"><h2>Administrator and staff accounts · ${state.accounts.length}</h2><input class="toolbar-search" data-filter="accounts-table" placeholder="Search accounts..." aria-label="Search accounts"></div><div id="accounts-table">${table(["Username", "Role", "Created", "Status"], rows, "No Admin or Staff accounts have been created yet.")}</div></section>`;
}

function registrationsPage() {
  const rows = state.registrationRequests.map(request => `<tr>
    <td><div class="cell-primary"><strong>${esc(request.fullName)}</strong><span>${esc(request.username)}</span></div></td>
    <td>${badge(request.role)}</td><td>${esc(request.email || "—")}<br>${esc(request.phone || "")}</td>
    <td>${request.moveIn ? formatDate(request.moveIn) : "—"}</td><td>${formatDate(request.createdAt)}</td>
    <td><button class="text-action" data-action="approve-registration" data-id="${esc(request.id)}">Review / approve</button> · <button class="text-action" data-action="reject-registration" data-id="${esc(request.id)}">Reject</button></td>
  </tr>`).join("");
  return `${heading("Registration requests", "Review account requests before access is enabled. Tenant approval requires assigning an available room and bed.")}<section class="table-card"><div class="table-head"><h2>Pending requests · ${state.registrationRequests.length}</h2></div>${table(["Applicant", "Role", "Contact", "Move-in", "Requested", "Action"], rows, "No pending registrations.")}</section>`;
}

function roomsPage() {
  const cards = state.rooms.map(room => {
    const tenants = state.tenants.filter(tenant => tenant.status === "Active" && tenant.roomId === room.id);
    return `<article class="room-card"><div class="room-card-top"><h3>${esc(room.name)}</h3>${badge(room.status)}</div><p>${tenants.length} occupied · ${Math.max(0, room.capacity - tenants.length)} available · Capacity ${room.capacity}</p><div class="room-slots">${Array.from({ length: Number(room.capacity) }, (_, index) => `<span class="slot${tenants.some(tenant => Number(tenant.bed) === index + 1) ? " taken" : ""}" title="${tenants.find(tenant => Number(tenant.bed) === index + 1)?.name || "Available"}">${index + 1}</span>`).join("")}</div></article>`;
  }).join("");
  return `${heading("Rooms & bed spaces", "See room capacities and active bed assignments.", `<button class="btn btn-primary" data-action="add-room">＋ Add room</button>`)}<div class="info-banner"><div>ⓘ</div><div><strong>Assignment history is retained</strong>Moving a tenant out releases their bed space while their billing and payment records remain available.</div></div><div class="room-grid">${cards || `<div class="empty-state">No rooms added yet.</div>`}</div>`;
}

function billingPage() {
  const bills = currentTenantBills().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const actions = session.role === "Admin" ? `<button class="btn btn-primary" data-action="add-bill">＋ Create billing</button>` : "";
  return `${heading(session.role === "Tenant" ? "My billing" : "Billing statements", session.role === "Tenant" ? "Review your charges, payments and remaining balance." : "Create flexible billing periods and monitor balances.", actions)}${session.role === "Tenant" ? `<div class="info-banner"><div>ⓘ</div><div><strong>How your balance is calculated</strong>Rent + electricity + water − discount + adjustment + previous balance − payments received.</div></div>` : `<div class="info-banner"><div>ⓘ</div><div><strong>Flexible billing periods</strong>Set the cutoff and due date for each bill. Previous balances can be carried into a new bill. Discounts and adjustments are recorded separately.</div></div>`}<section class="table-card"><div class="table-head"><h2>${bills.length} billing record${bills.length === 1 ? "" : "s"}</h2><input class="toolbar-search" data-filter="billing-table" placeholder="Search tenant or period..." aria-label="Search billing"></div><div id="billing-table">${table(["Tenant", "Period", "Total due", "Paid", "Balance", "Due date", "Status", "Statement"], billRows(bills))}</div></section>`;
}

function paymentsTable(payments, title) {
  return `<section class="table-card"><div class="table-head"><h2>${title}</h2><div class="table-tools">${session.role !== "Tenant" ? `<button class="btn btn-primary btn-small" data-action="add-payment">＋ Record payment</button>` : ""}<input class="toolbar-search" data-filter="payment-table" placeholder="Search payments..." aria-label="Search payments"></div></div><div id="payment-table">${table(["Tenant / payer", "Period", "Amount", "Method", "Date", "Reference", "Received by", "Receipt"], paymentRows(payments))}</div></section>`;
}
function paymentsPage() {
  const payments = session.role === "Tenant" ? state.payments.filter(payment => currentTenantBills().some(bill => bill.id === payment.billId)) : state.payments.slice();
  return `${heading(session.role === "Tenant" ? "My payment history" : "Payment transactions", session.role === "Tenant" ? "Your recorded transactions and payment confirmations." : "Record GCash or personal payments, including partial payments.", "")}${paymentsTable(payments.slice().reverse(), `${payments.length} transaction${payments.length === 1 ? "" : "s"}`)}`;
}

function depositsPage() {
  const deposits = state.deposits.filter(item => session.role !== "Tenant" || item.tenantId === session.tenantId);
  const rows = deposits.map(item => {
    const tenant = tenantById(item.tenantId);
    return `<tr><td><strong>${esc(tenant?.name || "Former tenant")}</strong></td><td class="money">${money(item.amount)}</td><td>${formatDate(item.date)}</td><td>${badge(item.status)}</td><td class="money">${money(item.refund)}</td><td>${session.role === "Admin" && item.status === "Held" ? `<button class="text-action" data-action="refund-deposit" data-id="${esc(item.id)}">Record refund</button>` : "—"}</td></tr>`;
  }).join("");
  return `${heading(session.role === "Tenant" ? "My security deposit" : "Security deposits", "Deposits are separate from monthly rent and utility charges.", session.role === "Admin" ? `<button class="btn btn-primary" data-action="add-deposit">＋ Record deposit</button>` : "")}<div class="info-banner"><div>ⓘ</div><div><strong>Optional by dormitory policy</strong>Only deposits actually collected should be recorded. A refund or adjustment should be reviewed against the final account.</div></div><section class="table-card">${table(["Tenant", "Deposit amount", "Received", "Status", "Refunded", "Action"], rows)}</section>`;
}

function concernsPage() {
  const concerns = state.concerns.filter(item => session.role !== "Tenant" || item.tenantId === session.tenantId).slice().reverse();
  return `${heading(session.role === "Tenant" ? "My concerns" : "Tenant concerns", session.role === "Tenant" ? "Submit a dormitory-related question or concern and follow its status." : "Review tenant messages and record a response or status update.", session.role === "Tenant" ? `<button class="btn btn-primary" data-action="add-concern">＋ Submit concern</button>` : "")}${session.role !== "Tenant" ? `<div class="info-banner"><div>ⓘ</div><div><strong>Email is not configured</strong>Concern records are stored in this browser demo; no email alerts or replies are sent.</div></div>` : ""}<section class="table-card">${concerns.map(item => {
    const tenant = tenantById(item.tenantId);
    return `<article class="concern-card"><div class="concern-card-head"><div><h3>${esc(item.subject)}</h3><span class="muted">${esc(tenant?.name || "Tenant")} · ${esc(item.category)} · ${formatDate(item.date)}</span></div><div class="row-actions">${badge(item.status)}${session.role !== "Tenant" && item.status !== "Closed" ? `<button class="text-action" data-action="respond-concern" data-id="${esc(item.id)}">Review / reply</button>` : ""}</div></div><p>${esc(item.message)}</p>${item.response ? `<div class="response-box"><strong>Owner response:</strong> ${esc(item.response)}</div>` : ""}</article>`;
  }).join("") || `<div class="empty-state">No concerns to show.</div>`}</section>`;
}

function occupancyPage() {
  const options = state.rooms.map(room => `<option value="${esc(room.id)}">${esc(room.name)} (capacity ${room.capacity})</option>`).join("");
  const rows = state.scans.slice().reverse().map(scan => `<tr><td>${esc(roomById(scan.roomId)?.name || "Removed room")}</td><td>${scan.count}</td><td>${scan.capacity}</td><td>${formatDate(scan.date)}</td><td>${esc(scan.note || "Manual count")}</td><td>${esc(scan.actor)}</td></tr>`).join("");
  return `${heading("Room occupancy", "Record an observed room count and compare it with registered capacity.", `<button class="btn btn-secondary" data-action="open-camera">◉ Open camera</button><button class="btn btn-primary" data-action="scan-room">＋ Record count</button>`)}
    <div class="info-banner"><div>ⓘ</div><div><strong>Prototype: camera-assisted manual count</strong>This browser demo can display a camera preview when permission is granted, but it does not detect or identify people automatically. Verify any difference in person; a count is not proof of unauthorized occupancy.</div></div>
    <div class="two-column"><section class="panel"><div class="panel-header"><div><h2>Camera preview</h2><p>Camera access requires HTTPS or localhost and your permission.</p></div></div><div class="camera-stage" id="camera-stage"><span>Camera is off. Open the camera to show a local preview.</span></div><div class="heading-actions" style="margin-top:12px"><button class="btn btn-secondary btn-small" data-action="open-camera">Start preview</button><button class="btn btn-quiet btn-small" data-action="close-camera">Stop camera</button></div></section><section class="panel"><div class="panel-header"><div><h2>Registered occupancy</h2><p>Active assigned tenants compared with capacity</p></div></div>${state.rooms.map(room => { const count = state.tenants.filter(tenant => tenant.status === "Active" && tenant.roomId === room.id).length; return `<div class="receipt-line"><span>${esc(room.name)}</span><strong>${count} / ${room.capacity}</strong></div>`; }).join("") || `<div class="empty-state">No rooms added.</div>`}</section></div>
    <section class="table-card"><div class="table-head"><h2>Occupancy scan history</h2></div>${table(["Room", "Detected / entered", "Capacity", "Date", "Note", "Recorded by"], rows)}</section>`;
}

function auditPage() {
  const rows = state.audit.map(item => `<tr><td>${new Date(item.date).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</td><td>${esc(item.actor)}</td><td>${esc(item.message)}</td></tr>`).join("");
  return `${heading("Audit log", "Recent important actions recorded in this browser demo.", "")}<section class="table-card">${table(["Date & time", "User", "Activity"], rows)}</section>`;
}

function renderPage() {
  if (!session) return;
  const allowed = navigation[session.role].map(item => item[0]);
  if (!allowed.includes(activePage)) activePage = "dashboard";
  const content = document.getElementById("page-content");
  document.querySelector(".breadcrumb b").textContent = pageTitles[activePage];
  const renderers = { dashboard, tenants: tenantsPage, rooms: roomsPage, accounts: accountsPage, registrations: registrationsPage, billing: billingPage, payments: paymentsPage, deposits: depositsPage, concerns: concernsPage, occupancy: occupancyPage, audit: auditPage };
  content.innerHTML = renderers[activePage]();
}
