import express from 'express';
import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const app = express();
const port = 3001;

type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
};

type AuthenticatedRequest = Request & {
  user: AuthUser;
};

type ErrorPayload = {
  error: string;
  details?: string;
};

type DateInputResult =
  | { valid: true; value: string | null }
  | { valid: false };

type ExpenseCategory = 'Software' | 'Marketing' | 'Hardware' | 'Travel' | 'Payroll' | 'Office' | 'Legal' | 'Other';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env and set your Supabase connection string.');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Set it to a long random secret in your environment.');
}

const expenseCategories = new Set<ExpenseCategory>([
  'Software',
  'Marketing',
  'Hardware',
  'Travel',
  'Payroll',
  'Office',
  'Legal',
  'Other'
]);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unknown server error';
};

const sendError = (res: Response, status: number, message: string, details?: string) => {
  const payload: ErrorPayload = { error: message };

  if (details && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }

  return res.status(status).json(payload);
};

const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== 'object') return false;

  const user = value as Partial<AuthUser>;
  const hasAvatar = typeof user.avatar_url === 'string' || user.avatar_url === null || user.avatar_url === undefined;

  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    typeof user.role === 'string' &&
    hasAvatar
  );
};

const getAuthenticatedUser = (req: Request) => {
  return (req as AuthenticatedRequest).user;
};

const normalizeText = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : '';
};

const parsePositiveAmount = (value: unknown) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePercentage = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
};

const parseDateInput = (value: unknown): DateInputResult => {
  if (value === undefined || value === null || value === '') {
    return { valid: true, value: null };
  }

  if (typeof value !== 'string') {
    return { valid: false };
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { valid: false };
  }

  const [year, month, day] = trimmed.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const parsedDate = parsed.toISOString().slice(0, 10);

  return parsedDate === trimmed ? { valid: true, value: trimmed } : { valid: false };
};

const isExpenseCategory = (value: unknown): value is ExpenseCategory => {
  return typeof value === 'string' && expenseCategories.has(value as ExpenseCategory);
};

const isUuid = (value: string) => uuidPattern.test(value);

app.use(cors());
app.use(express.json());

// Middleware to verify JWT token
const authenticateToken: RequestHandler = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return sendError(res, 401, 'Access token required');

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || !isAuthUser(user)) return sendError(res, 403, 'Invalid token');

    (req as AuthenticatedRequest).user = {
      ...user,
      avatar_url: user.avatar_url || null
    };
    next();
  });
};

// 1. Auth Login (verifies password via crypt in Postgres)
app.post('/api/auth/login', async (req, res) => {
  const email = normalizeText(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return sendError(res, 400, 'Email and password required');
  }

  try {
    const result = await pool.query(
      `SELECT id, email, raw_user_meta_data->>'name' as name, 
              raw_user_meta_data->>'avatar_url' as avatar_url, 
              raw_user_meta_data->>'role' as role,
              (encrypted_password = crypt($2, encrypted_password)) as authenticated 
       FROM auth.users 
       WHERE email = $1`,
      [email, password]
    );

    if (result.rows.length === 0 || !result.rows[0].authenticated) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const dbUser = result.rows[0];
    const userPayload = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name || dbUser.email.split('@')[0],
      avatar_url: dbUser.avatar_url,
      role: dbUser.role || 'Partner'
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: userPayload });
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 500, 'Authentication failed', getErrorMessage(error));
  }
});

// 2. Get Partner Profiles
app.get('/api/partners', authenticateToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, avatar_url, role FROM public.profiles ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    return sendError(res, 500, 'Failed to load partners', getErrorMessage(error));
  }
});

// 3. Get Investments
app.get('/api/investments', authenticateToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, p.name as partner_name, p.avatar_url as partner_avatar 
       FROM public.investments i
       LEFT JOIN public.profiles p ON i.created_by = p.id
       ORDER BY i.date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    return sendError(res, 500, 'Failed to load investments', getErrorMessage(error));
  }
});

// 4. Log Investment
app.post('/api/investments', authenticateToken, async (req, res) => {
  const title = normalizeText(req.body.title);
  const amount = parsePositiveAmount(req.body.amount);
  const investmentDate = parseDateInput(req.body.date);
  const investorName = normalizeText(req.body.investor_name);
  const equityPercentage = parsePercentage(req.body.equity_percentage);
  const description = normalizeText(req.body.description);
  const created_by = getAuthenticatedUser(req).id;

  if (!title || !investorName) {
    return sendError(res, 400, 'Title and investor name are required');
  }

  if (amount === null) {
    return sendError(res, 400, 'Investment amount must be greater than zero');
  }

  if (!investmentDate.valid) {
    return sendError(res, 400, 'Investment date must use YYYY-MM-DD format');
  }

  if (equityPercentage === null) {
    return sendError(res, 400, 'Equity percentage must be between 0 and 100');
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.investments (title, amount, date, investor_name, equity_percentage, description, created_by)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7)
       RETURNING *`,
      [title, amount, investmentDate.value, investorName, equityPercentage, description, created_by]
    );
    
    // Return the newly created investment with partner details
    const newInvest = result.rows[0];
    const details = await pool.query(
      `SELECT i.*, p.name as partner_name, p.avatar_url as partner_avatar 
       FROM public.investments i
       LEFT JOIN public.profiles p ON i.created_by = p.id
       WHERE i.id = $1`,
      [newInvest.id]
    );
    res.status(201).json(details.rows[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to log investment', getErrorMessage(error));
  }
});

// 5. Get Expenses
app.get('/api/expenses', authenticateToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, 
              p1.name as spent_by_name, p1.avatar_url as spent_by_avatar,
              p2.name as approved_by_name, p2.avatar_url as approved_by_avatar
       FROM public.expenses e
       LEFT JOIN public.profiles p1 ON e.created_by = p1.id
       LEFT JOIN public.profiles p2 ON e.approved_by = p2.id
       ORDER BY e.date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    return sendError(res, 500, 'Failed to load expenses', getErrorMessage(error));
  }
});

// 6. Request Expense
app.post('/api/expenses', authenticateToken, async (req, res) => {
  const title = normalizeText(req.body.title);
  const amount = parsePositiveAmount(req.body.amount);
  const expenseDate = parseDateInput(req.body.date);
  const category = req.body.category;
  const description = normalizeText(req.body.description);
  const created_by = getAuthenticatedUser(req).id;

  if (!title) {
    return sendError(res, 400, 'Title is required');
  }

  if (amount === null) {
    return sendError(res, 400, 'Expense amount must be greater than zero');
  }

  if (!expenseDate.valid) {
    return sendError(res, 400, 'Expense date must use YYYY-MM-DD format');
  }

  if (!isExpenseCategory(category)) {
    return sendError(res, 400, 'Expense category is invalid');
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.expenses (title, amount, date, category, description, status, created_by)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, 'Pending', $6)
       RETURNING *`,
      [title, amount, expenseDate.value, category, description, created_by]
    );

    const newExpense = result.rows[0];
    const details = await pool.query(
      `SELECT e.*, 
              p1.name as spent_by_name, p1.avatar_url as spent_by_avatar,
              p2.name as approved_by_name, p2.avatar_url as approved_by_avatar
       FROM public.expenses e
       LEFT JOIN public.profiles p1 ON e.created_by = p1.id
       LEFT JOIN public.profiles p2 ON e.approved_by = p2.id
       WHERE e.id = $1`,
      [newExpense.id]
    );
    res.status(201).json(details.rows[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to request expense', getErrorMessage(error));
  }
});

// 7. Approve Expense
app.post('/api/expenses/:id/approve', authenticateToken, async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const approved_by = getAuthenticatedUser(req).id;

  if (!id || !isUuid(id)) {
    return sendError(res, 400, 'Expense id is invalid');
  }

  try {
    const result = await pool.query(
      `UPDATE public.expenses 
       SET status = 'Approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'Pending'
       RETURNING *`,
      [approved_by, id]
    );

    if (result.rows.length === 0) {
      const existing = await pool.query(
        `SELECT status FROM public.expenses WHERE id = $1`,
        [id]
      );

      if (existing.rows.length === 0) {
        return sendError(res, 404, 'Expense not found');
      }

      return sendError(res, 409, `Expense has already been ${String(existing.rows[0].status).toLowerCase()}`);
    }

    const updatedExpense = result.rows[0];
    const details = await pool.query(
      `SELECT e.*, 
              p1.name as spent_by_name, p1.avatar_url as spent_by_avatar,
              p2.name as approved_by_name, p2.avatar_url as approved_by_avatar
       FROM public.expenses e
       LEFT JOIN public.profiles p1 ON e.created_by = p1.id
       LEFT JOIN public.profiles p2 ON e.approved_by = p2.id
       WHERE e.id = $1`,
      [updatedExpense.id]
    );
    res.json(details.rows[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to approve expense', getErrorMessage(error));
  }
});

// 8. Reject Expense
app.post('/api/expenses/:id/reject', authenticateToken, async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const approved_by = getAuthenticatedUser(req).id;

  if (!id || !isUuid(id)) {
    return sendError(res, 400, 'Expense id is invalid');
  }

  try {
    const result = await pool.query(
      `UPDATE public.expenses 
       SET status = 'Rejected', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'Pending'
       RETURNING *`,
      [approved_by, id]
    );

    if (result.rows.length === 0) {
      const existing = await pool.query(
        `SELECT status FROM public.expenses WHERE id = $1`,
        [id]
      );

      if (existing.rows.length === 0) {
        return sendError(res, 404, 'Expense not found');
      }

      return sendError(res, 409, `Expense has already been ${String(existing.rows[0].status).toLowerCase()}`);
    }

    const updatedExpense = result.rows[0];
    const details = await pool.query(
      `SELECT e.*, 
              p1.name as spent_by_name, p1.avatar_url as spent_by_avatar,
              p2.name as approved_by_name, p2.avatar_url as approved_by_avatar
       FROM public.expenses e
       LEFT JOIN public.profiles p1 ON e.created_by = p1.id
       LEFT JOIN public.profiles p2 ON e.approved_by = p2.id
       WHERE e.id = $1`,
      [updatedExpense.id]
    );
    res.json(details.rows[0]);
  } catch (error) {
    return sendError(res, 500, 'Failed to reject expense', getErrorMessage(error));
  }
});

app.use('/api', (_req, res) => {
  return sendError(res, 404, 'API route not found');
});

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  console.error('Unhandled API error:', error);

  if (res.headersSent) {
    return next(error);
  }

  return sendError(res, 500, 'Server error', getErrorMessage(error));
};

app.use(errorHandler);

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Chameleon Tech Finance API listening at http://localhost:${port}`);
  });
}

export default app;
