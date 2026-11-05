"use strict";

let state = null;

let session = null;
let activePage = "dashboard";
let cameraStream = null;
let toastTimer;
let setupRequired = false;
const isoDate = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const esc = escapeHtml;
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
const money = value => `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
const tenantById = id => state.tenants.find(tenant => tenant.id === id);
const roomById = id => state.rooms.find(room => room.id === id);
const billById = id => state.bills.find(bill => bill.id === id);
const billTotal = bill => Math.max(0, Number(bill.rent) + Number(bill.electricity) + Number(bill.water) - Number(bill.discount) + Number(bill.adjustment) + Number(bill.previousBalance));
const billPayments = billId => state.payments.filter(payment => payment.billId === billId);
const totalPaid = billId => billPayments(billId).reduce((sum, payment) => sum + Number(payment.amount), 0);
const balance = bill => Math.max(0, billTotal(bill) - totalPaid(bill.id));
function billStatus(bill) {
  const remaining = balance(bill);
  if (!remaining) return "Paid";
  if (new Date(`${bill.dueDate}T23:59:59`) < new Date()) return "Overdue";
  return totalPaid(bill.id) > 0 ? "Partial" : "Unpaid";
}
const badge = label => `<span class="badge ${esc(String(label).toLowerCase().replace(/\s+/g, "-"))}">${esc(label)}</span>`;
const currentTenantBills = () => state.bills.filter(bill => session?.role !== "Tenant" || bill.tenantId === session.tenantId);
const navigation = {
  Admin: [
    ["dashboard", "⌂", "Overview"], ["tenants", "♙", "Tenants"], ["rooms", "▦", "Rooms & beds"],
    ["accounts", "♙", "User accounts"],
    ["registrations", "▣", "Registration requests"],
    ["billing", "▤", "Billing"], ["payments", "₱", "Payments"], ["deposits", "◈", "Deposits"],
    ["concerns", "☏", "Concerns"], ["occupancy", "◉", "Occupancy"], ["audit", "≡", "Audit log"]
  ],
  Staff: [["dashboard", "⌂", "Overview"], ["payments", "₱", "Payments"]],
  Tenant: [["dashboard", "⌂", "My account"], ["billing", "▤", "My bills"], ["payments", "₱", "Payments"], ["deposits", "◈", "My deposit"], ["concerns", "☏", "My concerns"]]
};
const pageTitles = {
  dashboard: "Overview", tenants: "Tenant management", rooms: "Rooms & bed spaces",
  accounts: "User accounts",
  registrations: "Registration requests",
  billing: "Billing statements", payments: "Payment transactions", deposits: "Security deposits",
  concerns: "Tenant concerns", occupancy: "Room occupancy", audit: "Audit log"
};

function showToast(message, isError = false) {
  const root = document.getElementById("toast-root");
  root.innerHTML = `<div class="toast${isError ? " error" : ""}">${esc(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ""; }, 3400);
}
function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}
