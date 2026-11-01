# Architectural Decision Record & Design Trade-offs

This document details the engineering choices, financial models, trade-offs, and assumptions made while building the Swarn Sathi Gold Loan Branch Console.

---

## 1. Assumptions Where the Brief Was Silent

* **Initial Seeded Gold Rate:** Seeded with ₹7,250 per gram (725,000 paise/g) for 24K gold, reflecting realistic Indian market rates.
* **Appraisal Snapshot Invariance:** An appraisal is an immutable snapshot created against the active gold rate of that calendar day. Once saved, its appraised value and eligible LTV are locked; loans sanctioned against that appraisal inherit that valuation, regardless of future daily rate changes.
* **Auto-Disbursal Under Approval Threshold:** Loans requesting $\le \text{₹}3,00,000$ are transitioned directly from creation to `DISBURSED`, subtracting the processing fee immediately. Loans requesting $> \text{₹}3,00,000$ enter `PENDING_APPROVAL` and wait for a Branch Manager.
* **Aadhaar Storage Compliance:** To comply with data privacy and UIDAI regulations, the system accepts and validates strictly the last 4 digits (`^[0-9]{4}$`), discarding any full 12-digit number upfront.
* **Calendar Accrual Boundaries:** Interest accrual days are calculated using calendar day transitions in Indian Standard Time (`UTC+05:30`), guaranteeing that interest increments cleanly at midnight IST regardless of the hosting server's physical timezone.

---

## 2. Main Design Choices & Why

### Exact Money Handling (Zero Rounding Drift)
* **Representation:** All currency values are stored as integer **Paise** (`BIGINT` in PostgreSQL, integer in Node.js, where ₹1.00 = 100 paise).
* **Rationale:** IEEE 754 floating-point arithmetic introduces rounding drift (e.g., `0.1 + 0.2 === 0.30000000000000004`), which is unacceptable in banking and financial ledgers.
* **Rounding Rule:** For daily interest division, we employ **Standard Half-Up Rounding** to the nearest integer paise:
  $$\text{Interest (Paise)} = \text{round}\left(\frac{\text{Principal (Paise)} \times \text{Rate} \times \text{Days}}{365 \times 100}\right)$$

### Pure PostgreSQL Driver (`pg`) over Heavy ORMs
* **Rationale:** We opted for standard SQL migrations and the native `pg` connection pool rather than an ORM (like Prisma or Hibernate). This gives total transparency, zero hidden abstraction overhead, faster Docker builds, and direct control over ACID transactions.
* **Database-Level Maker-Checker Enforcement:** Beyond API middleware, the maker-checker rule is enforced in SQL schema:
  ```sql
  CONSTRAINT chk_maker_checker CHECK (
    approved_by_user_id IS NULL OR approved_by_user_id <> created_by_user_id
  );
  ```
  Even if application code fails, the database rejects any attempt by a loan creator to approve their own loan.

### Concurrency & Double-Click Protection
* **Pessimistic Locking (`SELECT ... FOR UPDATE`):** When recording repayments or approving loans, the loan row is locked within a SQL transaction. If two branch staff members simultaneously submit payments against the same loan, the second transaction waits until the first commits, preventing balance corruption.
* **Idempotency Keys:** Every repayment submission requires a unique `idempotency_key` (enforced as `UNIQUE` in the database). Retries or accidental double-clicks return the existing receipt without duplicate ledger entries.

### Append-Only Traceable Audit Trail
* Every entity creation, loan sanction, manager approval, repayment, and gold release writes to `audit_logs` inside the same database transaction. The system exposes zero `UPDATE` or `DELETE` endpoints for audit records, guaranteeing immutability.

---

## 3. What Was Deliberately Left Out (Scope Boundaries)

* **External SMS / SMTP Gateways:** Mocked by printing magic codes directly to the backend terminal console, as permitted by the brief.
* **Real Payment Gateway Integration:** Repayments are recorded as branch counter ledger transactions without simulated UPI/card webhooks.
* **Physical KYC Verification:** PAN verification is validated using strict regex format (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`), without making third-party NSDL/UIDAI API calls.
* **Multi-branch Data Isolation:** While users and customers have branch attributes, all branch data is accessible to current staff to facilitate simple single-branch evaluation.

---

## 4. Known Bugs & Operational Risks

* **In-Memory Rate Limiting:** Magic code rate limiting is currently stored in-memory using sliding-window timestamp maps. In a multi-instance horizontally scaled production deployment behind a load balancer, this must be migrated to a shared Redis cluster.
* **Large Dataset CSV Streaming:** The CSV export currently fetches rows in a single SQL query. While indexed, generating date-range exports across 200,000+ loans would benefit from Node.js readable streams (`pg-query-stream`) to avoid buffer memory spikes.

---

## 5. What We Would Build Next (With One More Week)

1. **Nightly Interest Accrual Job (Tier 3):** Implement a daily cron runner (using `node-cron` or `pg_cron`) that automatically posts daily interest snapshots and marks matured unpaid loans as `OVERDUE` at midnight IST, with idempotency guards to ensure it is safe to run multiple times.
2. **Payment Reversal Workflow (Tier 3):** Build a maker-checker reversal flow for wrongly posted cash entries that creates credit/debit adjustment ledger entries without altering or deleting historical payment records.
3. **Customer Self-Service View (Tier 3):** A read-only portal where borrowers log in via their phone number and 6-digit magic code to view their outstanding loan schedule and download payment receipts.
4. **Automated CI/CD Pipeline:** GitHub Actions workflow running tests (`npm test`), code linting, and Docker container vulnerability scanning on every pull request.