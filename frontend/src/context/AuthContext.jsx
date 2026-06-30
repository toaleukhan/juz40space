import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [curator, setCurator] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('curator');
    if (token && saved) {
      setCurator(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const login = async (phone, password) => {
    const { data } = await api.post('/auth/login', { phone, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('curator', JSON.stringify(data.curator));
    setCurator(data.curator);
    return data;
  };

  const register = async (form) => {
    const { data } = await api.post('/auth/register', form);
    localStorage.setItem('token', data.token);
    localStorage.setItem('curator', JSON.stringify(data.curator));
    setCurator(data.curator);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('curator');
    setCurator(null);
  };

  return (
    <AuthContext.Provider value={{ curator, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
