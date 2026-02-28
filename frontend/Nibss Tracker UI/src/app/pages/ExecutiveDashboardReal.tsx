import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { TrendingUp, AlertCircle, CheckCircle, Clock, Users, Shield, Database, Calendar as CalendarIcon, Filter, LayoutDashboard, Zap, Activity, Info } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/ui/loading';
import { ErrorDisplay } from '@/app/components/ui/error';
import { apiService } from '@/services/apiService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, AreaChart, Area, Legend, Cell, PieChart, Pie
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/app/components/ui/dialog';
import { Calendar } from '@/app/components/ui/calendar';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';

const COLORS = ['#166534', '#16a34a', '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
const STATUS_COLORS = [
  '#94a3b8', '#3b82f6', '#f43f5e', '#6366f1', '#06b6d4', '#0ea5e9',
  '#f59e0b', '#f97316', '#14b8a6', '#8b5cf6', '#a855f7', '#10b981', '#ef4444'
];

const normalizeTeamName = (team: string | null) => {
  if (!team) return 'Unassigned';
  const n = team.trim();
  const upper = n.toUpperCase();

  if (upper === 'DATA & IDENTITY' || upper === 'DATA AND IDENTITY' || upper === 'IDENTITY' || upper.includes('DATA & IDENTITY')) return 'Data & Identity';
  if (upper === 'COLLECTIONS' || upper.includes('COLLECTIONS') || upper === 'PAYMENT' || upper === 'NDD') return 'Collections';
  if (upper === 'CORE SWITCHING' || upper === 'CORE' || upper === 'SWITCHING' || upper.includes('CORE SWITCH')) return 'Core Switching';
  if (upper === 'ENTERPRISE SOLUTIONS' || upper === 'ENTERPRISE' || upper.includes('ENTERPRISE SOLUTIONS') || upper === 'ES' || upper === 'ENT SOL') return 'Enterprise Solutions';

  return n;
};

export function ExecutiveDashboardReal() {
  const [devTickets, setDevTickets] = useState<any[]>([]);
  const [governanceTickets, setGovernanceTickets] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const { theme } = useTheme();

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(undefined);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(undefined);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#9ca3af' : '#4b5563';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#fff',
    borderRadius: '12px',
    border: '1px solid ' + (isDark ? '#1e293b' : '#e2e8f0'),
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();

      const [devData, govData, escData, teamsData, projectsData] = await Promise.all([
        apiService.getTickets(params) as Promise<any[]>,
        apiService.getGovernanceCockpit(params) as Promise<any>,
        apiService.getEscalations(params) as Promise<any[]>,
        apiService.getTeams() as Promise<any[]>,
        apiService.getProjects() as Promise<any>
      ]);

      setDevTickets(devData);
      setGovernanceTickets(govData.items || govData || []);
      setEscalations(escData);
      setTeams(teamsData);
      setProjects(projectsData.items || projectsData || []);
      setFetchCount(prev => prev + 1);
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load executive data.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApplyFilters = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setIsDateModalOpen(false);
  };

  const handleResetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setIsDateModalOpen(false);
  };

  useEffect(() => {
    // Sync temp dates when main dates change
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  }, [startDate, endDate]);

  // KPI Calculations
  const totalDevTickets = devTickets.length;
  const completedDevTickets = devTickets.filter(t => [11, 'Live', 'Done', 'Completed'].includes(t.status)).length;
  const devProgress = totalDevTickets > 0 ? Math.round((completedDevTickets / totalDevTickets) * 100) : 0;

  const totalEscalationsCount = escalations.length;

  const serviceRequests = governanceTickets.filter(i => i.ticketType === 'Service Request' || !i.ticketType);
  const slaBreaches = serviceRequests.filter(i => i.slaBreach).length;
  const slaCompliance = serviceRequests.length > 0 ? Math.round((1 - (slaBreaches / serviceRequests.length)) * 100) : 100;

  // CHART DATA PREPARATION

  // 1. Team Distribution (Combined Dev + Governance)
  const combinedTeamData = useMemo(() => {
    const teamMap: Record<string, { dev: number; gov: number; name: string }> = {};

    devTickets.forEach(t => {
      const team = normalizeTeamName(t.team);
      if (!teamMap[team]) teamMap[team] = { dev: 0, gov: 0, name: team };
      teamMap[team].dev++;
    });

    governanceTickets.forEach(t => {
      const team = normalizeTeamName(t.team);
      if (!teamMap[team]) teamMap[team] = { dev: 0, gov: 0, name: team };
      teamMap[team].gov++;
    });

    return Object.values(teamMap).sort((a, b) => (b.dev + b.gov) - (a.dev + a.gov));
  }, [devTickets, governanceTickets]);

  // 2. Source Volume Breakdown (Pie)
  const sourceVolumeData = [
    { name: 'Development', value: devTickets.length, color: '#3b82f6' },
    { name: 'Incidents & SR', value: governanceTickets.length, color: '#f59e0b' }
  ];

  // 3. Dev Status Distribution (from Analytics page)
  const devStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    devTickets.forEach(t => {
      const status = String(t.statusLabel || t.status || 'Unknown');
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [devTickets]);

  // 4. Governance Group Distribution (from SLA page)
  const groupDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    governanceTickets.forEach(i => {
      const group = normalizeTeamName(i.team);
      counts[group] = (counts[group] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [governanceTickets]);

  // 5. Stability vs Velocity (Modified Combined)
  const stabilityVelocityData = useMemo(() => {
    // Filter out Unassigned for the trend chart as requested
    return combinedTeamData.filter(d => d.name !== 'Unassigned').slice(0, 10);
  }, [combinedTeamData]);

  const getStatusLabel = (status: any) => {
    const map: any = {
      0: 'To Do', 1: 'In Progress', 2: 'Blocked', 3: 'Review',
      4: 'DevOps', 5: 'Ready to Test', 6: 'QA Test', 7: 'Security Testing', 8: 'UAT',
      9: 'CAB Ready', 10: 'Production Ready', 11: 'Live', 12: 'Rollback'
    };

    if (typeof status === 'number') return map[status] || 'Unknown';
    if (typeof status === 'string') {
      const s = status.toUpperCase().trim();
      if (map[s]) return map[s];

      // Try matching the numeric string
      const num = parseInt(s, 10);
      if (!isNaN(num) && map[num]) return map[num];

      // Handle enum names like "READY_TO_TEST" -> "Ready to Test"
      const nameMap: any = {
        'TODO': 'To Do', 'IN_PROGRESS': 'In Progress', 'BLOCKED': 'Blocked',
        'REVIEW': 'Review', 'DEVOPS': 'DevOps', 'READY_TO_TEST': 'Ready to Test',
        'QA_TEST': 'QA Test', 'SECURITY_TESTING': 'Security Testing', 'UAT': 'UAT',
        'CAB_READY': 'CAB Ready', 'PRODUCTION_READY': 'Production Ready',
        'LIVE': 'Live', 'ROLLBACK': 'Rollback', 'DONE': 'Live'
      };
      return nameMap[s] || s;
    }

    return 'Unknown';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-1">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-emerald-600" />
            Executive Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">Holistic view of engineering velocity and operational stability</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 tracking-widest uppercase">Live Governance Matrix</span>
          </div>

          <Dialog open={isDateModalOpen} onOpenChange={setIsDateModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm h-10 px-4">
                <CalendarIcon className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-sm">
                  {startDate && endDate ? `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}` : 'Filter Date Range'}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Select Date Range</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Start Date</span>
                  <Calendar mode="single" selected={tempStartDate} onSelect={setTempStartDate} initialFocus className="rounded-md border border-slate-200 dark:border-slate-800" />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">End Date</span>
                  <Calendar mode="single" selected={tempEndDate} onSelect={setTempEndDate} className="rounded-md border border-slate-200 dark:border-slate-800" />
                </div>
              </div>
              <DialogFooter className="flex flex-row justify-between items-center sm:justify-between">
                <Button variant="ghost" onClick={handleResetFilters} className="text-xs font-bold uppercase tracking-widest text-rose-500 hover:text-rose-600 hover:bg-rose-50">Reset All</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDateModalOpen(false)} className="text-xs font-bold uppercase tracking-widest">Cancel</Button>
                  <Button onClick={handleApplyFilters} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest">Apply Range</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading && fetchCount === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground animate-pulse">Aggregated data across ecosystems...</p>
        </div>
      ) : (
        <div className={cn("space-y-8 transition-all duration-500", loading ? "opacity-50 blur-[1px]" : "opacity-100")}>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Total Dev Tickets</p>
                  <Zap className="w-5 h-5 text-blue-500 opacity-50" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-foreground">{totalDevTickets}</h3>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase tracking-tighter">Active Pipeline</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Success Rate</p>
                  <CheckCircle className="w-5 h-5 text-emerald-500 opacity-50" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-emerald-600">{devProgress}%</h3>
                </div>
                <div className="mt-4 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${devProgress}%` }} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-600 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Escalations</p>
                  <TrendingUp className="w-5 h-5 text-indigo-500 opacity-50" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-foreground">{totalEscalationsCount}</h3>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 text-[9px] font-black uppercase tracking-widest">Critical Path</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">SLA Compliance</p>
                  <Shield className="w-5 h-5 text-amber-500 opacity-50" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-amber-600">{slaCompliance}%</h3>
                </div>
                <div className="mt-4 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${slaCompliance}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Workload Heatmaps Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm border border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50 py-4">
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Development Workload</CardTitle>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">Active engineering load per team</p>
                </div>
                <Badge variant="secondary" className="bg-blue-600/10 text-blue-600 font-black text-[9px] uppercase">Dev Pipeline</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={combinedTeamData.filter(d => d.dev > 0)} margin={{ top: 20, right: 30, left: 10, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 10, fontWeight: 'bold' }} angle={-45} textAnchor="end" height={60} />
                      <YAxis stroke={textColor} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: isDark ? '#1e293b' : '#f1f5f9' }}
                        formatter={(value: any) => [`${value} Tickets`, 'Development']}
                      />
                      <Bar dataKey="dev" name="Development" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50 py-4">
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Governance & Operations</CardTitle>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">I&SR and Operational Workload</p>
                </div>
                <Badge variant="secondary" className="bg-amber-600/10 text-amber-600 font-black text-[9px] uppercase">Ops Matrix</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={combinedTeamData.filter(d => d.gov > 0)} margin={{ top: 20, right: 30, left: 10, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 10, fontWeight: 'bold' }} angle={-45} textAnchor="end" height={60} />
                      <YAxis stroke={textColor} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: isDark ? '#1e293b' : '#f1f5f9' }}
                        formatter={(value: any) => [`${value} Requests`, 'Governance (I&SR)']}
                      />
                      <Bar dataKey="gov" name="Governance (I&SR)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Volume Mix */}
            <Card className="shadow-sm border border-border/50 rounded-2xl flex flex-col overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50 py-4">
                <CardTitle className="text-lg font-black text-center uppercase tracking-tight">Volume Mix</CardTitle>
                <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest font-black mt-0.5">Dev vs Ops Contribution</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceVolumeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={105}
                        paddingAngle={8}
                        dataKey="value"
                        isAnimationActive={true}
                        animationDuration={1500}
                        stroke="none"
                      >
                        {sourceVolumeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => {
                          const total = sourceVolumeData.reduce((acc, cur) => acc + cur.value, 0);
                          const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return [`${percent}%`, name];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4 w-full px-4 border-t border-border/40 pt-4">
                  {sourceVolumeData.map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-black uppercase tracking-tighter">{item.name}</span>
                      </div>
                      <p className="text-lg font-black">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Dev Status Distribution */}
            <Card className="shadow-sm border border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50 py-4">
                <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                  <Zap className="w-5 h-5 text-blue-500" />
                  Dev Pipeline
                </CardTitle>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">Velocity breakdown across lifecycle</p>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={devStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {devStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => {
                          const total = devStatusData.reduce((acc, cur) => acc + cur.value, 0);
                          const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return [`${percent}%`, name];
                        }}
                      />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Governance Group Distribution */}
            <Card className="shadow-sm border border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50 py-4">
                <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                  <Shield className="w-5 h-5 text-amber-500" />
                  Ops Distribution
                </CardTitle>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">I&SR workload across departments</p>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupDistribution} layout="vertical" margin={{ left: 10, right: 30, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke={textColor} tick={{ fontSize: 9, fontWeight: 'bold' }} width={80} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                      <Bar dataKey="value" name="Tickets" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stability vs Velocity Trend */}
            <Card className="shadow-sm border border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Stability vs. Velocity Trend</CardTitle>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">Benchmarking feature delivery against operational noise</p>
                  </div>
                  <Badge className="bg-emerald-600 font-bold text-[9px] uppercase px-2 py-0.5">Correlation Index</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stabilityVelocityData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" stroke={textColor} fontSize={10} fontWeight="bold" />
                      <YAxis yAxisId="left" stroke={textColor} fontSize={10} fontWeight="bold" />
                      <YAxis yAxisId="right" orientation="right" stroke={textColor} fontSize={10} fontWeight="bold" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend verticalAlign="top" align="right" />
                      <Bar yAxisId="left" dataKey="dev" name="Dev Velocity (Tickets)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                      <Line yAxisId="right" type="monotone" dataKey="gov" name="Ops Stability (Incidents)" stroke="#ef4444" strokeWidth={4} dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Escalation Analytics (from SLA page) */}
            <Card className="shadow-sm border border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50 py-4">
                <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                  Distribution of Escalations
                </CardTitle>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">Critical path analysis for complex escalations</p>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={escalations.slice(0, 10).map(e => ({ name: e.externalId || e.id, level: e.level }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis stroke={textColor} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="level" name="Escalation Level" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}