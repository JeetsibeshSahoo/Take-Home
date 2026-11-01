import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/authSlice.js';
import { api } from '../services/api.js';
import { 
  CheckSquare, 
  CheckCircle, 
  XCircle, 
  ShieldAlert, 
  User 
} from 'lucide-react';

export default function ApprovalsQueuePage({ onOpenLoan }) {
  const currentUser = useSelector(selectCurrentUser);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await api.getApprovalsQueue();
      setQueue(res.queue || []);
    } catch (err) {
      setError('Failed to fetch approvals queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleDecision = async (loanId, decision) => {
    setError('');
    setSuccess('');
    setActionLoading(loanId);

    try {
      const res = await api.approveLoan(loanId, decision);
      setSuccess(res.message);
      fetchQueue();
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-amber-500" />
          Manager Approvals Queue
        </h1>
        <p className="text-sm text-slate-500">
          Loans exceeding ₹3,00,000 requiring four-eyes Maker-Checker authorization
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>{success}</div>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading queue...</div>
        ) : queue.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No Loans Pending Approval</p>
            <p className="text-xs text-slate-400 mt-1">All sanctioned high-value loans have been processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Loan Reference</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Scheme & Tenure</th>
                  <th className="px-6 py-3.5">Principal Requested</th>
                  <th className="px-6 py-3.5">Net Disbursal</th>
                  <th className="px-6 py-3.5">Created By</th>
                  <th className="px-6 py-3.5 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((l) => {
                  const isCreator = Number(l.created_by_user_id) === Number(currentUser?.id);

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        {l.loan_reference_no}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900 block">{l.customer_name}</span>
                        <span className="text-xs text-slate-400 font-mono">{l.customer_phone}</span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="font-semibold text-slate-800">{l.scheme}</span>
                        <span className="text-slate-400 block">{l.tenure_months} Months @ {l.interest_rate_annual_pct}%</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        ₹{(Number(l.principal_paise) / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-700">
                        ₹{(Number(l.net_disbursal_paise) / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {l.creator_name}
                        </div>
                        {isCreator && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            You created this (Maker)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isCreator ? (
                          <span className="text-xs text-slate-400 italic">
                            Cannot self-approve
                          </span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              disabled={actionLoading === l.id}
                              onClick={() => handleDecision(l.id, 'APPROVE')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              disabled={actionLoading === l.id}
                              onClick={() => handleDecision(l.id, 'REJECT')}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}