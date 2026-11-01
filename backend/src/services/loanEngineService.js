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

export const APPROVAL_THRESHOLD_PAISE = 30000000; 
export const MIN_PROCESSING_FEE_PAISE = 50000;   

export function getLtvSlab(principalPaise) {
  const principal = Number(principalPaise);
  if (principal <= 20000000) { 
    return { slabMaxPrincipal: 20000000, maxLtvPct: 80.0 };
  } else if (principal <= 50000000) { 
    return { slabMaxPrincipal: 50000000, maxLtvPct: 75.0 };
  } else { 
    return { slabMaxPrincipal: Infinity, maxLtvPct: 70.0 };
  }
}


export function calculateProcessingFee(principalPaise) {
  const principal = Number(principalPaise);
  const onePercent = Math.round(principal * 0.01);
  return Math.max(onePercent, MIN_PROCESSING_FEE_PAISE);
}


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