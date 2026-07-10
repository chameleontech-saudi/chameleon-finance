import React, { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import type { Partner } from '../types';

interface LoginProps {
  onLoginSuccess: (token: string, user: Partner) => void;
}

type LoginResponse = {
  token?: string;
  user?: Partner;
  error?: string;
  details?: string;
  missingEnv?: string[];
};

const readLoginResponse = async (response: Response): Promise<LoginResponse> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return {
        error: `Login returned invalid JSON with status ${response.status}.`
      };
    }
  }

  const text = await response.text();
  return {
    error: text || `Login request failed with status ${response.status}.`
  };
};

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@chameleontech.com');
  const [password, setPassword] = useState('Chameleon2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await readLoginResponse(response);

      if (!response.ok) {
        const missingEnv = data.missingEnv?.length ? ` Missing: ${data.missingEnv.join(', ')}.` : '';
        const message = data.error?.startsWith('A server error')
          ? 'The login service returned a server error. Please try again shortly.'
          : data.error || data.details || 'Login failed';

        throw new Error(`${message}${missingEnv}`);
      }

      if (!data.token || !data.user) {
        throw new Error('Login response was missing authentication data.');
      }

      // Store in localStorage
      localStorage.setItem('chameleon_token', data.token);
      localStorage.setItem('chameleon_user', JSON.stringify(data.user));
      
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100vw',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 60%), radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.08) 0%, transparent 60%), #0b0f19'
    }}>
      <div className="glass-premium modal-content" style={{
        maxWidth: '460px',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Logo Container */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
          }}>
            <img src="/logo.png" alt="Chameleon Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, fontFamily: 'Outfit' }}>
              CHAMELEON<span style={{ color: 'var(--primary)' }}>TECH</span>
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
              Partner Finance Portal
            </p>
          </div>
        </div>

        {error && (
          <div className="badge badge-danger" style={{
            display: 'block',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            width: '100%',
            textAlign: 'center',
            fontSize: '0.85rem',
            textTransform: 'none',
            letterSpacing: 'normal'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Partner Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
              <input
                id="email-input"
                className="input-control"
                type="email"
                placeholder="admin@chameleontech.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '44px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
              <input
                id="password-input"
                className="input-control"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '44px' }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-glow"
            style={{ width: '100%', padding: '14px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : (
              <>
                Access Dashboard <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
