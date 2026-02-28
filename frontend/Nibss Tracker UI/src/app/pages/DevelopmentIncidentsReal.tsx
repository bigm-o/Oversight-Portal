import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
    ArrowRight,
    Clock,
    TrendingUp,
    Calendar as CalendarIcon,
    User,
    AlertCircle,
    ExternalLink,
    ChevronRight,
    ChevronDown,
    ShieldAlert,
    Layers,
    Activity,
    Search,
    Zap,
    ShieldCheck,
    Ticket,
    Terminal,
    Code2,
    Cpu
} from 'lucide-react';
import { LoadingSpinner } from '@/app/components/ui/loading';
import { ErrorDisplay } from '@/app/components/ui/error';
import { apiService } from '@/services/apiService';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

export function DevelopmentIncidentsReal() {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [teamFilter, setTeamFilter] = useState('ALL TEAMS');
    const [linkFilter, setLinkFilter] = useState('ALL STATUS');
    const [visibleCount, setVisibleCount] = useState(10);
    const [syncing, setSyncing] = useState(false);

    const [selectedIncident, setSelectedIncident] = useState<any>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [allTeams, setAllTeams] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [data, teamsData] = await Promise.all([
                apiService.getDevelopmentIncidents(),
                apiService.getTeams()
            ]);
            setIncidents(data);
            setAllTeams(teamsData as any[]);
        } catch (err) {
            setError('Failed to load development incidents. Please check connection to backend.');
            console.error('L4 fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTeamReassign = async (incidentId: number, newTeam: string) => {
        try {
            await apiService.updateDevelopmentIncidentTeam(incidentId, newTeam);
            toast.success(`Incident reassigned to ${newTeam}`);
            setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, team: newTeam } : i));
            if (selectedIncident?.id === incidentId) {
                setSelectedIncident((prev: any) => ({ ...prev, team: newTeam }));
            }
        } catch (err) {
            toast.error('Failed to reassign team');
            console.error('Reassign error:', err);
        }
    };

    const handleLevelReassign = async (incidentId: number, newLevel: string) => {
        try {
            await apiService.updateDevelopmentIncidentLevel(incidentId, newLevel);
            toast.success(`Incident reassigned from L4 to ${newLevel}`);
            // Remove the incident from the list since it's no longer L4
            setIncidents(prev => prev.filter(i => i.id !== incidentId));
            setIsSheetOpen(false);
            setSelectedIncident(null);
        } catch (err) {
            toast.error('Failed to reassign incident level');
            console.error('Level reassign error:', err);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSync = async () => {
        try {
            setSyncing(true);
            toast.loading('Synchronizing L4 incidents from Freshservice and mapping to JIRA...', { id: 'sync-l4' });
            await apiService.syncDevelopmentIncidents();
            toast.success('Sync complete! Matrix updated.', { id: 'sync-l4' });
            fetchData();
        } catch (err) {
            toast.error('Sync failed. Terminal script might have timed out or failed.', { id: 'sync-l4' });
            console.error('Sync error:', err);
        } finally {
            setSyncing(false);
        }
    };

    const handleIncidentClick = (incident: any) => {
        setSelectedIncident(incident);
        setIsSheetOpen(true);
    };

    const filteredIncidents = incidents.filter(i => {
        const matchesSearch =
            i.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.freshdeskId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.jiraKey?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.team?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.assignedTo?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesTeam = teamFilter === 'ALL TEAMS' ||
            (i.team?.toUpperCase() === teamFilter.toUpperCase()) ||
            (!i.team && teamFilter === 'UNALLOCATED');
        const matchesLink = linkFilter === 'ALL STATUS' ||
            (linkFilter === 'LINKED' && i.jiraKey) ||
            (linkFilter === 'UNLINKED' && !i.jiraKey);

        return matchesSearch && matchesTeam && matchesLink;
    });

    const teams = Array.from(new Set(incidents.map(i => {
        if (!i.team) return 'UNALLOCATED';
        const n = i.team.trim();
        const upper = n.toUpperCase();

        if (upper === 'DATA & IDENTITY' || upper === 'DATA AND IDENTITY' || upper === 'IDENTITY') return 'Data & Identity';
        if (upper === 'COLLECTIONS') return 'Collections';
        if (upper === 'CORE SWITCHING' || upper === 'CORE' || upper === 'SWITCHING') return 'Core Switching';
        if (upper === 'ENTERPRISE SOLUTIONS' || upper === 'ENTERPRISE') return 'Enterprise Solutions';

        return n;
    }))).sort();

    const stats = {
        total: incidents.length,
        assigned: incidents.filter(i => i.assignedTo && i.assignedTo !== 'Unassigned').length,
        unassigned: incidents.filter(i => !i.assignedTo || i.assignedTo === 'Unassigned').length,
        breached: incidents.filter(i => i.slaBreach).length,
        critical: incidents.filter(i => i.priority?.toLowerCase() === 'high' || i.priority?.toLowerCase() === 'urgent' || i.priority?.toLowerCase() === 'critical').length,
        jiraLinked: incidents.filter(i => i.jiraKey).length
    };

    if (loading && !incidents.length) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
            <LoadingSpinner />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Accessing L4 development matrix...</p>
        </div>
    );

    if (error && !incidents.length) return (
        <div className="max-w-md mx-auto mt-20">
            <ErrorDisplay message={error} onRetry={fetchData} />
        </div>
    );

    return (
        <div className="space-y-4 sm:space-y-8 max-w-7xl mx-auto pb-12 px-1">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-3 uppercase tracking-tight">
                        <Terminal className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                        Dev Incidents <span className="text-emerald-600">(L4)</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium ml-11">Critical support tickets requiring high-level technical intervention</p>
                </div>

                <Button
                    onClick={handleSync}
                    disabled={syncing || loading}
                    variant="outline"
                    className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-600 hover:text-white transition-all gap-2"
                >
                    <Cpu className={cn("w-4 h-4", syncing && "animate-spin")} />
                    {syncing ? 'SYNCING...' : 'SYNC MATRIX'}
                </Button>
            </div>

            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-xl min-h-[400px]">
                        <LoadingSpinner />
                    </div>
                )}

                <div className={cn("space-y-4 sm:space-y-8 transition-opacity duration-300", loading ? "opacity-30" : "opacity-100")}>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Active L4', value: stats.total, icon: Cpu, color: 'border-l-emerald-600', textColor: 'text-emerald-600' },
                            { label: 'JIRA Linked', value: stats.jiraLinked, icon: Ticket, color: 'border-l-emerald-500', textColor: 'text-emerald-500' },
                            { label: 'Critical', value: stats.critical, icon: ShieldAlert, color: 'border-l-rose-600', textColor: 'text-rose-600' },
                            { label: 'SLA Breached', value: stats.breached, icon: AlertCircle, color: 'border-l-orange-500', textColor: 'text-orange-600' }
                        ].map((kpi, idx) => (
                            <Card key={idx} className={cn("border-l-4 shadow-sm transition-all hover:scale-[1.02]", kpi.color)}>
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">{kpi.label}</p>
                                            <div className="flex items-baseline gap-1">
                                                <p className={cn("text-2xl sm:text-3xl font-black", kpi.textColor)}>{kpi.value}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground">Tickets</p>
                                            </div>
                                        </div>
                                        <kpi.icon className={cn("w-8 h-8 opacity-20", kpi.textColor)} />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Filters and Search Bar Section */}
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-900/40 p-5 rounded-2xl border border-border shadow-sm">
                        <div className="flex flex-1 items-center gap-3 w-full">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search by ID, Title, or Engineer..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none shadow-sm"
                                />
                            </div>

                            <div className="relative">
                                <select
                                    value={teamFilter}
                                    onChange={(e) => setTeamFilter(e.target.value)}
                                    className="appearance-none pl-3 pr-10 py-2.5 rounded-xl bg-background border border-border text-xs font-bold text-slate-500 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer min-w-[160px] shadow-sm"
                                >
                                    <option>ALL TEAMS</option>
                                    {teams.map(t => (
                                        <option key={t}>{t}</option>
                                    ))}
                                </select>
                                <Layers className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <select
                                    value={linkFilter}
                                    onChange={(e) => setLinkFilter(e.target.value)}
                                    className="appearance-none pl-3 pr-10 py-2.5 rounded-xl bg-background border border-border text-xs font-bold text-slate-500 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer min-w-[160px] shadow-sm"
                                >
                                    <option>ALL STATUS</option>
                                    <option value="LINKED">IDENTIFIED IN JIRA</option>
                                    <option value="UNLINKED">PENDING JIRA</option>
                                </select>
                                <Zap className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Matrix View */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2 tracking-tight">
                                <Code2 className="w-5 h-5 text-emerald-600" /> Technical Intervention Matrix
                            </h3>
                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 font-bold border-none text-emerald-600">
                                {filteredIncidents.length} RECORDS FOUND
                            </Badge>
                        </div>

                        <div className="space-y-3">
                            {filteredIncidents.length === 0 ? (
                                <Card className="p-20 text-center border-dashed border-2 bg-muted/5">
                                    <Layers className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                                    <p className="font-bold text-slate-500">No L4 technical incidents found matching your search.</p>
                                </Card>
                            ) : (
                                <>
                                    {filteredIncidents.slice(0, visibleCount).map((ticket: any, idx: number) => (
                                        <div
                                            key={ticket.id}
                                            onClick={() => handleIncidentClick(ticket)}
                                            className={cn(
                                                "group relative flex flex-col md:flex-row items-center gap-6 p-4 bg-white dark:bg-slate-900 rounded-xl border transition-all cursor-pointer animate-in slide-in-from-bottom-2 duration-300",
                                                ticket.jiraKey
                                                    ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/10 dark:bg-emerald-950/5 hover:border-emerald-500 shadow-emerald-500/5"
                                                    : "border-slate-200 dark:border-slate-800 hover:border-emerald-500/50"
                                            )}
                                            style={{ animationDelay: `${idx * 20}ms` }}
                                        >
                                            {/* Left Accent */}
                                            <div className={cn(
                                                "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl hidden md:block",
                                                ticket.jiraKey ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                                            )} />

                                            {/* ID & Source */}
                                            <div className="flex-shrink-0 w-full md:w-32 flex flex-col gap-1 items-center md:items-start text-center md:text-left">
                                                <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">{ticket.source}</span>
                                                <Badge variant="outline" className={cn(
                                                    "font-bold text-xs border-none px-3 truncate max-w-full",
                                                    ticket.jiraKey
                                                        ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                )}>
                                                    #{ticket.freshdeskId}
                                                </Badge>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 flex flex-col items-center md:items-start">
                                                <div className="flex items-center gap-2 mb-1 w-full justify-center md:justify-start">
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm md:text-base group-hover:text-emerald-600 transition-colors truncate">
                                                        {ticket.title}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        {ticket.jiraKey && (
                                                            <Zap className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500 animate-pulse" />
                                                        )}
                                                        {(ticket.priority?.toLowerCase() === 'high' || ticket.priority?.toLowerCase() === 'urgent' || ticket.priority?.toLowerCase() === 'critical') && (
                                                            <ShieldAlert className="w-3.5 h-3.5 text-red-500 fill-red-500/10" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                                    <div className="flex items-center text-xs text-slate-500 font-medium font-mono">
                                                        <Layers className="w-3.5 h-3.5 mr-1.5 text-emerald-600/70" /> {ticket.team || 'UNALLOCATED'}
                                                    </div>
                                                    <div className="flex items-center text-xs text-slate-500 font-medium">
                                                        <User className="w-3.5 h-3.5 mr-1.5" /> {ticket.assignedTo || 'Unassigned'}
                                                    </div>
                                                    {ticket.jiraKey && (
                                                        <div className="flex items-center text-xs text-emerald-700 font-bold bg-emerald-100/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                                                            ID: {ticket.jiraKey}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center text-xs text-slate-400">
                                                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                                                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'N/A'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Badges */}
                                            <div className="flex items-center gap-6 flex-wrap justify-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Badge className={cn(
                                                        "font-bold text-[10px] px-3 py-1 border-2 whitespace-nowrap shadow-sm",
                                                        !ticket.jiraKey
                                                            ? "border-amber-500/20 text-amber-500 bg-amber-500/5"
                                                            : (ticket.jiraStatus?.toLowerCase() === 'done' || ticket.jiraStatus?.toLowerCase() === 'closed')
                                                                ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/10"
                                                                : "border-blue-500/20 text-blue-500 bg-blue-500/5"
                                                    )}>
                                                        {ticket.jiraKey ? (ticket.jiraStatus?.toUpperCase() || 'LINKED') : 'PENDING JIRA'}
                                                    </Badge>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">L4 LIFECYCLE</span>
                                                </div>

                                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all hidden md:block" />
                                            </div>
                                        </div>
                                    ))}

                                    {filteredIncidents.length > visibleCount && (
                                        <div className="mt-8 flex justify-center">
                                            <Button
                                                variant="outline"
                                                onClick={() => setVisibleCount(prev => prev + 10)}
                                                className="bg-white dark:bg-slate-900 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-bold px-8 py-6 rounded-xl shadow-sm transition-all flex items-center gap-3"
                                            >
                                                <TrendingUp className="w-4 h-4" />
                                                View More Incidents ({filteredIncidents.length - visibleCount} remaining)
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Offcanvas Details */}
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetContent className="sm:max-w-md md:max-w-lg lg:max-w-xl overflow-hidden flex flex-col bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 p-0 shadow-2xl">
                            <SheetHeader className="border-b pb-4 px-6 mt-6">
                                <div className="flex items-center justify-between">
                                    <SheetTitle className="text-2xl font-bold flex items-center gap-2 uppercase tracking-tight">
                                        <Terminal className="w-6 h-6 text-emerald-600" />
                                        #{selectedIncident?.freshdeskId}
                                    </SheetTitle>
                                    <Badge className={cn(
                                        "font-bold text-[10px] border-none shadow-lg",
                                        selectedIncident?.jiraKey ? "bg-emerald-600 shadow-emerald-500/20" : "bg-emerald-600 shadow-emerald-500/20"
                                    )}>
                                        {selectedIncident?.jiraKey ? 'JIRA ESCALATED' : 'FRESHSERVICE L4'}
                                    </Badge>
                                </div>
                                <SheetDescription className="text-base font-medium text-foreground mt-2 leading-relaxed">
                                    {selectedIncident?.title}
                                </SheetDescription>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                                {/* Status Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-muted/30 dark:bg-slate-900 rounded-xl border border-border">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-bold">FS Status</p>
                                        <p className="text-xl font-bold text-emerald-600">
                                            {selectedIncident?.freshserviceStatus || 'Awaiting L4'}
                                        </p>
                                    </div>
                                    <div className={cn(
                                        "p-4 rounded-xl border font-bold",
                                        selectedIncident?.jiraKey ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" : "bg-amber-500/5 border-amber-500/20 text-amber-600"
                                    )}>
                                        <p className="text-[10px] uppercase tracking-wider mb-1 opacity-70">JIRA Status</p>
                                        <p className="text-xl">
                                            {selectedIncident?.jiraKey ? (selectedIncident.jiraStatus || 'In Progress') : 'Pending Link'}
                                        </p>
                                    </div>
                                </div>

                                {/* Detailed Meta */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                                        <User className="w-4 h-4 text-emerald-600" />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Assigned Engineer</p>
                                            <p className="text-sm font-semibold">{selectedIncident?.assignedTo || 'UNASSIGNED'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                                        <Layers className="w-4 h-4 text-emerald-600" />
                                        <div className="flex-1">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Technical Team</p>
                                            <div className="relative group mt-0.5">
                                                <select
                                                    className="text-sm font-bold bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-lg px-3 py-1.5 cursor-pointer text-emerald-600 focus:ring-2 focus:ring-emerald-500/20 w-full appearance-none pr-8 transition-all hover:border-emerald-300"
                                                    value={selectedIncident?.team || 'Unknown'}
                                                    onChange={(e) => handleTeamReassign(selectedIncident.id, e.target.value)}
                                                >
                                                    <option value="Unknown">Unknown Team</option>
                                                    {allTeams.map((t: any) => (
                                                        <option key={t.id} value={t.name}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-emerald-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-110 transition-transform" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-card border border-amber-200 dark:border-amber-900/50 rounded-xl shadow-sm bg-amber-50/30 dark:bg-amber-950/10">
                                        <Terminal className="w-4 h-4 text-amber-600" />
                                        <div className="flex-1">
                                            <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold">Reassign From L4</p>
                                            <div className="relative group mt-0.5">
                                                <select
                                                    className="text-sm font-bold bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-lg px-3 py-1.5 cursor-pointer text-amber-600 focus:ring-2 focus:ring-amber-500/20 w-full appearance-none pr-8 transition-all hover:border-amber-300"
                                                    defaultValue=""
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            handleLevelReassign(selectedIncident.id, e.target.value);
                                                        }
                                                    }}
                                                >
                                                    <option value="">Select Level...</option>
                                                    <option value="L1">L1 - Contact Center</option>
                                                    <option value="L2">L2 - Service Owners</option>
                                                    <option value="L3">L3 - App Support</option>
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-amber-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-110 transition-transform" />
                                            </div>
                                            <p className="text-[9px] text-amber-600/70 dark:text-amber-400/70 mt-1.5 font-medium">Reassign this ticket away from L4 (it will disappear from this dashboard)</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                                        <ShieldAlert className={cn(
                                            "w-4 h-4",
                                            (selectedIncident?.priority?.toLowerCase() === 'high' || selectedIncident?.priority?.toLowerCase() === 'urgent' || selectedIncident?.priority?.toLowerCase() === 'critical') ? "text-red-500" : "text-emerald-600"
                                        )} />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Severity Level</p>
                                            <p className={cn(
                                                "text-sm font-semibold",
                                                (selectedIncident?.priority?.toLowerCase() === 'high' || selectedIncident?.priority?.toLowerCase() === 'urgent' || selectedIncident?.priority?.toLowerCase() === 'critical') ? "text-red-600" : ""
                                            )}>
                                                {selectedIncident?.priority?.toUpperCase() || 'NORMAL'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                                        <Clock className="w-4 h-4 text-emerald-600" />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Detection Date</p>
                                            <p className="text-sm font-semibold">
                                                {selectedIncident?.createdAt ? new Date(selectedIncident.createdAt).toLocaleString() : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                                        <ShieldCheck className={cn("w-4 h-4", selectedIncident?.slaBreach ? "text-red-500" : "text-emerald-600")} />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">SLA Performance</p>
                                            <p className={cn("text-sm font-semibold", selectedIncident?.slaBreach ? "text-red-600" : "text-emerald-600")}>
                                                {selectedIncident?.slaBreach ? 'BREACHED' : 'WITHIN TARGET'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Ticket Context / Description */}
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-border">
                                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-emerald-500" /> Issue Context & Details
                                    </h4>
                                    <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-wrap">
                                            {selectedIncident?.description || "No technical description provided. This is an L4 escalation requiring architectural review and technical resolution from the assigned development team."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-6 border-t mt-auto flex gap-2 bg-slate-50 dark:bg-slate-900/50">
                                <Button variant="outline" className="flex-1 font-bold py-6 rounded-xl" onClick={() => setIsSheetOpen(false)}>Close</Button>
                                <Button
                                    className={cn(
                                        "flex-1 text-white font-bold py-6 rounded-xl shadow-lg transition-all",
                                        "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                                    )}
                                    onClick={() => window.open(selectedIncident?.jiraKey
                                        ? `https://nibss.atlassian.net/browse/${selectedIncident?.jiraKey}`
                                        : `https://nibssplc.freshservice.com/a/tickets/${selectedIncident?.freshdeskId}`, '_blank')}
                                >
                                    Open {selectedIncident?.jiraKey ? 'JIRA' : 'Freshservice'} <ExternalLink className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </div>
    );
}
