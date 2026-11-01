/**
 * Loan Rules Engine
 * 
 * Rules enforced:
 * 1. LTV Slabs (decided by requested principal):
 *    - Up to ₹2,00,000 (20,000,000 paise): 80% of appraised value
 *    - Above ₹2,00,000 to ₹5,00,000 (20,000,001 to 50,000,000 paise): 75%
 *    - Above ₹5,00,000 (> 50,000,000 paise): 70%
 * 2. Schemes:
 *    - Standard: 18% per year simple interest, tenure 3 to 12 months
 *    - Quick: 12% per year simple interest, tenure up to 3 months (1-3)
 * 3. Processing fee: 1% of principal, minimum ₹500 (50,000 paise), deducted from disbursal
 * 4. Approval: Loans > ₹3,00,000 (30,000,000 paise) require Branch Manager approval
 *    (Maker-Checker: Creator cannot be Approver)
 */

export const SCHEMES = {
  STANDARD: {
    name: 'STANDARD',
    annualInterestRatePct: 18.0,
    minTenureMonths: 3,
    maxTenureMonths: 12,
  },
  QUICK: {
    name: 'QUICK',
    annualInterestRatePct: 12.0,
    minTenureMonths: 1,
    maxTenureMonths: 3,
  },
};

export const APPROVAL_THRESHOLD_PAISE = 30000000; // ₹3,00,000 in paise
export const MIN_PROCESSING_FEE_PAISE = 50000;    // ₹500 in paise

/**
 * Returns the maximum allowed LTV percentage based on requested principal.
 */
export function getLtvSlab(principalPaise) {
  const principal = Number(principalPaise);
  if (principal <= 20000000) { // Up to ₹2,00,000
    return { slabMaxPrincipal: 20000000, maxLtvPct: 80.0 };
  } else if (principal <= 50000000) { // Up to ₹5,00,000
    return { slabMaxPrincipal: 50000000, maxLtvPct: 75.0 };
  } else { // Above ₹5,00,000
    return { slabMaxPrincipal: Infinity, maxLtvPct: 70.0 };
  }
}

/**
 * Calculates processing fee: 1% of principal, minimum ₹500.
 */
export function calculateProcessingFee(principalPaise) {
  const principal = Number(principalPaise);
  const onePercent = Math.round(principal * 0.01);
  return Math.max(onePercent, MIN_PROCESSING_FEE_PAISE);
}

/**
 * Validates a loan application against all business constraints.
 */
export function validateLoanSanction({
  principalPaise,
  appraisedValuePaise,
  scheme,
  tenureMonths,
}) {
  const principal = Number(principalPaise);
  const appraised = Number(appraisedValuePaise);
  const tenure = Number(tenureMonths);

  if (isNaN(principal) || principal <= 0) {
    throw new Error('Principal amount must be greater than zero.');
  }

  // 1. Validate Scheme and Tenure
  const schemeConfig = SCHEMES[scheme?.toUpperCase()];
  if (!schemeConfig) {
    throw new Error(`Invalid scheme: ${scheme}. Choose STANDARD or QUICK.`);
  }

  if (tenure < schemeConfig.minTenureMonths || tenure > schemeConfig.maxTenureMonths) {
    throw new Error(
      `Tenure for ${schemeConfig.name} scheme must be between ${schemeConfig.minTenureMonths} and ${schemeConfig.maxTenureMonths} months.`
    );
  }

  // 2. Validate LTV Slab
  const { maxLtvPct } = getLtvSlab(principal);
  const maxAllowedPrincipalPaise = Math.floor((appraised * maxLtvPct) / 100);

  if (principal > maxAllowedPrincipalPaise) {
    throw new Error(
      `Requested principal of ₹${(principal / 100).toLocaleString('en-IN')} exceeds the maximum allowed LTV of ${maxLtvPct}% (₹${(maxAllowedPrincipalPaise / 100).toLocaleString('en-IN')}) for this slab.`
    );
  }

  // 3. Compute fees and disbursal
  const actualLtvPct = Math.round((principal / appraised) * 10000) / 100;
  const processingFeePaise = calculateProcessingFee(principal);
  const netDisbursalPaise = principal - processingFeePaise;

  if (netDisbursalPaise <= 0) {
    throw new Error('Principal is too low to cover the processing fee.');
  }

  const requiresApproval = principal > APPROVAL_THRESHOLD_PAISE;

  return {
    valid: true,
    scheme: schemeConfig.name,
    annualInterestRatePct: schemeConfig.annualInterestRatePct,
    principalPaise: principal,
    ltvPercentage: actualLtvPct,
    processingFeePaise,
    netDisbursalPaise,
    requiresApproval,
  };
}

/**
 * Validates Manager Approval rules (Maker-Checker).
 */
export function validateManagerApproval(loan, approverUserId, approverRole) {
  if (approverRole !== 'BRANCH_MANAGER' && approverRole !== 'ADMIN') {
    throw new Error('Only a Branch Manager or Admin can approve loans.');
  }

  if (Number(loan.created_by_user_id) === Number(approverUserId)) {
    throw new Error('Maker-Checker violation: The creator of the loan cannot approve it.');
  }

  if (loan.status !== 'PENDING_APPROVAL') {
    throw new Error(`Loan cannot be approved because current status is ${loan.status}.`);
  }

  return true;
}