import { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { 
  ArrowLeft, 
  Printer,  
  X,  
  FileCheck, 
} from 'lucide-react';

export default function LoanDetailPage({ loanId, onBack }) {
  const [loanData, setLoanData] = useState(null);
  const [repayments, setRepayments] = useState([]);
  const [closure, setClosure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calcDate, setCalcDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueInfo, setDueInfo] = useState(null);
  const [calculatingDue, setCalculatingDue] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [repayError, setRepayError] = useState('');
  const [repayLoading, setRepayLoading] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [releasedTo, setReleasedTo] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);

  const fetchLoanDetails = async () => {
    setLoading(true);
    try {
      const res = await api.getLoanById(loanId);
      setLoanData(res.loan);
      setRepayments(res.repayments || []);
      setClosure(res.closure || null);
      setDueInfo(res.loan.liveDue);
    } catch (err) {
      setError(err.message || 'Failed to fetch loan details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanDetails();
  }, [loanId]);

  // Recalculate dues when user changes target date
  const handleDateChange = async (dateStr) => {
    setCalcDate(dateStr);
    setCalculatingDue(true);
    try {
      const res = await api.getDueCalculator(loanId, dateStr);
      setDueInfo(res.due);
    } catch (err) {
      console.error(err);
    } finally {
      setCalculatingDue(false);
    }
  };

  const openRepayModal = () => {
    setRepayError('');
    setRepayAmount('');
    setIdempotencyKey(`IDEMP-${loanId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
    setShowRepayModal(true);
  };

  const handleRecordRepayment = async (e) => {
    e.preventDefault();
    setRepayError('');
    setRepayLoading(true);

    try {
      await api.recordRepayment(loanId, {
        amountInr: parseFloat(repayAmount),
        idempotencyKey,
        paymentDate: new Date(calcDate).toISOString(),
      });
      setShowRepayModal(false);
      fetchLoanDetails();
    } catch (err) {
      setRepayError(err.message || 'Repayment failed.');
    } finally {
      setRepayLoading(false);
    }
  };

  const handleCloseLoan = async (e) => {
    e.preventDefault();
    setCloseLoading(true);
    try {
      await api.closeLoan(loanId, {
        releasedToName: releasedTo,
        releaseNotes,
      });
      setShowCloseModal(false);
      fetchLoanDetails();
    } catch (err) {
      alert(err.message || 'Closure failed.');
    } finally {
      setCloseLoading(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading loan console...</div>;
  }

  if (error || !loanData) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="p-4 bg-rose-50 text-rose-800 rounded-xl">{error || 'Loan not found'}</div>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg">Go Back</button>
      </div>
    );
  }

  const isEligibleForClosure = dueInfo?.totalDuePaise === 0 && loanData.status === 'DISBURSED';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Bar with Print Button */}
      <div className="flex justify-between items-center mb-6 no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Loan Portfolio
        </button>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print Statement / Receipt
        </button>
      </div>

      {/* Printable Loan Statement Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-6 card-print">
        <div className="flex flex-col md:flex-row justify-between md:items-center pb-6 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 font-mono">{loanData.loan_reference_no}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                loanData.status === 'CLOSED' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {loanData.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Customer: <strong className="text-slate-800">{loanData.customer_name}</strong> (Phone: {loanData.customer_phone} • PAN: {loanData.customer_pan})
            </p>
          </div>

          <div className="text-left md:text-right text-xs text-slate-500">
            <p>Sanctioned Date: <strong className="text-slate-700">{new Date(loanData.sanctioned_at).toLocaleDateString('en-IN')}</strong></p>
            <p>Maturity Date: <strong className="text-slate-700">{loanData.maturity_date}</strong></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Created by: {loanData.creator_name}</p>
          </div>
        </div>

        {/* Loan Financial Snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-b border-slate-100">
          <div>
            <span className="text-xs text-slate-400 block uppercase font-medium">Scheme & Interest</span>
            <span className="text-base font-bold text-slate-900">{loanData.scheme} @ {loanData.interest_rate_annual_pct}%</span>
            <span className="block text-xs text-slate-500">{loanData.tenure_months} Months Tenure</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block uppercase font-medium">Sanctioned Principal</span>
            <span className="text-base font-bold text-slate-900">₹{(Number(loanData.principal_paise) / 100).toLocaleString('en-IN')}</span>
            <span className="block text-xs text-slate-500">LTV: {loanData.ltv_percentage}%</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block uppercase font-medium">Processing Fee Deducted</span>
            <span className="text-base font-bold text-slate-700">₹{(Number(loanData.processing_fee_paise) / 100).toLocaleString('en-IN')}</span>
            <span className="block text-xs text-emerald-700">Disbursed: ₹{(Number(loanData.net_disbursal_paise) / 100).toLocaleString('en-IN')}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block uppercase font-medium">Pledged Gold Weight</span>
            <span className="text-base font-bold text-amber-600">{loanData.total_net_weight_grams}g Net</span>
            <span className="block text-xs text-slate-500">Appraised: ₹{(Number(loanData.total_appraised_value_paise) / 100).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Live Due Calculator Bar (no-print) */}
        <div className="mt-6 p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div>
            <span className="text-xs text-amber-900 font-bold uppercase tracking-wider block">
              Live IST Due Calculator
            </span>
            <div className="flex items-center gap-3 mt-1.5">
              <label className="text-xs text-slate-600 font-medium">Calculate As Of Date:</label>
              <input
                type="date"
                value={calcDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 font-mono outline-none"
              />
              {calculatingDue && <span className="text-xs text-slate-400 animate-pulse">Calculating...</span>}
            </div>
          </div>

          <div className="flex gap-6 text-xs text-slate-800">
            <div>
              <span className="text-slate-500 block">Days Accrued:</span>
              <span className="font-bold text-sm text-slate-900">{dueInfo?.daysElapsed || 0} Days</span>
            </div>
            <div>
              <span className="text-slate-500 block">Accrued Interest:</span>
              <span className="font-bold text-sm text-amber-800">₹{((dueInfo?.accruedInterestPaise || 0) / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Outstanding Principal:</span>
              <span className="font-bold text-sm text-slate-900">₹{((dueInfo?.outstandingPrincipalPaise || 0) / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Due:</span>
              <span className="font-black text-sm text-rose-700">₹{((dueInfo?.totalDuePaise || 0) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Repay & Close */}
        {loanData.status === 'DISBURSED' && (
          <div className="mt-6 flex justify-end gap-3 no-print">
            <button
              onClick={openRepayModal}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Record Repayment
            </button>

            <button
              disabled={!isEligibleForClosure}
              onClick={() => setShowCloseModal(true)}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer ${
                isEligibleForClosure
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title={!isEligibleForClosure ? 'Total balance must be ₹0.00 to close' : ''}
            >
              Close Loan & Release Gold
            </button>
          </div>
        )}

        {/* Closure Metadata Banner if Closed */}
        {closure && (
          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h4 className="text-xs font-bold uppercase text-slate-700 mb-1 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              Gold Release Record (Immutable Audit)
            </h4>
            <p className="text-xs text-slate-600">
              Gold released to: <strong className="text-slate-900">{closure.gold_released_to_name}</strong> on {new Date(closure.closed_at).toLocaleString('en-IN')}.
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Items Released: {closure.released_items_summary}
            </p>
          </div>
        )}
      </div>

      {/* Repayment History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden card-print">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-sm text-slate-900">Repayment Ledger & Allocation Audit</h3>
        </div>

        {repayments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No repayments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100/70 text-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Receipt No</th>
                  <th className="px-6 py-3">Payment Date</th>
                  <th className="px-6 py-3">Amount Paid</th>
                  <th className="px-6 py-3">Interest Cleared</th>
                  <th className="px-6 py-3">Principal Cleared</th>
                  <th className="px-6 py-3">Remaining Principal</th>
                  <th className="px-6 py-3">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {repayments.map((r) => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 font-mono font-semibold text-slate-900 text-xs">
                      {r.payment_reference_no}
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-slate-700">
                      {new Date(r.payment_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-3 font-bold text-slate-900">
                      ₹{(Number(r.amount_paise) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-3 text-amber-700 font-semibold text-xs">
                      ₹{(Number(r.interest_cleared_paise) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-3 text-emerald-700 font-semibold text-xs">
                      ₹{(Number(r.principal_cleared_paise) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-800 text-xs">
                      ₹{(Number(r.outstanding_principal_after_paise) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">
                      {r.recorded_by_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Repayment Modal */}
      {showRepayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Record Repayment</h3>
              <button onClick={() => setShowRepayModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {repayError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                {repayError}
              </div>
            )}

            <form onSubmit={handleRecordRepayment} className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl text-xs space-y-1 text-amber-950">
                <div className="flex justify-between">
                  <span>Accrued Interest Due:</span>
                  <span className="font-bold">₹{((dueInfo?.accruedInterestPaise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Outstanding Principal:</span>
                  <span className="font-bold">₹{((dueInfo?.outstandingPrincipalPaise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-amber-200/60 pt-1 text-rose-800">
                  <span>Total Due (Overpayment Rejected):</span>
                  <span>₹{((dueInfo?.totalDuePaise || 0) / 100).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Repayment Amount (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Enter amount..."
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:bg-white outline-none"
                />
              </div>

              <div className="text-[11px] text-slate-400 font-mono">
                Idempotency Key: {idempotencyKey}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRepayModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={repayLoading || !repayAmount}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs rounded-lg"
                >
                  {repayLoading ? 'Posting...' : 'Confirm Repayment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Closure Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-2">Close Loan & Release Gold</h3>
            <p className="text-xs text-slate-500 mb-4">
              Balance is ₹0.00. Confirm the borrower receiving the pledged gold jewelry items.
            </p>

            <form onSubmit={handleCloseLoan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recipient Full Name (as per ID)
                </label>
                <input
                  type="text"
                  required
                  defaultValue={loanData.customer_name}
                  onChange={(e) => setReleasedTo(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Release Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Physical gold packet inspected and returned..."
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closeLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg"
                >
                  {closeLoading ? 'Releasing...' : 'Formally Release Gold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}