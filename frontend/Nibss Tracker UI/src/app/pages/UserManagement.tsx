import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Check, Copy, AlertCircle, Loader2, Send, Shield, Briefcase, LayoutDashboard, BarChart3, Bell, FileText, CheckSquare, Users, Search, MoreVertical, Edit, UserX, Database, GitBranch, ArrowRightLeft, TrendingUp, Terminal, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/app/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import apiService from '@/services/apiService';
import { toast } from 'sonner';
import { cn } from '@/app/components/ui/utils';

interface PermissionState {
    pages: string[];
    teams: number[];
    admin: boolean;
    isActive: boolean;
}

interface User {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    permissions: string; // JSON string
    isActive: boolean;
    createdAt: string;
}

const PAGE_GROUPS = [
    {
        group: 'Main',
        items: [
            { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
            { id: 'gpt', label: 'NIBSS GPT', icon: Sparkles },
        ]
    },
    {
        group: 'Governing Development',
        items: [
            { id: 'analytics', label: 'Development Analytics', icon: BarChart3 },
            { id: 'development', label: 'Development Tracking', icon: Briefcase },
            { id: 'development-incidents', label: 'Development Incidents (L4)', icon: Terminal },
            { id: 'jira-integration', label: 'Jira Mapping', icon: GitBranch },
            { id: 'ticket-movement', label: 'Ticket movement', icon: ArrowRightLeft },
        ]
    },
    {
        group: 'Governing Service Delivery',
        items: [
            { id: 'incidents', label: 'Incidents and Service requests', icon: AlertCircle },
            { id: 'escalations', label: 'Escalations', icon: TrendingUp },
            { id: 'sla-compliance', label: 'SLA compliance', icon: Shield },
        ]
    },
    {
        group: 'Database',
        items: [
            { id: 'reports', label: 'Reports', icon: FileText },
            { id: 'database', label: 'Database Viewer', icon: Database },
        ]
    },
    {
        group: 'Administration',
        items: [
            { id: 'user-management', label: 'User Management', icon: Users },
        ]
    }
];

// Add notifications back if needed or keep it hidden if it's auto-access
const ALL_PAGES = [...PAGE_GROUPS.flatMap(g => g.items), { id: 'notifications', label: 'Notifications', icon: Bell }];

const ROLE_DEFAULTS: Record<string, { pages: string[], admin: boolean }> = {
    'Manager': {
        pages: ['dashboard', 'analytics', 'sla-compliance', 'reports'],
        admin: false
    },
    'Admin': {
        pages: ALL_PAGES.map(p => p.id),
        admin: true
    },
    'Team Lead': {
        pages: ['analytics', 'development', 'jira-integration', 'ticket-movement'],
        admin: false
    },
    'Governor': {
        pages: ALL_PAGES.filter(p => !['database', 'user-management'].includes(p.id)).map(p => p.id),
        admin: false
    },
    'User': {
        pages: [],
        admin: false
    }
};

const ROLES = Object.keys(ROLE_DEFAULTS);

// --- Helper Functions ---

const togglePage = (
    permState: PermissionState,
    setPermState: React.Dispatch<React.SetStateAction<PermissionState>>,
    pageId: string
) => {
    setPermState(prev => {
        const isIncluded = prev.pages.includes(pageId);
        const newPages = isIncluded
            ? prev.pages.filter(p => p !== pageId)
            : [...prev.pages, pageId];

        // If unchecking development, clear teams
        const newTeams = (pageId === 'development' && isIncluded) ? [] : prev.teams;

        return { ...prev, pages: newPages, teams: newTeams };
    });
};

const toggleTeam = (
    permState: PermissionState,
    setPermState: React.Dispatch<React.SetStateAction<PermissionState>>,
    teamId: number
) => {
    setPermState(prev => ({
        ...prev,
        teams: prev.teams.includes(teamId)
            ? prev.teams.filter(t => t !== teamId)
            : [...prev.teams, teamId]
    }));
};

// --- Components ---

const PermissionEditor = React.memo(({
    permissions,
    setPermissions,
    teams,
    role,
    setRole
}: {
    permissions: PermissionState,
    setPermissions: React.Dispatch<React.SetStateAction<PermissionState>>,
    teams: any[],
    role: string,
    setRole: (role: string) => void
}) => (
    <div className="space-y-6">
        <div className="space-y-2">
            <Label className="text-foreground font-semibold">User Role</Label>
            <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full bg-background border-border h-12 rounded-xl">
                    <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                    {ROLES.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1 px-1">
                Selecting a role will pre-assign default permissions for that tier.
            </p>
        </div>

        <div className="space-y-4">
            <Label className="text-foreground font-semibold">Page Access</Label>
            <div className="space-y-6">
                {PAGE_GROUPS.map((group) => (
                    <div key={group.group} className="space-y-3">
                        <Label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">{group.group}</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.items.map((page) => {
                                const isChecked = permissions.pages.includes(page.id);
                                return (
                                    <div
                                        key={page.id}
                                        onClick={() => togglePage(permissions, setPermissions, page.id)}
                                        className={cn(
                                            "flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer select-none group",
                                            isChecked
                                                ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/10"
                                                : "bg-background border-border hover:border-muted-foreground/30 shadow-sm"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            {/* Custom Checkbox to avoid Radix update loops in nested clicks */}
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                                isChecked ? "bg-blue-600 border-blue-600" : "bg-transparent border-gray-300 group-hover:border-gray-400"
                                            )}>
                                                {isChecked && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <page.icon className={cn("w-4 h-4", isChecked ? "text-blue-500" : "text-muted-foreground transition-colors group-hover:text-foreground")} />
                                                <span className={cn("text-xs font-bold", isChecked ? "text-foreground" : "text-muted-foreground transition-colors group-hover:text-foreground")}>
                                                    {page.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {permissions.pages.includes('development') && teams.length > 0 && (
            <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border animate-in fade-in slide-in-from-top-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Development Teams</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {teams.map((team) => {
                        const isChecked = permissions.teams.includes(team.id);
                        return (
                            <div
                                key={team.id}
                                className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded transition-colors cursor-pointer group"
                                onClick={() => toggleTeam(permissions, setPermissions, team.id)}
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded border flex items-center justify-center transition-colors shadow-sm",
                                    isChecked ? "bg-blue-600 border-blue-600" : "bg-transparent border-gray-300 group-hover:border-gray-400"
                                )}>
                                    {isChecked && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-sm text-foreground">{team.name}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        <div className="space-y-4 pt-4 border-t border-border">
            <Label className="text-foreground font-semibold">Account Status</Label>
            <div
                className={cn(
                    "flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors border group",
                    permissions.isActive
                        ? "bg-green-500/5 dark:bg-green-500/10 border-green-500/20 hover:bg-green-500/10"
                        : "bg-red-500/5 dark:bg-red-500/10 border-red-500/20 hover:bg-red-500/10"
                )}
                onClick={() => setPermissions(prev => ({ ...prev, isActive: !prev.isActive }))}
            >
                <div className="flex items-center gap-3">
                    <AlertCircle className={cn("w-5 h-5", permissions.isActive ? "text-green-600" : "text-red-600")} />
                    <div>
                        <Label className="font-bold cursor-pointer">Account {permissions.isActive ? 'Active' : 'Deactivated'}</Label>
                        <p className="text-xs text-muted-foreground">
                            {permissions.isActive ? 'User can log in to the system.' : 'User is blocked from logging in.'}
                        </p>
                    </div>
                </div>
                {/* Custom Checkbox Status */}
                <div className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm",
                    permissions.isActive
                        ? (permissions.isActive ? "bg-green-600 border-green-600" : "bg-transparent border-gray-300")
                        : "bg-transparent border-gray-300"
                )}>
                    {permissions.isActive && <Check className="w-4 h-4 text-white" />}
                </div>
            </div>

            <div
                className="flex items-center justify-between p-4 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 rounded-xl cursor-pointer hover:bg-orange-500/10 transition-colors group"
                onClick={() => setPermissions(prev => ({ ...prev, admin: !prev.admin }))}
            >
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-orange-600" />
                    <div>
                        <Label className="font-bold text-foreground cursor-pointer">Admin Privileges</Label>
                        <p className="text-xs text-orange-600 dark:text-orange-400">Full system control.</p>
                    </div>
                </div>
                {/* Custom Checkbox Admin */}
                <div className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm",
                    permissions.admin ? "bg-orange-600 border-orange-600" : "bg-transparent border-orange-300"
                )}>
                    {permissions.admin && <Check className="w-4 h-4 text-white" />}
                </div>
            </div>
        </div>
    </div>
));

export const UserManagement = () => {
    const [activeTab, setActiveTab] = useState("manage");
    const [teams, setTeams] = useState<any[]>([]);

    // Invite State
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteResult, setInviteResult] = useState<{ link: string; template: string } | null>(null);
    const [invitePermissions, setInvitePermissions] = useState<PermissionState>({
        pages: [],
        teams: [],
        admin: false,
        isActive: true
    });
    const [inviteRole, setInviteRole] = useState("User");

    const handleInviteRoleChange = useCallback((role: string) => {
        setInviteRole(role);
        const defaults = ROLE_DEFAULTS[role];
        if (defaults) {
            setInvitePermissions(prev => ({
                ...prev,
                pages: [...defaults.pages],
                admin: defaults.admin,
                // If Team Lead, and we have teams, maybe select the first one?
                teams: role === 'Team Lead' && teams.length > 0 ? [teams[0].id] : []
            }));
        }
    }, [teams]);

    // List State
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Edit State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editPermissions, setEditPermissions] = useState<PermissionState>({
        pages: [],
        teams: [],
        admin: false,
        isActive: true
    });
    const [editRole, setEditRole] = useState("User");
    const [savingEdit, setSavingEdit] = useState(false);

    const handleEditRoleChange = useCallback((role: string) => {
        setEditRole(role);
        const defaults = ROLE_DEFAULTS[role];
        if (defaults) {
            setEditPermissions(prev => ({
                ...prev,
                pages: [...defaults.pages],
                admin: defaults.admin
            }));
        }
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const [teamsData, usersData] = await Promise.all([
                apiService.getTeams(),
                apiService.getUsers()
            ]);

            if (Array.isArray(teamsData)) setTeams(teamsData);
            if (Array.isArray(usersData)) setUsers(usersData);
        } catch (error) {
            console.error('Failed to fetch data', error);
            // toast.error("Failed to load users. You might not have permission.");
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Parse permissions helper
    const parsePermissions = (json: string): PermissionState => {
        try {
            const parsed = JSON.parse(json);
            return {
                pages: Array.isArray(parsed.pages) ? parsed.pages : [],
                teams: Array.isArray(parsed.teams) ? parsed.teams : [],
                admin: !!parsed.admin,
                isActive: parsed.isActive !== undefined ? !!parsed.isActive : true
            };
        } catch {
            return { pages: [], teams: [], admin: false, isActive: true };
        }
    };

    // --- Actions ---

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;

        setInviteLoading(true);
        try {
            const response: any = await apiService.inviteUser(inviteEmail, inviteRole, invitePermissions);
            setInviteResult({
                link: response.link,
                template: response.template
            });
            toast.success("Invitation Generated");
            fetchData(); // Refresh list just in case needed
        } catch (error: any) {
            toast.error(error.message || "Failed to create invitation");
        } finally {
            setInviteLoading(false);
        }
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setEditPermissions({
            ...parsePermissions(user.permissions),
            isActive: user.isActive
        });
        setEditRole(user.role || "User");
    };

    const { user: currentUser, refreshUser } = useAuth();
    const handleSavePermissions = async () => {
        if (!editingUser) return;
        setSavingEdit(true);
        try {
            const payload = {
                permissions: {
                    pages: editPermissions.pages,
                    teams: editPermissions.teams,
                    admin: editPermissions.admin
                },
                isActive: editPermissions.isActive
            };

            await apiService.updateUserPermissions(editingUser.id, editRole, payload);
            toast.success("User updated successfully");

            // If the updated user is the current user, refresh the auth state
            if (editingUser.email === currentUser?.email) {
                await refreshUser();
            }

            setEditingUser(null);
            fetchData(); // Refresh list
        } catch (error: any) {
            toast.error("Failed to update user");
        } finally {
            setSavingEdit(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast("Copied to clipboard");
    };

    // Filter users
    const filteredUsers = React.useMemo(() => {
        return users.filter(u =>
            u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [users, searchQuery]);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-green-600" />
                        User Management
                    </h1>
                    <p className="text-muted-foreground dark:text-muted-foreground">Manage access, roles, and invitations.</p>
                </div>
                {/* <Button variant="outline"><FileText className="w-4 h-4 mr-2" /> Export Audit Log</Button> */}
            </div>

            <Tabs defaultValue="manage" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8">
                    <TabsTrigger value="manage">Manage Users</TabsTrigger>
                    <TabsTrigger value="invite">Invite New</TabsTrigger>
                </TabsList>

                <TabsContent value="manage" className="space-y-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users by name or email..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchData} title="Refresh">
                            <Loader2 className={cn("w-4 h-4", loadingUsers && "animate-spin")} />
                        </Button>
                    </div>

                    {loadingUsers ? (
                        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block rounded-xl border border-border overflow-hidden shadow-sm bg-card">
                                <Table>
                                    <TableHeader className="bg-muted/30 dark:bg-gray-900/50">
                                        <TableRow>
                                            <TableHead className="w-[300px]">User</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Access</TableHead>
                                            <TableHead>Joined</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.map((user) => {
                                            const perms = parsePermissions(user.permissions);
                                            return (
                                                <TableRow key={user.id} className="group hover:bg-muted/30 dark:hover:bg-gray-800/50 transition-colors">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9 border border-border">
                                                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`} />
                                                                <AvatarFallback>{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="text-sm font-semibold text-foreground">{user.firstName} {user.lastName}</div>
                                                                <div className="text-xs text-muted-foreground">{user.email}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={perms.admin ? "default" : "secondary"} className={cn(
                                                            perms.admin ? "bg-orange-100 text-orange-700 hover:bg-orange-200 border-none px-2 py-1" : "bg-green-100 text-green-700 hover:bg-green-200 border-none px-2 py-1"
                                                        )}>
                                                            {perms.admin ? 'Administrator' : 'Standard User'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={user.isActive ? "secondary" : "destructive"} className={cn(
                                                            user.isActive ? "bg-green-100 text-green-700 hover:bg-green-200 border-none px-2 py-1" : "bg-red-100 text-red-700 hover:bg-red-200 border-none px-2 py-1"
                                                        )}>
                                                            {user.isActive ? 'Active' : 'Deactivated'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1 flex-wrap">
                                                            {perms.pages.length > 0 ? (
                                                                <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-border dark:border-gray-700">{perms.pages.length} Pages</Badge>
                                                            ) : <span className="text-muted-foreground text-xs">-</span>}
                                                            {perms.teams.length > 0 && (
                                                                <Badge variant="outline" className="text-xs font-normal text-purple-600 border-purple-200 bg-purple-50">{perms.teams.length} Teams</Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {new Date(user.createdAt).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} className="hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors">
                                                            <Edit className="w-4 h-4 mr-2" />
                                                            Edit
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {filteredUsers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <UserX className="w-8 h-8 opacity-50" />
                                                        <p>No users found matching "{searchQuery}"</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {filteredUsers.map((user) => {
                                    const perms = parsePermissions(user.permissions);
                                    return (
                                        <Card key={user.id} className="border-border dark:border-gray-800">
                                            <CardContent className="p-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`} />
                                                            <AvatarFallback>{user.firstName?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-semibold">{user.firstName} {user.lastName}</div>
                                                            <div className="text-xs text-muted-foreground">{user.email}</div>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <Badge variant={user.isActive ? "secondary" : "destructive"}>
                                                        {user.isActive ? 'Active' : 'Deactivated'}
                                                    </Badge>
                                                    <Badge variant={perms.admin ? "default" : "secondary"}>
                                                        {perms.admin ? 'Admin' : 'User'}
                                                    </Badge>
                                                    <Badge variant="outline">{perms.pages.length} Access Points</Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="invite">
                    <div className="grid gap-8 lg:grid-cols-3 animate-in slide-in-from-right-4 duration-300">
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="border-border dark:border-gray-800 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Send className="w-5 h-5 text-blue-600" />
                                        Invite New User
                                    </CardTitle>
                                    <CardDescription>
                                        Send an invitation link to a team member's email address.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleInvite} className="space-y-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-foreground">Email Address</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="email"
                                                    placeholder="colleague@nibss-plc.com.ng"
                                                    className="pl-9 bg-background border-border"
                                                    type="email"
                                                    value={inviteEmail}
                                                    onChange={(e) => setInviteEmail(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <PermissionEditor
                                            permissions={invitePermissions}
                                            setPermissions={setInvitePermissions}
                                            teams={teams}
                                            role={inviteRole}
                                            setRole={handleInviteRoleChange}
                                        />

                                        <Button
                                            type="submit"
                                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:shadow-lg active:scale-[0.98]"
                                            disabled={inviteLoading || !inviteEmail}
                                        >
                                            {inviteLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                                            Generate Invite Link
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                        {/* Preview Card */}
                        <div className="space-y-6 hidden lg:block">
                            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-black dark:to-slate-900 text-white border-0 shadow-xl rounded-2xl relative overflow-hidden">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-blue-400" /> Access Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-slate-400 text-sm">Target</span> <span className="text-sm truncate max-w-[120px]">{inviteEmail || '---'}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-slate-400 text-sm">Pages</span> <Badge className="bg-blue-500/20 text-blue-300">{invitePermissions.pages.length}</Badge></div>
                                    <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-slate-400 text-sm">Role</span> <span className={cn("font-bold", inviteRole === 'Admin' ? "text-orange-400" : "text-green-400")}>{inviteRole}</span></div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Invite Result Dialog */}
            <Dialog open={!!inviteResult} onOpenChange={(open) => !open && setInviteResult(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600">
                            <Check className="w-6 h-6" /> Invite Link Ready
                        </DialogTitle>
                        <DialogDescription>Copy the link below to send to the user.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex gap-2">
                            <code className="flex-1 bg-muted p-3 rounded text-sm break-all">{inviteResult?.link}</code>
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(inviteResult?.link || '')}><Copy className="w-4 h-4" /></Button>
                        </div>
                        <Label>Email Template</Label>
                        <textarea className="w-full h-32 p-3 bg-muted border border-border rounded-md text-sm text-foreground" readOnly value={inviteResult?.template || ''} />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl">
                    <DialogHeader className="px-6 py-6 border-b border-border bg-background flex-shrink-0">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Shield className="w-5 h-5 text-green-600" />
                            Edit Permissions
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground mt-1">
                            Modifying access for <span className="font-bold text-foreground truncate">{editingUser?.firstName} {editingUser?.lastName}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-6 bg-muted/5 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30 transition-colors">
                        <PermissionEditor
                            permissions={editPermissions}
                            setPermissions={setEditPermissions}
                            teams={teams}
                            role={editRole}
                            setRole={handleEditRoleChange}
                        />
                    </div>

                    <DialogFooter className="px-6 py-4 border-t border-border bg-card flex-shrink-0 sm:flex-row justify-end space-x-3">
                        <Button variant="ghost" onClick={() => setEditingUser(null)} className="font-semibold text-muted-foreground hover:bg-muted/50">
                            Cancel
                        </Button>
                        <Button onClick={handleSavePermissions} disabled={savingEdit} className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 shadow-md transition-all active:scale-95">
                            {savingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Update User Access
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
