import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import type { Partner } from './types';

const normalizePartner = (value: unknown): Partner | null => {
  if (!value || typeof value !== 'object') return null;

  const user = value as Partial<Partner>;

  if (
    typeof user.id !== 'string' ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string' ||
    typeof user.role !== 'string'
  ) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: typeof user.avatar_url === 'string' ? user.avatar_url : null
  };
};

const clearStoredSession = () => {
  localStorage.removeItem('chameleon_token');
  localStorage.removeItem('chameleon_user');
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Partner | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedToken = localStorage.getItem('chameleon_token');
    const storedUser = localStorage.getItem('chameleon_user');

    if (storedToken && storedUser) {
      try {
        const parsedUser = normalizePartner(JSON.parse(storedUser));

        if (parsedUser) {
          setToken(storedToken);
          setCurrentUser(parsedUser);
        } else {
          clearStoredSession();
        }
      } catch {
        clearStoredSession();
      }
    }
    setInitializing(false);
  }, []);

  const handleLoginSuccess = (userToken: string, userProfile: Partner) => {
    setToken(userToken);
    setCurrentUser(userProfile);
  };

  const handleLogout = () => {
    clearStoredSession();
    setToken(null);
    setCurrentUser(null);
  };

  if (initializing) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0f19',
        color: '#fff'
      }}>
        <div style={{ fontSize: '1.2rem', fontFamily: 'Outfit' }}>Initializing Portal...</div>
      </div>
    );
  }

  return (
    <>
      {token && currentUser ? (
        <Dashboard token={token} currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
};

export default App;
