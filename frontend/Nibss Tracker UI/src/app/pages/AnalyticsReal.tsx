import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useTheme } from '@/contexts/ThemeContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Line } from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle, Clock, BarChart3, Activity, Calendar as CalendarIcon, Filter, X, LayoutDashboard, Users, Layers, Shield, Database, Eye, EyeOff } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/ui/loading';
import { ErrorDisplay } from '@/app/components/ui/error';
import { apiService } from '@/services/apiService';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/app/components/ui/dialog';
import { Calendar } from '@/app/components/ui/calendar';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

const COLORS = ['#166534', '#16a34a', '#22c55e', '#86efac'];

export function AnalyticsReal() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#9ca3af' : '#4b5563'; // gray-400 : gray-600
  const gridColor = isDark ? '#374151' : '#e5e7eb'; // gray-700 : gray-200
  const tooltipStyle = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderColor: isDark ? '#374151' : '#e5e7eb',
    color: isDark ? '#f3f4f6' : '#111827'
  };

  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [l4Incidents, setL4Incidents] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [rollbacks, setRollbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // Filter States
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(undefined);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(undefined);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('All Teams');
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [showDevDistribution, setShowDevDistribution] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();

      const [teamsData, projectsData, ticketsData, l4Data, movementsData, rollbacksData] = await Promise.all([
        apiService.getTeams(),
        apiService.getProjects(),
        apiService.getTickets(params),
        apiService.getDevelopmentIncidents(params),
        apiService.getTicketMovements(params),
        apiService.getRollbacks(params)
      ]);

      setTeams(teamsData as any[]);
      setProjects((projectsData as any).items || projectsData || []);
      setTickets(ticketsData as any[]);
      setL4Incidents(l4Data as any[]);
      setMovements(movementsData as any[]);
      setRollbacks(rollbacksData as any[]);
    } catch (err: any) {
      const msg = 'Failed to load analytics data. Please check if the backend is running.';
      setError(msg);
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
      setFetchCount(prev => prev + 1);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setSelectedTeamId('All Teams');
  };

  const handleApplyDateFilters = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };

  useEffect(() => {
    // Sync temp dates when main dates change (e.g. on reset)
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  }, [startDate, endDate]);


  const getStatusLabel = (status: any) => {
    const map: any = {
      0: 'To Do', 1: 'In Progress', 2: 'Blocked', 3: 'Review',
      4: 'DevOps', 5: 'Ready to Test', 6: 'QA Test', 7: 'Security Testing', 8: 'UAT',
      9: 'CAB Ready', 10: 'Production Ready', 11: 'Live', 12: 'Rollback',
      'TODO': 'To Do', 'BACKLOG': 'To Do', 'OPEN': 'To Do', 'TO DO': 'To Do',
      'IN PROGRESS': 'In Progress', 'IN_PROGRESS': 'In Progress', 'INPROGRESS': 'In Progress',
      'BLOCKED': 'Blocked', 'IMPEDIMENT': 'Blocked',
      'REVIEW': 'Review', 'INREVIEW': 'Review',
      'DEVOPS': 'DevOps',
      'READY TO TEST': 'Ready to Test', 'READYTOTEST': 'Ready to Test', 'READY_TO_TEST': 'Ready to Test',
      'QA TEST': 'QA Test', 'QATEST': 'QA Test', 'QA': 'QA Test', 'QA_TEST': 'QA Test',
      'SECURITY TESTING': 'Security Testing', 'SECURITYTESTING': 'Security Testing', 'SECURITY': 'Security Testing', 'SECURITY_TESTING': 'Security Testing',
      'UAT': 'UAT',
      'CAB READY': 'CAB Ready', 'CAB_READY': 'CAB Ready', 'CABREADY': 'CAB Ready', 'CAB': 'CAB Ready',
      'PRODUCTION READY': 'Production Ready', 'PRODUCTIONREADY': 'Production Ready', 'PRODUCTION_READY': 'Production Ready',
      'LIVE': 'Live', 'DONE': 'Live', 'COMPLETED': 'Live', 'CLOSED': 'Live',
      'ROLLBACK': 'Rollback'
    };
    if (status === null || status === undefined) return 'Pending Classification';

    // Handle numeric status
    if (typeof status === 'number') return map[status] ?? 'Pending Classification';

    // Handle string status (could be a number as string or an enum name)
    if (typeof status === 'string') {
      const s = status.toUpperCase().trim();
      // Try mapping the string directly (e.g. "2" -> "Blocked" or "BLOCKED" -> "Blocked")
      if (map[s]) return map[s];

      // Try mapping without underscores
      const noUnderscore = s.replace(/_/g, ' ');
      if (map[noUnderscore]) return map[noUnderscore];

      return 'Pending Classification';
    }

    return 'Pending Classification';
  };

  const getPriorityLabel = (priority: any) => {
    const map: any = { 0: 'Low', 1: 'Medium', 2: 'High' };
    if (typeof priority === 'string') {
      const p = priority.toUpperCase().trim();
      if (p === 'LOW') return 'Low';
      if (p === 'MEDIUM') return 'Medium';
      if (p === 'HIGH') return 'High';
    }
    return map[priority] ?? 'Medium';
  };

  // Filters and Memoized Data
  // Filters and Memoized Data
  const currentTeamId = selectedTeamId === 'All Teams' ? undefined : selectedTeamId;
  const filteredProjects = useMemo(() => {
    let list = projects;
    if (currentTeamId) {
      list = list.filter(p => String(p.teamId || p.teamid) === String(currentTeamId));
    }

    if (startDate || endDate) {
      const activeProjectIds = new Set(tickets.map(t => t.projectId || t.projectid).filter(id => id !== null));
      list = list.filter(p => activeProjectIds.has(p.id));
    }

    return list;
  }, [projects, currentTeamId, startDate, endDate, tickets]);

  const filteredTeams = useMemo(() => {
    let list = teams;
    if (currentTeamId) {
      list = list.filter(t => String(t.id) === String(currentTeamId));
    }

    if (startDate || endDate) {
      const activeTeamIdsFromProjects = new Set(filteredProjects.map(p => p.teamId || p.teamid).filter(id => id !== null));
      const activeTeamNamesFromL4 = new Set(l4Incidents.map(i => i.team).filter(Boolean));
      list = list.filter(t => activeTeamIdsFromProjects.has(t.id) || activeTeamNamesFromL4.has(t.name));
    }

    return list;
  }, [teams, currentTeamId, startDate, endDate, filteredProjects, l4Incidents]);

  const teamName = currentTeamId ? teams.find(t => String(t.id) === String(currentTeamId))?.name : null;

  const filteredTickets = useMemo(() => {
    if (!currentTeamId) return tickets;
    const projectIds = filteredProjects.map(p => p.id);
    const projectKeys = filteredProjects.map(p => p.jiraKey).filter(k => k && k.trim() !== "");
    return tickets.filter(t => projectIds.includes(t.projectId || t.projectid) || (t.epicKey && projectKeys.includes(t.epicKey)) || t.team === teamName);
  }, [tickets, currentTeamId, filteredProjects, teamName]);

  const filteredL4 = useMemo(() => {
    return currentTeamId ? l4Incidents.filter(i => i.team === teamName) : l4Incidents;
  }, [l4Incidents, currentTeamId, teamName]);

  if (!tickets.length && loading) {
    return <LoadingSpinner />;
  }

  if (error && !tickets.length) {
    return <ErrorDisplay message={error} onRetry={fetchData} />;
  }

  // Team Workload (Tickets)
  const teamWorkloadData = filteredTeams.map((team: any) => {
    const teamProjectIds = projects.filter((p: any) => p.teamId === team.id || p.teamid === team.id).map(p => p.id);
    const teamProjectKeys = projects.filter((p: any) => (p.teamId === team.id || p.teamid === team.id) && p.jiraKey).map(p => p.jiraKey);
    const teamTickets = tickets.filter(t => teamProjectIds.includes(t.projectId || t.projectid) || (t.epicKey && teamProjectKeys.includes(t.epicKey)));

    const teamL4 = l4Incidents.filter(i => i.team === team.name);

    const doneTickets = teamTickets.filter(t => getStatusLabel(t.status) === 'Live').length;
    const doneL4 = teamL4.filter(i => i.resolvedAt).length;

    const done = doneTickets + doneL4;
    const total = teamTickets.length + teamL4.length;
    const active = total - done;

    return {
      name: team.name.split(' ')[0] || 'Unknown Team',
      activeTickets: active,
      completedTickets: done,
      total: total
    };
  }).sort((a, b) => b.total - a.total);

  // KPI Calculations
  const activeProjectsCount = (startDate || endDate)
    ? filteredProjects.length
    : filteredProjects.filter(p => !['completed', 'done', 'live'].includes((p.status || '').toLowerCase())).length;

  const totalTicketsAllTeams = filteredTickets.length + filteredL4.length;
  const completedTicketsAllTeams = filteredTickets.filter(t => getStatusLabel(t.status) === 'Live').length + filteredL4.filter(i => i.resolvedAt).length;
  const overallProgress = totalTicketsAllTeams > 0 ? Math.round((completedTicketsAllTeams / totalTicketsAllTeams) * 100) : 0;

  // Calculate team performance data (Points)
  const teamPerformanceData = filteredTeams.map((team: any) => {
    const teamProjectIds = projects.filter((p: any) => p.teamId === team.id || p.teamid === team.id).map(p => p.id);
    const teamProjectKeys = projects.filter((p: any) => p.teamId === team.id || p.teamid === team.id).map(p => p.jiraKey);
    const teamProjects = projects.filter((p: any) => teamProjectIds.includes(p.id) || teamProjectKeys.includes(p.jiraKey));

    const teamTickets = tickets.filter(t => teamProjectIds.includes(t.projectId || t.projectid) || teamProjectKeys.includes(t.epicKey));

    const projectPlannedPoints = teamProjects.reduce((sum: number, p: any) => sum + (Number(p.plannedPoints) || 0), 0);
    const projectCompletedPoints = teamProjects.reduce((sum: number, p: any) => sum + (Number(p.completedPoints) || 0), 0);

    const ticketPlannedPoints = teamTickets.reduce((sum: number, t: any) => sum + (Number(t.deliveryPoints || t.delivery_points) || 0), 0);
    const ticketCompletedPoints = teamTickets.filter(t => getStatusLabel(t.status) === 'Live').reduce((sum: number, t: any) => sum + (Number(t.deliveryPoints || t.delivery_points) || 0), 0);

    // If date filters are applied, prioritize calculation from filtered tickets
    const isDateFiltered = !!(startDate || endDate);
    const plannedPoints = (isDateFiltered || projectPlannedPoints === 0) ? ticketPlannedPoints : projectPlannedPoints;
    const completedPoints = (isDateFiltered || projectCompletedPoints === 0) ? ticketCompletedPoints : projectCompletedPoints;

    return {
      name: team.name.split(' ')[0] || 'Unknown Team',
      fullName: team.name,
      planned: plannedPoints,
      completed: completedPoints,
      percentage: plannedPoints > 0 ? Math.round((completedPoints / plannedPoints) * 100) : 0
    };
  });


  // Ticket Status Distribution
  const statusCounts: Record<string, number> = {};
  filteredTickets.forEach(ticket => {
    const status = getStatusLabel(ticket.status);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  const ticketStatusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const STATUS_COLORS = [
    '#94a3b8', // To Do (Slate-400)
    '#3b82f6', // In Progress (Blue-500)
    '#f43f5e', // Blocked (Rose-500)
    '#6366f1', // Review (Indigo-500)
    '#06b6d4', // DevOps (Cyan-500)
    '#0ea5e9', // Ready to Test (Sky-500)
    '#f59e0b', // QA Test (Amber-500)
    '#f97316', // Security Testing (Orange-500)
    '#14b8a6', // UAT (Teal-500)
    '#8b5cf6', // CAB Ready (Violet-500)
    '#a855f7', // Production Ready (Purple-500)
    '#10b981', // Live (Emerald-500)
    '#ef4444'  // Rollback (Red-500)
  ];

  // Incidents vs Development Effort (Correlation analysis)
  const correlationData = filteredTeams.map((team: any) => {
    const teamProjectIds = projects.filter((p: any) => p.teamId === team.id || p.teamid === team.id).map(p => p.id);
    const teamProjectKeys = projects.filter((p: any) => (p.teamId === team.id || p.teamid === team.id) && p.jiraKey).map(p => p.jiraKey);
    const teamTickets = tickets.filter(t => teamProjectIds.includes(t.projectId || t.projectid) || (t.epicKey && teamProjectKeys.includes(t.epicKey)));

    const jiraIncidents = teamTickets.filter(t => {
      const type = String(t.issueType || t.type || '').toLowerCase();
      return type.includes('incident') || type.includes('bug') || type.includes('defect');
    }).length;

    const teamL4Count = l4Incidents.filter(i => i.team === team.name).length;
    const incidentsCount = jiraIncidents + teamL4Count;

    const devCount = teamTickets.length - jiraIncidents;

    return {
      name: team.name.split(' ')[0] || 'Unknown Team',
      incidents: incidentsCount,
      development: devCount,
      incidentDensity: devCount > 0 ? (incidentsCount / devCount * 10).toFixed(2) : 0
    };
  });

  // Ticket movements vs Rollbacks
  const movementVsRollback = filteredTeams.map((team: any) => {
    const teamProjectIds = projects.filter((p: any) => p.teamId === team.id || p.teamid === team.id).map(p => p.id);
    const teamProjectKeys = projects.filter((p: any) => (p.teamId === team.id || p.teamid === team.id) && p.jiraKey).map(p => p.jiraKey);
    const teamTickets = tickets.filter(t => teamProjectIds.includes(t.projectId || t.projectid) || (t.epicKey && teamProjectKeys.includes(t.epicKey)));
    const teamTicketIds = teamTickets.map(t => t.id);

    const mCount = movements.filter(m => teamTicketIds.includes(m.ticketId || m.ticketid)).length;
    const rCount = rollbacks.filter(r => teamTicketIds.includes(r.ticketId || r.ticketid)).length;

    return {
      name: team.name.split(' ')[0] || 'Unknown Team',
      movements: mCount,
      rollbacks: rCount
    };
  });

  // Pie: Tickets categorized by projects
  const projectDistribution = filteredProjects.map(p => {
    const ticketCount = filteredTickets.filter(t => t.projectId === p.id || t.projectid === p.id || t.epicKey === p.jiraKey).length;
    return { name: p.name || p.jiraKey, value: ticketCount };
  }).filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, currentTeamId ? 1000 : 20);

  // Distribution of tickets by agent (dev tickets strictly)
  const agentDistribution: Record<string, number> = {};
  filteredTickets.filter(t => {
    const type = String(t.issueType || t.type || '').toLowerCase();
    return !type.includes('incident') && !type.includes('bug') && !type.includes('defect');
  }).forEach(t => {
    const agent = t.assignedTo || t.assignee || 'Unassigned';
    agentDistribution[agent] = (agentDistribution[agent] || 0) + 1;
  });
  const agentData = Object.entries(agentDistribution)
    .filter(([name]) => !['Unassigned', 'None', '', 'null', 'undefined'].includes(name))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Backlog by risk
  const riskDistribution: Record<string, number> = {};
  filteredTickets.filter(t => ['To Do', 'Backlog'].includes(getStatusLabel(t.status))).forEach(t => {
    const risk = Number(t.risk) || 0;
    const riskLabel = risk >= 2 ? 'High Risk' : (risk === 1 ? 'Medium Risk' : 'Low Risk');
    riskDistribution[riskLabel] = (riskDistribution[riskLabel] || 0) + 1;
  });
  const riskData = ['Low Risk', 'Medium Risk', 'High Risk'].map(name => ({ name, value: riskDistribution[name] || 0 }));

  // Dynamic Chart Reordering: Prepare components and sort by data volume
  const chartComponents = [
    {
      id: 'status',
      title: 'Ticket Status Breakdown',
      weight: ticketStatusData.length > 0 ? 10 : 0,
      render: () => (
        <Card key="status">
          <CardHeader className="pb-2">
            <CardTitle>Ticket Status Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground">Distribution of all system tickets</p>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={450} key={`status-${fetchCount}`}>
              <PieChart>
                <Pie data={ticketStatusData} cx="50%" cy="50%" innerRadius={75} outerRadius={160} paddingAngle={2} dataKey="value" stroke="none" isAnimationActive={true} animationDuration={1500}>
                  {ticketStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: textColor }}
                  formatter={(value: number, name: string) => {
                    const total = ticketStatusData.reduce((acc, cur) => acc + cur.value, 0);
                    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return [`${percent}%`, name];
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', color: textColor, fontSize: '11px', fontWeight: 'bold' }} verticalAlign="bottom" align="center" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'workload',
      title: 'Team Workload Volume',
      weight: teamWorkloadData.length > 0 ? 9 : 0,
      render: () => (
        <Card key="workload">
          <CardHeader>
            <CardTitle>Team Workload Volume</CardTitle>
            <p className="text-sm text-muted-foreground">Active vs Completed tickets per team</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={450} key={`workload-${fetchCount}`}>
              <BarChart data={teamWorkloadData} layout="vertical" margin={{ left: 40, right: 30, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" stroke={textColor} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" stroke={textColor} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? '#374151' : '#f3f4f6' }} />
                <Legend wrapperStyle={{ paddingTop: '20px', color: textColor, fontSize: '11px', fontWeight: 'bold' }} verticalAlign="bottom" align="center" iconSize={10} />
                <Bar dataKey="activeTickets" stackId="a" fill="#f59e0b" name="Active Tickets" />
                <Bar dataKey="completedTickets" stackId="a" fill="#166534" name="Completed Tickets" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'effort',
      title: 'Incidents vs Dev Effort',
      weight: correlationData.some(d => d.incidents > 0 || d.development > 0) ? 8 : 0,
      render: () => (
        <Card key="effort">
          <CardHeader className="pb-2">
            <CardTitle>Incidents vs Dev Effort</CardTitle>
            <p className="text-sm text-muted-foreground">Correlation between features and incidents</p>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={450} key={`effort-${fetchCount}`}>
              <ComposedChart data={correlationData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" stroke={textColor} />
                <YAxis yAxisId="right" orientation="right" stroke={textColor} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: '15px', color: textColor, fontSize: '11px', fontWeight: 'bold' }} verticalAlign="bottom" align="center" iconSize={10} />
                <Bar yAxisId="left" dataKey="development" barSize={45} fill="#3b82f6" name="Dev Effort" />
                <Line yAxisId="right" type="monotone" dataKey="incidents" stroke="#ef4444" strokeWidth={4} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'performance',
      title: 'Points Delivery Performance',
      weight: teamPerformanceData.some(d => d.planned > 0) ? 7 : 0,
      render: () => (
        <Card key="performance">
          <CardHeader>
            <CardTitle>Points Delivery Performance</CardTitle>
            <p className="text-sm text-muted-foreground">Planned vs Completed Delivery Points</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={450} key={`performance-${fetchCount}`}>
              <BarChart data={teamPerformanceData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 11 }} />
                <YAxis stroke={textColor} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: '20px', color: textColor, fontSize: '11px', fontWeight: 'bold' }} verticalAlign="bottom" align="center" iconSize={10} />
                <Bar dataKey="planned" fill="#9ca3af" name="Planned Points" />
                <Bar dataKey="completed" fill="#16a34a" name="Completed Points" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'movements',
      title: 'Ticket Movements VS Rollbacks',
      weight: movementVsRollback.some(d => d.movements > 0 || d.rollbacks > 0) ? 6 : 0,
      render: () => (
        <Card key="movements">
          <CardHeader>
            <CardTitle>Ticket Movements VS Rollbacks</CardTitle>
            <p className="text-sm text-muted-foreground">Movement volume versus stability per team</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={450} key={`movements-${fetchCount}`}>
              <BarChart data={movementVsRollback} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 11 }} />
                <YAxis stroke={textColor} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                <Bar dataKey="movements" fill="#3b82f6" name="Movements" />
                <Bar dataKey="rollbacks" fill="#ef4444" name="Rollbacks" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'projects',
      title: currentTeamId ? `All ${teamName} projects by volume` : 'Top 20 Projects by Volume',
      weight: projectDistribution.length > 0 ? 5 : 0,
      render: () => (
        <Card key="projects">
          <CardHeader>
            <CardTitle>{currentTeamId ? `All ${teamName} projects by volume` : 'Top 20 Projects by Volume'}</CardTitle>
            <p className="text-sm text-muted-foreground">Distribution of tickets across projects</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={450} key={`projects-${fetchCount}`}>
              <PieChart>
                <Pie data={projectDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={140} paddingAngle={5} dataKey="value" nameKey="name" isAnimationActive={true}>
                  {projectDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    const total = projectDistribution.reduce((acc, cur) => acc + cur.value, 0);
                    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return [`${percent}%`, name];
                  }}
                />
                <Legend verticalAlign="bottom" align="center" layout="horizontal" iconSize={10} wrapperStyle={{ paddingTop: '20px', fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'agents',
      title: 'Strict Dev Ticket Distribution',
      weight: agentData.length > 0 ? 3 : 0,
      render: () => (
        <Card key="agents" className="relative group">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Strict Dev Ticket Distribution</CardTitle>
              <p className="text-sm text-muted-foreground">Ticket allocation per Developer (excluding support/bugs)</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDevDistribution(!showDevDistribution)}
              className="h-8 w-8 opacity-10 group-hover:opacity-100 transition-opacity"
              title={showDevDistribution ? "Hide Chart" : "Show Chart"}
            >
              {showDevDistribution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </CardHeader>
          <CardContent className={cn(
            "h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 transition-all duration-300",
            !showDevDistribution && "h-0 py-0 opacity-0 overflow-hidden"
          )}>
            {showDevDistribution && (
              <ResponsiveContainer width="100%" height={Math.max(450, agentData.length * 35)}>
                <BarChart data={agentData} layout="vertical" margin={{ left: 50, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" stroke={textColor} />
                  <YAxis dataKey="name" type="category" stroke={textColor} width={100} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#6366f1" name="Dev Tickets" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )
    },
    {
      id: 'risk',
      title: 'Backlog Risk Analysis',
      weight: riskData.some(d => d.value > 0) ? 4 : 0,
      render: () => (
        <Card key="risk">
          <CardHeader>
            <CardTitle>Backlog Risk Analysis</CardTitle>
            <p className="text-sm text-muted-foreground">Risk profile of pending tickets (To Do / Backlog)</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={450} key={`risk-${fetchCount}`}>
              <PieChart>
                <Pie data={riskData} cx="50%" cy="50%" innerRadius={80} outerRadius={150} dataKey="value" nameKey="name" isAnimationActive={true}>
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    const total = riskData.reduce((acc, cur) => acc + cur.value, 0);
                    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return [`${percent}%`, name];
                  }}
                />
                <Legend verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )
    }
  ];

  const sortedCharts = chartComponents.sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-green-600" />
            Analytics & Insights
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium">Performance metrics and trend analysis</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20 w-fit">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-700 dark:text-green-400 tracking-wider">LIVE DATA</span>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          {/* Inline Filters */}
          <div className="flex items-center gap-3">
            {/* Team Select */}
            <div className="w-44">
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <SelectValue placeholder="Select Team" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Teams">All Teams</SelectItem>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Popovers */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 gap-2 hover:bg-slate-50 dark:hover:bg-slate-900">
                    <CalendarIcon className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs font-medium">
                      {tempStartDate ? format(tempStartDate, 'MMM d') : 'Start Date'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={tempStartDate} onSelect={setTempStartDate} initialFocus />
                </PopoverContent>
              </Popover>

              <span className="text-slate-300 dark:text-slate-700">-</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 gap-2 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-sm">
                    <CalendarIcon className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs font-medium">
                      {tempEndDate ? format(tempEndDate, 'MMM d') : 'End Date'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={tempEndDate} onSelect={setTempEndDate} initialFocus />
                </PopoverContent>
              </Popover>

              {(tempStartDate || tempEndDate) && (
                <Button
                  size="sm"
                  className="h-9 bg-green-600 hover:bg-green-700 text-white px-3"
                  onClick={handleApplyDateFilters}
                >
                  Apply
                </Button>
              )}
            </div>

            {(startDate || endDate || selectedTeamId !== 'All Teams') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetFilters}
                className="h-9 w-9 text-slate-400 hover:text-rose-500 hover:bg-rose-50"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && !tickets.length && <ErrorDisplay message={error} onRetry={fetchData} />}

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-xl min-h-[400px]">
            <LoadingSpinner />
          </div>
        )}

        <div className={cn("space-y-6 transition-opacity duration-300", loading ? "opacity-30" : "opacity-100")}>


          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card className="border-l-4 border-l-blue-600 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Total Teams</p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground">{filteredTeams.length}</p>
                  </div>
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-600 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Active Projects</p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground">{activeProjectsCount}</p>
                  </div>
                  <Database className="w-8 h-8 sm:w-10 sm:h-10 text-green-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-600 shadow-sm relative overflow-hidden group">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Dev Tickets</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl sm:text-3xl font-bold text-foreground">{filteredTickets.length}</p>
                      <span className="text-[10px] text-muted-foreground font-bold">+{filteredL4.length} L4s</span>
                    </div>
                  </div>
                  <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-slate-400 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Overall Progress</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl sm:text-3xl font-bold text-foreground truncate">{overallProgress}%</p>
                      <p className="text-sm font-semibold text-muted-foreground hidden sm:block">({completedTicketsAllTeams}/{totalTicketsAllTeams})</p>
                    </div>
                  </div>
                  <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Dynamic Grid of Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedCharts.map(chart => chart.render())}
          </div>

          {/* Team Details */}
          < Card >
            <CardHeader>
              <CardTitle>Team Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamPerformanceData.map((team: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-border/65 hover:border-border/90 dark:border-border/40 dark:hover:border-border/70 transition-all rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {team.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{team.fullName}</h3>
                        <p className="text-sm text-muted-foreground">{team.completed} / {team.planned} points</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-700">{team.percentage}%</p>
                      <p className="text-xs text-muted-foreground">completion rate</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card >
        </div>
      </div>
    </div>
  );
}