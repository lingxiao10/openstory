import { createContext, useState, ReactNode, createElement } from 'react';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  lang: 'zh' | 'en';
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  isLoggedIn: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoggedIn: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));

  const login = (u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem('auth_user', JSON.stringify(u));
    localStorage.setItem('auth_token', t);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  };

  return createElement(AuthContext.Provider, { value: { user, token, login, logout, isLoggedIn: !!user } }, children);
}
