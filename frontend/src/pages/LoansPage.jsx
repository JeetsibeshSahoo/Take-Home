import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { 
  CreditCard, 
  Search, 
  Filter, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Calendar
} from 'lucide-react';

export default function LoansPage({ onSelectLoan }) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, totalCount: 0 });

  const fetchLoans = async (p = 1, status = '') => {
    setLoading(true);
    try {
      const res = await api.getLoans(p, status);
      setLoans(res.loans || []);
      setPagination(res.pagination || { totalPages: 1, totalCount: 0 });
    } catch (err) {
      console.error('Failed to load loans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans(page, statusFilter);
  }, [page, statusFilter]);

  const statusBadge = (status) => {
    switch (status) {
      case 'DISBURSED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active / Disbursed</span>;
      case 'PENDING_APPROVAL':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Pending Approval</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">Closed & Released</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Rejected</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-amber-500" />
            Loan Portfolio Directory
          </h1>
          <p className="text-sm text-slate-500">Track active disbursements, repayments, due calculations, and closures</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
          {['', 'DISBURSED', 'PENDING_APPROVAL', 'CLOSED'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === s ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {s === '' ? 'All Loans' : s === 'DISBURSED' ? 'Active' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading loans...</div>
        ) : loans.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No loans found</p>
            <p className="text-xs text-slate-400 mt-1">Sanction a loan from the New Loan tab to view it here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Loan Reference</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Scheme</th>
                  <th className="px-6 py-3.5">Principal</th>
                  <th className="px-6 py-3.5">Outstanding Balance</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Maturity Date</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      {l.loan_reference_no}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900 block">{l.customer_name}</span>
                      <span className="text-xs text-slate-400 font-mono">{l.customer_phone}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-800">
                      {l.scheme} ({l.tenure_months}m)
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      ₹{(Number(l.principal_paise) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 font-bold text-amber-700">
                      ₹{(Number(l.outstanding_principal_paise) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4">
                      {statusBadge(l.status)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                      {l.maturity_date}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onSelectLoan && onSelectLoan(l.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Manage & Repay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
            <span>Showing Page {page} of {pagination.totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border border-slate-200 bg-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border border-slate-200 bg-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}