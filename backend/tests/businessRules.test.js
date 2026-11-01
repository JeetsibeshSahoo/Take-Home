import { describe, test, expect } from '@jest/globals';
import {
  calculateNetWeight,
  calculateItemValue,
  evaluateAppraisal,
} from '../src/services/goldAppraisalService.js';
import {
  getLtvSlab,
  calculateProcessingFee,
  validateLoanSanction,
  validateManagerApproval,
} from '../src/services/loanEngineService.js';
import {
  calculateAccruedInterest,
  allocateRepayment
} from '../src/services/interestEngineService.js';

describe('1. Gold Appraisal Engine Tests', () => {
  const goldRatePaise = 700000; // ₹7,000 / gram (24K)

  test('calculates net weight accurately (gross - stone)', () => {
    const net = calculateNetWeight(10.5, 1.2);
    expect(net).toBe(9.3);
  });

  test('rejects stone weight greater than or equal to gross weight', () => {
    expect(() => calculateNetWeight(5.0, 5.0)).toThrow();
    expect(() => calculateNetWeight(4.0, 6.0)).toThrow();
  });

  test('computes item value for 22K gold accurately', () => {
    // 10 grams of 22K gold at ₹7,000/g = 10 * (22/24) * 7000 = ₹64,166.67 => 6416667 paise
    const { purityFactor, itemValuePaise } = calculateItemValue(10, 22, goldRatePaise);
    expect(purityFactor).toBeCloseTo(0.916667, 4);
    expect(itemValuePaise).toBe(6416667);
  });

  test('evaluates a full appraisal with multiple items', () => {
    const items = [
      { description: 'Gold Ring', grossWeightGrams: 5.5, stoneWeightGrams: 0.5, karat: 22 }, // net 5g
      { description: 'Gold Chain', grossWeightGrams: 10.0, stoneWeightGrams: 0.0, karat: 18 }, // net 10g
    ];
    const result = evaluateAppraisal(items, goldRatePaise);
    expect(result.totalGrossWeightGrams).toBe(15.5);
    expect(result.totalNetWeightGrams).toBe(15.0);
    expect(result.totalAppraisedValuePaise).toBeGreaterThan(0);
  });
});

describe('2. Loan Engine & LTV Slab Tests', () => {
  test('determines correct LTV caps for loan slabs', () => {
    expect(getLtvSlab(15000000).maxLtvPct).toBe(80.0); // ₹1.5L -> 80%
    expect(getLtvSlab(20000000).maxLtvPct).toBe(80.0); // ₹2.0L -> 80%
    expect(getLtvSlab(35000000).maxLtvPct).toBe(75.0); // ₹3.5L -> 75%
    expect(getLtvSlab(50000000).maxLtvPct).toBe(75.0); // ₹5.0L -> 75%
    expect(getLtvSlab(60000000).maxLtvPct).toBe(70.0); // ₹6.0L -> 70%
  });

  test('calculates processing fee with ₹500 floor', () => {
    // 1% of ₹30,000 (3,000,000 paise) = ₹300, but minimum is ₹500 (50,000 paise)
    expect(calculateProcessingFee(3000000)).toBe(50000);
    // 1% of ₹1,00,000 (10,000,000 paise) = ₹1,000 (100,000 paise)
    expect(calculateProcessingFee(10000000)).toBe(100000);
  });

  test('rejects loan exceeding LTV cap for its slab', () => {
    const appraisedPaise = 10000000; // ₹1,00,000 appraisal (max 80% = ₹80,000)
    expect(() =>
      validateLoanSanction({
        principalPaise: 8500000, // ₹85,000 (85% LTV, violates 80%)
        appraisedValuePaise: appraisedPaise,
        scheme: 'STANDARD',
        tenureMonths: 6,
      })
    ).toThrow(/exceeds the maximum allowed LTV/);
  });

  test('enforces Maker-Checker constraint for approvals', () => {
    const loan = { created_by_user_id: 10, status: 'PENDING_APPROVAL' };
    // Creator cannot approve their own loan
    expect(() => validateManagerApproval(loan, 10, 'BRANCH_MANAGER')).toThrow(/Maker-Checker violation/);
    // Non-manager cannot approve
    expect(() => validateManagerApproval(loan, 20, 'BRANCH_STAFF')).toThrow(/Only a Branch Manager/);
    // Valid manager approval
    expect(validateManagerApproval(loan, 20, 'BRANCH_MANAGER')).toBe(true);
  });
});

describe('3. Interest Accrual & Repayment Allocation Tests', () => {
  test('calculates daily simple interest on a 365-day basis', () => {
    // ₹1,00,000 principal at 18% p.a. for 30 days
    // Interest = (100000 * 18 * 30) / 365 = ₹1,479.45 => 147945 paise
    const principalPaise = 10000000;
    const startDate = '2026-01-01';
    const endDate = '2026-01-31'; // exactly 30 days

    const interest = calculateAccruedInterest(principalPaise, 18.0, startDate, endDate);
    expect(interest).toBe(147945);
  });

  test('allocates payment to interest first, then principal', () => {
    const allocation = allocateRepayment({
      paymentAmountPaise: 500000, // ₹5,000 payment
      outstandingPrincipalPaise: 10000000, // ₹1,00,000 principal
      accruedInterestPaise: 200000, // ₹2,000 interest
    });

    expect(allocation.interestClearedPaise).toBe(200000); // clears all interest
    expect(allocation.principalClearedPaise).toBe(300000); // remaining ₹3,000 to principal
    expect(allocation.remainingPrincipalPaise).toBe(9700000); // ₹97,000 left
    expect(allocation.isFullyPaid).toBe(false);
  });

  test('strictly rejects overpayment', () => {
    expect(() =>
      allocateRepayment({
        paymentAmountPaise: 15000000, // ₹1,50,000
        outstandingPrincipalPaise: 10000000, // ₹1,00,000
        accruedInterestPaise: 100000, // ₹1,000
      })
    ).toThrow(/Overpayment rejected/);
  });
});