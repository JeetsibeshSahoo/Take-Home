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
  const goldRatePaise = 700000; 

  test('calculates net weight accurately (gross - stone)', () => {
    const net = calculateNetWeight(10.5, 1.2);
    expect(net).toBe(9.3);
  });

  test('rejects stone weight greater than or equal to gross weight', () => {
    expect(() => calculateNetWeight(5.0, 5.0)).toThrow();
    expect(() => calculateNetWeight(4.0, 6.0)).toThrow();
  });

  test('computes item value for 22K gold accurately', () => {
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
    expect(getLtvSlab(15000000).maxLtvPct).toBe(80.0); 
    expect(getLtvSlab(20000000).maxLtvPct).toBe(80.0); 
    expect(getLtvSlab(35000000).maxLtvPct).toBe(75.0); 
    expect(getLtvSlab(50000000).maxLtvPct).toBe(75.0); 
    expect(getLtvSlab(60000000).maxLtvPct).toBe(70.0); 
  });

  test('calculates processing fee with ₹500 floor', () => {
    expect(calculateProcessingFee(3000000)).toBe(50000);
    expect(calculateProcessingFee(10000000)).toBe(100000);
  });

  test('rejects loan exceeding LTV cap for its slab', () => {
    const appraisedPaise = 10000000; 
    expect(() =>
      validateLoanSanction({
        principalPaise: 8500000, 
        appraisedValuePaise: appraisedPaise,
        scheme: 'STANDARD',
        tenureMonths: 6,
      })
    ).toThrow(/exceeds the maximum allowed LTV/);
  });

  test('enforces Maker-Checker constraint for approvals', () => {
    const loan = { created_by_user_id: 10, status: 'PENDING_APPROVAL' };
    expect(() => validateManagerApproval(loan, 10, 'BRANCH_MANAGER')).toThrow(/Maker-Checker violation/);
    expect(() => validateManagerApproval(loan, 20, 'BRANCH_STAFF')).toThrow(/Only a Branch Manager/);
    expect(validateManagerApproval(loan, 20, 'BRANCH_MANAGER')).toBe(true);
  });
});

describe('3. Interest Accrual & Repayment Allocation Tests', () => {
  test('calculates daily simple interest on a 365-day basis', () => {
    const principalPaise = 10000000;
    const startDate = '2026-01-01';
    const endDate = '2026-01-31'; 

    const interest = calculateAccruedInterest(principalPaise, 18.0, startDate, endDate);
    expect(interest).toBe(147945);
  });

  test('allocates payment to interest first, then principal', () => {
    const allocation = allocateRepayment({
      paymentAmountPaise: 500000, 
      outstandingPrincipalPaise: 10000000, 
      accruedInterestPaise: 200000,
    });

    expect(allocation.interestClearedPaise).toBe(200000); 
    expect(allocation.principalClearedPaise).toBe(300000); 
    expect(allocation.remainingPrincipalPaise).toBe(9700000); 
    expect(allocation.isFullyPaid).toBe(false);
  });

  test('strictly rejects overpayment', () => {
    expect(() =>
      allocateRepayment({
        paymentAmountPaise: 15000000, 
        outstandingPrincipalPaise: 10000000, 
        accruedInterestPaise: 100000, 
      })
    ).toThrow(/Overpayment rejected/);
  });
});