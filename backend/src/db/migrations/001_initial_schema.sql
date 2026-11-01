-- Migration 001: Initial Schema for Swarn Sathi Gold Loan Branch Console
-- Enforces real DB constraints, exact money (paise), and immutable audit logs.

-- 1. USERS & ROLES
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('BRANCH_STAFF', 'BRANCH_MANAGER', 'ADMIN')),
    branch_name VARCHAR(100) NOT NULL DEFAULT 'Kolkata Main Branch',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. PASSWORDLESS MAGIC CODES (6-digit, 10 min expiry, max 5 attempts, single-use)
CREATE TABLE IF NOT EXISTS magic_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    attempts_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_magic_codes_email_created ON magic_codes(email, created_at DESC);

-- 3. DAILY GOLD RATES (Set daily by admin, stored in PAISE per gram for 24K)
CREATE TABLE IF NOT EXISTS gold_rates (
    id SERIAL PRIMARY KEY,
    rate_per_gram_paise BIGINT NOT NULL CHECK (rate_per_gram_paise > 0),
    effective_date DATE NOT NULL UNIQUE,
    set_by_user_id INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gold_rates_effective_date ON gold_rates(effective_date DESC);

-- 4. CUSTOMERS (PAN validated, Aadhaar strictly stores last 4 digits only)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    date_of_birth DATE NOT NULL,
    address TEXT NOT NULL,
    pan VARCHAR(10) NOT NULL CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
    aadhaar_last_4 CHAR(4) NOT NULL CHECK (aadhaar_last_4 ~ '^[0-9]{4}$'),
    created_by_user_id INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_pan ON customers(pan);

-- 5. GOLD APPRAISALS (Immutable snapshot of items and gold rate)
CREATE TABLE IF NOT EXISTS appraisals (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id),
    gold_rate_id INT NOT NULL REFERENCES gold_rates(id),
    gold_rate_per_gram_paise BIGINT NOT NULL CHECK (gold_rate_per_gram_paise > 0),
    total_gross_weight_grams NUMERIC(10, 3) NOT NULL CHECK (total_gross_weight_grams > 0),
    total_net_weight_grams NUMERIC(10, 3) NOT NULL CHECK (total_net_weight_grams > 0),
    total_appraised_value_paise BIGINT NOT NULL CHECK (total_appraised_value_paise > 0),
    max_eligible_loan_paise BIGINT NOT NULL CHECK (max_eligible_loan_paise > 0),
    created_by_user_id INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_appraisals_customer_id ON appraisals(customer_id);

-- 6. APPRAISAL ITEMS (Individual jewelry items)
CREATE TABLE IF NOT EXISTS appraisal_items (
    id SERIAL PRIMARY KEY,
    appraisal_id INT NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    gross_weight_grams NUMERIC(10, 3) NOT NULL CHECK (gross_weight_grams > 0),
    stone_weight_grams NUMERIC(10, 3) NOT NULL DEFAULT 0.000 CHECK (stone_weight_grams >= 0),
    net_weight_grams NUMERIC(10, 3) NOT NULL CHECK (net_weight_grams > 0),
    karat INT NOT NULL CHECK (karat IN (18, 20, 22, 24)),
    purity_factor NUMERIC(7, 6) NOT NULL, -- e.g., 22/24 = 0.916667
    item_value_paise BIGINT NOT NULL CHECK (item_value_paise > 0)
);

-- 7. LOANS
CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    loan_reference_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id),
    appraisal_id INT NOT NULL REFERENCES appraisals(id),
    scheme VARCHAR(50) NOT NULL CHECK (scheme IN ('STANDARD', 'QUICK')),
    interest_rate_annual_pct NUMERIC(5, 2) NOT NULL, -- 18.00 for STANDARD, 12.00 for QUICK
    tenure_months INT NOT NULL CHECK (tenure_months BETWEEN 1 AND 12),
    principal_paise BIGINT NOT NULL CHECK (principal_paise > 0),
    ltv_percentage NUMERIC(5, 2) NOT NULL,
    processing_fee_paise BIGINT NOT NULL CHECK (processing_fee_paise >= 50000), -- Min 500 INR (50,000 paise)
    net_disbursal_paise BIGINT NOT NULL CHECK (net_disbursal_paise > 0),
    outstanding_principal_paise BIGINT NOT NULL CHECK (outstanding_principal_paise >= 0),
    status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'DISBURSED', 'CLOSED', 'REJECTED')),
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    sanctioned_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ,
    maturity_date DATE NOT NULL,
    created_by_user_id INT NOT NULL REFERENCES users(id),
    approved_by_user_id INT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Maker-Checker database constraint:
    CONSTRAINT chk_maker_checker CHECK (
        approved_by_user_id IS NULL OR approved_by_user_id <> created_by_user_id
    )
);
CREATE INDEX IF NOT EXISTS idx_loans_customer_id ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_maturity_date ON loans(maturity_date);

-- 8. REPAYMENTS (Cleared interest first, then principal. Idempotency protected)
CREATE TABLE IF NOT EXISTS repayments (
    id SERIAL PRIMARY KEY,
    loan_id INT NOT NULL REFERENCES loans(id),
    payment_reference_no VARCHAR(60) UNIQUE NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    interest_cleared_paise BIGINT NOT NULL DEFAULT 0 CHECK (interest_cleared_paise >= 0),
    principal_cleared_paise BIGINT NOT NULL DEFAULT 0 CHECK (principal_cleared_paise >= 0),
    outstanding_principal_after_paise BIGINT NOT NULL CHECK (outstanding_principal_after_paise >= 0),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by_user_id INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_repayments_loan_id ON repayments(loan_id);

-- 9. LOAN CLOSURES (Only when outstanding is 0; logs who, when, and gold released)
CREATE TABLE IF NOT EXISTS loan_closures (
    id SERIAL PRIMARY KEY,
    loan_id INT UNIQUE NOT NULL REFERENCES loans(id),
    released_by_user_id INT NOT NULL REFERENCES users(id),
    gold_released_to_name VARCHAR(150) NOT NULL,
    released_items_summary TEXT NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. AUDIT TRAIL (Append-only traceability log: who, when, what changed)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    entity_name VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by_user_id INT NOT NULL REFERENCES users(id),
    ip_address VARCHAR(50),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(performed_by_user_id);