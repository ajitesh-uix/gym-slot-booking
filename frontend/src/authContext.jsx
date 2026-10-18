import { createContext, useContext, useState, useEffect } from 'react';
import { clearAuth, loadUser, saveAuth } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadUser());

  useEffect(() => {
    const stored = loadUser();
    if (stored && !user) setUser(stored);
  }, []);

  function login(token, nextUser) {
    saveAuth(token, nextUser);
    setUser(nextUser);
  }

  function logout() {
    clearAuth();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
