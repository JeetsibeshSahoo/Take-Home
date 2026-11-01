import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectIsAdmin } from '../store/authSlice.js';
import { api } from '../services/api.js';
import { 
  LayoutDashboard, 
  Coins,
  AlertOctagon, 
  FileSpreadsheet
} from 'lucide-react';

export default function DashboardPage() {
  const isAdmin = useSelector(selectIsAdmin);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rateHistory, setRateHistory] = useState([]);
  const [breaches, setBreaches] = useState([]);
  const [newRateInr, setNewRateInr] = useState('');
  const [rateSuccess, setRateSuccess] = useState('');
  const [rateError, setRateError] = useState('');
  const [updatingRate, setUpdatingRate] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const statsRes = await api.getDashboardStats();
      setStats(statsRes);

      const historyRes = await api.getRateHistory();
      setRateHistory(historyRes.history || []);
      setBreaches(historyRes.breaches || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleUpdateRate = async (e) => {
    e.preventDefault();
    setRateError('');
    setRateSuccess('');
    setUpdatingRate(true);

    try {
      const res = await api.setDailyRate(parseFloat(newRateInr));
      setRateSuccess(res.message);
      setNewRateInr('');
      fetchDashboardData();
    } catch (err) {
      setRateError(err.message || 'Failed to update gold rate.');
    } finally {
      setUpdatingRate(false);
    }
  };

  // WITH THIS (Sends Bearer token and triggers file download seamlessly):
  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem('swarn_sathi_token');
      const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
      const response = await fetch(`/api/dashboard/export-csv${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download CSV report.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `loans-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(err.message || 'Failed to download CSV.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-amber-500" />
          Branch Portfolio Dashboard
        </h1>
        <p className="text-sm text-slate-500">Live operational metrics, risk flags, and portfolio health (Tier 2)</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading portfolio analytics...</div>
      ) : (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-400 font-medium uppercase block">Active Loans</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{stats?.activeLoansCount || 0}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-400 font-medium uppercase block">Outstanding Principal</span>
              <span className="text-xl font-bold text-amber-600 mt-1 block">
                ₹{(stats?.totalOutstandingPrincipalInr || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-400 font-medium uppercase block">Interest Accrued Today</span>
              <span className="text-xl font-bold text-emerald-700 mt-1 block">
                ₹{(stats?.interestAccruedTodayInr || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-400 font-medium uppercase block">Overdue Loans</span>
              <span className="text-xl font-bold text-rose-600 mt-1 block">
                {stats?.overdueCount || 0} (₹{(stats?.overdueAmountInr || 0).toLocaleString('en-IN')})
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-400 font-medium uppercase block">LTV Breaches</span>
              <span className="text-2xl font-black text-purple-700 mt-1 block">
                {stats?.ltvBreachCount || 0}
              </span>
            </div>
          </div>

          {/* Admin Daily Gold Rate Update & CSV Export Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admin Rate Setting */}
            {isAdmin && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  Admin: Set Daily 24K Gold Rate
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Set today's rate in Rupees per gram. Existing loans retain their sanction rate, but active LTVs are evaluated against this rate.
                </p>

                {rateSuccess && (
                  <div className="mb-3 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg">{rateSuccess}</div>
                )}
                {rateError && (
                  <div className="mb-3 p-3 bg-rose-50 text-rose-800 text-xs rounded-lg">{rateError}</div>
                )}

                <form onSubmit={handleUpdateRate} className="flex gap-3">
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="e.g. 7350"
                    value={newRateInr}
                    onChange={(e) => setNewRateInr(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={updatingRate}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-lg cursor-pointer"
                  >
                    {updatingRate ? 'Saving...' : 'Publish Rate'}
                  </button>
                </form>
              </div>
            )}

            {/* CSV Export Tool */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Export Portfolio Data (CSV)
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Download verified loan book records for audit reporting and reconciliation.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>

              <button
                onClick={handleExportCsv}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download CSV Export
              </button>
            </div>
          </div>

          {/* LTV Breaches Alert Table (Tier 2 feature) */}
          {breaches.length > 0 && (
            <div className="bg-white rounded-2xl border border-purple-200 shadow-xs p-6">
              <h3 className="font-bold text-sm text-purple-900 mb-2 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-purple-600" />
                Active Loans with LTV Slab Breach (Due to Gold Price Movement)
              </h3>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-purple-50 text-purple-900 font-bold">
                    <tr>
                      <th className="px-4 py-2.5">Loan Reference</th>
                      <th className="px-4 py-2.5">Customer</th>
                      <th className="px-4 py-2.5">Outstanding Balance</th>
                      <th className="px-4 py-2.5">Original LTV</th>
                      <th className="px-4 py-2.5">Current LTV</th>
                      <th className="px-4 py-2.5">Slab Cap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {breaches.map((b) => (
                      <tr key={b.loan_id}>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{b.loan_reference_no}</td>
                        <td className="px-4 py-2.5">{b.customer_name} ({b.customer_phone})</td>
                        <td className="px-4 py-2.5 font-bold">₹{(Number(b.outstanding_principal_paise) / 100).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5">{b.original_ltv_pct}%</td>
                        <td className="px-4 py-2.5 font-bold text-purple-700">{b.current_ltv_pct}%</td>
                        <td className="px-4 py-2.5 font-bold text-slate-700">{b.slab_max_ltv_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}