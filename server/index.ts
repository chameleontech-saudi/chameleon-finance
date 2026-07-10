import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const app = express();
const port = 3001;

// Use URL-encoded password in connection string
const connectionString = 'postgresql://postgres.hqpvwdchdvdazxhuvdfc:-F%2FnKWHD5aj%2BsqJ@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const JWT_SECRET = 'chameleon-tech-secret-key-2026';

app.use(cors());
app.use(express.json());

// Middleware to verify JWT token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// 1. Auth Login (verifies password via crypt in Postgres)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
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
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

// 2. Get Partner Profiles
app.get('/api/partners', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, avatar_url, role FROM public.profiles ORDER BY name`
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get Investments
app.get('/api/investments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, p.name as partner_name, p.avatar_url as partner_avatar 
       FROM public.investments i
       LEFT JOIN public.profiles p ON i.created_by = p.id
       ORDER BY i.date DESC`
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Log Investment
app.post('/api/investments', authenticateToken, async (req, res) => {
  const { title, amount, date, investor_name, equity_percentage, description } = req.body;
  const created_by = req.user.id;

  if (!title || !amount || !investor_name) {
    return res.status(400).json({ error: 'Title, amount, and investor name are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.investments (title, amount, date, investor_name, equity_percentage, description, created_by)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7)
       RETURNING *`,
      [title, amount, date || null, investor_name, equity_percentage || 0, description || '', created_by]
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get Expenses
app.get('/api/expenses', authenticateToken, async (req, res) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Request Expense
app.post('/api/expenses', authenticateToken, async (req, res) => {
  const { title, amount, date, category, description } = req.body;
  const created_by = req.user.id;

  if (!title || !amount || !category) {
    return res.status(400).json({ error: 'Title, amount, and category are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.expenses (title, amount, date, category, description, status, created_by)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, 'Pending', $6)
       RETURNING *`,
      [title, amount, date || null, category, description || '', created_by]
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Approve Expense
app.post('/api/expenses/:id/approve', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const approved_by = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE public.expenses 
       SET status = 'Approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approved_by, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Reject Expense
app.post('/api/expenses/:id/reject', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const approved_by = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE public.expenses 
       SET status = 'Rejected', approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approved_by, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Chameleon Tech Finance API listening at http://localhost:${port}`);
  });
}

export default app;
