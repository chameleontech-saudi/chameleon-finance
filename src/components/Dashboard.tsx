import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
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

interface Partner {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  role: string;
}

interface Investment {
  id: string;
  title: string;
  amount: number;
  date: string;
  investor_name: string;
  equity_percentage: number;
  description: string;
  partner_name?: string;
  partner_avatar?: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: 'Software' | 'Marketing' | 'Hardware' | 'Travel' | 'Payroll' | 'Office' | 'Legal' | 'Other';
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_by: string;
  spent_by_name?: string;
  spent_by_avatar?: string;
  approved_by_name?: string;
  approved_by_avatar?: string;
  approved_at?: string;
}

interface DashboardProps {
  token: string;
  currentUser: Partner;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ token, currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'investments' | 'expenses'>('overview');
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  
  // New Investment Form
  const [newInvest, setNewInvest] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    investor_name: '',
    equity_percentage: '',
    description: ''
  });

  // New Expense Form
  const [newExpense, setNewExpense] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: 'Software',
    description: ''
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [investsRes, expensesRes, partnersRes] = await Promise.all([
        fetch('/api/investments', { headers }),
        fetch('/api/expenses', { headers }),
        fetch('/api/partners', { headers })
      ]);

      if (!investsRes.ok || !expensesRes.ok || !partnersRes.ok) {
        throw new Error('Failed to fetch finance portal data.');
      }

      const investsData = await investsRes.json();
      const expensesData = await expensesRes.json();

      setInvestments(investsData);
      setExpenses(expensesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const totalInvestments = investments.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const approvedExpenses = expenses
    .filter(e => e.status === 'Approved')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pendingExpenses = expenses
    .filter(e => e.status === 'Pending')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  const currentBalance = totalInvestments - approvedExpenses;

  // Recharts: Calculate Monthly Aggregates for area chart
  const getChartData = () => {
    // Generate map of month key "YYYY-MM" to { investments: 0, expenses: 0 }
    const monthlyMap: Record<string, { month: string; Inflow: number; Outflow: number }> = {};
    
    // Sort transactions chronologically
    const allDates = [
      ...investments.map(i => i.date),
      ...expenses.map(e => e.date)
    ].sort();

    if (allDates.length === 0) return [];

    const minDate = new Date(allDates[0]);
    const maxDate = new Date(allDates[allDates.length - 1]);
    
    // Populate month intervals
    let tempDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (tempDate <= maxDate) {
      const monthKey = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = tempDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyMap[monthKey] = { month: monthLabel, Inflow: 0, Outflow: 0 };
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    // Add Inflows (Investments)
    investments.forEach(inv => {
      const k = inv.date.substring(0, 7);
      if (monthlyMap[k]) {
        monthlyMap[k].Inflow += Number(inv.amount);
      }
    });

    // Add Outflows (Approved Expenses)
    expenses.filter(e => e.status === 'Approved').forEach(exp => {
      const k = exp.date.substring(0, 7);
      if (monthlyMap[k]) {
        monthlyMap[k].Outflow += Number(exp.amount);
      }
    });

    return Object.values(monthlyMap);
  };

  // Recharts: Expense Category breakdown for donut chart
  const getCategoryData = () => {
    const categories: Record<string, number> = {};
    expenses.filter(e => e.status === 'Approved').forEach(exp => {
      categories[exp.category] = (categories[exp.category] || 0) + Number(exp.amount);
    });
    return Object.keys(categories).map(cat => ({
      name: cat,
      value: categories[cat]
    }));
  };

  const COLORS = ['#10b981', '#06b6d4', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#64748b'];

  // Handle Approvals
  const handleExpenseAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/expenses/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`Could not ${action} expense.`);
      const updatedExpense = await response.json();
      
      // Update state
      setExpenses(prev => prev.map(e => e.id === id ? updatedExpense : e));
    } catch (err) {
      console.error(err);
      alert(`Error updating expense transaction: ${action}`);
    }
  };

  // Submit Investment
  const handleLogInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvest.title || !newInvest.amount || !newInvest.investor_name) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch('/api/investments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newInvest,
          amount: parseFloat(newInvest.amount),
          equity_percentage: newInvest.equity_percentage ? parseFloat(newInvest.equity_percentage) : 0
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to log investment.');

      setInvestments(prev => [data, ...prev]);
      setIsInvestmentModalOpen(false);
      setNewInvest({
        title: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        investor_name: '',
        equity_percentage: '',
        description: ''
      });
    } catch (err: any) {
      setFormError(err.message || 'Server error logging investment.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Expense Request
  const handleRequestExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.title || !newExpense.amount || !newExpense.category) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newExpense,
          amount: parseFloat(newExpense.amount)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to request expense.');

      setExpenses(prev => [data, ...prev]);
      setIsExpenseModalOpen(false);
      setNewExpense({
        title: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'Software',
        description: ''
      });
    } catch (err: any) {
      setFormError(err.message || 'Server error requesting expense.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
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
              src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
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
                  onClick={() => setIsInvestmentModalOpen(true)}
                >
                  <Plus size={16} /> Log Capital
                </button>
                <button 
                  className="btn btn-primary btn-glow"
                  onClick={() => setIsExpenseModalOpen(true)}
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
                    {formatCurrency(currentBalance)}
                  </span>
                  <div className="stat-change" style={{ color: '#34d399' }}>
                    <TrendingUp size={14} /> Runway active
                  </div>
                </div>
                <div className="stat-icon" style={{ borderColor: 'rgba(16,185,129,0.2)', color: 'var(--primary)' }}>
                  <DollarSign size={20} />
                </div>
              </div>

              <div className="stat-card glass">
                <div className="stat-content">
                  <span className="stat-label">Total Seed Funding</span>
                  <span className="stat-value">{formatCurrency(totalInvestments)}</span>
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
                  <span className="stat-value">{formatCurrency(approvedExpenses)}</span>
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
                    {formatCurrency(pendingExpenses)}
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
                          <YAxis stroke="var(--text-muted)" tickLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                          <Tooltip 
                            contentStyle={{ 
                              background: '#1e293b', 
                              borderColor: 'rgba(255,255,255,0.08)',
                              borderRadius: '8px',
                              color: '#fff' 
                            }} 
                            formatter={(value: any) => [formatCurrency(Number(value)), undefined]}
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
                                formatter={(value: any) => [formatCurrency(Number(value)), undefined]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', width: '100%' }}>
                          {getCategoryData().map((item, idx) => (
                            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[idx % COLORS.length] }} />
                              <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{item.name}</span>
                              <span style={{ fontWeight: 600, marginLeft: 'auto' }}>{formatCurrency(item.value)}</span>
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
                                    src={exp.spent_by_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                                    alt={exp.spent_by_name} 
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
                                {new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                {formatCurrency(exp.amount)}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button 
                                    className="btn btn-secondary"
                                    onClick={() => handleExpenseAction(exp.id, 'reject')}
                                    style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--error)' }}
                                    title="Reject Request"
                                  >
                                    <X size={14} /> Reject
                                  </button>
                                  <button 
                                    className="btn btn-primary"
                                    onClick={() => handleExpenseAction(exp.id, 'approve')}
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
                  <button className="btn btn-primary btn-glow" onClick={() => setIsInvestmentModalOpen(true)}>
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
                                  src={inv.partner_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                                  alt={inv.partner_name} 
                                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <span style={{ fontSize: '0.85rem' }}>{inv.partner_name}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--secondary)' }}>
                              {inv.equity_percentage > 0 ? `${inv.equity_percentage}%` : '—'}
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>
                              {formatCurrency(inv.amount)}
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
                  <button className="btn btn-primary btn-glow" onClick={() => setIsExpenseModalOpen(true)}>
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
                                  src={exp.spent_by_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                                  alt={exp.spent_by_name} 
                                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <span style={{ fontSize: '0.85rem' }}>{exp.spent_by_name}</span>
                              </div>
                            </td>
                            <td>
                              <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                {exp.category}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                                    style={{ padding: '4px 6px', borderRadius: 'var(--radius-sm)' }}
                                    title="Reject"
                                  >
                                    <X size={12} style={{ color: 'var(--error)' }} />
                                  </button>
                                  <button 
                                    className="btn btn-primary"
                                    onClick={() => handleExpenseAction(exp.id, 'approve')}
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
                                      src={exp.approved_by_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                                      alt={exp.approved_by_name} 
                                      style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                    <span>{exp.approved_by_name}</span>
                                  </div>
                                ) : '—'
                              )}
                            </td>
                            <td style={{ fontWeight: 700, color: exp.status === 'Rejected' ? 'var(--text-muted)' : 'var(--primary)', textAlign: 'right' }}>
                              {formatCurrency(exp.amount)}
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
        <div className="modal-overlay" onClick={() => setIsInvestmentModalOpen(false)}>
          <div className="glass-premium modal-content" style={{ padding: '32px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.3rem', fontFamily: 'Outfit' }}>Log Capital Investment</h3>
              <button 
                onClick={() => setIsInvestmentModalOpen(false)}
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
                  <label className="form-label">Amount (USD) *</label>
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
                <button type="button" className="btn btn-secondary" onClick={() => setIsInvestmentModalOpen(false)}>
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
        <div className="modal-overlay" onClick={() => setIsExpenseModalOpen(false)}>
          <div className="glass-premium modal-content" style={{ padding: '32px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.3rem', fontFamily: 'Outfit' }}>Request Capital Disbursement</h3>
              <button 
                onClick={() => setIsExpenseModalOpen(false)}
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
                  <label className="form-label">Amount (USD) *</label>
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
                  onChange={e => setNewExpense(prev => ({ ...prev, category: e.target.value }))}
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
                <button type="button" className="btn btn-secondary" onClick={() => setIsExpenseModalOpen(false)}>
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
