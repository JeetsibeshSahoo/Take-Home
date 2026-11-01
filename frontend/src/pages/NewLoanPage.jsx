import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { 
  FilePlus2, 
  ShieldAlert, 
  CheckCircle, 
  HelpCircle, 
  Coins, 
  ArrowRight,
  Clock,
  Percent,
  AlertTriangle
} from 'lucide-react';

export default function NewLoanPage({ preselectedAppraisal, onLoanCreated }) {
  const [appraisalId, setAppraisalId] = useState(preselectedAppraisal?.id || '');
  const [appraisal, setAppraisal] = useState(preselectedAppraisal || null);
  const [scheme, setScheme] = useState('STANDARD');
  const [tenureMonths, setTenureMonths] = useState(6);
  const [principalInr, setPrincipalInr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdLoan, setCreatedLoan] = useState(null);

  useEffect(() => {
    async function loadAppraisalDetails() {
      if (appraisalId && !appraisal) {
        try {
          const res = await api.getAppraisalById(appraisalId);
          setAppraisal(res.appraisal);
        } catch (err) {
          setError('Failed to load appraisal details.');
        }
      }
    }
    loadAppraisalDetails();
  }, [appraisalId]);

  // Adjust tenure limits based on scheme
  const handleSchemeChange = (selectedScheme) => {
    setScheme(selectedScheme);
    if (selectedScheme === 'QUICK' && tenureMonths > 3) {
      setTenureMonths(3);
    } else if (selectedScheme === 'STANDARD' && tenureMonths < 3) {
      setTenureMonths(6);
    }
  };

  // Real-time calculation based on PDF business rules
  const calculateLoanPreview = () => {
    const principal = parseFloat(principalInr) || 0;
    const appraisedVal = appraisal ? (Number(appraisal.total_appraised_value_paise) / 100) : 0;

    // LTV Slab rule
    let maxLtvPct = 80;
    let slabName = 'Up to ₹2 Lakh (80% Max)';
    if (principal > 500000) {
      maxLtvPct = 70;
      slabName = 'Above ₹5 Lakh (70% Max)';
    } else if (principal > 200000) {
      maxLtvPct = 75;
      slabName = '₹2 Lakh to ₹5 Lakh (75% Max)';
    }

    const maxAllowedPrincipal = Math.floor((appraisedVal * maxLtvPct) / 100);
    const actualLtvPct = appraisedVal > 0 ? (principal / appraisedVal) * 100 : 0;
    const isLtvBreached = principal > maxAllowedPrincipal;

    // Processing Fee: 1% of principal, minimum ₹500 floor
    const onePct = Math.round(principal * 0.01);
    const processingFee = principal > 0 ? Math.max(onePct, 500) : 0;
    const netDisbursal = Math.max(0, principal - processingFee);

    // Approval requirement: > ₹3,00,000 needs Branch Manager approval
    const requiresApproval = principal > 300000;

    return {
      principal,
      appraisedVal,
      maxLtvPct,
      slabName,
      maxAllowedPrincipal,
      actualLtvPct: actualLtvPct.toFixed(2),
      isLtvBreached,
      processingFee,
      netDisbursal,
      requiresApproval,
    };
  };

  const preview = calculateLoanPreview();

  const handleSanctionSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!appraisalId) {
      setError('A valid appraisal snapshot ID is required.');
      return;
    }

    if (preview.isLtvBreached) {
      setError(`Principal cannot exceed maximum allowed LTV of ${preview.maxLtvPct}% (₹${preview.maxAllowedPrincipal.toLocaleString('en-IN')}).`);
      return;
    }

    setLoading(true);
    try {
      const res = await api.sanctionLoan({
        appraisalId: Number(appraisalId),
        requestedPrincipalInr: parseFloat(principalInr),
        scheme,
        tenureMonths: parseInt(tenureMonths, 10),
      });

      setCreatedLoan(res.loan);
    } catch (err) {
      setError(err.message || 'Loan sanction failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FilePlus2 className="w-6 h-6 text-amber-500" />
          Sanction Gold Loan
        </h1>
        <p className="text-sm text-slate-500">Configure scheme, tenure, verify LTV slab caps, and disburse</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Success View */}
      {createdLoan ? (
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-700 mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Loan Sanctioned: {createdLoan.loan_reference_no}
              </h2>
              <p className="text-xs text-slate-500">
                Status: <span className="font-bold uppercase text-slate-700">{createdLoan.status}</span>
              </p>
            </div>
          </div>

          {createdLoan.status === 'PENDING_APPROVAL' ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs mb-6">
              <p className="font-bold text-sm mb-1">⏳ Awaiting Branch Manager Approval</p>
              <p>Because the principal exceeds ₹3,00,000, this loan is queued in the Approvals Tab. Under the four-eyes maker-checker principle, a manager who did not create this loan must approve it before disbursal.</p>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs mb-6">
              <p className="font-bold text-sm mb-1">✅ Loan Disbursed Immediately</p>
              <p>Net disbursed amount of ₹{(createdLoan.net_disbursal_paise / 100).toLocaleString('en-IN')} has been credited.</p>
            </div>
          )}

          <button
            onClick={() => onLoanCreated && onLoanCreated(createdLoan.id)}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Open Loan Details & Due Calculator
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Loan Sanction Form */
        <form onSubmit={handleSanctionSubmit} className="space-y-6">
          {/* Appraisal Details Box */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-semibold text-sm text-slate-900 mb-4">Pledged Gold Appraisal</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Appraisal ID</label>
                <input
                  type="number"
                  required
                  placeholder="Enter Appraisal ID #"
                  value={appraisalId}
                  onChange={(e) => setAppraisalId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:bg-white outline-none"
                />
              </div>

              {appraisal && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Customer / Borrower</label>
                    <p className="text-sm font-semibold text-slate-900 py-2">{appraisal.customer_name || 'Customer Identified'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Total Appraised Value</label>
                    <p className="text-sm font-bold text-amber-600 py-2">
                      ₹{(Number(appraisal.total_appraised_value_paise) / 100).toLocaleString('en-IN')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Scheme Selection */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-semibold text-sm text-slate-900 mb-4">Choose Loan Scheme</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Standard Scheme */}
              <div
                onClick={() => handleSchemeChange('STANDARD')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  scheme === 'STANDARD'
                    ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-900">Standard Scheme</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">18% p.a.</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Simple interest, flexible tenure between 3 to 12 months</p>
                <div className="text-xs font-medium text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Tenure: 3 to 12 Months
                </div>
              </div>

              {/* Quick Scheme */}
              <div
                onClick={() => handleSchemeChange('QUICK')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  scheme === 'QUICK'
                    ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-900">Quick Scheme</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">12% p.a.</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Lower interest rate for short-term borrowing up to 3 months</p>
                <div className="text-xs font-medium text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Tenure: 1 to 3 Months
                </div>
              </div>
            </div>
          </div>

          {/* Principal & Tenure Inputs */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-semibold text-sm text-slate-900 mb-4">Principal & Tenure Configuration</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Requested Principal (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 150000"
                    value={principalInr}
                    onChange={(e) => setPrincipalInr(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Slab rule applies automatically based on requested amount</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tenure (Months): <span className="font-bold text-amber-600">{tenureMonths} Months</span>
                </label>
                <input
                  type="range"
                  min={scheme === 'STANDARD' ? 3 : 1}
                  max={scheme === 'STANDARD' ? 12 : 3}
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(e.target.value)}
                  className="w-full accent-amber-500 mt-2"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>{scheme === 'STANDARD' ? '3m' : '1m'}</span>
                  <span>{scheme === 'STANDARD' ? '12m' : '3m'}</span>
                </div>
              </div>
            </div>

            {/* Live Calculation Preview Card */}
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Applicable LTV Slab:</span>
                <span className="font-bold text-slate-800">{preview.slabName}</span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Maximum Allowed Principal:</span>
                <span className="font-bold text-slate-900">₹{preview.maxAllowedPrincipal.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Calculated LTV:</span>
                <span className={`font-bold ${preview.isLtvBreached ? 'text-rose-600' : 'text-slate-900'}`}>
                  {preview.actualLtvPct}% {preview.isLtvBreached && '(Breaches Slab Cap!)'}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-2 flex justify-between text-xs">
                <span className="text-slate-500">Processing Fee (1% with ₹500 floor):</span>
                <span className="font-semibold text-slate-800">₹{preview.processingFee.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 text-slate-900">
                <span>Net Disbursal Amount:</span>
                <span className="text-emerald-700">₹{preview.netDisbursal.toLocaleString('en-IN')}</span>
              </div>

              {preview.requiresApproval && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-100 text-amber-900 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Amount &gt; ₹3,00,000: Will require Branch Manager approval before disbursal.</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading || preview.isLtvBreached || preview.principal <= 0}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {loading ? 'Processing Sanction...' : 'Confirm Loan Sanction'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}