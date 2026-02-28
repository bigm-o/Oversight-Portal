import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '@/services/apiService';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const [theme, setThemeState] = useState<Theme>('light');

  const getSystemTheme = (): 'light' | 'dark' => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const effectiveTheme = theme === 'auto' ? getSystemTheme() : theme;

  useEffect(() => {
    // Priority 1: Use server-side preference if available
    if (user?.theme) {
      setThemeState(user.theme as Theme);
      localStorage.setItem('theme', user.theme);
    } else {
      // Priority 2: Use local storage if no user preference
      const stored = localStorage.getItem('theme') as Theme;
      if (stored) {
        setThemeState(stored);
      }
    }
  }, [user?.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(getSystemTheme());
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);

    if (user) {
      // Update local user state immediately to prevent flicker on potential re-renders or reloads
      updateUser({ theme: newTheme });

      try {
        console.log(`Saving theme preference [${newTheme}] to server for ${user.email}...`);
        await apiService.put('/users/theme', { theme: newTheme });
        console.log('User theme preference sync complete');
      } catch (error) {
        console.error('Failed to sync theme preference to server:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
