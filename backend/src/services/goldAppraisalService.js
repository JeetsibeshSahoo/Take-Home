export const ACCEPTED_KARATS = [18, 20, 22, 24];


export function calculateNetWeight(grossWeightGrams, stoneWeightGrams = 0) {
  const gross = Number(grossWeightGrams);
  const stone = Number(stoneWeightGrams);

  if (isNaN(gross) || gross <= 0) {
    throw new Error('Gross weight must be a positive number.');
  }
  if (isNaN(stone) || stone < 0) {
    throw new Error('Stone weight cannot be negative.');
  }
  if (stone >= gross) {
    throw new Error('Stone weight cannot be greater than or equal to gross weight.');
  }

  // Round to 3 decimal places (milligrams)
  return Math.round((gross - stone) * 1000) / 1000;
}


export function calculateItemValue(netWeightGrams, karat, goldRatePerGramPaise) {
  if (!ACCEPTED_KARATS.includes(Number(karat))) {
    throw new Error(`Invalid karat: ${karat}. Accepted karats are 18, 20, 22, 24.`);
  }

  const purityFactor = Number(karat) / 24.0;
  // Net weight * purity factor * gold rate (paise)
  const itemValuePaise = Math.round(netWeightGrams * purityFactor * Number(goldRatePerGramPaise));

  return {
    purityFactor: Math.round(purityFactor * 1000000) / 1000000, // 6 decimal precision
    itemValuePaise,
  };
}

export function evaluateAppraisal(items, goldRatePerGramPaise) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item is required for gold appraisal.');
  }
  if (!goldRatePerGramPaise || Number(goldRatePerGramPaise) <= 0) {
    throw new Error('A valid positive gold rate is required.');
  }

  let totalGrossWeight = 0;
  let totalNetWeight = 0;
  let totalAppraisedValuePaise = 0;

  const evaluatedItems = items.map((item, index) => {
    const netWeight = calculateNetWeight(item.grossWeightGrams, item.stoneWeightGrams || 0);
    const { purityFactor, itemValuePaise } = calculateItemValue(
      netWeight,
      item.karat,
      goldRatePerGramPaise
    );

    totalGrossWeight += Number(item.grossWeightGrams);
    totalNetWeight += netWeight;
    totalAppraisedValuePaise += itemValuePaise;

    return {
      description: item.description || `Item ${index + 1}`,
      grossWeightGrams: Number(item.grossWeightGrams),
      stoneWeightGrams: Number(item.stoneWeightGrams || 0),
      netWeightGrams: netWeight,
      karat: Number(item.karat),
      purityFactor,
      itemValuePaise,
    };
  });

  return {
    totalGrossWeightGrams: Math.round(totalGrossWeight * 1000) / 1000,
    totalNetWeightGrams: Math.round(totalNetWeight * 1000) / 1000,
    totalAppraisedValuePaise,
    items: evaluatedItems,
  };
}