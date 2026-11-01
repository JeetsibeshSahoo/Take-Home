import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  selectIsAuthenticated, 
  selectAuthLoading, 
  checkAuthSession 
} from './store/authSlice.js';
import Navbar from './components/Navbar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import AppraisalPage from './pages/AppraisalPage.jsx';
import NewLoanPage from './pages/NewLoanPage.jsx';
import LoansPage from './pages/LoansPage.jsx';
import LoanDetailPage from './pages/LoanDetailPage.jsx';
import ApprovalsQueuePage from './pages/ApprovalsQueuePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

export default function App() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authLoading = useSelector(selectAuthLoading);
  const [activeTab, setActiveTab] = useState('customers');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedAppraisal, setSelectedAppraisal] = useState(null);
  const [selectedLoanId, setSelectedLoanId] = useState(null);

  // Restore session on mount
  useEffect(() => {
    dispatch(checkAuthSession());
  }, [dispatch]);

  // Loading spinner during session validation
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-pulse font-semibold text-amber-500">
          Initializing Swarn Sathi Console...
        </div>
      </div>
    );
  }

  // If unauthenticated, render passwordless magic code login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1">
        {activeTab === 'customers' && (
          <CustomersPage
            onSelectCustomerForAppraisal={(customer) => {
              setSelectedCustomer(customer);
              setActiveTab('appraisal');
            }}
          />
        )}

        {activeTab === 'appraisal' && (
          <AppraisalPage
            selectedCustomer={selectedCustomer}
            onAppraisalCreated={(appraisal) => {
              setSelectedAppraisal(appraisal);
              setActiveTab('new-loan');
            }}
          />
        )}

        {activeTab === 'new-loan' && (
          <NewLoanPage
            preselectedAppraisal={selectedAppraisal}
            onLoanCreated={(loanId) => {
              setSelectedLoanId(loanId);
              setActiveTab('loan-detail');
            }}
          />
        )}

        {activeTab === 'loans' && (
          <LoansPage
            onSelectLoan={(loanId) => {
              setSelectedLoanId(loanId);
              setActiveTab('loan-detail');
            }}
          />
        )}

        {activeTab === 'loan-detail' && (
          <LoanDetailPage
            loanId={selectedLoanId}
            onBack={() => setActiveTab('loans')}
          />
        )}

        {activeTab === 'approvals' && (
          <ApprovalsQueuePage
            onOpenLoan={(loanId) => {
              setSelectedLoanId(loanId);
              setActiveTab('loan-detail');
            }}
          />
        )}

        {activeTab === 'dashboard' && <DashboardPage />}
      </main>
    </div>
  );
}