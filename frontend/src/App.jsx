import React, { useState, useEffect } from 'react';
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

  // Parse initial tab and loanId from URL hash (e.g. #loans, #loan-detail?id=2)
  const getTabFromHash = () => {
    const hash = window.location.hash.replace('#', '').trim();
    if (!hash) return { tab: 'customers', loanId: null };
    const [tabPart, queryPart] = hash.split('?');
    const params = new URLSearchParams(queryPart || '');
    return {
      tab: tabPart || 'customers',
      loanId: params.get('id') ? Number(params.get('id')) : null,
    };
  };

  const initial = getTabFromHash();
  const [activeTab, setActiveTabState] = useState(initial.tab);
  const [selectedLoanId, setSelectedLoanId] = useState(initial.loanId);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedAppraisal, setSelectedAppraisal] = useState(null);

  // Sync state changes to browser URL hash
  const navigateTo = (tab, loanId = null) => {
    setActiveTabState(tab);
    if (loanId) {
      setSelectedLoanId(loanId);
      window.location.hash = `${tab}?id=${loanId}`;
    } else {
      window.location.hash = tab;
    }
  };

  // Listen for browser Back/Forward buttons and hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const { tab, loanId } = getTabFromHash();
      setActiveTabState(tab);
      if (loanId) setSelectedLoanId(loanId);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Clear URL hash when logged out so signin page URL stays clean: http://localhost:5173/
  useEffect(() => {
    if (!isAuthenticated && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [isAuthenticated]);

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
      <Navbar activeTab={activeTab} setActiveTab={(tab) => navigateTo(tab)} />

      <main className="flex-1">
        {activeTab === 'customers' && (
          <CustomersPage
            onSelectCustomerForAppraisal={(customer) => {
              setSelectedCustomer(customer);
              navigateTo('appraisal');
            }}
          />
        )}

        {activeTab === 'appraisal' && (
          <AppraisalPage
            selectedCustomer={selectedCustomer}
            onAppraisalCreated={(appraisal) => {
              setSelectedAppraisal(appraisal);
              navigateTo('new-loan');
            }}
          />
        )}

        {activeTab === 'new-loan' && (
          <NewLoanPage
            preselectedAppraisal={selectedAppraisal}
            onLoanCreated={(loanId) => {
              navigateTo('loan-detail', loanId);
            }}
          />
        )}

        {activeTab === 'loans' && (
          <LoansPage
            onSelectLoan={(loanId) => {
              navigateTo('loan-detail', loanId);
            }}
          />
        )}

        {activeTab === 'loan-detail' && (
          <LoanDetailPage
            loanId={selectedLoanId}
            onBack={() => navigateTo('loans')}
          />
        )}

        {activeTab === 'approvals' && (
          <ApprovalsQueuePage
            onOpenLoan={(loanId) => {
              navigateTo('loan-detail', loanId);
            }}
          />
        )}

        {activeTab === 'dashboard' && <DashboardPage />}
      </main>
    </div>
  );
}