# Disclosure of AI Tool Usage

As required by the assignment ground rules, this document provides a complete, honest disclosure of how AI tools were utilized during the design, development, and debugging of the Swarn Sathi Branch Console.

---

## 1. Tools Used & Purpose

* **Antigravity AI (Gemini 3.8)**: Used as a full-stack pair programming assistant for architectural planning, pure SQL schema design, financial formulas, Jest automated unit tests, and React component structures.

---

## 2. Prompts That Worked Well

1. **Exact Money & Constraints Prompt:**
   > *"Design a pure PostgreSQL schema with real constraints: a maker-checker check constraint where `approved_by_user_id <> created_by_user_id`, PAN regex, 4-digit Aadhaar, and represent all money strictly as integer paise to eliminate floating-point drift."*
   * **Why it worked:** Generated a clean, migration-ready SQL schema with robust database-level integrity checks.

2. **IST Daily Interest Accrual Prompt:**
   > *"Implement daily simple interest calculation on outstanding principal in Indian Standard Time (UTC+05:30) for a 365-day year using half-up integer paise rounding, and an allocation function that clears accrued interest first before principal and strictly rejects overpayments."*
   * **Why it worked:** Produced deterministic financial math that passed all boundary unit tests.

3. **Concurrency Locking Prompt:**
   > *"Implement loan repayment and manager approval controllers using PostgreSQL transactions with `SELECT ... FOR UPDATE` row locks to prevent race conditions when two staff act on the same loan simultaneously."*
   * **Why it worked:** Ensured transactional integrity and race-condition safety.

---

## 3. Cases Where the AI Was Wrong or Incomplete & How We Caught Them

### Case 1: Missing SQL Table Alias in Customer Search Count Query
* **What went wrong:** In `backend/src/controllers/customerController.js`, the search query used `WHERE c.full_name ILIKE $1 OR c.pan ILIKE $1`. However, the AI wrote the count query as `SELECT COUNT(*) FROM customers` without the table alias `c`.
* **How we noticed:** During manual testing of the customer directory, entering a PAN number in the search bar failed silently under PostgreSQL and continued displaying all customers instead of filtering down to the matching record.
* **How we fixed it:** Diagnosed the SQL error in terminal logs, updated the query to `SELECT COUNT(*) FROM customers c`, and verified that search filtering works correctly across Name, Phone, and PAN.

### Case 2: Missing Authorization Header on Native Browser CSV Download
* **What went wrong:** The AI initially implemented CSV export using `window.open('/api/dashboard/export-csv')`. However, native browser navigation does not pass the `Authorization: Bearer <token>` stored in `localStorage`, resulting in a `401 Unauthorized` response.
* **How we noticed:** Clicking "Download CSV Export" opened a new tab displaying `{"error":"Unauthorized","message":"Access token required."}`.
* **How we fixed it:** Rewrote `handleExportCsv` in `DashboardPage.jsx` to use an authenticated `fetch()` with the Bearer header, convert the response into a binary `blob`, and trigger an in-memory anchor tag download (`loans-export-YYYY-MM-DD.csv`).

### Case 3: CSV CRLF Line Endings for Windows Excel
* **What went wrong:** The initial CSV builder used Unix `\n` line endings and called `.toISOString()` on database dates, which rendered blank or malformed in Microsoft Excel on Windows.
* **How we fixed it:** Rewrote the SQL query to format dates cleanly using `TO_CHAR(maturity_date, 'YYYY-MM-DD')` and formatted rows using standard Windows CRLF (`\r\n`) with UTF-8 encoding.

---

## 4. What Was Written or Rewritten by Hand & Why

* **State Management Architecture (Redux Toolkit):** The AI initially proposed React Context API. We decided to rewrite the global state management using **Redux Toolkit (`@reduxjs/toolkit` and `react-redux`)** with an `authSlice` to ensure predictable state transitions, clean selectors (`selectCurrentUser`, `selectIsManager`), and enterprise maintainability.
* **Database Driver Selection:** Chose pure PostgreSQL (`pg` connection pool) with explicit SQL migration files rather than an ORM, ensuring full control over database constraints and pessimistic row locks.