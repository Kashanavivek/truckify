import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const bootstrap = useCallback(async () => {
    if (!tokenStore.get()) { setLoading(false); setUser(null); return; }
    try {
      const res = await api('/auth/me');
      setUser(res.data.user);
      setTrucks(res.data.trucks || []);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const login = async (email, password) => {
    const res = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
    await bootstrap();
    return res.data.user;
  };

  const register = async (payload) => {
    const res = await api('/auth/register', { method: 'POST', body: payload, auth: false });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
    await bootstrap();
    return res.data.user;
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
    setTrucks([]);
  };

  const value = useMemo(
    () => ({ user, trucks, loading, login, register, logout, refresh: bootstrap, isCustomer: user?.role === 'customer', isOwner: user?.role === 'owner', isAdmin: user?.role === 'admin' }),
    [user, trucks, loading, bootstrap]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
