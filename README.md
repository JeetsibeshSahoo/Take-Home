# Swarn Sathi — Gold Loan Branch Console

A secure, multi-role branch console for gold loan origination, appraisals, maker-checker sanctioning, daily interest accrual, repayment allocation, and loan closure.

---

## 1. Prerequisites
* **Docker & Docker Compose** (Recommended for clean machine evaluation)
* *Alternatively (Local setup):* **Node.js 18+** & **PostgreSQL 16+**

---

## 2. How to Run (Single Command)

### Option A: Docker Compose (Clean Machine - Recommended)
From the repository root, run:
```bash
docker compose up --build
```
* **PostgreSQL (Port 5432):** Boots, runs migrations, and loads seed data automatically.
* **Backend API (Port 5000):** Starts Express REST API at `http://localhost:5000`.
* **Frontend Console (Port 5173):** Access the web app at `http://localhost:5173`.

### Option B: Local Development
1. Start local PostgreSQL and create database `swarn_sathi`.
2. Configure `.env` in `backend/` with your database credentials.
3. In `backend/`:
   ```bash
   npm install
   npm run start:migrate
   ```
4. In `frontend/`:
   ```bash
   npm install
   npm run dev
   ```

---

## 3. How to Run Automated Tests

Execute all domain business logic, financial math, authorization, and security tests with a single command:
```bash
cd backend
npm test
```
*Tests cover: Gold appraisal purity, LTV slabs, 365-day simple interest in IST, interest-first repayment allocation, overpayment rejection, magic code attempt expiration, and RBAC guards.*

---

## 4. Seeded Logins & Magic Codes

Users sign in passwordlessly using a 6-digit magic code. 

### Seeded Role Accounts:
| Role | Email | Privileges |
| :--- | :--- | :--- |
| **Branch Staff** | `staff@swarnsathi.com` | Onboard customers, value gold, sanction loans, record repayments, close loans |
| **Branch Staff 2** | `staff2@swarnsathi.com` | Additional staff account for multi-clerk workflows |
| **Branch Manager** | `manager@swarnsathi.com` | View branch operations, approve loans > ₹3,00,000 (Maker-Checker enforced) |
| **Admin** | `admin@swarnsathi.com` | Set daily 24K gold rates, monitor LTV breaches, supervise system |

### Where Login Codes Appear in Development:
Per the assignment brief, no external email service is called. When you click **"Send Magic Code"**, the 6-digit code is **printed directly to the backend terminal console logs**:
```text
======================================================
🔐 SWARN SATHI LOGIN CODE FOR: staff@swarnsathi.com
👉 CODE: 481920
⏱️ Expires in 10 minutes
======================================================
```
*(In Docker: view via `docker compose logs -f backend`)*

---

## 5. Map of the Codebase

```text
Take-Home/
├── docker-compose.yml              # Single-command orchestrator (Postgres, API, UI)
├── .env.example                    # Environment secrets template
├── README.md                       # Prerequisites, run instructions & code map
├── DECISIONS.md                    # Architecture design, money rules & assumptions
├── AI_USAGE.md                     # Disclosure of AI tools, prompts & hand-rewrites
├── backend/
│   ├── src/
│   │   ├── server.js / app.js      # Server entrypoint, Helmet, CORS, centralized errors
│   │   ├── db/
│   │   │   ├── index.js            # Connection pool (pg) & transaction client
│   │   │   ├── migrate.js          # Pure SQL migration runner
│   │   │   ├── seed.js             # Seed data (Users, starting gold rate ₹7,250/g)
│   │   │   └── migrations/         # 001_initial_schema.sql (Constraints, indexes, paise)
│   │   ├── services/
│   │   │   ├── goldAppraisalService.js  # Purity factor (Karat/24), net weight, item math
│   │   │   ├── loanEngineService.js     # LTV slabs (80/75/70%), fee floor (₹500), maker-checker
│   │   │   ├── interestEngineService.js # 365-day IST daily accrual, interest-first allocation
│   │   │   └── auditService.js          # Append-only immutable audit trail logger
│   │   ├── controllers/            # Auth, Customers, Appraisals, Loans, Dashboard, Audit
│   │   ├── middleware/             # Bearer JWT auth, RBAC guards, sliding-window rate limit
│   │   └── routes/                 # Express API routes (/api/*)
│   └── tests/                      # Automated Jest test suites
└── frontend/
    └── src/
        ├── store/                  # Redux Toolkit store & authSlice
        ├── services/api.js         # Unified Fetch client with Bearer auth
        ├── components/Navbar.jsx   # Role badge, live 24K gold ticker, approvals badge
        └── pages/                  # Login, Customers, Appraisal, NewLoan, Loans, LoanDetail, Dashboard
```