import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

interface Partner {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  role: string;
}

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Partner | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedToken = localStorage.getItem('chameleon_token');
    const storedUser = localStorage.getItem('chameleon_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setCurrentUser(JSON.parse(storedUser));
    }
    setInitializing(false);
  }, []);

  const handleLoginSuccess = (userToken: string, userProfile: Partner) => {
    setToken(userToken);
    setCurrentUser(userProfile);
  };

  const handleLogout = () => {
    localStorage.removeItem('chameleon_token');
    localStorage.removeItem('chameleon_user');
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
