import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  selectCurrentUser, 
  selectIsManager, 
  selectIsAdmin, 
  logout 
} from '../store/authSlice.js';
import { api } from '../services/api.js';
import { 
  Coins, 
  Users, 
  Scale, 
  FilePlus2, 
  CreditCard, 
  CheckSquare, 
  LayoutDashboard, 
  LogOut,
  Building2,
  TrendingUp
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const isManager = useSelector(selectIsManager);
  const isAdmin = useSelector(selectIsAdmin);

  const [todayRate, setTodayRate] = useState(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  useEffect(() => {
    async function fetchNavbarInfo() {
      try {
        const rateRes = await api.getTodayRate();
        setTodayRate(rateRes.rate);

        if (isManager || isAdmin) {
          const queueRes = await api.getApprovalsQueue();
          setPendingApprovalsCount(queueRes.queue?.length || 0);
        }
      } catch (err) {
        // Fallback silently if rate is not yet set
      }
    }
    fetchNavbarInfo();
    const interval = setInterval(fetchNavbarInfo, 30000);
    return () => clearInterval(interval);
  }, [isManager, isAdmin]);

  const navItems = [
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'appraisal', label: 'New Appraisal', icon: Scale },
    { id: 'new-loan', label: 'Sanction Loan', icon: FilePlus2 },
    { id: 'loans', label: 'All Loans', icon: CreditCard },
    ...(isManager || isAdmin ? [{ 
      id: 'approvals', 
      label: 'Approvals Queue', 
      icon: CheckSquare,
      badge: pendingApprovalsCount 
    }] : []),
    { id: 'dashboard', label: 'Portfolio Dashboard', icon: LayoutDashboard },
  ];

  const roleBadgeColors = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
    BRANCH_MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    BRANCH_STAFF: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Branch */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-200">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                Swarn Sathi
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">Console</span>
              </span>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Building2 className="w-3 h-3" />
                {user?.branchName || 'Kolkata Main Branch'}
              </div>
            </div>
          </div>

          {/* Today's Gold Rate Live Ticker */}
          {todayRate && (
            <div className="hidden md:flex items-center gap-2 bg-amber-50/80 border border-amber-200/80 px-3.5 py-1.5 rounded-full text-xs font-medium text-amber-900">
              <TrendingUp className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>Today's 24K Gold Rate:</span>
              <span className="font-bold text-amber-700">₹{todayRate.ratePerGramInr.toLocaleString('en-IN')}/g</span>
            </div>
          )}

          {/* User Profile Badge & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900 leading-none">{user?.fullName}</p>
              <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 mt-1 rounded-md border ${roleBadgeColors[user?.role] || 'bg-slate-100 text-slate-700'}`}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={() => dispatch(logout())}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {item.badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white text-amber-600' : 'bg-rose-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}