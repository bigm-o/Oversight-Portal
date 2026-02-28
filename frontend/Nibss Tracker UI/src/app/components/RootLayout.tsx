import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { Bell, Menu, X, LayoutDashboard, AlertCircle, Code2, GitBranch, BarChart3, CheckSquare, FileText, Database, LogOut, Users, Shield, ArrowRightLeft, TrendingUp, Terminal, Settings, Sparkles } from 'lucide-react';
import nibssLogo from '../../assets/Nibss_logo.png';
import { useState, useEffect } from 'react';
import { Badge } from '@/app/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { Toaster } from '@/app/components/ui/sonner';

const navGroups = [
  {
    group: 'Main',
    items: [
      { path: '/', id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
      { path: '/gpt', id: 'gpt', label: 'NIBSS GPT', icon: Sparkles },
    ]
  },
  {
    group: 'Governing Development',
    items: [
      { path: '/analytics', id: 'analytics', label: 'Development Analytics', icon: BarChart3 },
      { path: '/development', id: 'development', label: 'Development Tracking', icon: Code2 },
      { path: '/development-incidents', id: 'development-incidents', label: 'Development Incidents (L4)', icon: Terminal },
      { path: '/admin/jira', id: 'jira-integration', label: 'Jira Mapping', icon: GitBranch },
      { path: '/ticket-movement', id: 'ticket-movement', label: 'Ticket movement', icon: ArrowRightLeft },
    ]
  },
  {
    group: 'Governing Service Delivery',
    items: [
      { path: '/sla-compliance', id: 'sla-compliance', label: 'SLA compliance', icon: Shield },
      { path: '/incidents', id: 'incidents', label: 'Incidents and Service requests', icon: AlertCircle },
      { path: '/escalations', id: 'escalations', label: 'Escalations', icon: TrendingUp },
    ]
  },
  {
    group: 'Database',
    items: [
      { path: '/reports', id: 'reports', label: 'Reports', icon: FileText },
      { path: '/database', id: 'database', label: 'Database Viewer', icon: Database },
    ]
  },
  {
    group: 'Admin',
    items: [
      { path: '/admin/users', id: 'user-management', label: 'User Management', icon: Users },
    ]
  }
];

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, refreshUser, isLoadingPermissions, token } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const notificationCount = 0;

  // Flattened items for easy lookup
  const navItems = navGroups.flatMap(g => g.items);

  // On mount, refresh permissions to get fresh data from backend
  useEffect(() => {
    // Only refresh if we have a token and haven't initialized yet
    if (token && !hasInitialized && !isLoadingPermissions) {
      console.log('Initializing RootLayout: refreshing permissions');
      refreshUser();
      setHasInitialized(true);
    }
  }, [token, hasInitialized, isLoadingPermissions, refreshUser]);

  // Handle responsive sidebar - open on large screens, closed on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle unauthorized page access
  useEffect(() => {
    // Skip if user not logged in, or if we are currently loading fresh permissions
    if (!user || isLoadingPermissions) return;

    const currentNavItem = navItems.find(item => {
      // Handle exact match or nested paths
      if (item.path === '/') return location.pathname === '/';
      return location.pathname.startsWith(item.path);
    });

    // Special check for notifications which isn't in main navItems
    if (location.pathname === '/notifications') {
      if (!hasPermission('notifications')) {
        console.warn('Unauthorized access to notifications. Redirecting.');
        navigate('/');
      }
      return;
    }

    if (currentNavItem && !hasPermission(currentNavItem.id)) {
      console.warn(`Unauthorized access to ${location.pathname}. Redirecting to dashboard.`);
      navigate('/');
    }
  }, [location.pathname, user, isLoadingPermissions, navigate]);

  // Handle auto-closing sidebar on mobile when navigating
  useEffect(() => {
    const handleNavigation = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    handleNavigation();
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const hasPermission = (itemId: string) => {
    // If no user or permissions loaded yet, restrictive
    if (!user) return false;

    const isAdmin = user.role === 'Admin' || user.permissions?.admin;

    // User Management is the only tool that admins get automatically.
    // Jira Integration now requires explicit page permission like other dashboards.
    if (itemId === 'user-management') {
      return isAdmin;
    }

    // For all other pages, check the specific page permissions
    // If permissions is a legacy string "Admin", we allow everything
    if (typeof user.permissions === 'string') return true;

    const hasAccess = user.permissions?.pages?.includes(itemId);

    console.log(`Permission check for ${itemId}:`, {
      isAdmin,
      pages: user.permissions?.pages,
      hasAccess
    });

    return !!hasAccess;
  };

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden text-foreground">
      {/* Header - Part of flex flow */}
      <header className="bg-white dark:bg-card border-b border-border z-50 h-16 sm:h-20 md:h-24 flex-shrink-0">
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 h-full">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
            <button
              onClick={() => {
                setSidebarOpen(!sidebarOpen);
                window.dispatchEvent(new CustomEvent('mainSidebarToggle'));
              }}
              className="p-2 hover:bg-muted dark:hover:bg-accent rounded-lg transition-colors flex-shrink-0"
            >
              {sidebarOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <img src={nibssLogo} alt="NIBSS Logo" className="h-10 sm:h-14 md:h-16 w-auto" />
            <div className="border-l border-border pl-2 sm:pl-3 md:pl-4 ml-2 hidden sm:block">
              <h1 className="font-semibold text-xs sm:text-sm md:text-base truncate tracking-tight">NiBSS IT Oversight</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate uppercase font-bold tracking-wider">IT Governance & Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            {hasPermission('notifications') && (
              <Link
                to="/notifications"
                className="relative p-2 hover:bg-muted dark:hover:bg-accent rounded-lg transition-colors hidden md:flex text-muted-foreground"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 bg-red-600 text-white px-1.5 py-0.5 text-xs">
                    {notificationCount}
                  </Badge>
                )}
              </Link>
            )}
            <Link
              to="/settings"
              className="p-2 hover:bg-muted dark:hover:bg-accent rounded-lg transition-colors flex text-muted-foreground"
              title="System Settings"
            >
              <Settings className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3 border-l border-border pl-4 hidden md:flex">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-bold truncate max-w-[150px]">{user?.email || 'User'}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-black">{user?.role || 'Role'}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0 bg-background relative">
        {/* Sidebar Overlay for Mobile */}
        {sidebarOpen && (
          <div
            className="md:hidden absolute inset-0 bg-black/60 z-30 transition-opacity backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`absolute md:relative left-0 top-0 bottom-0 bg-white dark:bg-card border-r border-border transition-all duration-300 z-40 overflow-y-auto w-56 sm:w-64 md:w-72 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-0 md:opacity-0'
            }`}
        >
          <nav className="p-3 sm:p-4 pt-4 sm:pt-6 space-y-6">
            {/* User Profile - Mobile Only */}
            <div className="md:hidden mb-4 pb-4 border-b border-border">
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{user?.email || 'User'}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{user?.role || 'Role'}</p>
                </div>
              </div>
            </div>

            {navGroups.map((group) => {
              const filteredItems = group.items.filter(item => hasPermission(item.id));
              if (filteredItems.length === 0) return null;

              return (
                <div key={group.group} className="space-y-1.5">
                  <h2 className="px-4 text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-2 pointer-events-none select-none">
                    {group.group}
                  </h2>
                  <div className="space-y-1">
                    {filteredItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      const IconComponent = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-xs sm:text-sm group ${isActive
                            ? 'bg-green-700 text-white shadow-lg shadow-green-900/10 font-bold'
                            : 'text-muted-foreground hover:bg-muted dark:hover:bg-white/5 hover:text-foreground'
                            }`}
                        >
                          <IconComponent className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:text-green-600'}`} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all mt-6 text-xs sm:text-sm font-bold"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span>Logout</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto bg-background transition-all">
          <div
            key={location.pathname}
            className={`max-w-full min-h-full animate-in fade-in slide-in-from-bottom-2 duration-700 ${location.pathname === '/gpt' ? 'p-0 h-full' : 'p-3 sm:p-4 md:p-6 lg:p-8'
              }`}
          >
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}