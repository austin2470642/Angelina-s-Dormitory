"use strict";

function loginScreen() {
  if (setupRequired) {
    document.getElementById("app").innerHTML = `
      <main class="login-page">
        <section class="login-story">
          <div class="sidebar-brand"><div class="brand-mark">A</div><div><div class="brand-name">Angelina's Dormitory</div><div class="brand-subtitle">Billing & fee management</div></div></div>
          <div class="story-copy">
            <div class="eyebrow">One-time first-run setup</div>
            <h1>Create your administrator account.</h1>
            <p>This database has no user accounts yet. Create the first Admin account to secure the system. After signing in, the Admin can create Staff and Tenant accounts.</p>
            <div class="story-points"><span class="story-pill">No default accounts</span><span class="story-pill">Passwords are hashed</span></div>
          </div>
          <div class="login-foot">Angelina's Dormitory · Private administrator setup</div>
        </section>
        <section class="login-panel">
          <div class="login-card">
            <div class="eyebrow">First account</div>
            <h2>Set up the Admin</h2>
            <p>This setup is available only while the database has no accounts.</p>
            <form class="login-form" id="setup-admin-form">
              <div class="field"><label for="setup-username">Admin username</label><input id="setup-username" name="username" required minlength="3" maxlength="80" autocomplete="username" placeholder="Choose a username"></div>
              <div class="field"><label for="setup-password">Password</label><input id="setup-password" name="password" type="password" required minlength="8" maxlength="100" autocomplete="new-password" placeholder="At least 8 characters"></div>
              <div class="field"><label for="setup-confirm-password">Confirm password</label><input id="setup-confirm-password" name="confirmPassword" type="password" required minlength="8" maxlength="100" autocomplete="new-password" placeholder="Enter the same password"></div>
              <button class="btn btn-primary" type="submit">Create Admin account <span aria-hidden="true">→</span></button>
            </form>
            <div class="demo-warning">This creates the first Admin only. Do not share the password. Store it safely because there is no password recovery configured.</div>
          </div>
        </section>
      </main>`;
    return;
  }

  document.getElementById("app").innerHTML = `
    <main class="login-page">
      <section class="login-story">
        <div class="sidebar-brand"><div class="brand-mark">A</div><div><div class="brand-name">Angelina's Dormitory</div><div class="brand-subtitle">Billing & fee management</div></div></div>
        <div class="story-copy">
          <div class="eyebrow">A simpler way to manage dorm life</div>
          <h1>Everything in its right place.</h1>
          <p>Keep tenant details, bed spaces, monthly bills and payments together in one clear view.</p>
          <div class="story-points"><span class="story-pill">Room & bed tracking</span><span class="story-pill">Flexible billing</span><span class="story-pill">Payment history</span></div>
        </div>
        <div class="login-foot">Angelina's Dormitory · Billing & Fee Management</div>
      </section>
      <section class="login-panel">
        <div class="login-card">
          <div class="eyebrow">Welcome back</div>
          <h2>Sign in to your account</h2>
          <p>Choose your account type, then sign in with an account saved in the dormitory database.</p>
          <form class="login-form" id="login-form">
            <div class="field"><label for="role">Account type</label><select id="role" name="role"><option>Admin</option><option>Staff</option><option>Tenant</option></select></div>
            <div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required placeholder="Enter your username"></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required placeholder="Enter your password"></div>
            <button class="btn btn-primary" type="submit">Sign in <span aria-hidden="true">→</span></button>
          </form>
          <div class="demo-box"><strong>Need an account?</strong><p>You can submit a Staff or Tenant registration request. An Admin must approve it before you can sign in.</p></div>
          <button class="panel-link" type="button" data-action="show-registration">Register as Staff or Tenant →</button>
        </div>
      </section>
    </main>`;
}

function registrationScreen() {
  document.getElementById("app").innerHTML = `
    <main class="login-page">
      <section class="login-story">
        <div class="sidebar-brand"><div class="brand-mark">A</div><div><div class="brand-name">Angelina's Dormitory</div><div class="brand-subtitle">Billing & fee management</div></div></div>
        <div class="story-copy">
          <div class="eyebrow">Account registration</div>
          <h1>Request system access.</h1>
          <p>Register as Staff or Tenant. Your account stays pending until an Admin reviews the request.</p>
          <div class="story-points"><span class="story-pill">Admin approval required</span><span class="story-pill">Tenant room assignment required</span></div>
        </div>
        <div class="login-foot">Angelina's Dormitory · Account request</div>
      </section>
      <section class="login-panel">
        <div class="login-card">
          <div class="eyebrow">New account</div>
          <h2>Register</h2>
          <p>After approval, use the username and password you enter here to sign in.</p>
          <form class="login-form" id="registration-form">
            <div class="field"><label for="registration-role">Account type</label><select id="registration-role" name="role" required><option value="">Choose account type</option><option value="Staff">Staff</option><option value="Tenant">Tenant</option></select></div>
            <div class="field"><label for="registration-name">Full name</label><input id="registration-name" name="fullName" required maxlength="120" autocomplete="name"></div>
            <div class="field"><label for="registration-username">Username</label><input id="registration-username" name="username" required minlength="3" maxlength="80" autocomplete="username"></div>
            <div class="field"><label for="registration-phone">Contact number (optional)</label><input id="registration-phone" name="phone" maxlength="40" autocomplete="tel"></div>
            <div class="field"><label for="registration-email">Email address (required for Tenant)</label><input id="registration-email" name="email" type="email" maxlength="190" autocomplete="email"></div>
            <div id="tenant-registration-fields" hidden><div class="field"><label for="registration-move-in">Requested move-in date</label><input id="registration-move-in" name="moveIn" type="date"></div></div>
            <div class="field"><label for="registration-password">Password</label><input id="registration-password" name="password" type="password" required minlength="8" maxlength="100" autocomplete="new-password"></div>
            <div class="field"><label for="registration-confirm-password">Confirm password</label><input id="registration-confirm-password" name="confirmPassword" type="password" required minlength="8" maxlength="100" autocomplete="new-password"></div>
            <button class="btn btn-primary" type="submit">Send registration request <span aria-hidden="true">→</span></button>
          </form>
          <div class="demo-warning">Staff requests need Admin approval. Tenant requests need Admin approval and an available room and bed assignment. Never share your password.</div>
          <button class="panel-link" type="button" data-action="show-login">← Back to sign in</button>
        </div>
      </section>
    </main>`;

  const form = document.getElementById("registration-form");
  const tenantFields = document.getElementById("tenant-registration-fields");
  const moveIn = form.elements.moveIn;
  const email = form.elements.email;
  const updateTenantFields = () => {
    const isTenant = form.elements.role.value === "Tenant";
    tenantFields.hidden = !isTenant;
    moveIn.required = isTenant;
    email.required = isTenant;
  };
  form.elements.role.addEventListener("change", updateTenantFields);
  updateTenantFields();
}
