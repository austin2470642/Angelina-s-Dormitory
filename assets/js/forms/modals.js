"use strict";

function modal(title, description, body) {
  document.getElementById("modal-root").innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-header"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header>${body}</section></div>`;
}
function closeModal() { document.getElementById("modal-root").innerHTML = ""; }
function optionsForTenants(selected = "") {
  return state.tenants.filter(tenant => tenant.status === "Active").map(tenant => `<option value="${esc(tenant.id)}"${tenant.id === selected ? " selected" : ""}>${esc(tenant.name)}</option>`).join("");
}
function addTenantModal() {
  const roomOptions = state.rooms.map(room => `<option value="${esc(room.id)}">${esc(room.name)} (${Math.max(0, room.capacity - state.tenants.filter(tenant => tenant.status === "Active" && tenant.roomId === room.id).length)} available)</option>`).join("");
  modal("Add tenant", "Create a tenant record and assign an available bed space.", `<form class="modal-body" id="tenant-form"><div class="form-grid">
    <div class="field full"><label>Full name</label><input name="name" required maxlength="90"></div><div class="field"><label>Contact number</label><input name="phone" maxlength="30"></div><div class="field"><label>Email address for billing QR</label><input name="email" type="email" required maxlength="190"></div>
    <div class="field"><label>Room</label><select name="roomId" required>${roomOptions}</select></div><div class="field"><label>Available bed</label><select name="bed" required></select></div>
    <div class="field"><label>Tenant username</label><input name="username" required minlength="3" maxlength="80" autocomplete="off"></div><div class="field"><label>Temporary password</label><input name="password" type="password" required minlength="8" maxlength="100" autocomplete="new-password"></div>
    <div class="field full"><label>Move-in date</label><input name="moveIn" type="date" value="${isoDate()}" required></div></div><div class="demo-warning">A private QR link to this tenant's billing information will be sent to this email after the tenant record is saved. Share the temporary account credentials securely.</div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save tenant and email QR</button></div></form>`);
  const form = document.getElementById("tenant-form");
  const roomSelect = form.elements.roomId;
  const beds = form.elements.bed;
  const updateBeds = () => {
    const room = roomById(roomSelect.value);
    const used = state.tenants.filter(tenant => tenant.status === "Active" && tenant.roomId === room?.id).map(tenant => Number(tenant.bed));
    beds.innerHTML = Array.from({ length: Number(room?.capacity || 0) }, (_, index) => index + 1).filter(bed => !used.includes(bed)).map(bed => `<option value="${bed}">Bed ${bed}</option>`).join("");
    if (!beds.options.length) beds.innerHTML = `<option value="">No beds available</option>`;
  };
  roomSelect.addEventListener("change", updateBeds);
  updateBeds();
}
function addAccountModal() {
  modal("Create user account", "Create an Admin or Staff login. Tenant accounts are created with their tenant record.", `<form class="modal-body" id="account-form"><div class="form-grid">
    <div class="field"><label>Account role</label><select name="role" required><option value="Staff">Staff</option><option value="Admin">Admin</option></select></div>
    <div class="field"><label>Username</label><input name="username" required minlength="3" maxlength="80" autocomplete="off"></div>
    <div class="field full"><label>Temporary password</label><input name="password" type="password" required minlength="8" maxlength="100" autocomplete="new-password"></div>
  </div><div class="demo-warning">Share the credentials securely. Passwords are stored as hashes and cannot be viewed later.</div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Create account</button></div></form>`);
}
function approveRegistrationModal(request) {
  const rooms = state.rooms.filter(room => room.status === "Open" && Array.from({ length: Number(room.capacity) }, (_, index) => index + 1)
    .some(bed => !state.tenants.some(tenant => tenant.status === "Active" && tenant.roomId === room.id && Number(tenant.bed) === bed)));
  if (!rooms.length) return showToast("There are no available room beds to assign. Add or free a bed before approving this tenant.", true);
  modal("Approve Tenant registration", `Assign a room and bed for ${request.fullName}.`, `<form class="modal-body" id="registration-approval-form" data-id="${esc(request.id)}"><div class="form-grid">
    <div class="field full"><label>Email for billing QR</label><input name="email" type="email" value="${esc(request.email || "")}" maxlength="190" required></div>
    <div class="field"><label>Room</label><select name="roomId" required>${rooms.map(room => `<option value="${esc(room.id)}">${esc(room.name)}</option>`).join("")}</select></div>
    <div class="field"><label>Available bed</label><select name="bed" required></select></div>
    <div class="field full"><label>Requested move-in</label><input value="${esc(request.moveIn || "")}" disabled></div>
  </div><div class="demo-warning">Approving creates the Tenant record and emails a private billing QR to this address.</div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Approve and email QR</button></div></form>`);
  const form = document.getElementById("registration-approval-form");
  const roomSelect = form.elements.roomId;
  const beds = form.elements.bed;
  const updateBeds = () => {
    const room = roomById(roomSelect.value);
    const used = state.tenants.filter(tenant => tenant.status === "Active" && tenant.roomId === room?.id).map(tenant => Number(tenant.bed));
    beds.innerHTML = Array.from({ length: Number(room?.capacity || 0) }, (_, index) => index + 1)
      .filter(bed => !used.includes(bed))
      .map(bed => `<option value="${bed}">Bed ${bed}</option>`).join("");
    if (!beds.options.length) beds.innerHTML = `<option value="">No beds available</option>`;
  };
  roomSelect.addEventListener("change", updateBeds);
  updateBeds();
}
function addRoomModal() {
  modal("Add room", "Create a room and set the number of bed spaces.", `<form class="modal-body" id="room-form"><div class="form-grid"><div class="field"><label>Room name / number</label><input name="name" required maxlength="40" placeholder="Room 104"></div><div class="field"><label>Bed capacity</label><input name="capacity" type="number" min="1" max="40" value="4" required></div></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save room</button></div></form>`);
}
function addBillModal() {
  if (!state.tenants.some(tenant => tenant.status === "Active")) return showToast("Add an active tenant before creating a bill.", true);
  modal("Create billing statement", "Set this period's charges, cutoff and due date.", `<form class="modal-body" id="bill-form"><div class="form-grid">
    <div class="field full"><label>Tenant</label><select name="tenantId" required>${optionsForTenants()}</select></div><div class="field"><label>Billing period</label><input name="period" required placeholder="December 2026"></div><div class="field"><label>Cutoff date</label><input name="cutoff" type="date" value="${isoDate()}" required></div><div class="field"><label>Due date</label><input name="dueDate" type="date" value="${isoDate(14)}" required></div><div class="field"><label>Rent (₱)</label><input name="rent" type="number" min="0" step="0.01" value="5000" required></div><div class="field"><label>Electricity (₱)</label><input name="electricity" type="number" min="0" step="0.01" value="0" required></div><div class="field"><label>Water (₱)</label><input name="water" type="number" min="0" step="0.01" value="0" required></div><div class="field"><label>Discount (₱)</label><input name="discount" type="number" min="0" step="0.01" value="0" required></div><div class="field"><label>Adjustment (₱)</label><input name="adjustment" type="number" step="0.01" value="0" required></div><div class="field"><label>Previous balance (₱)</label><input name="previousBalance" type="number" min="0" step="0.01" value="0" required></div><div class="field full"><label>Adjustment reason (if applicable)</label><input name="adjustmentReason" maxlength="160" placeholder="Reason for additional charge or correction"></div></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save billing</button></div></form>`);
}
function addPaymentModal() {
  const bills = state.bills.filter(bill => balance(bill) > 0);
  if (!bills.length) return showToast("There are no outstanding bills to pay.", true);
  modal("Record payment", "Record full or partial payment against a billing statement.", `<form class="modal-body" id="payment-form"><div class="form-grid"><div class="field full"><label>Billing statement</label><select name="billId" required>${bills.map(bill => `<option value="${esc(bill.id)}">${esc(tenantById(bill.tenantId)?.name || "Tenant")} · ${esc(bill.period)} · balance ${money(balance(bill))}</option>`).join("")}</select></div><div class="field"><label>Payer name</label><input name="payer" maxlength="90" required></div><div class="field"><label>Amount received (₱)</label><input name="amount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Payment method</label><select name="method"><option>GCash</option><option>Personal Payment</option></select></div><div class="field"><label>Payment date</label><input name="date" type="date" value="${isoDate()}" required></div><div class="field full"><label>Reference (optional)</label><input name="reference" maxlength="100"></div></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save payment</button></div></form>`);
  const form = document.getElementById("payment-form");
  const updatePayer = () => { const bill = billById(form.elements.billId.value); form.elements.payer.value = tenantById(bill?.tenantId)?.name || ""; form.elements.amount.max = balance(bill); };
  form.elements.billId.addEventListener("change", updatePayer);
  updatePayer();
}
function addDepositModal() {
  modal("Record security deposit", "Record a deposit actually received by the dormitory.", `<form class="modal-body" id="deposit-form"><div class="form-grid"><div class="field full"><label>Tenant</label><select name="tenantId" required>${optionsForTenants()}</select></div><div class="field"><label>Amount received (₱)</label><input name="amount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Date received</label><input name="date" type="date" value="${isoDate()}" required></div></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save deposit</button></div></form>`);
}
function addConcernModal() {
  modal("Submit a concern", "Send a dormitory-related concern for the owner to review.", `<form class="modal-body" id="concern-form"><div class="form-grid">${session.role !== "Tenant" ? `<div class="field full"><label>Tenant</label><select name="tenantId" required>${optionsForTenants()}</select></div>` : ""}<div class="field"><label>Category</label><select name="category"><option>Room / facility</option><option>Billing question</option><option>Payment clarification</option><option>Other</option></select></div><div class="field"><label>Subject</label><input name="subject" required maxlength="100"></div><div class="field full"><label>Details</label><textarea name="message" required maxlength="1500" placeholder="Describe the issue or question..."></textarea></div></div><div class="demo-warning">Demo mode: your concern is saved in this browser. No email alert is sent.</div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Submit concern</button></div></form>`);
}
function respondConcernModal(id) {
  const concern = state.concerns.find(item => item.id === id);
  if (!concern) return showToast("Concern record not found.", true);
  modal("Review concern", `${tenantById(concern.tenantId)?.name || "Tenant"} · ${concern.subject}`, `<form class="modal-body" id="response-form" data-id="${esc(id)}"><div class="info-banner"><div>ⓘ</div><div>${esc(concern.message)}</div></div><div class="field"><label>Status</label><select name="status">${["New", "In Review", "Responded", "Closed"].map(status => `<option${status === concern.status ? " selected" : ""}>${status}</option>`).join("")}</select></div><div class="field"><label>Owner response</label><textarea name="response" maxlength="1500">${esc(concern.response)}</textarea></div><div class="demo-warning">Demo mode: response is stored in this browser; no email reply is sent.</div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save response</button></div></form>`);
}
function occupancyModal() {
  if (!state.rooms.length) return showToast("Add a room before recording an occupancy count.", true);
  modal("Record occupancy count", "Record a count for verification against registered room capacity.", `<form class="modal-body" id="scan-form"><div class="form-grid"><div class="field full"><label>Room</label><select name="roomId" required>${state.rooms.map(room => `<option value="${esc(room.id)}">${esc(room.name)} · capacity ${room.capacity}</option>`).join("")}</select></div><div class="field"><label>Observed people count</label><input name="count" type="number" min="0" max="100" required></div><div class="field"><label>Scan date</label><input name="date" type="date" value="${isoDate()}" required></div><div class="field full"><label>Note (optional)</label><input name="note" maxlength="160" placeholder="Manual visual count"></div></div><div class="demo-warning">This is a manually entered count. It does not identify people or prove unauthorized occupancy.</div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save count</button></div></form>`);
}

function receiptModal(billId) {
  const bill = billById(billId);
  if (!bill) return showToast("Billing statement not found.", true);
  const tenant = tenantById(bill.tenantId);
  const lines = [["Rent", bill.rent], ["Electricity", bill.electricity], ["Water", bill.water], ["Discount", -bill.discount], ["Adjustment", bill.adjustment], ["Previous balance", bill.previousBalance], ["Total billed", billTotal(bill)], ["Payments received", totalPaid(bill.id)], ["Remaining balance", balance(bill)]];
  modal("Billing statement", "The statement total includes prior balances and any recorded adjustments.", `<div class="modal-body receipt"><div class="eyebrow">Angelina's Dormitory</div><h2>${esc(tenant?.name || "Former tenant")}</h2><div class="muted">${esc(bill.period)} · ${esc(roomById(tenant?.roomId)?.name || "No room assigned")}</div><div class="receipt-lines">${lines.map(([label, amount]) => `<div class="receipt-line"><span>${esc(label)}${label === "Adjustment" && bill.adjustmentReason ? ` · ${esc(bill.adjustmentReason)}` : ""}</span><strong class="money">${money(amount)}</strong></div>`).join("")}<div class="receipt-line"><span>Cutoff date</span><strong>${formatDate(bill.cutoff)}</strong></div><div class="receipt-line"><span>Due date</span><strong>${formatDate(bill.dueDate)} · ${badge(billStatus(bill))}</strong></div></div><div class="demo-warning">Billing details are available to the tenant through their private emailed QR link. Recording a payment must still be done separately.</div><div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="print-receipt">Print</button></div></div>`);
}
function paymentReceiptModal(id) {
  const payment = state.payments.find(item => item.id === id);
  if (!payment) return showToast("Payment record not found.", true);
  const bill = billById(payment.billId);
  const tenant = tenantById(bill?.tenantId);
  modal("Payment receipt", "Confirmation of a payment recorded in this system.", `<div class="modal-body receipt"><div class="eyebrow">Payment received</div><h2>${esc(payment.payer || tenant?.name || "Tenant")}</h2><div class="muted">${esc(roomById(tenant?.roomId)?.name || "No room assigned")} · ${esc(bill?.period || "—")}</div><div class="receipt-lines"><div class="receipt-line"><span>Amount received</span><strong>${money(payment.amount)}</strong></div><div class="receipt-line"><span>Method</span><strong>${esc(payment.method)}</strong></div><div class="receipt-line"><span>Date</span><strong>${formatDate(payment.date)}</strong></div><div class="receipt-line"><span>Reference</span><strong>${esc(payment.reference || "—")}</strong></div><div class="receipt-line"><span>Received by</span><strong>${esc(payment.receiver || "—")}</strong></div><div class="receipt-line"><span>Remaining bill balance</span><strong>${money(bill ? balance(bill) : 0)}</strong></div></div><div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="print-receipt">Print</button></div></div>`);
}
