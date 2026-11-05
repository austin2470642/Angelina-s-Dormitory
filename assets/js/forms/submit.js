"use strict";

async function handleFormSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());

  if (form.id === "login-form") {
    try {
      await apiMutation("login", data);
      activePage = "dashboard";
      appShell();
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }

  if (form.id === "registration-form") {
    if (data.password !== data.confirmPassword) return showToast("The passwords do not match.", true);
    try {
      await apiMutation("register", data);
      loginScreen();
      showToast("Registration sent. Wait for Admin approval before signing in.");
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }

  if (form.id === "setup-admin-form") {
    if (data.password !== data.confirmPassword) return showToast("The passwords do not match.", true);
    try {
      const result = await apiMutation("setup_admin", data);
      setupRequired = false;
      activePage = "dashboard";
      session = result.user;
      state = result.state;
      appShell();
    } catch (error) {
      if (error.status === 409) {
        setupRequired = false;
        loginScreen();
      }
      showToast(error.message, true);
    }
    return;
  }

  if (form.id === "account-form") {
    await finishSave("User account created.", "create_account", data);
  } else if (form.id === "registration-approval-form") {
    const request = state.registrationRequests.find(item => item.id === form.dataset.id);
    if (request?.role === "Tenant") {
      await saveNewTenantAndSendQr("approve_registration", { ...data, id: form.dataset.id }, "Tenant registration approved.");
    } else {
      await finishSave("Registration approved and account activated.", "approve_registration", { ...data, id: form.dataset.id });
    }
  } else if (form.id === "tenant-form") {
    const room = roomById(data.roomId);
    const bedTaken = state.tenants.some(
      tenant => tenant.status === "Active" && tenant.roomId === data.roomId && Number(tenant.bed) === Number(data.bed)
    );
    if (!room || !data.bed || Number(data.bed) > Number(room.capacity) || bedTaken) {
      return showToast("That bed space is no longer available. Choose an available bed.", true);
    }
    await saveNewTenantAndSendQr("create_tenant", data, "Tenant record saved.");
  } else if (form.id === "room-form") {
    if (state.rooms.some(room => room.name.toLowerCase() === data.name.trim().toLowerCase())) {
      return showToast("A room with that name already exists.", true);
    }
    await finishSave("Room added.", "create_room", data);
  } else if (form.id === "bill-form") {
    const bill = {
      ...data,
      rent: Number(data.rent),
      electricity: Number(data.electricity),
      water: Number(data.water),
      discount: Number(data.discount),
      adjustment: Number(data.adjustment),
      previousBalance: Number(data.previousBalance)
    };
    if (bill.dueDate < bill.cutoff) return showToast("The due date must be on or after the cutoff date.", true);
    if (billTotal(bill) < 0) return showToast("The bill total cannot be negative.", true);
    if (bill.adjustment !== 0 && !bill.adjustmentReason.trim()) {
      return showToast("Enter a reason for the billing adjustment.", true);
    }
    await finishSave("Billing statement created. It is now available through the tenant's billing QR.", "create_bill", data);
  } else if (form.id === "payment-form") {
    const bill = billById(data.billId);
    const paymentAmount = Number(data.amount);
    if (!bill || !Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > balance(bill) + 0.0001) {
      return showToast("Enter an amount greater than zero and no more than the remaining balance.", true);
    }
    await finishSave("Payment recorded and balance updated.", "record_payment", data);
  } else if (form.id === "deposit-form") {
    await finishSave("Security deposit recorded.", "create_deposit", data);
  } else if (form.id === "concern-form") {
    await finishSave("Concern saved.", "create_concern", data);
  } else if (form.id === "response-form") {
    const concern = state.concerns.find(item => item.id === form.dataset.id);
    if (!concern) return showToast("Concern record not found.", true);
    await finishSave("Concern response saved.", "respond_concern", { ...data, id: form.dataset.id });
  } else if (form.id === "scan-form") {
    const room = roomById(data.roomId);
    if (!room || Number(data.count) < 0) return showToast("Choose a room and enter a valid count.", true);
    await finishSave("Occupancy count saved for review.", "record_scan", data);
  }
}
