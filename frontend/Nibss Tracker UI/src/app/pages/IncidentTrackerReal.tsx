import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { AlertCircle, Clock, Search, AlertTriangle, Plus, X, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { LoadingSpinner } from '@/app/components/ui/loading';
import { ErrorDisplay } from '@/app/components/ui/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Progress } from '@/app/components/ui/progress';
import { useSync, SyncStatus } from '@/contexts/SyncContext';
import axios from 'axios';
import { cn } from '@/app/components/ui/utils';
import { parseISO, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';

export function IncidentTrackerReal() {
  const [cockpitData, setCockpitData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [supportLevelFilter, setSupportLevelFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'incident' | 'service-request'>('incident');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleItems, setVisibleItems] = useState(50);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    category: '',
    requester: '',
    assignedTo: '',
    complexity: 1,
    risk: 1
  });

  const { startSync, jobs } = useSync();

  const isSyncing = jobs['Incidents']?.status === SyncStatus.Running;

  const fetchCockpitData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('http://localhost:5001/api/governance/cockpit');
      setCockpitData(response.data);
    } catch (err) {
      setError('Failed to load data. Please check if the backend is running.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    try {
      // Trigger sync in background - don't wait for it
      await startSync('Incidents');
      // Optionally refresh data after a short delay to pick up any immediate updates
      setTimeout(() => {
        fetchCockpitData();
      }, 2000);
    } catch (err: any) {
      console.error('Sync error:', err);
    }
  };

  const handleCreateSubmit = async () => {
    try {
      const endpoint = createType === 'incident'
        ? 'http://localhost:5001/api/governance/incidents'
        : 'http://localhost:5001/api/governance/service-requests';

      await axios.post(endpoint, formData);
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        priority: 'Medium',
        category: '',
        requester: '',
        assignedTo: '',
        complexity: 1,
        risk: 1
      });
      fetchCockpitData();
    } catch (err: any) {
      console.error('Create error:', err);
      alert(`Failed to create item: ${err.response?.data?.message || err.message}`);
    }
  };

  useEffect(() => {
    fetchCockpitData();
  }, []);

  // ── Freshservice status code → display label mapping ────────────────────
  // Status 18 (Awaiting L4 Support) is excluded from this page — it feeds Dev Incidents (L4).
  const FS_STATUS_MAP: Record<number, { label: string; variant: 'destructive' | 'secondary' | 'outline' | 'default'; className: string }> = {
    2: { label: 'Open', variant: 'destructive', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400' },
    3: { label: 'Pending', variant: 'secondary', className: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400' },
    4: { label: 'Resolved', variant: 'outline', className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-400' },
    5: { label: 'Closed', variant: 'default', className: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400' },
    6: { label: "Awaiting Customer's Response", variant: 'secondary', className: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400' },
    7: { label: 'Declined', variant: 'destructive', className: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400' },
    8: { label: 'Rejected', variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-400 dark:bg-red-900/30 dark:text-red-300' },
    9: { label: 'Awaiting Approval', variant: 'secondary', className: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-400' },
    10: { label: 'Awaiting 3rd Party', variant: 'secondary', className: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/20 dark:text-indigo-400' },
    19: { label: 'Awaiting Change Freeze Lift', variant: 'secondary', className: 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/20 dark:text-teal-400' },
  };


  const calculateSLABreach = (slaDueDate: string | null) => {
    if (!slaDueDate) return null;

    const dueDate = new Date(slaDueDate);
    const now = new Date();

    if (now > dueDate) {
      const diffTime = Math.abs(now.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { breached: true, days: diffDays };
    }

    return { breached: false, days: 0 };
  };

  const filteredItems = useMemo(() => {
    if (!cockpitData?.items) return [];

    return cockpitData.items.filter((item: any) => {
      // Exclude Awaiting L4 Support (status 18) — belongs on Dev Incidents (L4) page
      if (item.status === 18) return false;

      const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status.toString() === statusFilter;
      const matchesType = typeFilter === 'all' || item.ticket_type === typeFilter;
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesSupportLevel = supportLevelFilter === 'all' || item.support_level === supportLevelFilter;

      // Date filter
      let matchesDate = true;
      const itemDate = parseISO(item.created_at);
      const now = new Date();

      if (dateFilter === 'today') {
        matchesDate = itemDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        matchesDate = itemDate >= subDays(now, 7);
      } else if (dateFilter === 'month') {
        matchesDate = itemDate >= subDays(now, 30);
      } else if (dateFilter === 'custom') {
        if (startDate && endDate) {
          matchesDate = isWithinInterval(itemDate, {
            start: startOfDay(new Date(startDate)),
            end: endOfDay(new Date(endDate))
          });
        }
      }

      // Filter out L4 tickets (status 18/19) from this page as they go to Dev Board
      const isL4 = item.status === 18 || item.status === 19;
      if (isL4) return false;

      return matchesSearch && matchesStatus && matchesType && matchesPriority && matchesSupportLevel && matchesDate;
    });
  }, [cockpitData, searchTerm, statusFilter, typeFilter, priorityFilter, supportLevelFilter, dateFilter, startDate, endDate]);

  const filteredMetrics = useMemo(() => {
    const incidents = filteredItems.filter((i: any) => i.ticket_type === 'Incident');
    const serviceRequests = filteredItems.filter((i: any) => i.ticket_type === 'Service Request');
    // 'Open' = Freshservice status 2 (Open) or 6 (Awaiting Customer's Response)
    const openStatuses = [2, 6];

    // Compute earliest date across all filtered items
    const allDates = filteredItems
      .map((i: any) => i.created_at ? new Date(i.created_at).getTime() : null)
      .filter(Boolean) as number[];
    const earliestDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : null;
    const latestDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : null;

    return {
      totalIncidents: incidents.length,
      totalServiceRequests: serviceRequests.length,
      openIncidents: incidents.filter((i: any) => openStatuses.includes(i.status)).length,
      openServiceRequests: serviceRequests.filter((i: any) => openStatuses.includes(i.status)).length,
      criticalItems: filteredItems.filter((i: any) => i.priority === 'Critical' || i.priority === 'Urgent').length,
      slaBreaches: filteredItems.filter((i: any) => i.sla_breach === true || calculateSLABreach(i.sla_due_date)?.breached).length,
      earliestDate,
      latestDate,
    };
  }, [filteredItems]);

  // Format the date range label for KPI card sub-text
  const dateRangeLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (dateFilter === 'custom' && startDate && endDate) {
      return `From: ${fmtShort(new Date(startDate))} · To: ${fmtShort(new Date(endDate))}`;
    }
    if (dateFilter === 'custom' && startDate) {
      return `From: ${fmtShort(new Date(startDate))}`;
    }
    if (dateFilter === 'custom' && endDate) {
      return `To: ${fmtShort(new Date(endDate))}`;
    }
    if (dateFilter === 'today') {
      return `Today · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    if (dateFilter === 'week') {
      return `From: ${fmtShort(subDays(new Date(), 7))} · To: Today`;
    }
    if (dateFilter === 'month') {
      return `From: ${fmtShort(subDays(new Date(), 30))} · To: Today`;
    }
    // Default: show earliest date from the actual data
    if (filteredMetrics.earliestDate) {
      return `From: ${fmt(filteredMetrics.earliestDate)}`;
    }
    return '';
  }, [dateFilter, startDate, endDate, filteredMetrics.earliestDate]);


  const avgResolutionTime = useMemo(() => {
    const resolvedStatuses = [4, 5, 7, 8];
    const resolvedItems = filteredItems.filter((i: any) => resolvedStatuses.includes(i.status));
    if (resolvedItems.length === 0) return 0;

    return Math.round(resolvedItems
      .reduce((acc: number, i: any) => acc + (i.resolved_at ? new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime() : 0), 0)
      / resolvedItems.length / (1000 * 60 * 60));
  }, [filteredItems]);

  const getStatusBadge = (status: number | string) => {
    const statusNum = typeof status === 'string' ? parseInt(status) : status;
    return FS_STATUS_MAP[statusNum] || { label: `Status ${statusNum}`, variant: 'outline' as const, className: 'bg-muted text-muted-foreground border-border' };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-muted-foreground bg-muted/30 border-border';
    }
  };

  if (loading && !cockpitData) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={fetchCockpitData} />;
  }


  if (!cockpitData) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-green-600" />
            Incidents & Service Requests
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Monitor and manage incidents and service requests</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            onClick={handleManualSync}
            disabled={isSyncing}
            variant="outline"
            className="border-green-700 text-green-700 hover:bg-green-50 text-xs sm:text-sm"
          >
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync from API'}
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-xs sm:text-sm"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            Create New
          </Button>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-xl min-h-[400px]">
            <LoadingSpinner />
          </div>
        )}

        <div className={cn("space-y-6 transition-opacity duration-300", loading ? "opacity-30" : "opacity-100")}>

          {/* Metrics Cards (4 cards layout) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Incidents</p>
                    <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-500 mt-1">{filteredMetrics.totalIncidents}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="text-red-500 font-medium">{filteredMetrics.openIncidents} open</span>
                      {dateRangeLabel && <span className="ml-1 opacity-70">· {dateRangeLabel}</span>}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Service Requests</p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-500 mt-1">{filteredMetrics.totalServiceRequests}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="text-blue-500 font-medium">{filteredMetrics.openServiceRequests} open</span>
                      {dateRangeLabel && <span className="ml-1 opacity-70">· {dateRangeLabel}</span>}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>


            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Critical Issues</p>
                    <p className="text-2xl sm:text-3xl font-bold text-red-700 dark:text-red-500 mt-1">{filteredMetrics.criticalItems || 0}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">Needs attention</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-700 dark:text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">SLA Breaches</p>
                    <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-500 mt-1">{filteredMetrics.slaBreaches || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">This period</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            {/* Row 1: All dropdowns */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[160px] sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3 h-3 sm:w-4 sm:h-4" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 sm:pl-10 text-xs sm:text-sm py-1.5 sm:py-2"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32 sm:w-40 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Incident">Incidents</SelectItem>
                  <SelectItem value="Service Request">Service Requests</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supportLevelFilter} onValueChange={setSupportLevelFilter}>
                <SelectTrigger className="w-24 sm:w-32 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="L1">L1</SelectItem>
                  <SelectItem value="L2">L2</SelectItem>
                  <SelectItem value="L3">L3</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32 sm:w-40 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 sm:w-40 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="2">Open</SelectItem>
                  <SelectItem value="3">Pending</SelectItem>
                  <SelectItem value="4">Resolved</SelectItem>
                  <SelectItem value="5">Closed</SelectItem>
                  <SelectItem value="6">Awaiting Customer</SelectItem>
                  <SelectItem value="9">Awaiting Approval</SelectItem>
                  <SelectItem value="10">Awaiting 3rd Party</SelectItem>
                  <SelectItem value="19">Change Freeze</SelectItem>
                  <SelectItem value="7">Declined</SelectItem>
                  <SelectItem value="8">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: Date range picker – always visible */}
            <div className={cn(
              "flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
              dateFilter === 'custom' && (startDate || endDate)
                ? "border-green-600/50 bg-green-50/40 dark:bg-green-900/10"
                : "border-border/40 bg-muted/30"
            )}>
              <div className="flex items-center gap-2 flex-shrink-0">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date Range</span>
              </div>

              {/* Quick preset buttons */}
              <div className="flex gap-1 flex-shrink-0">
                {[
                  { label: 'All', value: 'all' },
                  { label: 'Today', value: 'today' },
                  { label: '7 Days', value: 'week' },
                  { label: '30 Days', value: 'month' },
                ].map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => { setDateFilter(preset.value); setStartDate(''); setEndDate(''); }}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-medium transition-all",
                      dateFilter === preset.value && dateFilter !== 'custom'
                        ? "bg-green-700 text-white shadow-sm"
                        : "bg-background border border-border/60 text-muted-foreground hover:border-green-600 hover:text-green-700"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="h-4 w-px bg-border/50 flex-shrink-0 hidden sm:block" />

              {/* Custom date inputs */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium flex-shrink-0">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateFilter('custom');
                  }}
                  min={`${new Date().getFullYear()}-01-01`}
                  max={endDate || new Date().toISOString().split('T')[0]}
                  className={cn(
                    "h-8 rounded-md border px-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-green-600/30",
                    startDate
                      ? "border-green-600/60 bg-green-50/50 dark:bg-green-900/20 text-foreground"
                      : "border-input bg-background text-foreground"
                  )}
                />
                <span className="text-xs text-muted-foreground font-medium flex-shrink-0">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateFilter('custom');
                  }}
                  min={startDate || `${new Date().getFullYear()}-01-01`}
                  max={new Date().toISOString().split('T')[0]}
                  className={cn(
                    "h-8 rounded-md border px-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-green-600/30",
                    endDate
                      ? "border-green-600/60 bg-green-50/50 dark:bg-green-900/20 text-foreground"
                      : "border-input bg-background text-foreground"
                  )}
                />
              </div>

              {/* Active filter summary + clear */}
              {dateFilter === 'custom' && (startDate || endDate) && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[11px] text-green-700 dark:text-green-400 font-medium">
                    {startDate && endDate
                      ? `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : startDate
                        ? `From ${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                        : `Until ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </span>
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); setDateFilter('all'); }}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          <Card>
            <CardHeader>
              <CardTitle>Items ({filteredItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredItems.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground dark:text-muted-foreground">No items found matching your criteria</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredItems.slice(0, visibleItems).map((item: any) => {
                    const statusInfo = getStatusBadge(item.status);
                    const slaInfo = calculateSLABreach(item.sla_due_date);
                    const isBreached = slaInfo?.breached || item.sla_breach;

                    // Log first breached item
                    if (isBreached && item.id === 3) {
                      console.log('Item 3 breach check:', {
                        id: item.id,
                        sla_due_date: item.sla_due_date,
                        sla_breach: item.sla_breach,
                        slaInfo,
                        isBreached
                      });
                    }

                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => setSelectedItem(item)}
                        className={cn(
                          "border rounded-xl p-5 transition-all cursor-pointer group relative overflow-hidden",
                          "bg-card/30 border-border/65 hover:bg-card/60 hover:border-border/90 hover:shadow-lg dark:border-border/40 dark:hover:border-border/70 dark:hover:bg-muted/10",
                          isBreached ? "border-destructive/30 bg-destructive/5 dark:bg-destructive/10 dark:border-destructive/40" : ""
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-semibold text-foreground dark:text-white">
                                {item.title || `Item #${item.id}`}
                              </h3>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {item.ticket_type}
                              </Badge>
                              <Badge variant="outline" className={
                                item.support_level === 'L1' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  item.support_level === 'L2' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                    'bg-teal-50 text-teal-700 border-teal-200'
                              }>
                                {item.support_level}
                              </Badge>

                              <Badge variant={statusInfo.variant}>
                                {statusInfo.label}
                              </Badge>
                              <Badge className={getPriorityColor(item.priority)}>
                                {item.priority}
                              </Badge>
                              {isBreached && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  BREACHED - {slaInfo?.days || 0} {(slaInfo?.days || 0) === 1 ? 'day' : 'days'} overdue
                                </Badge>
                              )}
                            </div>
                            {/* <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                          {item.description || 'No description available'}
                        </p> */}
                            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                              {item.description
                                ? (item.description.length > 100
                                  ? `${item.description.substring(0, 100)}...`
                                  : item.description)
                                : 'No description available'}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              {item.category && <span>Category: {item.category}</span>}
                              {item.requester && <span>Requester: {item.requester}</span>}
                              {item.assigned_to && <span>Assigned: {item.assigned_to}</span>}
                              {item.channel && <span>Channel: {item.channel}</span>}
                              <span>Created: {new Date(item.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-medium text-foreground">#{item.id}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {filteredItems.length > visibleItems && (
                <div className="mt-6 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleItems(prev => prev + 50)}
                    className="w-full"
                  >
                    Load More ({filteredItems.length - visibleItems} remaining)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Modal */}
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Item</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setCreateType('incident')}
                  className={`p-4 border-2 rounded-lg transition-all ${createType === 'incident'
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-border hover:border-muted-foreground/50'
                    }`}
                >
                  <AlertCircle className={`w-8 h-8 mx-auto mb-2 ${createType === 'incident' ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <p className={`font-semibold ${createType === 'incident' ? 'text-red-600 dark:text-red-400' : 'text-foreground/80'}`}>Incident</p>
                  <p className="text-xs text-muted-foreground mt-1">System issue or outage</p>
                </button>
                <button
                  onClick={() => setCreateType('service-request')}
                  className={`p-4 border-2 rounded-lg transition-all ${createType === 'service-request'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-border hover:border-muted-foreground/50'
                    }`}
                >
                  <Clock className={`w-8 h-8 mx-auto mb-2 ${createType === 'service-request' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  <p className={`font-semibold ${createType === 'service-request' ? 'text-blue-600 dark:text-blue-400' : 'text-foreground/80'}`}>Service Request</p>
                  <p className="text-xs text-muted-foreground mt-1">User request or task</p>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter title"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Critical">Critical</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Category</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., System, Network"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Requester</Label>
                    <Input
                      value={formData.requester}
                      onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
                      placeholder="Email or name"
                    />
                  </div>

                  <div>
                    <Label>Assigned To</Label>
                    <Input
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      placeholder="Team or person"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Complexity (1-4)</Label>
                    <Select value={formData.complexity.toString()} onValueChange={(value) => setFormData({ ...formData, complexity: parseInt(value) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">C1 - Simple</SelectItem>
                        <SelectItem value="2">C2 - Moderate</SelectItem>
                        <SelectItem value="3">C3 - Complex</SelectItem>
                        <SelectItem value="4">C4 - Very Complex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Risk (1-4)</Label>
                    <Select value={formData.risk.toString()} onValueChange={(value) => setFormData({ ...formData, risk: parseInt(value) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">R1 - Low</SelectItem>
                        <SelectItem value="2">R2 - Medium</SelectItem>
                        <SelectItem value="3">R3 - High</SelectItem>
                        <SelectItem value="4">R4 - Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateSubmit}
                    disabled={!formData.title}
                    className="bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900"
                  >
                    Create {createType === 'incident' ? 'Incident' : 'Service Request'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Details Offcanvas */}
          <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
            <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
              {selectedItem && (
                <>
                  <SheetHeader className="border-b pb-4">
                    <SheetTitle className="text-xl font-bold">{selectedItem.title}</SheetTitle>
                  </SheetHeader>

                  <div className="mt-6 space-y-6 px-8">
                    {/* Status & Priority Section */}
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status & Priority</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Status</span>
                          <Badge variant={getStatusBadge(selectedItem.status).variant}>
                            {getStatusBadge(selectedItem.status).label}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Severity</span>
                          <Badge className={getPriorityColor(selectedItem.priority)}>
                            {selectedItem.priority}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Priority</span>
                          <span className="text-sm font-medium text-foreground">P{selectedItem.complexity || 1}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Source</span>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {selectedItem.type}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* SLA Information Section */}
                    {selectedItem.sla_due_date && (
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">SLA Information</h3>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-muted-foreground">SLA Status</span>
                              <span className={`text-sm font-semibold ${selectedItem.sla_breach ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                                {selectedItem.sla_breach ? 'At Risk' : 'On Track'}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${selectedItem.sla_breach ? 'bg-red-500' : 'bg-green-500'}`}
                                style={{ width: selectedItem.sla_breach ? '100%' : '75%' }}
                              ></div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Time Remaining</span>
                            <span className="text-sm font-medium text-foreground">
                              {(() => {
                                if (!selectedItem.sla_due_date) return 'No SLA';
                                const dueDate = new Date(selectedItem.sla_due_date);
                                const now = new Date();
                                const diffMs = dueDate.getTime() - now.getTime();

                                if (diffMs < 0) {
                                  const daysOverdue = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
                                  return `${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue`;
                                }

                                const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                                if (days > 0) {
                                  return `${days} ${days === 1 ? 'day' : 'days'}, ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
                                }
                                return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Item Details Section */}
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Request Details</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-muted-foreground">Request ID</span>
                          <span className="text-sm font-medium text-foreground text-right">SR-{selectedItem.id}</span>
                        </div>
                        {selectedItem.category && (
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-muted-foreground">Category</span>
                            <span className="text-sm font-medium text-foreground text-right">{selectedItem.category}</span>
                          </div>
                        )}
                        {selectedItem.requester && (
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-muted-foreground">Requester</span>
                            <span className="text-sm font-medium text-foreground text-right">{selectedItem.requester}</span>
                          </div>
                        )}
                        {selectedItem.requester_email && (
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-muted-foreground">Requester Email</span>
                            <span className="text-sm font-medium text-foreground text-right">{selectedItem.requester_email}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-muted-foreground">Assignee</span>
                          <span className="text-sm font-medium text-foreground text-right">{selectedItem.assigned_to || 'Unassigned'}</span>
                        </div>
                        {selectedItem.channel && (
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-muted-foreground">Channel</span>
                            <span className="text-sm font-medium text-foreground text-right">{selectedItem.channel}</span>
                          </div>
                        )}
                        {selectedItem.native_sla_due_date && (
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-muted-foreground">SLA Due Date</span>
                            <span className="text-sm font-medium text-foreground text-right">{new Date(selectedItem.native_sla_due_date).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-muted-foreground">Created At</span>
                          <span className="text-sm font-medium text-foreground text-right">{new Date(selectedItem.created_at).toLocaleString()}</span>
                        </div>
                        <div className="col-span-2 pt-2">
                          <span className="text-sm text-muted-foreground block mb-2">Description</span>
                          <div className="text-sm text-foreground bg-muted/30 p-4 rounded border border-border max-h-96 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{selectedItem.description || 'No description available'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Section */}
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Incident Timeline</h3>
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
                              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                            </div>
                            <div className="w-0.5 h-full bg-border mt-2"></div>
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-medium text-foreground">{getStatusBadge(selectedItem.status).label}</p>
                            <p className="text-xs text-muted-foreground mt-1">Currently being investigated</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <AlertCircle className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Created</p>
                            <p className="text-xs text-muted-foreground mt-1">{new Date(selectedItem.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div >
    </div >
  );
}
