"use strict";

function appShell() {
  const menu = navigation[session.role];
  document.getElementById("app").innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand"><div class="brand-mark">A</div><div><div class="brand-name">Angelina's Dormitory</div><div class="brand-subtitle">Billing management</div></div></div>
        <div class="nav-caption">Workspace</div>
        <nav class="nav-list" aria-label="Main navigation">${menu.map(([key, icon, title]) => `<button class="nav-item${activePage === key ? " active" : ""}" data-page="${key}"><span class="nav-icon">${icon}</span>${title}</button>`).join("")}</nav>
        <div class="sidebar-bottom">
          <div class="sidebar-note">Data is saved in the dormitory database. Email alerts and automatic camera counting are not configured.</div>
          <div class="profile-row"><div class="avatar">${esc(initials(session.name))}</div><div class="profile-meta"><strong>${esc(session.name)}</strong><span>${esc(session.role)} account</span></div><button class="logout-button" data-action="logout" aria-label="Sign out" title="Sign out">↗</button></div>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar"><div class="breadcrumb">Dormitory management <span class="muted">/</span> <b>${esc(pageTitles[activePage])}</b></div><div class="topbar-right"><span class="date-label">${new Date().toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}</span><span class="role-chip">${esc(session.role)} view</span></div></header>
        <section class="content" id="page-content"></section>
      </main>
    </div>`;
  renderPage();
}

function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function metric(label, value, note, icon) {
  return `<article class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${note}</div></article>`;
}
function table(headers, rows, emptyMessage = "No records to show yet.") {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td class="empty-state" colspan="${headers.length}">${emptyMessage}</td></tr>`}</tbody></table></div>`;
}
function billRows(bills) {
  return bills.map(bill => {
    const tenant = tenantById(bill.tenantId);
    return `<tr><td><div class="cell-primary"><strong>${esc(tenant?.name || "Former tenant")}</strong><span>${esc(roomById(tenant?.roomId)?.name || "No room assigned")}</span></div></td><td>${esc(bill.period)}</td><td class="money">${money(billTotal(bill))}</td><td class="money">${money(totalPaid(bill.id))}</td><td class="money"><strong>${money(balance(bill))}</strong></td><td>${formatDate(bill.dueDate)}</td><td>${badge(billStatus(bill))}</td><td><button class="text-action" data-action="receipt" data-id="${esc(bill.id)}">Statement</button></td></tr>`;
  }).join("");
}
function paymentRows(payments) {
  return payments.map(payment => {
    const bill = billById(payment.billId);
    const tenant = tenantById(bill?.tenantId);
    return `<tr><td><strong>${esc(payment.payer || tenant?.name || "Tenant")}</strong></td><td>${esc(bill?.period || "—")}</td><td class="money"><strong>${money(payment.amount)}</strong></td><td>${esc(payment.method)}</td><td>${formatDate(payment.date)}</td><td>${esc(payment.reference || "—")}</td><td>${esc(payment.receiver || "—")}</td><td><button class="text-action" data-action="payment-receipt" data-id="${esc(payment.id)}">Receipt</button></td></tr>`;
  }).join("");
}
function dashboard() {
  if (session.role === "Tenant") return tenantDashboard();
  if (session.role === "Staff") {
    const own = state.payments.filter(payment => payment.receiver === session.name);
    return `${heading(`Good day, ${esc(session.name)}`, "Record tenant payments and review transactions you've received.", `<button class="btn btn-primary" data-action="add-payment">＋ Record payment</button>`)}
      <div class="metrics">${metric("Payments recorded", own.length, "Transactions by your account", "₱")}${metric("Collected today", money(own.filter(item => item.date === isoDate()).reduce((sum, item) => sum + Number(item.amount), 0)), "Your recorded transactions", "↗")}${metric("Recent transactions", own.filter(item => item.date >= isoDate(-7)).length, "Recorded in the last 7 days", "◷")}${metric("Payment methods", "2", "GCash and personal payment", "▣")}</div>
      ${paymentsTable(own.slice().reverse(), "Your recent payments")}`;
  }
  const activeTenants = state.tenants.filter(tenant => tenant.status === "Active").length;
  const capacity = state.rooms.reduce((sum, room) => sum + Number(room.capacity), 0);
  const occupied = state.tenants.filter(tenant => tenant.status === "Active").length;
  const outstanding = state.bills.reduce((sum, bill) => sum + balance(bill), 0);
  const overdue = state.bills.filter(bill => billStatus(bill) === "Overdue").length;
  const collected = state.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const recent = state.payments.slice().reverse().slice(0, 5);
  const months = [...new Set(state.bills.map(bill => bill.period))].slice(-6);
  const chart = months.map(month => {
    const amount = state.bills.filter(bill => bill.period === month).reduce((sum, bill) => sum + totalPaid(bill.id), 0);
    const max = Math.max(1, ...months.map(period => state.bills.filter(bill => bill.period === period).reduce((sum, bill) => sum + totalPaid(bill.id), 0)));
    return `<div class="bar-column"><div class="bar" style="height:${Math.max(4, Math.round(amount / max * 100))}%"></div><span class="bar-label">${esc(month.split(" ")[0].slice(0, 3))}</span></div>`;
  }).join("");
  const actions = `<button class="btn btn-secondary" data-page="billing">View billing</button><button class="btn btn-primary" data-action="add-tenant">＋ Add tenant</button>`;
  return `${heading(`Good day, ${esc(session.name)}`, "Here is what's happening at your dormitory today.", actions)}
    <div class="metrics">${metric("Active tenants", activeTenants, `${state.tenants.length} total tenant records`, "♙")}${metric("Bed spaces occupied", `${occupied} / ${capacity}`, `${Math.max(0, capacity - occupied)} spaces available`, "▦")}${metric("Payments collected", money(collected), `${state.payments.length} recorded transactions`, "₱")}${metric("Outstanding balance", money(outstanding), `${overdue} overdue billing record${overdue === 1 ? "" : "s"}`, "◷")}</div>
    <div class="two-column"><section class="panel"><div class="panel-header"><div><h2>Collections overview</h2><p>Payments received across saved billing periods</p></div><button class="panel-link" data-page="payments">All payments →</button></div><div class="bar-chart">${chart || `<div class="empty-state">Collections will appear here when payments are recorded.</div>`}</div></section>
    <section class="panel"><div class="panel-header"><div><h2>Room occupancy</h2><p>Active assignments across all bed spaces</p></div><button class="panel-link" data-page="rooms">View rooms →</button></div><div class="occupancy-summary"><div class="donut" style="--occupancy:${capacity ? occupied / capacity * 100 : 0}%"><div class="donut-center"><strong>${capacity ? Math.round(occupied / capacity * 100) : 0}%</strong><span>occupied</span></div></div><div class="legend"><span>${occupied} occupied</span><span>${Math.max(0, capacity - occupied)} available</span></div></div></section></div>
    <div class="two-column"><section class="table-card"><div class="table-head"><h2>Recent payments</h2><button class="panel-link" data-page="payments">View all →</button></div>${table(["Tenant / payer", "Billing period", "Amount", "Method", "Date", ""], recent.map(payment => {
      const bill = billById(payment.billId); const tenant = tenantById(bill?.tenantId);
      return `<tr><td><strong>${esc(payment.payer || tenant?.name || "Tenant")}</strong></td><td>${esc(bill?.period || "—")}</td><td class="money"><strong>${money(payment.amount)}</strong></td><td>${esc(payment.method)}</td><td>${formatDate(payment.date)}</td><td><button class="text-action" data-action="payment-receipt" data-id="${esc(payment.id)}">Receipt</button></td></tr>`;
    }).join(""))}</section><section class="panel"><div class="panel-header"><div><h2>Recent activity</h2><p>Latest actions in the system</p></div><button class="panel-link" data-page="audit">Audit log →</button></div><div class="activity-list">${state.audit.slice(0, 4).map(item => `<div class="activity-item"><span class="activity-dot">•</span><div><strong>${esc(item.message)}</strong><span>${esc(item.actor)} · ${new Date(item.date).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span></div></div>`).join("")}</div><div class="eyebrow" style="margin:18px 0 11px">Email status · demo only</div><div class="activity-list">${state.notifications.slice().reverse().slice(0, 3).map(item => `<div class="activity-item"><span class="activity-dot">✉</span><div><strong>${esc(item.type)}</strong><span>${esc(tenantById(item.tenantId)?.name || "Tenant")} · ${esc(item.status)} · ${new Date(item.date).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span></div></div>`).join("") || `<span class="muted" style="font-size:10px">No notification records yet. Email is not connected.</span>`}</div></section></div>`;
}
