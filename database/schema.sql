CREATE DATABASE IF NOT EXISTS angelinas_dormitory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE angelinas_dormitory;

CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  status ENUM('Active', 'Moved Out') NOT NULL DEFAULT 'Active',
  move_in_date DATE NOT NULL,
  move_out_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenants_status (status),
  INDEX idx_tenants_name (full_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_name VARCHAR(60) NOT NULL UNIQUE,
  status ENUM('Open', 'Closed') NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bed_spaces (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  bed_number SMALLINT UNSIGNED NOT NULL,
  status ENUM('Available', 'Occupied', 'Unavailable') NOT NULL DEFAULT 'Available',
  UNIQUE KEY uq_room_bed (room_id, bed_number),
  CONSTRAINT fk_beds_room FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tenant_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  bed_space_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_assignments_tenant (tenant_id, end_date),
  INDEX idx_assignments_bed (bed_space_id, end_date),
  CONSTRAINT fk_assignments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_assignments_bed FOREIGN KEY (bed_space_id) REFERENCES bed_spaces(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Admin', 'Staff', 'Tenant') NOT NULL,
  status ENUM('Active', 'Disabled') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_user_tenant_role CHECK (
    (role = 'Tenant' AND tenant_id IS NOT NULL) OR
    (role IN ('Admin', 'Staff') AND tenant_id IS NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS registration_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Staff', 'Tenant') NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  move_in_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_registration_role_created (role, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS billing (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  billing_period VARCHAR(80) NOT NULL,
  cutoff_date DATE NOT NULL,
  due_date DATE NOT NULL,
  rent DECIMAL(12,2) NOT NULL DEFAULT 0,
  electricity DECIMAL(12,2) NOT NULL DEFAULT 0,
  water DECIMAL(12,2) NOT NULL DEFAULT 0,
  previous_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_billing_tenant (tenant_id, created_at),
  INDEX idx_billing_due (due_date),
  CONSTRAINT fk_billing_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS billing_adjustments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  billing_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('Discount', 'Adjustment') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  reason VARCHAR(255) NOT NULL DEFAULT '',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_adjustments_bill (billing_id),
  CONSTRAINT fk_adjustments_billing FOREIGN KEY (billing_id) REFERENCES billing(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_adjustments_user FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  billing_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('GCash', 'Personal Payment') NOT NULL,
  payment_date DATE NOT NULL,
  reference VARCHAR(120) NULL,
  payer_name VARCHAR(120) NOT NULL,
  received_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_billing (billing_id),
  INDEX idx_payments_date (payment_date),
  CONSTRAINT fk_payments_billing FOREIGN KEY (billing_id) REFERENCES billing(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payments_receiver FOREIGN KEY (received_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS billing_qr_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  billing_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_billing_qr_bill (billing_id),
  CONSTRAINT fk_billing_qr_bill FOREIGN KEY (billing_id) REFERENCES billing(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_billing_qr_payment FOREIGN KEY (payment_id) REFERENCES payments(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tenant_billing_qr_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_billing_qr_tenant (tenant_id),
  CONSTRAINT fk_tenant_billing_qr_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS deposits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  received_date DATE NOT NULL,
  status ENUM('Held', 'Refunded', 'Retained', 'Partially Refunded') NOT NULL DEFAULT 'Held',
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_deposits_tenant (tenant_id),
  CONSTRAINT fk_deposits_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tenant_concerns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(80) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('New', 'In Review', 'Responded', 'Closed') NOT NULL DEFAULT 'New',
  owner_response TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_concerns_tenant (tenant_id, created_at),
  INDEX idx_concerns_status (status),
  CONSTRAINT fk_concerns_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS occupancy_scans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  observed_count SMALLINT UNSIGNED NOT NULL,
  capacity SMALLINT UNSIGNED NOT NULL,
  scan_date DATE NOT NULL,
  note VARCHAR(255) NULL,
  recorded_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_scans_room_date (room_id, scan_date),
  CONSTRAINT fk_scans_room FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_scans_user FOREIGN KEY (recorded_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  notification_type VARCHAR(80) NOT NULL,
  delivery_status ENUM('Queued', 'Sent', 'Failed', 'Not Configured') NOT NULL DEFAULT 'Not Configured',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_tenant (tenant_id, created_at),
  CONSTRAINT fk_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
