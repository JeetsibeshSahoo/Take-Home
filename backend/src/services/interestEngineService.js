/**
 * Interest and Repayment Allocation Engine
 * 
 * Rules enforced:
 * - Simple interest accrued daily on outstanding principal.
 * - 365-day year.
 * - Dates in IST (Indian Standard Time, UTC+5:30).
 * - Repayment allocation: clears accrued interest FIRST, then principal.
 * - Overpayment is strictly rejected.
 * - Overdue: today > maturity_date and outstanding > 0.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Converts a Date or ISO string into an IST calendar date string (YYYY-MM-DD).
 */
export function getISTDateString(dateInput = new Date()) {
  const date = new Date(dateInput);
  // IST offset is +5:30 (+330 minutes)
  const istOffsetMs = 330 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  return istDate.toISOString().split('T')[0];
}

/**
 * Calculates calendar days elapsed between two dates in IST.
 */
export function getDaysElapsedIST(startDateInput, endDateInput = new Date()) {
  const startStr = getISTDateString(startDateInput);
  const endStr = getISTDateString(endDateInput);

  const startUtc = Date.UTC(
    Number(startStr.slice(0, 4)),
    Number(startStr.slice(5, 7)) - 1,
    Number(startStr.slice(8, 10))
  );
  const endUtc = Date.UTC(
    Number(endStr.slice(0, 4)),
    Number(endStr.slice(5, 7)) - 1,
    Number(endStr.slice(8, 10))
  );

  const diffDays = Math.floor((endUtc - startUtc) / MS_PER_DAY);
  return Math.max(0, diffDays);
}

/**
 * Calculates accrued simple interest in paise.
 * Formula: (Principal * Rate * Days) / (365 * 100)
 * Uses standard Half-Up integer rounding.
 */
export function calculateAccruedInterest(
  outstandingPrincipalPaise,
  annualInterestRatePct,
  startDate,
  asOfDate = new Date()
) {
  const principal = Number(outstandingPrincipalPaise);
  if (principal <= 0) return 0;

  const days = getDaysElapsedIST(startDate, asOfDate);
  const rate = Number(annualInterestRatePct);

  // Interest = (P * R * T) / (365 * 100)
  const interestPaise = Math.round((principal * rate * days) / 36500);
  return interestPaise;
}

/**
 * Computes full due status (principal, interest, total due, and overdue flag).
 */
export function calculateDueStatus(loan, asOfDate = new Date()) {
  const principal = Number(loan.outstanding_principal_paise);
  
  // If loan has no outstanding principal, due is 0
  if (principal <= 0) {
    return {
      outstandingPrincipalPaise: 0,
      accruedInterestPaise: 0,
      totalDuePaise: 0,
      daysElapsed: 0,
      isOverdue: false,
    };
  }

  // Calculate interest from the last payment or sanction date
  const interestStartDate = loan.last_payment_date || loan.disbursed_at || loan.sanctioned_at;
  const daysElapsed = getDaysElapsedIST(interestStartDate, asOfDate);
  const accruedInterestPaise = calculateAccruedInterest(
    principal,
    loan.interest_rate_annual_pct,
    interestStartDate,
    asOfDate
  );

  const totalDuePaise = principal + accruedInterestPaise;

  // Overdue check: today > maturity_date in IST
  const todayIST = getISTDateString(asOfDate);
  const maturityIST = getISTDateString(loan.maturity_date);
  const isOverdue = todayIST > maturityIST && totalDuePaise > 0;

  return {
    outstandingPrincipalPaise: principal,
    accruedInterestPaise,
    totalDuePaise,
    daysElapsed,
    isOverdue,
  };
}

/**
 * Allocates a repayment amount according to the rule:
 * 1. Clears accrued interest first.
 * 2. Remainder clears outstanding principal.
 * 3. Overpayment is strictly rejected!
 */
export function allocateRepayment({
  paymentAmountPaise,
  outstandingPrincipalPaise,
  accruedInterestPaise,
}) {
  const payment = Number(paymentAmountPaise);
  const principal = Number(outstandingPrincipalPaise);
  const interest = Number(accruedInterestPaise);
  const totalDue = principal + interest;

  if (isNaN(payment) || payment <= 0) {
    throw new Error('Repayment amount must be greater than zero.');
  }

  // Rule: Overpayment is rejected
  if (payment > totalDue) {
    throw new Error(
      `Overpayment rejected! Total due is ₹${(totalDue / 100).toFixed(2)}, but ₹${(payment / 100).toFixed(2)} was offered.`
    );
  }

  let interestClearedPaise = 0;
  let principalClearedPaise = 0;

  if (payment <= interest) {
    // Payment only covers partial or full interest
    interestClearedPaise = payment;
    principalClearedPaise = 0;
  } else {
    // Payment clears 100% of accrued interest and reduces principal
    interestClearedPaise = interest;
    principalClearedPaise = payment - interest;
  }

  const remainingPrincipalPaise = principal - principalClearedPaise;

  return {
    paymentAmountPaise: payment,
    interestClearedPaise,
    principalClearedPaise,
    remainingPrincipalPaise,
    isFullyPaid: remainingPrincipalPaise === 0,
  };
}