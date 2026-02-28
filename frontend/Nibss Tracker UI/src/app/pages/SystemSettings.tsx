import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useTheme } from '@/contexts/ThemeContext';
import { Settings, Shield, User, Palette, Key, CheckCircle, AlertTriangle, Monitor, Moon, Sun, BellRing } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

export function SystemSettings() {
    const { user, refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'appearance' | 'notifications'>('profile');
    const [isUpdating, setIsUpdating] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const { theme, setTheme } = useTheme();

    const isAdmin = user?.role === 'Admin' || user?.permissions?.admin;

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        try {
            setIsUpdating(true);
            await apiService.post('/users/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            toast.success('Password updated successfully');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err: any) {
            toast.error(err.message || 'Failed to update password');
        } finally {
            setIsUpdating(false);
        }
    };

    const menuItems = [
        { id: 'profile', label: 'My Profile', icon: User },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'notifications', label: 'Notifications', icon: BellRing },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
                    <div className="p-2 bg-green-600/10 rounded-xl">
                        <Settings className="w-8 h-8 text-green-600" />
                    </div>
                    System Settings
                </h1>
                <p className="text-muted-foreground ml-14">Manage your account preferences and application configuration</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Navigation Sidebar */}
                <div className="lg:col-span-1 space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border-2 ${activeTab === item.id
                                    ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-500/20'
                                    : 'bg-card border-transparent hover:border-green-600/30 text-muted-foreground'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-green-600'}`} />
                                <span className="font-bold text-sm tracking-tight">{item.label}</span>
                            </button>
                        );
                    })}

                    {isAdmin && (
                        <div className="mt-8 pt-8 border-t border-border">
                            <p className="px-4 text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-4">Admin Console</p>
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-3 rounded-xl border-dashed border-2 hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-600 hover:text-green-600"
                                onClick={() => window.location.href = '/admin/users'}
                            >
                                <Monitor className="w-5 h-5" />
                                <span className="font-bold text-sm">Permissions Manager</span>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3 space-y-6">
                    {activeTab === 'profile' && (
                        <Card className="border-0 shadow-xl shadow-black/5 bg-white/50 dark:bg-card/50 backdrop-blur-md overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-green-600/5 to-transparent border-b border-border/50">
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <User className="w-5 h-5 text-green-600" />
                                    Contextual Profile
                                </CardTitle>
                                <CardDescription>Your account details and current role assignments</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-24 h-24 bg-gradient-to-br from-green-600 to-green-800 rounded-3xl flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-green-500/40">
                                        {user?.email?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-black text-foreground tracking-tight">{user?.firstName} {user?.lastName}</h2>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 font-black tracking-widest uppercase text-[10px] px-3">
                                                {user?.role}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground font-medium">{user?.email}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4 p-6 bg-muted/40 rounded-2xl border border-border/50">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5" /> Effective Permissions
                                        </h3>
                                        <div className="space-y-3">
                                            {user?.permissions?.admin ? (
                                                <div className="flex items-center gap-2 text-sm font-bold text-green-600">
                                                    <CheckCircle className="w-4 h-4" /> Full System Access
                                                </div>
                                            ) : (
                                                user?.permissions?.pages?.map((p: string) => (
                                                    <div key={p} className="flex items-center gap-2 text-sm font-semibold text-foreground capitalize">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                        {p.replace('-', ' ')}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4 p-6 bg-muted/40 rounded-2xl border border-border/50">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5" /> Account Capacity
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-muted-foreground">Page Access</span>
                                                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-black">
                                                    {user?.permissions?.admin ? 'ALL' : (user?.permissions?.pages?.length || 0)}
                                                </Badge>
                                            </div>

                                            {user?.permissions?.pages?.includes('development') && (
                                                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                                    <span className="text-sm font-semibold text-muted-foreground">Designated Teams</span>
                                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-black">
                                                        {user?.permissions?.admin ? 'ALL' : (user?.permissions?.teams?.length || 0)} Teams
                                                    </Badge>
                                                </div>
                                            )}

                                            {!user?.permissions?.pages?.includes('development') && !user?.permissions?.admin && (
                                                <p className="text-[10px] text-muted-foreground italic leading-tight">
                                                    Your account is optimized for governance oversight. Contact an administrator for development team assignments.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'security' && (
                        <Card className="border-0 shadow-xl shadow-black/5 bg-white/50 dark:bg-card/50 backdrop-blur-md">
                            <CardHeader className="bg-gradient-to-r from-red-600/5 to-transparent border-b border-border/50">
                                <CardTitle className="text-xl font-bold flex items-center gap-2 text-red-600">
                                    <Key className="w-5 h-5" />
                                    Credential Management
                                </CardTitle>
                                <CardDescription>Securely update your authentication credentials</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8">
                                <form onSubmit={handlePasswordChange} className="max-w-md space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Password</Label>
                                            <Input
                                                type="password"
                                                className="rounded-xl h-12 bg-muted/50 border-0 focus:ring-2 focus:ring-red-500/20"
                                                value={passwordData.currentPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Password</Label>
                                            <Input
                                                type="password"
                                                className="rounded-xl h-12 bg-muted/50 border-0 focus:ring-2 focus:ring-red-500/20"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Confirm New Password</Label>
                                            <Input
                                                type="password"
                                                className="rounded-xl h-12 bg-muted/50 border-0 focus:ring-2 focus:ring-red-500/20"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isUpdating}
                                        className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-red-500/20"
                                    >
                                        {isUpdating ? 'Updating...' : 'Set Security Credentials'}
                                    </Button>
                                </form>

                                <div className="mt-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-start gap-4">
                                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-orange-600">Two-Factor Authentication</h4>
                                        <p className="text-xs text-muted-foreground mt-1">NIBSS Policy requires Corporate Identity for systems access. Multi-factor is managed via AD integration.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'appearance' && (
                        <Card className="border-0 shadow-xl shadow-black/5 bg-white/50 dark:bg-card/50 backdrop-blur-md">
                            <CardHeader className="bg-gradient-to-r from-blue-600/5 to-transparent border-b border-border/50">
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Palette className="w-5 h-5 text-blue-600" />
                                    Interface Customization
                                </CardTitle>
                                <CardDescription>Tailor the oversight matrix to your visual requirements</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="max-w-md space-y-6">
                                    {/* Theme Selector */}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Global Theme Mode</Label>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={async () => {
                                                    setTheme('light');
                                                    try { await apiService.put('/users/theme', { theme: 'light' }); } catch (e) { }
                                                }}
                                                className={`flex-1 p-4 rounded-2xl border-2 transition-all group flex flex-col items-center gap-3 bg-white ${theme === 'light' ? 'border-blue-600 shadow-xl shadow-blue-500/10' : 'border-border hover:border-blue-600'
                                                    }`}
                                            >
                                                <Sun className="w-6 h-6 text-orange-500" />
                                                <span className="text-xs font-bold text-gray-900">Light Mode</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setTheme('dark');
                                                    try { await apiService.put('/users/theme', { theme: 'dark' }); } catch (e) { }
                                                }}
                                                className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 bg-slate-900 ${theme === 'dark' ? 'border-blue-600 shadow-xl shadow-blue-500/10' : 'border-border hover:border-blue-600'
                                                    }`}
                                            >
                                                <Moon className="w-6 h-6 text-blue-400" />
                                                <span className="text-xs font-bold text-white">Deep Dark</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'notifications' && (
                        <Card className="border-0 shadow-xl shadow-black/5 bg-white/50 dark:bg-card/50 backdrop-blur-md">
                            <CardHeader className="bg-gradient-to-r from-amber-600/5 to-transparent border-b border-border/50">
                                <CardTitle className="text-xl font-bold flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <BellRing className="w-5 h-5 text-amber-600" />
                                        Alerting & Subscriptions
                                    </div>
                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] px-3 py-1">Coming Soon</Badge>
                                </CardTitle>
                                <CardDescription>Configure real-time notifications for critical ticket transitions</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="space-y-6 opacity-60 pointer-events-none grayscale">
                                    <div className="p-6 bg-muted/40 rounded-2xl border border-border/50 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold">Email Notifications</h4>
                                            <p className="text-sm text-muted-foreground">Receive daily summaries of your assigned tickets</p>
                                        </div>
                                        <div className="w-12 h-7 bg-muted rounded-full cursor-not-allowed p-1">
                                            <div className="w-5 h-5 bg-white rounded-full"></div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-muted/40 rounded-2xl border border-border/50 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold">SLA Breach Alerts</h4>
                                            <p className="text-sm text-muted-foreground">Instant notifications for high-priority breaches</p>
                                        </div>
                                        <div className="w-12 h-7 bg-muted rounded-full cursor-not-allowed p-1">
                                            <div className="w-5 h-5 bg-white rounded-full"></div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-muted/40 rounded-2xl border border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-center py-10">
                                        <Monitor className="w-10 h-10 text-muted-foreground/30 mb-3" />
                                        <h4 className="font-bold text-muted-foreground font-black uppercase tracking-widest text-xs">Module Restricted</h4>
                                        <p className="text-[11px] text-muted-foreground max-w-xs mt-1">Notification services are currently being integrated with the NIBSS SMTP server.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode, variant?: string, className?: string }) {
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${variant === 'outline' ? 'border' : 'bg-muted'} ${className}`}>
            {children}
        </span>
    );
}

function TrendingUp(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
        </svg>
    );
}
