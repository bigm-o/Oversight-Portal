import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiService } from '@/services/apiService';

interface User {
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  theme?: string;
  permissions?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (data: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isAuthenticated: boolean;
  isLoadingPermissions: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

  useEffect(() => {
    // Initial sync handles load, but we could add tab-sync here
  }, []);

  const login = async (data: any) => {
    let email = data.email;
    let password = data.password;

    const response = await apiService.post<any>('/auth/login', { email, password });

    // Parse permissions string to object
    let parsedPermissions: any = {};
    if (response.permissions) {
      try {
        if (typeof response.permissions === 'string') {
          parsedPermissions = JSON.parse(response.permissions);
        } else {
          parsedPermissions = response.permissions;
        }
      } catch (e) {
        console.error('Failed to parse permissions:', e);
        parsedPermissions = {};
      }
    }

    const userData = {
      email: response.email,
      role: response.role,
      firstName: response.firstName,
      lastName: response.lastName,
      theme: response.theme,
      permissions: parsedPermissions,
      isActive: response.isActive !== false
    };

    setToken(response.token);
    setUser(userData);

    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(userData));

    if (response.theme) {
      localStorage.setItem('theme', response.theme);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const refreshUser = useCallback(async () => {
    try {
      setIsLoadingPermissions(true);
      const response: any = await apiService.getCurrentUser();

      // Parse permissions string to object
      let parsedPermissions: any = {};
      if (response.permissions) {
        try {
          if (typeof response.permissions === 'string') {
            parsedPermissions = JSON.parse(response.permissions);
          } else {
            parsedPermissions = response.permissions;
          }
        } catch (e) {
          console.error('Failed to parse permissions:', e);
          parsedPermissions = {};
        }
      }

      const userData = {
        email: response.email,
        role: response.role,
        firstName: response.firstName,
        lastName: response.lastName,
        theme: response.theme,
        permissions: parsedPermissions,
        isActive: response.isActive !== false
      };

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));

      if (response.theme) {
        localStorage.setItem('theme', response.theme);
      }
    } catch (e) {
      console.error('Failed to refresh user:', e);
    } finally {
      setIsLoadingPermissions(false);
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, updateUser, isAuthenticated: !!token, isLoadingPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
