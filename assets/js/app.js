"use strict";

document.addEventListener("submit", handleFormSubmit);
document.addEventListener("submit", handleRefundSubmit, true);
document.addEventListener("input", event => {
  if (event.target instanceof HTMLInputElement && event.target.dataset.filter) filterTable(event.target);
});
document.addEventListener("click", event => {
  const button = event.target.closest("[data-page], [data-action]");
  if (!button) return;
  if (button.hasAttribute("data-page")) {
    if (!session) return;
    if (activePage === "occupancy" && button.dataset.page !== "occupancy") closeCamera();
    activePage = button.dataset.page;
    renderPage();
    return;
  }
  const { action, id } = button.dataset;
  if (action === "show-registration") {
    if (!setupRequired) registrationScreen();
  } else if (action === "show-login") {
    loginScreen();
  } else if (action === "logout") {
    logout();
  } else if (action === "close-modal") {
    closeModal();
  } else if (action === "backdrop-close" && event.target === button) {
    closeModal();
  }
  else if (action === "add-tenant") addTenantModal();
  else if (action === "add-account") addAccountModal();
  else if (action === "approve-registration") reviewRegistration(id);
  else if (action === "reject-registration") rejectRegistration(id);
  else if (action === "add-room") addRoomModal();
  else if (action === "add-bill") addBillModal();
  else if (action === "add-payment") addPaymentModal();
  else if (action === "add-deposit") addDepositModal();
  else if (action === "add-concern") addConcernModal();
  else if (action === "respond-concern") respondConcernModal(id);
  else if (action === "scan-room") occupancyModal();
  else if (action === "move-out") moveOut(id);
  else if (action === "refund-deposit") refundDeposit(id);
  else if (action === "receipt") receiptModal(id);
  else if (action === "payment-receipt") paymentReceiptModal(id);
  else if (action === "email-tenant-billing-qr") emailTenantBillingQr(id);
  else if (action === "open-camera") openCamera();
  else if (action === "close-camera") closeCamera();
  else if (action === "print-receipt") window.print();
});
apiStartup();
