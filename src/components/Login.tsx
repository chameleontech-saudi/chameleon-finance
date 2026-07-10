import React, { useState } from 'react';
import { Lock, Mail, Users, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

const PARTNER_PRESETS = [
  { name: 'Alex Mercer', email: 'alex@chameleon.tech', role: 'Managing Partner' },
  { name: 'Sarah Chen', email: 'sarah@chameleon.tech', role: 'Investment Director' },
  { name: 'Marcus Thompson', email: 'marcus@chameleon.tech', role: 'Financial Officer' },
  { name: 'Elena Rostova', email: 'elena@chameleon.tech', role: 'Operations Partner' }
];

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Chameleon2026!'); // Set default password for easy demo
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store in localStorage
      localStorage.setItem('chameleon_token', data.token);
      localStorage.setItem('chameleon_user', JSON.stringify(data.user));
      
      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    setError(null);
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
                placeholder="partner@chameleon.tech"
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

        {/* Quick Presets for Demo */}
        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Users size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Login Presets (Demo)
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {PARTNER_PRESETS.map((preset) => (
              <button
                key={preset.email}
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSelectPreset(preset.email)}
                style={{
                  padding: '8px 12px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '2px',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'left',
                  background: email === preset.email ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)',
                  borderColor: email === preset.email ? 'var(--primary-border)' : 'var(--border-color)',
                  color: email === preset.email ? 'var(--primary)' : 'var(--text-primary)'
                }}
              >
                <span style={{ fontWeight: 600 }}>{preset.name}</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{preset.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
