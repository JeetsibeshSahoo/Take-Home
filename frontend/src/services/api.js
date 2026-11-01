const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('swarn_sathi_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || data.error || 'Something went wrong');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  requestCode: (email) => request('/auth/request-code', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyCode: (email, code) => request('/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) }),
  getMe: () => request('/auth/me'),

  // Customers
  getCustomers: (page = 1, search = '') => request(`/customers?page=${page}&search=${encodeURIComponent(search)}`),
  getCustomerById: (id) => request(`/customers/${id}`),
  createCustomer: (customerData) => request('/customers', { method: 'POST', body: JSON.stringify(customerData) }),

  // Gold Rates
  getTodayRate: () => request('/gold-rates/today'),
  setDailyRate: (ratePerGramInr) => request('/gold-rates', { method: 'POST', body: JSON.stringify({ ratePerGramInr }) }),
  getRateHistory: () => request('/gold-rates/history'),

  // Appraisals
  createAppraisal: (appraisalData) => request('/appraisals', { method: 'POST', body: JSON.stringify(appraisalData) }),
  getAppraisalById: (id) => request(`/appraisals/${id}`),

  // Loans
  getLoans: (page = 1, status = '') => request(`/loans?page=${page}${status ? `&status=${status}` : ''}`),
  getLoanById: (id) => request(`/loans/${id}`),
  sanctionLoan: (loanData) => request('/loans/sanction', { method: 'POST', body: JSON.stringify(loanData) }),
  approveLoan: (id, decision) => request(`/loans/${id}/approve`, { method: 'POST', body: JSON.stringify({ decision }) }),
  getApprovalsQueue: () => request('/loans/approvals-queue'),
  getDueCalculator: (id, dateStr) => request(`/loans/${id}/due-calculator${dateStr ? `?date=${dateStr}` : ''}`),
  recordRepayment: (id, repaymentData) => request(`/loans/${id}/repayments`, { method: 'POST', body: JSON.stringify(repaymentData) }),
  closeLoan: (id, closureData) => request(`/loans/${id}/close`, { method: 'POST', body: JSON.stringify(closureData) }),

  // Dashboard & Reports
  getDashboardStats: () => request('/dashboard/stats'),
  getExportCsvUrl: (startDate, endDate) => `/api/dashboard/export-csv${startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : ''}`,
};