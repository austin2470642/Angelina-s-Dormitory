"use strict";

const API_URL = new URL("api/index.php", document.baseURI);
let csrfToken = "";

async function apiRequest(action, options = {}) {
  const method = options.method || "GET";
  const headers = { Accept: "application/json" };
  const request = { method, headers, credentials: "same-origin" };

  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = csrfToken;
    request.body = JSON.stringify(options.body || {});
  }

  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  const response = await fetch(url, request);
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The PHP API returned an invalid response. Check the Apache and PHP error logs.");
  }
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (result.csrf) csrfToken = result.csrf;
  return result;
}

async function apiMutation(action, body = {}) {
  const result = await apiRequest(action, { method: "POST", body });
  if (result.state) state = result.state;
  if (result.user) session = result.user;
  return result;
}

async function apiStartup() {
  try {
    await apiRequest("csrf");
    await apiRequest("health");
    const setup = await apiRequest("setup_status");
    setupRequired = setup.setupRequired;
    if (setupRequired) {
      state = null;
      session = null;
      loginScreen();
      return;
    }
    const result = await apiRequest("state");
    session = result.user;
    state = result.state;
    appShell();
  } catch (error) {
    if (error.status === 401) {
      loginScreen();
      return;
    }
    loginScreen();
    showToast(error.message, true);
  }
}
