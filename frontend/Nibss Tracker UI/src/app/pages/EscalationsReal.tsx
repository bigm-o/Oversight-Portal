import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
    ArrowRight,
    GitBranch,
    Clock,
    CheckCircle,
    TrendingUp,
    Calendar as CalendarIcon,
    User,
    AlertCircle,
    ExternalLink,
    ChevronRight,
    ShieldAlert,
    Layers,
    Activity,
    Search,
    Zap,
    ShieldCheck,
    Ticket
} from 'lucide-react';
import { LoadingSpinner } from '@/app/components/ui/loading';
import { ErrorDisplay } from '@/app/components/ui/error';
import { apiService } from '@/services/apiService';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

export function EscalationsReal() {
    const [escalations, setEscalations] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [fromLevel, setFromLevel] = useState('All Levels');
    const [toLevel, setToLevel] = useState('All Levels');

    const [selectedEscalation, setSelectedEscalation] = useState<any>(null);
    const [journey, setJourney] = useState<any[]>([]);
    const [loadingJourney, setLoadingJourney] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(20);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params: any = {};
            if (fromLevel !== 'All Levels') params.fromLevel = fromLevel;
            if (toLevel !== 'All Levels') params.toLevel = toLevel;

            const [escalationsData, statsData] = await Promise.all([
                apiService.getEscalations(params),
                apiService.getEscalationStats(params)
            ]);

            setEscalations(escalationsData || []);
            setStats(statsData);
        } catch (err: any) {
            const msg = 'Failed to load escalation data. Please check if the backend is running.';
            setError(msg);
            if (escalations.length > 0) {
                toast.error(msg);
            }
            console.error('Escalation fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [fromLevel, toLevel]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Initial load and updates on fromLevel/toLevel changes.

    const fetchJourney = async (externalId: string) => {
        try {
            setLoadingJourney(true);
            const journeyData = await apiService.getEscalationJourney(externalId);
            setJourney(journeyData);
        } catch (err) {
            toast.error('Failed to load escalation journey');
            console.error('Journey fetch error:', err);
        } finally {
            setLoadingJourney(false);
        }
    };

    const handleEscalationClick = (escalation: any) => {
        setSelectedEscalation(escalation);
        setIsSheetOpen(true);
        fetchJourney(escalation.freshdeskId);
    };

    const getLevelConfig = (level: string) => {
        const configs: Record<string, { bg: string, text: string, border: string, dot: string, gradient: string }> = {
            'L1': {
                bg: 'bg-emerald-500/10',
                text: 'text-emerald-600 dark:text-emerald-400',
                border: 'border-emerald-200 dark:border-emerald-800/50',
                dot: 'bg-emerald-500',
                gradient: 'from-emerald-600 to-emerald-400'
            },
            'L2': {
                bg: 'bg-green-500/10',
                text: 'text-green-600 dark:text-green-400',
                border: 'border-green-200 dark:border-green-800/50',
                dot: 'bg-green-500',
                gradient: 'from-green-600 to-green-400'
            },
            'L3': {
                bg: 'bg-teal-500/10',
                text: 'text-teal-600 dark:text-teal-400',
                border: 'border-teal-200 dark:border-teal-800/50',
                dot: 'bg-teal-500',
                gradient: 'from-teal-600 to-teal-400'
            },
            'L4': {
                bg: 'bg-rose-500/10',
                text: 'text-rose-600 dark:text-rose-400',
                border: 'border-rose-200 dark:border-rose-800/50',
                dot: 'bg-rose-500',
                gradient: 'from-rose-600 to-rose-400'
            },
        };
        return configs[level] || {
            bg: 'bg-slate-500/10',
            text: 'text-slate-600 dark:text-slate-400',
            border: 'border-slate-200 dark:border-slate-800/50',
            dot: 'bg-slate-500',
            gradient: 'from-slate-600 to-slate-400'
        };
    };

    const filteredEscalations = escalations.filter(e =>
        e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.freshdeskId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.assignedTeam || e.team)?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && !escalations.length) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
            <LoadingSpinner />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Orchestrating escalation data...</p>
        </div>
    );

    if (error && !escalations.length) return (
        <div className="max-w-md mx-auto mt-20">
            <ErrorDisplay message={error} onRetry={fetchData} />
        </div>
    );

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12">
            {/* Standard Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-green-600" />
                        Escalation Tracking & Governance
                    </h1>
                    <p className="text-muted-foreground font-medium">Real-time monitoring of ticket movements and support level transitions</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-green-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="search ticket escalations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 w-64 rounded-lg bg-background border border-border text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all outline-none font-medium placeholder:text-slate-400 dark:placeholder:text-slate-400"
                        />
                    </div>

                    <Select value={fromLevel} onValueChange={setFromLevel}>
                        <SelectTrigger className="w-32 h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <SelectValue placeholder="From" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All Levels">From: All</SelectItem>
                            <SelectItem value="L1">Tier 1 (L1)</SelectItem>
                            <SelectItem value="L2">Tier 2 (L2)</SelectItem>
                            <SelectItem value="L3">Tier 3 (L3)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={toLevel} onValueChange={setToLevel}>
                        <SelectTrigger className="w-32 h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <SelectValue placeholder="To" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All Levels">To: All</SelectItem>
                            <SelectItem value="L1">Tier 1 (L1)</SelectItem>
                            <SelectItem value="L2">Tier 2 (L2)</SelectItem>
                            <SelectItem value="L3">Tier 3 (L3)</SelectItem>
                            <SelectItem value="L4">Tier 4 (L4)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {error && !escalations.length && <ErrorDisplay message={error} onRetry={fetchData} />}

            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-xl min-h-[400px]">
                        <LoadingSpinner />
                    </div>
                )}

                <div className={cn("space-y-8 transition-opacity duration-300", loading ? "opacity-30" : "opacity-100")}>


                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Escalations', value: stats?.totalEscalations || 0, icon: ShieldAlert, color: 'emerald', sub: 'Detected movements' },
                            { label: 'L4 Transitions', value: stats?.byLevel?.find((l: any) => l.level === 'L4')?.count || 0, icon: Zap, color: 'green', sub: 'Technical depth' },
                            { label: 'SLA Exceptions', value: stats?.slaBreached || 0, icon: AlertCircle, color: 'rose', sub: 'Priority required' },
                            { label: 'Awaiting L4 Response', value: escalations.filter((e: any) => e.escalationStatus === 'Awaiting L4').length, icon: Clock, color: 'teal', sub: 'Pending dev action' }
                        ].map((kpi, idx) => {
                            const colorMap: Record<string, string> = {
                                emerald: 'border-l-emerald-500 text-emerald-500',
                                green: 'border-l-green-500 text-green-500',
                                rose: 'border-l-rose-500 text-rose-500',
                                teal: 'border-l-teal-500 text-teal-500'
                            };
                            return (
                                <Card key={idx} className={cn("border-l-4 shadow-sm transition-all hover:shadow-md", colorMap[kpi.color])}>
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{kpi.label}</p>
                                                <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
                                                <p className="text-xs text-muted-foreground font-medium">{kpi.sub}</p>
                                            </div>
                                            <kpi.icon className="w-10 h-10 opacity-20" />
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Operational Matrix */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2 tracking-tight">
                                <ShieldCheck className="w-5 h-5 text-green-600" /> Operational Movement Matrix
                            </h3>
                            <Badge variant="outline" className="bg-muted/50 font-bold border-none text-muted-foreground">
                                {filteredEscalations.length} RECORDS FOUND
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {(() => {
                                const fromIdx = fromLevel !== 'All Levels' ? parseInt(fromLevel.replace('L', '')) : 0;
                                const toIdx = toLevel !== 'All Levels' ? parseInt(toLevel.replace('L', '')) : 0;
                                const isDeEscalation = fromIdx > 0 && toIdx > 0 && fromIdx > toIdx;

                                if (isDeEscalation) {
                                    return (
                                        <Card className="p-20 text-center border-dashed border-2 bg-rose-50/10 border-rose-200/50">
                                            <AlertCircle className="w-12 h-12 mx-auto text-rose-500 mb-4" />
                                            <p className="font-bold text-rose-600 dark:text-rose-400">The system does not show de-escalations, please pick other levels.</p>
                                        </Card>
                                    );
                                }

                                if (filteredEscalations.length === 0) {
                                    return (
                                        <Card className="p-20 text-center border-dashed border-2 bg-muted/5">
                                            <Layers className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                                            <p className="font-bold text-slate-500">No escalation movements detected in the system.</p>
                                        </Card>
                                    );
                                }

                                return (
                                    <>
                                        {filteredEscalations.slice(0, visibleCount).map((ticket, idx) => {
                                            const level = getLevelConfig(ticket.toLevel || ticket.supportLevel);
                                            return (
                                                <div
                                                    key={ticket.id}
                                                    onClick={() => handleEscalationClick(ticket)}
                                                    className="group relative flex flex-col md:flex-row items-center gap-6 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-green-500/50 dark:hover:border-green-500/50 hover:shadow-xl transition-all cursor-pointer animate-in slide-in-from-bottom-2 duration-300"
                                                    style={{ animationDelay: `${idx * 50}ms` }}
                                                >
                                                    {/* Left Accent */}
                                                    <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl hidden md:block", level.dot)} />

                                                    {/* ID & Source */}
                                                    <div className="flex-shrink-0 w-full md:w-32 flex flex-col gap-1 items-center md:items-start text-center md:text-left">
                                                        <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">{ticket.source}</span>
                                                        <Badge variant="outline" className="font-bold text-xs border-none bg-slate-100 dark:bg-slate-800 px-3 truncate max-w-full text-green-600 dark:text-green-500">
                                                            {ticket.freshdeskId}
                                                        </Badge>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0 flex flex-col items-center md:items-start">
                                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm md:text-base mb-1 group-hover:text-green-600 transition-colors truncate w-full text-center md:text-left">
                                                            {ticket.title}
                                                        </h4>
                                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                                            <div className="flex items-center text-xs text-slate-500 font-medium">
                                                                <Layers className="w-3.5 h-3.5 mr-1.5 text-green-600/70" /> {ticket.assignedTeam || ticket.team || 'No Team'}
                                                            </div>
                                                            <div className="flex items-center text-xs text-slate-500 font-medium">
                                                                <User className="w-3.5 h-3.5 mr-1.5" /> {ticket.assignedTo || 'Unassigned'}
                                                            </div>
                                                            <div className="flex items-center text-xs text-slate-400">
                                                                <Clock className="w-3.5 h-3.5 mr-1.5" />
                                                                {ticket.escalatedAt ? new Date(ticket.escalatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---')}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Badges */}
                                                    <div className="flex items-center gap-6 flex-wrap justify-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                                                <Badge className={cn("px-1.5 py-0 font-black text-[9px] border shadow-none", getLevelConfig(ticket.fromLevel).bg, getLevelConfig(ticket.fromLevel).text, getLevelConfig(ticket.fromLevel).border)}>
                                                                    {ticket.fromLevel || '??'}
                                                                </Badge>
                                                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                <Badge className={cn("px-1.5 py-0 font-black text-[9px] border shadow-none", getLevelConfig(ticket.toLevel).bg, getLevelConfig(ticket.toLevel).text, getLevelConfig(ticket.toLevel).border)}>
                                                                    {ticket.toLevel || '??'}
                                                                </Badge>
                                                            </div>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Level Transition</span>
                                                        </div>

                                                        <div className="flex flex-col items-center gap-1">
                                                            <Badge variant="outline" className={cn(
                                                                "font-bold text-[10px] px-3 py-1 border-2",
                                                                ticket.slaBreach
                                                                    ? "border-rose-500/20 text-rose-500 bg-rose-500/5"
                                                                    : "border-green-500/20 text-green-500 bg-green-500/5"
                                                            )}>
                                                                {ticket.slaBreach ? 'SLA VIOLATION' : 'SLA COMPLIANT'}
                                                            </Badge>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter text-center">Governance Status</span>
                                                        </div>

                                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-green-500 group-hover:translate-x-1 transition-all hidden md:block" />
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {filteredEscalations.length > visibleCount && (
                                            <div className="mt-8 flex justify-center">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setVisibleCount(prev => prev + 20)}
                                                    className="bg-white dark:bg-slate-900 border-green-500/30 text-green-600 hover:bg-green-50 hover:text-green-700 font-bold px-8 py-6 rounded-xl shadow-sm transition-all flex items-center gap-3"
                                                >
                                                    <TrendingUp className="w-4 h-4" />
                                                    Load More Movements ({filteredEscalations.length - visibleCount} remaining)
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Journey Side Sheet */}
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetContent className="sm:max-w-md md:max-w-lg lg:max-w-xl overflow-hidden flex flex-col bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 p-0 shadow-2xl">
                            <SheetHeader className="border-b pb-4 px-6 mt-6">
                                <div className="flex items-center justify-between">
                                    <SheetTitle className="text-2xl font-bold flex items-center gap-2 uppercase tracking-tight">
                                        <Ticket className="w-6 h-6 text-green-600" />
                                        {selectedEscalation?.freshdeskId}
                                    </SheetTitle>
                                    <Badge className="bg-green-600 text-white font-bold text-[10px] border-none shadow-lg shadow-green-500/20">
                                        {selectedEscalation?.source?.toUpperCase()}
                                    </Badge>
                                </div>
                                <SheetDescription className="text-base font-medium text-foreground mt-2 leading-relaxed">
                                    {selectedEscalation?.title}
                                </SheetDescription>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                                {/* Meta Info Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-muted/30 dark:bg-slate-900 rounded-xl border border-border">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-bold">Current Level</p>
                                        <p className="text-xl font-bold text-green-600 dark:text-green-500 flex items-center gap-2">
                                            {selectedEscalation?.supportLevel}
                                        </p>
                                    </div>
                                    <div className={cn(
                                        "p-4 rounded-xl border font-bold",
                                        selectedEscalation?.slaBreach
                                            ? "bg-rose-500/10 border-rose-500/20 text-rose-500"
                                            : "bg-green-500/10 border-green-500/20 text-green-500"
                                    )}>
                                        <p className="text-[10px] uppercase tracking-wider mb-1 opacity-70">Governance Status</p>
                                        <p className="text-xl">
                                            {selectedEscalation?.slaBreach ? 'BREACHED' : 'COMPLIANT'}
                                        </p>
                                    </div>
                                </div>

                                {/* Description Section */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                                        Description
                                    </h4>
                                    <div className="p-5 bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-600 dark:text-slate-400 max-h-60 overflow-y-auto whitespace-pre-wrap shadow-inner ring-1 ring-black/5">
                                        {selectedEscalation?.description || "No description provided."}
                                    </div>
                                </div>

                                {/* Detailed Meta */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                                        <User className="w-4 h-4 text-green-600" />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Assigned To</p>
                                            <p className="text-sm font-semibold">{selectedEscalation?.assignedTo || 'Unassigned'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                                        <Clock className="w-4 h-4 text-teal-600" />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Detected At</p>
                                            <p className="text-sm font-semibold">
                                                {selectedEscalation?.createdAt ? new Date(selectedEscalation.createdAt).toLocaleString() : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-green-600" /> Escalation History
                                        </h4>
                                    </div>

                                    {loadingJourney ? (
                                        <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                            <LoadingSpinner />
                                            <p className="text-xs font-bold text-slate-400 uppercase">Extracting history...</p>
                                        </div>
                                    ) : journey.length === 0 ? (
                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-12 text-center border border-dashed text-muted-foreground">
                                            <Clock className="w-10 h-10 mx-auto mb-4 opacity-20" />
                                            <p className="text-xs font-bold uppercase tracking-widest">No previous movements</p>
                                        </div>
                                    ) : (
                                        <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-green-500 before:to-slate-200 dark:before:to-slate-800">
                                            {journey.map((move, index) => {
                                                const config = getLevelConfig(move.toLevel);
                                                return (
                                                    <div key={index} className="relative pl-10 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                                                        <div className={cn(
                                                            "absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white dark:border-slate-950 flex items-center justify-center z-10 shadow-lg",
                                                            index === 0 ? "bg-green-600" : "bg-slate-300 dark:bg-slate-700"
                                                        )} />

                                                        <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-border hover:border-green-500/30 transition-all">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="px-2 py-0.5 rounded text-[8px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                                        {move.fromLevel || 'INIT'}
                                                                    </div>
                                                                    <ArrowRight className="w-2 h-2 text-slate-300" />
                                                                    <div className={cn("px-2 py-0.5 rounded text-[8px] font-bold uppercase", config.bg, config.text)}>
                                                                        {move.toLevel}
                                                                    </div>
                                                                </div>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                                    {new Date(move.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>

                                                            <div className="text-xs font-bold text-foreground flex items-center gap-2 mb-2">
                                                                <span className="opacity-60">{move.fromStatus}</span>
                                                                <ArrowRight className="w-3 h-3 opacity-30" />
                                                                <span className="text-green-600 dark:text-green-500">{move.toStatus}</span>
                                                            </div>

                                                            <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                <div className="flex items-center gap-1.5">
                                                                    <User className="w-2.5 h-2.5" /> {move.changedBy || 'SYSTEM'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 py-6 border-t mt-auto flex gap-2 bg-slate-50 dark:bg-slate-900/50">
                                <Button variant="outline" className="flex-1 font-bold py-6 rounded-xl" onClick={() => setIsSheetOpen(false)}>Close</Button>
                                <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-green-500/20 transition-all"
                                    onClick={() => window.open(`https://nibssplc.freshservice.com/a/tickets/${selectedEscalation?.freshdeskId}`, '_blank')}
                                >
                                    Open Platform <ExternalLink className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </div>
    );
}
