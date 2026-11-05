"use strict";

async function finishSave(message, action, data = {}) {
  try {
    await apiMutation(action, data);
    closeModal();
    renderPage();
    showToast(message);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function moveOut(id) {
  const tenant = tenantById(id);
  if (!tenant || tenant.status !== "Active") return;
  const confirmed = window.confirm(`Record ${tenant.name} as moved out? Their billing and payment history will be kept.`);
  if (!confirmed) return;
  try {
    await apiMutation("move_out", { id });
    renderPage();
    showToast("Move-out recorded. Historical records were kept.");
  } catch (error) {
    showToast(error.message, true);
  }
}

async function reviewRegistration(id) {
  const request = state.registrationRequests.find(item => item.id === id);
  if (!request) return showToast("Registration request not found.", true);
  if (request.role === "Tenant") {
    approveRegistrationModal(request);
    return;
  }
  await finishSave("Staff registration approved and account activated.", "approve_registration", { id });
}

async function rejectRegistration(id) {
  const request = state.registrationRequests.find(item => item.id === id);
  if (!request || !window.confirm(`Reject the ${request.role} registration for ${request.username}?`)) return;
  try {
    await apiMutation("reject_registration", { id });
    renderPage();
    showToast("Registration rejected.");
  } catch (error) {
    showToast(error.message, true);
  }
}

function refundDeposit(id) {
  const deposit = state.deposits.find(item => item.id === id);
  if (!deposit || deposit.status !== "Held") return;
  modal("Record deposit refund", "Review the final account before recording a refund.", `<form class="modal-body" id="refund-form" data-id="${esc(id)}"><div class="field"><label>Refund amount (₱)</label><input name="refund" type="number" min="0" max="${Number(deposit.amount)}" step="0.01" value="${Number(deposit.amount)}" required></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save refund</button></div></form>`);
}

async function handleRefundSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "refund-form") return;
  event.preventDefault();
  const deposit = state.deposits.find(item => item.id === form.dataset.id);
  const refund = Number(new FormData(form).get("refund"));
  if (!deposit || !Number.isFinite(refund) || refund < 0 || refund > Number(deposit.amount)) {
    return showToast("Refund must be between zero and the deposit amount.", true);
  }
  await finishSave("Deposit refund recorded.", "refund_deposit", { id: form.dataset.id, refund });
}

async function logout() {
  closeCamera();
  try {
    await apiRequest("logout", { method: "POST" });
    await apiRequest("csrf");
    session = null;
    state = null;
    activePage = "dashboard";
    loginScreen();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return showToast("Camera preview needs a supported browser and HTTPS or localhost.", true);
  try {
    closeCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const stage = document.getElementById("camera-stage");
    if (stage) stage.innerHTML = `<video autoplay muted playsinline></video>`;
    const video = document.querySelector("#camera-stage video");
    if (video) video.srcObject = cameraStream;
    showToast("Camera preview started. No image is recorded or analyzed.");
  } catch (error) {
    showToast(`Could not open camera: ${error.message}`, true);
  }
}

function closeCamera() {
  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  const stage = document.getElementById("camera-stage");
  if (stage) stage.innerHTML = `<span>Camera is off. Open the camera to show a local preview.</span>`;
}

function filterTable(input) {
  const target = document.getElementById(input.dataset.filter);
  if (!target) return;
  const query = input.value.toLocaleLowerCase();
  target.querySelectorAll("tbody tr").forEach(row => {
    row.hidden = !row.textContent.toLocaleLowerCase().includes(query);
  });
}
