import React, { useCallback, useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Briefcase, 
  CreditCard, 
  Clock, 
  LogOut, 
  Plus, 
  Check, 
  X, 
  PieChart as PieIcon, 
  BarChart as BarIcon, 
  Layers
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import type { Expense, ExpenseCategory, Investment, MoneyValue, Partner } from '../types';

interface DashboardProps {
  token: string;
  currentUser: Partner;
  onLogout: () => void;
}

type ApiErrorResponse = {
  error?: string;
  details?: string;
};

type ChartPoint = {
  month: string;
  Inflow: number;
  Outflow: number;
};

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

const todayInputValue = () => new Date().toISOString().split('T')[0];

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

const isMoneyValue = (value: unknown): value is MoneyValue => {
  return typeof value === 'number' || typeof value === 'string';
};

const toNumber = (value: MoneyValue | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Amounts are entered and stored in SAR; INR is shown as a read-only equivalent.
const SAR_TO_INR_RATE = 25.41;

const sarFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0
});

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const compactSarFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'SAR',
  notation: 'compact',
  maximumFractionDigits: 1
});

const formatSar = (value: MoneyValue | null | undefined) => {
  return sarFormatter.format(toNumber(value));
};

const formatInrEquivalent = (value: MoneyValue | null | undefined) => {
  return inrFormatter.format(toNumber(value) * SAR_TO_INR_RATE);
};

const formatDualCurrencyText = (value: MoneyValue | null | undefined) => {
  return `${formatSar(value)} / ${formatInrEquivalent(value)}`;
};

const formatCompactSar = (value: MoneyValue | null | undefined) => {
  return compactSarFormatter.format(toNumber(value));
};

const parsePositiveMoney = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePercentage = (value: string) => {
  if (!value.trim()) return 0;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
};

const readJsonResponse = async <T,>(response: Response): Promise<T | ApiErrorResponse | null> => {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();
    return text ? { error: text } : null;
  }

  try {
    return await response.json();
  } catch {
    return {
      error: `Request returned invalid JSON with status ${response.status}.`
    };
  }
};

const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const payload = await readJsonResponse<T>(response);

  if (!response.ok) {
    const apiError =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as ApiErrorResponse).error || (payload as ApiErrorResponse).details
        : null;

    throw new Error(apiError || `Request failed with status ${response.status}.`);
  }

  if (!payload) {
    throw new Error('Request returned an empty response.');
  }

  return payload as T;
};

const getMonthKey = (date: string) => {
  const key = date.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : null;
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1)));
};

const formatDate = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);

  if (!year || !month || !day) {
    return date;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

export const Dashboard: React.FC<DashboardProps> = ({ token, currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'investments' | 'expenses'>('overview');
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingExpenseId, setUpdatingExpenseId] = useState<string | null>(null);
  
  // Modals state
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  
  // New Investment Form
  const [newInvest, setNewInvest] = useState({
    title: '',
    amount: '',
    date: todayInputValue(),
    investor_name: '',
    equity_percentage: '',
    description: ''
  });

  // New Expense Form
  const [newExpense, setNewExpense] = useState<{
    title: string;
    amount: string;
    date: string;
    category: ExpenseCategory;
    description: string;
  }>({
    title: '',
    amount: '',
    date: todayInputValue(),
    category: 'Software',
    description: ''
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [investsData, expensesData] = await Promise.all([
        requestJson<Investment[]>('/api/investments', { headers }),
        requestJson<Expense[]>('/api/expenses', { headers })
      ]);

      setInvestments(investsData);
      setExpenses(expensesData);
    } catch (err) {
      console.error(err);
      setLoadError(getErrorMessage(err, 'Failed to fetch finance portal data.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Calculations
  const totalInvestments = investments.reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  const approvedExpenses = expenses
    .filter(e => e.status === 'Approved')
    .reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  const pendingExpenses = expenses
    .filter(e => e.status === 'Pending')
    .reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  
  const currentBalance = totalInvestments - approvedExpenses;

  // Recharts: Calculate Monthly Aggregates for area chart
  const getChartData = () => {
    const monthlyMap: Record<string, ChartPoint> = {};
    const allMonthKeys = [
      ...investments.map(i => getMonthKey(i.date)),
      ...expenses.map(e => getMonthKey(e.date))
    ].filter((monthKey): monthKey is string => Boolean(monthKey)).sort();

    if (allMonthKeys.length === 0) return [];

    let [cursorYear, cursorMonth] = allMonthKeys[0].split('-').map(Number);
    const [maxYear, maxMonth] = allMonthKeys[allMonthKeys.length - 1].split('-').map(Number);

    while (cursorYear < maxYear || (cursorYear === maxYear && cursorMonth <= maxMonth)) {
      const monthKey = `${cursorYear}-${String(cursorMonth).padStart(2, '0')}`;
      monthlyMap[monthKey] = { month: formatMonthLabel(monthKey), Inflow: 0, Outflow: 0 };

      cursorMonth += 1;
      if (cursorMonth > 12) {
        cursorYear += 1;
        cursorMonth = 1;
      }
    }

    // Add Inflows (Investments)
    investments.forEach(inv => {
      const key = getMonthKey(inv.date);
      if (key && monthlyMap[key]) {
        monthlyMap[key].Inflow += toNumber(inv.amount);
      }
    });

    // Add Outflows (Approved Expenses)
    expenses.filter(e => e.status === 'Approved').forEach(exp => {
      const key = getMonthKey(exp.date);
      if (key && monthlyMap[key]) {
        monthlyMap[key].Outflow += toNumber(exp.amount);
      }
    });

    return Object.values(monthlyMap);
  };

  // Recharts: Expense Category breakdown for donut chart
  const getCategoryData = () => {
    const categories: Record<string, number> = {};
    expenses.filter(e => e.status === 'Approved').forEach(exp => {
      categories[exp.category] = (categories[exp.category] || 0) + toNumber(exp.amount);
    });
    return Object.keys(categories).map(cat => ({
      name: cat,
      value: categories[cat]
    }));
  };

  const COLORS = ['#10b981', '#06b6d4', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#64748b'];

  const openInvestmentModal = () => {
    setFormError(null);
    setIsInvestmentModalOpen(true);
  };

  const closeInvestmentModal = () => {
    setFormError(null);
    setIsInvestmentModalOpen(false);
  };

  const openExpenseModal = () => {
    setFormError(null);
    setIsExpenseModalOpen(true);
  };

  const closeExpenseModal = () => {
    setFormError(null);
    setIsExpenseModalOpen(false);
  };

  // Handle Approvals
  const handleExpenseAction = async (id: string, action: 'approve' | 'reject') => {
    if (updatingExpenseId) return;

    setUpdatingExpenseId(id);
    try {
      const updatedExpense = await requestJson<Expense>(`/api/expenses/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Update state
      setExpenses(prev => prev.map(e => e.id === id ? updatedExpense : e));
    } catch (err) {
      console.error(err);
      alert(getErrorMessage(err, `Could not ${action} expense.`));
    } finally {
      setUpdatingExpenseId(null);
    }
  };

  // Submit Investment
  const handleLogInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newInvest.title.trim();
    const investorName = newInvest.investor_name.trim();
    const amount = parsePositiveMoney(newInvest.amount);
    const equityPercentage = parsePercentage(newInvest.equity_percentage);

    if (!title || !newInvest.amount || !investorName) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (amount === null) {
      setFormError('Investment amount must be greater than zero.');
      return;
    }

    if (equityPercentage === null) {
      setFormError('Equity percentage must be between 0 and 100.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      const data = await requestJson<Investment>('/api/investments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newInvest,
          title,
          investor_name: investorName,
          amount,
          equity_percentage: equityPercentage,
          description: newInvest.description.trim()
        })
      });

      setInvestments(prev => [data, ...prev]);
      closeInvestmentModal();
      setNewInvest({
        title: '',
        amount: '',
        date: todayInputValue(),
        investor_name: '',
        equity_percentage: '',
        description: ''
      });
    } catch (err) {
      setFormError(getErrorMessage(err, 'Server error logging investment.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Expense Request
  const handleRequestExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newExpense.title.trim();
    const amount = parsePositiveMoney(newExpense.amount);

    if (!title || !newExpense.amount || !newExpense.category) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (amount === null) {
      setFormError('Expense amount must be greater than zero.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      const data = await requestJson<Expense>('/api/expenses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newExpense,
          title,
          amount,
          description: newExpense.description.trim()
        })
      });

      setExpenses(prev => [data, ...prev]);
      closeExpenseModal();
      setNewExpense({
        title: '',
        amount: '',
        date: todayInputValue(),
        category: 'Software',
        description: ''
      });
    } catch (err) {
      setFormError(getErrorMessage(err, 'Server error requesting expense.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const renderCurrencyAmount = (val: MoneyValue, align: 'left' | 'right' = 'left') => {
    return (
      <span className={`dual-currency dual-currency-${align}`}>
        <span className="dual-currency-primary">{formatSar(val)}</span>
        <span className="dual-currency-secondary">{formatInrEquivalent(val)}</span>
      </span>
    );
  };

  const formatPercent = (val: MoneyValue | null | undefined) => {
    const percentage = toNumber(val);

    if (percentage <= 0) return '—';

    return `${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
    }).format(percentage)}%`;
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div className="sidebar-logo">
            <img src="/logo.png" alt="Chameleon Tech" />
            <span>CHAMELEON</span>
          </div>

          <nav className="sidebar-menu">
            <button 
              className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Layers size={18} /> Overview
            </button>
            <button 
              className={`sidebar-item ${activeTab === 'investments' ? 'active' : ''}`}
              onClick={() => setActiveTab('investments')}
            >
              <Briefcase size={18} /> Investments
            </button>
            <button 
              className={`sidebar-item ${activeTab === 'expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('expenses')}
            >
              <CreditCard size={18} /> Expenses
            </button>
          </nav>
        </div>

        {/* Current Partner Profile */}
        <div>
          <div className="sidebar-partner glass" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
            <img 
              className="partner-avatar" 
              src={currentUser.avatar_url || FALLBACK_AVATAR} 
              alt={currentUser.name} 
            />
            <div className="partner-info">
              <span className="partner-name">{currentUser.name}</span>
              <span className="partner-role">{currentUser.role}</span>
            </div>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={onLogout}
            style={{ width: '100%', marginTop: '12px', fontSize: '0.85rem', padding: '8px 12px' }}
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="main-viewport">
        {loading ? (
          <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(16, 185, 129, 0.1)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading finance metrics...</span>
          </div>
        ) : loadError ? (
          <div className="glass" style={{ padding: '32px', maxWidth: '720px' }}>
            <h2 style={{ fontSize: '1.4rem', fontFamily: 'Outfit', marginBottom: '8px' }}>
              Could not load the finance dashboard
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px' }}>
              {loadError}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-glow" onClick={() => void fetchData()}>
                Retry
              </button>
              <button className="btn btn-secondary" onClick={onLogout}>
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Top Greeting */}
            <div className="section-header" style={{ marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', fontFamily: 'Outfit' }}>Financial Dashboard</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Real-time treasury balance, funding tracking, and operational expenses ledger.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn btn-secondary"
                  onClick={openInvestmentModal}
                >
                  <Plus size={16} /> Log Capital
                </button>
                <button 
                  className="btn btn-primary btn-glow"
                  onClick={openExpenseModal}
                >
                  <Plus size={16} /> Request Expense
                </button>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="stat-grid">
              <div className="stat-card glass-premium">
                <div className="stat-content">
                  <span className="stat-label">Treasury Cash Balance</span>
                  <span className="stat-value" style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>
                    {renderCurrencyAmount(currentBalance)}
                  </span>
                  <div className="stat-change" style={{ color: '#34d399' }}>
                    <TrendingUp size={14} /> Runway active
                  </div>
                </div>
                <div className="stat-icon" style={{ borderColor: 'rgba(16,185,129,0.2)', color: 'var(--primary)' }}>
                  <Wallet size={20} />
                </div>
              </div>

              <div className="stat-card glass">
                <div className="stat-content">
                  <span className="stat-label">Total Seed Funding</span>
                  <span className="stat-value">{renderCurrencyAmount(totalInvestments)}</span>
                  <span className="stat-change" style={{ color: 'var(--text-secondary)' }}>
                    {investments.length} Investments
                  </span>
                </div>
                <div className="stat-icon" style={{ color: 'var(--secondary)' }}>
                  <Briefcase size={20} />
                </div>
              </div>

              <div className="stat-card glass">
                <div className="stat-content">
                  <span className="stat-label">Operational Outflow</span>
                  <span className="stat-value">{renderCurrencyAmount(approvedExpenses)}</span>
                  <span className="stat-change" style={{ color: 'var(--text-secondary)' }}>
                    Approved cash expenses
                  </span>
                </div>
                <div className="stat-icon" style={{ color: '#fbbf24' }}>
                  <TrendingDown size={20} style={{ color: '#fbbf24' }} />
                </div>
              </div>

              <div className="stat-card glass">
                <div className="stat-content">
                  <span className="stat-label">Pending Approval Requests</span>
                  <span className="stat-value" style={{ color: pendingExpenses > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {renderCurrencyAmount(pendingExpenses)}
                  </span>
                  <span className="stat-change" style={{ color: 'var(--text-secondary)' }}>
                    {expenses.filter(e => e.status === 'Pending').length} requests pending review
                  </span>
                </div>
                <div className="stat-icon" style={{ color: 'var(--warning)' }}>
                  <Clock size={20} />
                </div>
              </div>
            </div>

            {/* TAB CONTENT: OVERVIEW */}
            {activeTab === 'overview' && (
              <>
                <div className="dashboard-grid">
                  {/* Left: cash flow trend chart */}
                  <div className="glass" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontFamily: 'Outfit' }}>Treasury Cash Inflow vs Outflow</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aggregated monthly records of funding vs operational expenses</p>
                      </div>
                      <BarIcon size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div style={{ width: '100%', height: '300px', fontSize: '0.8rem' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month" stroke="var(--text-muted)" tickLine={false} />
                          <YAxis stroke="var(--text-muted)" tickLine={false} tickFormatter={(val) => formatCompactSar(val)} />
                          <Tooltip 
                            contentStyle={{ 
                              background: '#1e293b', 
                              borderColor: 'rgba(255,255,255,0.08)',
                              borderRadius: '8px',
                              color: '#fff' 
                            }} 
                            formatter={(value: unknown) => [formatDualCurrencyText(isMoneyValue(value) ? value : 0), undefined]}
                          />
                          <Area type="monotone" dataKey="Inflow" stroke="var(--primary)" fillOpacity={1} fill="url(#colorInflow)" strokeWidth={2} />
                          <Area type="monotone" dataKey="Outflow" stroke="#f59e0b" fillOpacity={1} fill="url(#colorOutflow)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right: Pie Chart category breakdown */}
                  <div className="glass" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontFamily: 'Outfit' }}>Expense Breakdown</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Share of approved expenditure by category</p>
                      </div>
                      <PieIcon size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    {getCategoryData().length === 0 ? (
                      <div style={{ display: 'flex', height: '240px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        No approved expenses to visualize.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '100%', height: '180px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={getCategoryData()}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {getCategoryData().map((_entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ 
                                  background: '#1e293b', 
                                  borderColor: 'rgba(255,255,255,0.08)',
                                  borderRadius: '8px',
                                  color: '#fff' 
                                }}
                                formatter={(value: unknown) => [formatDualCurrencyText(isMoneyValue(value) ? value : 0), undefined]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', width: '100%' }}>
                          {getCategoryData().map((item, idx) => (
                            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[idx % COLORS.length] }} />
                              <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{item.name}</span>
                              <span style={{ fontWeight: 600, marginLeft: 'auto' }}>
                                {renderCurrencyAmount(item.value, 'right')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom: Pending Reviews Queue */}
                <div className="glass" style={{ padding: '24px' }}>
                  <div className="section-header" style={{ marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontFamily: 'Outfit' }}>Awaiting Approval</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Financial disbursements requiring validation from partner board members</p>
                    </div>
                  </div>

                  {expenses.filter(e => e.status === 'Pending').length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      All requested expenses have been reviewed. Clear ledger!
                    </div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Requester</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenses.filter(e => e.status === 'Pending').map((exp) => (
                            <tr key={exp.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <img 
                                    src={exp.spent_by_avatar || FALLBACK_AVATAR} 
                                    alt={exp.spent_by_name || 'Partner'} 
                                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                                  />
                                  <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{exp.spent_by_name || 'Partner'}</span>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{exp.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {exp.description || 'No description provided'}
                                </div>
                              </td>
                              <td>
                                <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                  {exp.category}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {formatDate(exp.date)}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                {renderCurrencyAmount(exp.amount)}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button 
                                    className="btn btn-secondary"
                                    onClick={() => handleExpenseAction(exp.id, 'reject')}
                                    disabled={updatingExpenseId === exp.id}
                                    style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--error)' }}
                                    title="Reject Request"
                                  >
                                    <X size={14} /> Reject
                                  </button>
                                  <button 
                                    className="btn btn-primary"
                                    onClick={() => handleExpenseAction(exp.id, 'approve')}
                                    disabled={updatingExpenseId === exp.id}
                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                    title="Approve Request"
                                  >
                                    <Check size={14} /> Approve
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB CONTENT: INVESTMENTS */}
            {activeTab === 'investments' && (
              <div className="glass" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontFamily: 'Outfit' }}>Capital Inflow Ledger</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Institutional investments and strategic funding details</p>
                  </div>
                  <button className="btn btn-primary btn-glow" onClick={openInvestmentModal}>
                    <Plus size={16} /> Log Capital
                  </button>
                </div>

                {investments.length === 0 ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No investments logged in the portal yet.
                  </div>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Funding details</th>
                          <th>Investor</th>
                          <th>Recorded By</th>
                          <th>Equity %</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {investments.map((inv) => (
                          <tr key={inv.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{inv.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '350px' }}>
                                {inv.description || 'No description provided'}
                              </div>
                            </td>
                            <td style={{ fontWeight: 500 }}>{inv.investor_name}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img 
                                  src={inv.partner_avatar || FALLBACK_AVATAR} 
                                  alt={inv.partner_name || 'Partner'} 
                                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <span style={{ fontSize: '0.85rem' }}>{inv.partner_name || 'Partner'}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--secondary)' }}>
                              {formatPercent(inv.equity_percentage)}
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {formatDate(inv.date)}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>
                              {renderCurrencyAmount(inv.amount, 'right')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: EXPENSES */}
            {activeTab === 'expenses' && (
              <div className="glass" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontFamily: 'Outfit' }}>Operational Expenses Ledger</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Full record of disbursements, expenses, and pending claims</p>
                  </div>
                  <button className="btn btn-primary btn-glow" onClick={openExpenseModal}>
                    <Plus size={16} /> Request Expense
                  </button>
                </div>

                {expenses.length === 0 ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No expenses requested in the ledger yet.
                  </div>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Expense details</th>
                          <th>Spent By</th>
                          <th>Category</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Audited By</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((exp) => (
                          <tr key={exp.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{exp.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                                {exp.description || 'No description provided'}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img 
                                  src={exp.spent_by_avatar || FALLBACK_AVATAR} 
                                  alt={exp.spent_by_name || 'Partner'} 
                                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <span style={{ fontSize: '0.85rem' }}>{exp.spent_by_name || 'Partner'}</span>
                              </div>
                            </td>
                            <td>
                              <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                {exp.category}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {formatDate(exp.date)}
                            </td>
                            <td>
                              <span className={`badge ${
                                exp.status === 'Approved' ? 'badge-success' : 
                                exp.status === 'Pending' ? 'badge-pending' : 'badge-danger'
                              }`}>
                                {exp.status === 'Approved' && <Check size={10} style={{ marginRight: '2px' }} />}
                                {exp.status === 'Rejected' && <X size={10} style={{ marginRight: '2px' }} />}
                                {exp.status}
                              </span>
                            </td>
                            <td>
                              {exp.status === 'Pending' ? (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button 
                                    className="btn btn-secondary"
                                    onClick={() => handleExpenseAction(exp.id, 'reject')}
                                    disabled={updatingExpenseId === exp.id}
                                    style={{ padding: '4px 6px', borderRadius: 'var(--radius-sm)' }}
                                    title="Reject"
                                  >
                                    <X size={12} style={{ color: 'var(--error)' }} />
                                  </button>
                                  <button 
                                    className="btn btn-primary"
                                    onClick={() => handleExpenseAction(exp.id, 'approve')}
                                    disabled={updatingExpenseId === exp.id}
                                    style={{ padding: '4px 6px', borderRadius: 'var(--radius-sm)' }}
                                    title="Approve"
                                  >
                                    <Check size={12} />
                                  </button>
                                </div>
                              ) : (
                                exp.approved_by_name ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <img 
                                      src={exp.approved_by_avatar || FALLBACK_AVATAR} 
                                      alt={exp.approved_by_name} 
                                      style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                    <span>{exp.approved_by_name}</span>
                                  </div>
                                ) : '—'
                              )}
                            </td>
                            <td style={{ fontWeight: 700, color: exp.status === 'Rejected' ? 'var(--text-muted)' : 'var(--primary)', textAlign: 'right' }}>
                              {renderCurrencyAmount(exp.amount, 'right')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL 1: LOG INVESTMENT */}
      {isInvestmentModalOpen && (
        <div className="modal-overlay" onClick={closeInvestmentModal}>
          <div className="glass-premium modal-content" style={{ padding: '32px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.3rem', fontFamily: 'Outfit' }}>Log Capital Investment</h3>
              <button 
                onClick={closeInvestmentModal}
                aria-label="Close investment form"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="badge badge-danger" style={{ display: 'block', padding: '10px', width: '100%', marginBottom: '16px', textAlign: 'center', textTransform: 'none' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleLogInvestment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Funding Title *</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="e.g. Series A Extension Funding"
                  value={newInvest.title}
                  onChange={e => setNewInvest(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Amount (SAR) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="input-control" 
                    placeholder="250000"
                    value={newInvest.amount}
                    onChange={e => setNewInvest(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Capital Date *</label>
                  <input 
                    type="date" 
                    className="input-control" 
                    value={newInvest.date}
                    onChange={e => setNewInvest(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Investor Name *</label>
                  <input 
                    type="text" 
                    className="input-control" 
                    placeholder="Vertex Ventures"
                    value={newInvest.investor_name}
                    onChange={e => setNewInvest(prev => ({ ...prev, investor_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Equity Percentage</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    max="100"
                    className="input-control" 
                    placeholder="5.0"
                    value={newInvest.equity_percentage}
                    onChange={e => setNewInvest(prev => ({ ...prev, equity_percentage: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes & Description</label>
                <textarea 
                  className="input-control" 
                  rows={3} 
                  placeholder="Notes about vesting schedule, legal terms, or milestones..."
                  value={newInvest.description}
                  onChange={e => setNewInvest(prev => ({ ...prev, description: e.target.value }))}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={closeInvestmentModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-glow" disabled={formSubmitting}>
                  {formSubmitting ? 'Logging...' : 'Log Capital'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REQUEST EXPENSE */}
      {isExpenseModalOpen && (
        <div className="modal-overlay" onClick={closeExpenseModal}>
          <div className="glass-premium modal-content" style={{ padding: '32px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.3rem', fontFamily: 'Outfit' }}>Request Capital Disbursement</h3>
              <button 
                onClick={closeExpenseModal}
                aria-label="Close expense form"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="badge badge-danger" style={{ display: 'block', padding: '10px', width: '100%', marginBottom: '16px', textAlign: 'center', textTransform: 'none' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleRequestExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Expense Title *</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="e.g. Github Team Subscription Annual Renewal"
                  value={newExpense.title}
                  onChange={e => setNewExpense(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Amount (SAR) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    className="input-control" 
                    placeholder="1200"
                    value={newExpense.amount}
                    onChange={e => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expense Date *</label>
                  <input 
                    type="date" 
                    className="input-control" 
                    value={newExpense.date}
                    onChange={e => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Expense Category *</label>
                <select 
                  className="input-control"
                  value={newExpense.category}
                  onChange={e => setNewExpense(prev => ({ ...prev, category: e.target.value as ExpenseCategory }))}
                  required
                >
                  <option value="Software">Software & Cloud Services</option>
                  <option value="Marketing">Marketing & Branding</option>
                  <option value="Hardware">Hardware & Equipment</option>
                  <option value="Travel">Travel & Lodging</option>
                  <option value="Payroll">Payroll & Contractor Fees</option>
                  <option value="Office">Office & Rent</option>
                  <option value="Legal">Legal & Compliance</option>
                  <option value="Other">Other Operational Cost</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Purpose</label>
                <textarea 
                  className="input-control" 
                  rows={3} 
                  placeholder="Explain why this expense is necessary for Chameleon Tech operations..."
                  value={newExpense.description}
                  onChange={e => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={closeExpenseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-glow" disabled={formSubmitting}>
                  {formSubmitting ? 'Requesting...' : 'Request Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
