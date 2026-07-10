export type Partner = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
};

export type MoneyValue = number | string;

export type ExpenseCategory =
  | 'Software'
  | 'Marketing'
  | 'Hardware'
  | 'Travel'
  | 'Payroll'
  | 'Office'
  | 'Legal'
  | 'Other';

export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected';

export type Investment = {
  id: string;
  title: string;
  amount: MoneyValue;
  date: string;
  investor_name: string;
  equity_percentage: MoneyValue | null;
  description: string | null;
  partner_name?: string | null;
  partner_avatar?: string | null;
};

export type Expense = {
  id: string;
  title: string;
  amount: MoneyValue;
  date: string;
  category: ExpenseCategory;
  description: string | null;
  status: ExpenseStatus;
  created_by: string;
  spent_by_name?: string | null;
  spent_by_avatar?: string | null;
  approved_by_name?: string | null;
  approved_by_avatar?: string | null;
  approved_at?: string | null;
};
