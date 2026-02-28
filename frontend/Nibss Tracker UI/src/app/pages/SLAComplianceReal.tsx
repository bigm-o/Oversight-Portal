import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { AlertCircle, TrendingUp, XCircle, ShieldCheck, Calendar as CalendarIcon, Filter, Layers, Eye, EyeOff } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/ui/loading';
import { apiService } from '@/services/apiService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/app/components/ui/utils';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/app/components/ui/dialog';
import { Calendar } from '@/app/components/ui/calendar';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

export function SLAComplianceReal() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const { theme } = useTheme();

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(undefined);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(undefined);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('All Levels');
  const [showAgentDistribution, setShowAgentDistribution] = useState(true);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#9ca3af' : '#4b5563';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();
      if (selectedLevel !== 'All Levels') {
        params.supportLevel = selectedLevel;
      }

      const response = await apiService.getGovernanceCockpit(params);
      setIncidents(response.items || []);
    } catch (err: any) {
      const msg = 'Failed to load SLA data. Please check if the backend is running.';
      setError(msg);
      console.error('SLA fetch error:', err);
    } finally {
      setLoading(false);
      setFetchCount(prev => prev + 1);
    }
  }, [startDate, endDate, selectedLevel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync temp dates when modal opens
  useEffect(() => {
    if (isDateModalOpen) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
    }
  }, [isDateModalOpen, startDate, endDate]);

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
    setSelectedLevel('All Levels');
    setIsDateModalOpen(false);
  };

  // KPI Calculations
  const totalIncidentsCount = incidents.length;
  const slaBreachesCount = incidents.filter((i: any) => i.slaBreach).length;
  const resolvedOnTime = incidents.filter((i: any) => (i.status === 4 || i.status === 5) && !i.slaBreach).length;
  const resolvedTotal = incidents.filter((i: any) => (i.status === 4 || i.status === 5)).length;

  const overallSLA = totalIncidentsCount > 0 ? ((totalIncidentsCount - slaBreachesCount) / totalIncidentsCount) * 100 : 100;
  const resolvedBeforeBreachRate = resolvedTotal > 0 ? (resolvedOnTime / resolvedTotal) * 100 : 100;

  // Chart Data: Distribution of tickets by agent
  const agentDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => {
      const agent = i.assignedTo || 'Unassigned';
      if (agent !== 'Unassigned' && agent !== 'Unknown') {
        counts[agent] = (counts[agent] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [incidents]);

  // Chart Data: Distribution of tickets by group
  const groupDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => {
      const group = i.team || 'Unknown Group';
      counts[group] = (counts[group] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [incidents]);

  // Chart Data: Distribution of escalations
  const escalationDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => {
      const status = i.escalationStatus || 'Not Escalated';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [incidents]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e'];

  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#fff',
    borderColor: isDark ? '#1e293b' : '#e2e8f0',
    color: isDark ? '#f1f5f9' : '#1e293b'
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-green-600" />
            SLA Compliance
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium">Strict governance over Incidents & Service Requests</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white/50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-[140px] h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" />
                <SelectValue placeholder="All Levels" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Levels">All Levels</SelectItem>
              <SelectItem value="L1">Tier 1 (L1)</SelectItem>
              <SelectItem value="L2">Tier 2 (L2)</SelectItem>
              <SelectItem value="L3">Tier 3 (L3)</SelectItem>
            </SelectContent>
          </Select>

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
              <DialogFooter>
                <Button variant="ghost" onClick={handleResetFilters}>Reset All</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDateModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters} className="bg-green-600 hover:bg-green-700 text-white">Apply Filter</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-xl min-h-[400px]">
            <LoadingSpinner />
          </div>
        )}

        <div className={cn("space-y-6 transition-opacity duration-300", loading ? "opacity-30" : "opacity-100")}>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card className="border-l-4 border-l-green-600 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-muted-foreground/60 uppercase tracking-widest mb-1">SLA Compliance</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-600">{overallSLA.toFixed(1)}%</p>
                  </div>
                  <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 text-green-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-600 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Incidents & Service Requests</p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground">{totalIncidentsCount}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-rose-600 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-muted-foreground/60 uppercase tracking-widest mb-1">SLA Breaches</p>
                    <p className="text-2xl sm:text-3xl font-bold text-rose-600">{slaBreachesCount}</p>
                  </div>
                  <XCircle className="w-8 h-8 sm:w-10 sm:h-10 text-rose-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-600 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-muted-foreground/60 uppercase tracking-widest mb-1">% Resolved On-Time</p>
                    <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{resolvedBeforeBreachRate.toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="relative group">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Distribution by Agent</CardTitle>
                  <p className="text-sm text-muted-foreground">Volume strictly from Incidents & Service Requests</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAgentDistribution(!showAgentDistribution)}
                  className="h-8 w-8 opacity-10 group-hover:opacity-100 transition-opacity"
                  title={showAgentDistribution ? "Hide Chart" : "Show Chart"}
                >
                  {showAgentDistribution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </CardHeader>
              <CardContent className={cn(
                "h-[550px] pt-4 transition-all duration-300",
                !showAgentDistribution && "h-0 py-0 opacity-0 overflow-hidden"
              )}>
                {showAgentDistribution && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentDistribution} layout="vertical" margin={{ left: 60, right: 30, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                      <XAxis type="number" stroke={textColor} fontSize={11} />
                      <YAxis dataKey="name" type="category" stroke={textColor} fontSize={11} width={130} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribution by Group</CardTitle>
                <p className="text-sm text-muted-foreground">Ticket allocation across support groups</p>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="name"
                      isAnimationActive={true}
                    >
                      {groupDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => {
                        const total = groupDistribution.reduce((acc, cur) => acc + cur.value, 0);
                        const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                        return [`${percent}%`, name];
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribution of Escalations</CardTitle>
                <p className="text-sm text-muted-foreground">Movement of tickets across support tiers</p>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={escalationDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                    <XAxis dataKey="name" stroke={textColor} fontSize={11} angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke={textColor} fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Incidents & Service Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No data to display in this range</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incidents.slice(0, 20).map((incident: any) => (
                    <div key={incident.id} className="flex items-center justify-between p-4 border border-border/65 hover:border-border/90 dark:border-border/40 dark:hover:border-border/70 transition-all rounded-lg">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          incident.slaBreach ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                        )}>
                          {incident.slaBreach ? <XCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">
                            {incident.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{incident.freshdeskId}</span>
                            <span className="text-xs text-muted-foreground">{incident.assignedTo || 'Unassigned'}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{incident.team || 'No Group'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={incident.slaBreach ? 'destructive' : 'outline'}>
                          {incident.supportLevel || 'L1'}
                        </Badge>
                        <div className="text-right hidden sm:block">
                          <p className={cn("text-sm font-bold", incident.slaBreach ? "text-red-600" : "text-green-600")}>
                            {incident.slaBreach ? 'SLA BREACH' : 'ON TIME'}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">{incident.priority}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}