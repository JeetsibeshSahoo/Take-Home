import { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { 
  Scale, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
} from 'lucide-react';

export default function AppraisalPage({ selectedCustomer, onAppraisalCreated }) {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(selectedCustomer?.id || '');
  const [todayRate, setTodayRate] = useState(null);
  const [loadingRate, setLoadingRate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdAppraisal, setCreatedAppraisal] = useState(null);

  // Jewelry items state
  const [items, setItems] = useState([
    { description: '22K Gold Bangle', grossWeightGrams: '', stoneWeightGrams: '0', karat: 22 },
  ]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [custRes, rateRes] = await Promise.all([
          api.getCustomers(1, ''),
          api.getTodayRate(),
        ]);
        setCustomers(custRes.customers || []);
        setTodayRate(rateRes.rate);
      } catch (err) {
        setError(err.message || 'Failed to load initial data.');
      } finally {
        setLoadingRate(false);
      }
    }
    loadInitialData();
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      { description: `Gold Ornament ${items.length + 1}`, grossWeightGrams: '', stoneWeightGrams: '0', karat: 22 },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Real-time live summary calculations
  const calculateLiveSummary = () => {
    if (!todayRate) return { totalGross: 0, totalNet: 0, totalValueInr: 0, maxLoanInr: 0 };

    let totalGross = 0;
    let totalNet = 0;
    let totalValueInr = 0;

    const rateInr = todayRate.ratePerGramInr;

    for (const item of items) {
      const gross = parseFloat(item.grossWeightGrams) || 0;
      const stone = parseFloat(item.stoneWeightGrams) || 0;
      const net = Math.max(0, gross - stone);
      const purity = Number(item.karat) / 24.0;
      const val = net * purity * rateInr;

      totalGross += gross;
      totalNet += net;
      totalValueInr += val;
    }

    return {
      totalGross: Math.round(totalGross * 1000) / 1000,
      totalNet: Math.round(totalNet * 1000) / 1000,
      totalValueInr: Math.round(totalValueInr),
      maxLoanInr: Math.round(totalValueInr * 0.80), // 80% maximum slab cap
    };
  };

  const summary = calculateLiveSummary();

  const handleSubmitAppraisal = async (e) => {
    e.preventDefault();
    setError('');

    if (!customerId) {
      setError('Please select a customer for this appraisal.');
      return;
    }

    // Validate weights
    for (let i = 0; i < items.length; i++) {
      const g = parseFloat(items[i].grossWeightGrams);
      const s = parseFloat(items[i].stoneWeightGrams) || 0;
      if (isNaN(g) || g <= 0) {
        setError(`Item #${i + 1} gross weight must be a positive number.`);
        return;
      }
      if (s >= g) {
        setError(`Item #${i + 1} stone weight cannot be greater than or equal to gross weight.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await api.createAppraisal({
        customerId: Number(customerId),
        items: items.map(item => ({
          description: item.description,
          grossWeightGrams: parseFloat(item.grossWeightGrams),
          stoneWeightGrams: parseFloat(item.stoneWeightGrams) || 0,
          karat: parseInt(item.karat, 10),
        })),
      });

      setCreatedAppraisal(res.appraisal);
    } catch (err) {
      setError(err.message || 'Failed to record appraisal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Scale className="w-6 h-6 text-amber-500" />
          Gold Appraisal Valuation
        </h1>
        <p className="text-sm text-slate-500">Record jewelry items, deduct impurities, and lock in an immutable snapshot</p>
      </div>

      {/* Gold Rate Banner */}
      {todayRate && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
              24K
            </div>
            <div>
              <p className="text-xs text-amber-800 uppercase font-semibold">Active Daily Rate</p>
              <p className="text-lg font-black text-amber-950">₹{todayRate.ratePerGramInr.toLocaleString('en-IN')} <span className="text-xs font-normal text-amber-800">per gram (24K Gold)</span></p>
            </div>
          </div>
          <div className="text-right text-xs text-amber-800">
            <p>Effective Date: <span className="font-semibold">{todayRate.effectiveDate}</span></p>
            <p className="text-[11px] text-amber-600 mt-0.5">Set by: {todayRate.setByName}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Success View if Appraisal Created */}
      {createdAppraisal ? (
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-700 mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Appraisal Snapshot Saved!</h2>
              <p className="text-xs text-slate-500">Immutable snapshot ID #{createdAppraisal.id} recorded with rate ₹{(createdAppraisal.gold_rate_per_gram_paise / 100).toLocaleString('en-IN')}/g</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 my-6">
            <div>
              <p className="text-xs text-emerald-800">Net Weight</p>
              <p className="text-lg font-bold text-slate-900">{createdAppraisal.total_net_weight_grams} g</p>
            </div>
            <div>
              <p className="text-xs text-emerald-800">Appraised Value</p>
              <p className="text-lg font-bold text-amber-600">₹{(createdAppraisal.total_appraised_value_paise / 100).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-emerald-800">Max Eligible Loan (80%)</p>
              <p className="text-lg font-bold text-emerald-700">₹{(createdAppraisal.max_eligible_loan_paise / 100).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-emerald-800">Total Items</p>
              <p className="text-lg font-bold text-slate-900">{createdAppraisal.items?.length || 1}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onAppraisalCreated && onAppraisalCreated(createdAppraisal)}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Sanction Loan Against This Gold
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setCreatedAppraisal(null); setItems([{ description: 'Item 1', grossWeightGrams: '', stoneWeightGrams: '0', karat: 22 }]); }}
              className="px-4 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm rounded-xl transition-colors cursor-pointer"
            >
              Create Another Appraisal
            </button>
          </div>
        </div>
      ) : (
        /* Appraisal Entry Form */
        <form onSubmit={handleSubmitAppraisal} className="space-y-6">
          {/* Customer Selection */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Select Borrower / Customer</label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.phone}) — PAN: {c.pan}
                </option>
              ))}
            </select>
          </div>

          {/* Jewelry Items Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-sm text-slate-800">Jewelry Items Appraisal Table</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-100/70 text-slate-700 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Gross Wt (g)</th>
                    <th className="px-4 py-3">Stone Wt (g)</th>
                    <th className="px-4 py-3">Net Wt (g)</th>
                    <th className="px-4 py-3">Karat</th>
                    <th className="px-4 py-3">Purity</th>
                    <th className="px-4 py-3">Est. Value</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const gross = parseFloat(item.grossWeightGrams) || 0;
                    const stone = parseFloat(item.stoneWeightGrams) || 0;
                    const net = Math.max(0, gross - stone);
                    const purity = Number(item.karat) / 24.0;
                    const valInr = net * purity * (todayRate?.ratePerGramInr || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            required
                            placeholder="e.g. 22K Gold Chain"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:bg-white outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 w-28">
                          <input
                            type="number"
                            step="0.001"
                            required
                            placeholder="0.000"
                            value={item.grossWeightGrams}
                            onChange={(e) => handleItemChange(idx, 'grossWeightGrams', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-900 focus:bg-white outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 w-28">
                          <input
                            type="number"
                            step="0.001"
                            placeholder="0.000"
                            value={item.stoneWeightGrams}
                            onChange={(e) => handleItemChange(idx, 'stoneWeightGrams', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-900 focus:bg-white outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800 text-xs">
                          {net.toFixed(3)}g
                        </td>
                        <td className="px-4 py-3 w-24">
                          <select
                            value={item.karat}
                            onChange={(e) => handleItemChange(idx, 'karat', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-900 focus:bg-white outline-none"
                          >
                            <option value={18}>18K</option>
                            <option value={20}>20K</option>
                            <option value={22}>22K</option>
                            <option value={24}>24K</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {(purity * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 font-semibold text-amber-700 text-xs">
                          ₹{Math.round(valInr).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Appraisal Live Totals Bar */}
            <div className="bg-amber-500/10 p-4 border-t border-amber-200/60 flex flex-wrap justify-between items-center gap-4">
              <div className="flex gap-6 text-xs text-slate-700">
                <div>
                  <span className="text-slate-500 block">Total Gross Wt:</span>
                  <span className="font-bold text-slate-900 text-sm">{summary.totalGross}g</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Net Wt:</span>
                  <span className="font-bold text-slate-900 text-sm">{summary.totalNet}g</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Appraised Value:</span>
                  <span className="font-bold text-amber-700 text-sm">₹{summary.totalValueInr.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Max Eligible Loan (80% Cap):</span>
                  <span className="font-bold text-emerald-700 text-sm">₹{summary.maxLoanInr.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || summary.totalValueInr <= 0}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {submitting ? 'Locking Snapshot...' : 'Save Immutable Appraisal'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}