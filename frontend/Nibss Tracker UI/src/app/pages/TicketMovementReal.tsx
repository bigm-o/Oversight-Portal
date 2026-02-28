import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { ArrowRight, GitBranch, Clock, CheckCircle, TrendingUp, RotateCcw, Ticket, Calendar as CalendarIcon, Check, ChevronsUpDown, Info, User, FileText, AlertCircle, MessageSquare, ExternalLink, Activity } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/ui/loading';
import { ErrorDisplay } from '@/app/components/ui/error';
import { apiService } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/app/components/ui/command';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/app/components/ui/utils';
import { useSync, SyncStatus } from '@/contexts/SyncContext';
import { toast } from 'sonner';

export function TicketMovementReal() {
  const { user } = useAuth();
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [teams, setTeams] = useState<any[]>([]);

  const isAdmin = user?.role === 'Admin' || user?.permissions?.admin;
  const authorizedTeamIds = user?.permissions?.teams || [];

  const availableTeams = useMemo(() => {
    if (isAdmin) return teams;
    return teams.filter(t => authorizedTeamIds.map(Number).includes(t.id));
  }, [teams, isAdmin, authorizedTeamIds]);

  useEffect(() => {
    if (availableTeams.length === 1 && selectedTeam === 'all') {
      setSelectedTeam(availableTeams[0].id.toString());
    }
  }, [availableTeams, selectedTeam]);

  const getTeamIdFromJiraKey = useCallback((key: string) => {
    if (!key) return null;
    const prefix = key.split('-')[0].toUpperCase();
    const team = availableTeams.find(t => t.prefix === prefix);
    return team ? team.id : null;
  }, [availableTeams]);

  const filteredProjects = useMemo(() => {
    return allProjects.filter((p: any) => {
      const pTeamId = p.teamId ? Number(p.teamId) : null;
      return isAdmin || (pTeamId && authorizedTeamIds.map(Number).includes(pTeamId));
    });
  }, [allProjects, isAdmin, authorizedTeamIds]);

  const filteredTickets = useMemo(() => {
    return allTickets.filter((t: any) => {
      const ticketTeamId = getTeamIdFromJiraKey(t.jiraKey);
      const projectForTicket = allProjects.find((p: any) => p.id === t.projectId);
      const projectTeamId = projectForTicket?.teamId ? Number(projectForTicket.teamId) : null;

      const teamId = projectTeamId || ticketTeamId;
      return isAdmin || (teamId && authorizedTeamIds.map(Number).includes(teamId));
    });
  }, [allTickets, allProjects, isAdmin, authorizedTeamIds, getTeamIdFromJiraKey]);

  const filteredMovementsData = useMemo(() => {
    const ticketKeys = new Set(filteredTickets.map(t => t.jiraKey));
    return allMovements.filter((m: any) => ticketKeys.has(m.jiraKey));
  }, [allMovements, filteredTickets]);

  const projects = filteredProjects;
  const tickets = filteredTickets;
  const movements = filteredMovementsData;

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const [isJustifyModalOpen, setIsJustifyModalOpen] = useState(false);
  const [justifyingMovement, setJustifyingMovement] = useState<any>(null);
  const [justificationText, setJustificationText] = useState('');
  const [submittingJustification, setSubmittingJustification] = useState(false);

  const { jobs } = useSync();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ticketsData, projectsData, movementsData, teamsData] = await Promise.all([
        apiService.getTickets(),
        apiService.getProjects(),
        apiService.getTicketMovements(),
        apiService.getTeams()
      ]) as [any, any, any, any];

      setAllTickets(ticketsData);
      setAllProjects(projectsData);
      setAllMovements(movementsData);
      setTeams(teamsData);

    } catch (err) {
      setError('Failed to load ticket movement data. Please check if the backend is running.');
      console.error('Ticket movement fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusLabel = (status: number) => {
    const statusMap = {
      0: 'BACKLOG',
      1: 'SELECTED FOR DEV',
      2: 'IN PROGRESS',
      3: 'REVIEW',
      4: 'TESTING',
      5: 'CAB READY',
      6: 'READY TO DEPLOY',
      7: 'DONE',
      8: 'ROLLBACK'
    };
    return statusMap[status as keyof typeof statusMap] || 'Pending Classification';
  };

  const getStatusColor = (status: number) => {
    const colorMap = {
      0: 'bg-muted text-muted-foreground',
      1: 'bg-blue-500/10 text-blue-500',
      2: 'bg-blue-500/20 text-blue-500',
      3: 'bg-indigo-500/20 text-indigo-500',
      4: 'bg-yellow-500/20 text-yellow-500',
      5: 'bg-purple-500/20 text-purple-500',
      6: 'bg-cyan-500/20 text-cyan-500',
      7: 'bg-green-500/20 text-green-500',
      8: 'bg-destructive/20 text-destructive'
    };
    return colorMap[status as keyof typeof colorMap] || 'bg-muted text-muted-foreground';
  };

  const handleJustifyClick = (movement: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setJustifyingMovement(movement);
    setJustificationText(movement.justification || '');
    setIsJustifyModalOpen(true);
  };

  const submitJustification = async () => {
    if (!justifyingMovement || !justificationText.trim()) return;

    try {
      setSubmittingJustification(true);
      const justifiedBy = user?.email || 'System User';
      await apiService.justifyMovement(justifyingMovement.id, justificationText, justifiedBy);

      const updatedAllMovements = allMovements.map(m =>
        m.id === justifyingMovement.id ? {
          ...m,
          justification: justificationText,
          justifiedBy: justifiedBy,
          justifiedAt: new Date().toISOString()
        } : m
      );
      setAllMovements(updatedAllMovements);

      if (selectedMovement?.id === justifyingMovement.id) {
        setSelectedMovement((prev: any) => ({
          ...prev,
          justification: justificationText,
          justifiedBy: justifiedBy,
          justifiedAt: new Date().toISOString()
        }));
      }

      toast.success('Justification saved');
      setIsJustifyModalOpen(false);
    } catch (err) {
      toast.error('Failed to save justification');
      console.error(err);
    } finally {
      setSubmittingJustification(false);
    }
  };

  if (loading && !allTickets.length) return <LoadingSpinner />;
  if (error && !allTickets.length) return <ErrorDisplay message={error} onRetry={fetchData} />;

  const filteredMovements = movements.filter((movement: any) => {
    const ticketForMovement = tickets.find((t: any) => t.jiraKey === movement.jiraKey);
    if (!ticketForMovement) return false;

    if (selectedTeam && selectedTeam !== 'all') {
      const ticketTeamId = getTeamIdFromJiraKey(ticketForMovement.jiraKey);
      const projectForTicket = allProjects.find((p: any) => p.id === ticketForMovement.projectId);
      const projectTeamId = projectForTicket?.teamId ? Number(projectForTicket.teamId) : null;
      const teamId = projectTeamId || ticketTeamId;
      if (teamId?.toString() !== selectedTeam) return false;
    }

    if (selectedProject && selectedProject !== 'all') {
      if (ticketForMovement.projectId !== parseInt(selectedProject)) return false;
    }

    if (selectedTicket && selectedTicket !== 'all') {
      if (ticketForMovement.jiraKey !== selectedTicket) return false;
    }

    if (startDate) {
      const movementDate = new Date(movement.createdAt);
      if (movementDate < new Date(startDate)) return false;
    }

    if (endDate) {
      const movementDate = new Date(movement.createdAt);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (movementDate > end) return false;
    }

    return true;
  }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const rollbacksList = filteredMovements.filter(m => m.isRollback);

  const activeTicketsCount = tickets.filter((t: any) => t.status !== 0 && t.status !== 7).length;
  const totalMovementsCount = filteredMovements.length;
  const totalRollbacksCount = filteredMovements.filter((m: any) => m.isRollback).length;

  const handleRowClick = (movement: any) => {
    const ticketDetails = tickets.find((t: any) => t.jiraKey === movement.jiraKey);
    setSelectedMovement({ ...movement, ticketDetails });
    setIsSheetOpen(true);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-green-600" />
            Audit Trail & Ticket Movements
          </h1>
          <p className="text-muted-foreground mt-1">Real-time tracking of development lifecycle and status transitions</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20">
          <GitBranch className="w-5 h-5 text-blue-500" />
          {jobs['JIRA']?.status === SyncStatus.Running ? (
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm font-semibold text-blue-500/80">Sync in progress</span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-blue-500/80">Live Sync Active</span>
          )}
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-xl min-h-[400px]">
            <LoadingSpinner />
          </div>
        )}

        <div className={cn("space-y-6 transition-opacity duration-300", loading ? "opacity-30" : "opacity-100")}>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-purple-500 shadow-sm transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 font-medium">Active Tickets</p>
                    <p className="text-3xl font-bold text-foreground">{activeTicketsCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Neither Backlog nor Done</p>
                  </div>
                  <Ticket className="w-10 h-10 text-purple-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 font-medium">Total Activity</p>
                    <p className="text-3xl font-bold text-foreground">{totalMovementsCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Historical movements captured</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-blue-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-destructive shadow-sm transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 font-medium">Rollbacks</p>
                    <p className="text-3xl font-bold text-destructive">{totalRollbacksCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Backward status transitions</p>
                  </div>
                  <RotateCcw className="w-10 h-10 text-destructive opacity-20" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card shadow-sm border-border">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block font-semibold">Team</label>
                  <Select
                    value={selectedTeam}
                    onValueChange={(val) => {
                      setSelectedTeam(val);
                      setSelectedProject('all');
                      setSelectedTicket('all');
                    }}
                  >
                    <SelectTrigger className="w-full shadow-sm border-border">
                      <SelectValue placeholder="All Teams" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeams.length > 1 && <SelectItem value="all">All Teams</SelectItem>}
                      {availableTeams.map((team: any) => (
                        <SelectItem key={team.id} value={team.id.toString()}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block font-semibold">Project</label>
                  <Select
                    value={selectedProject}
                    onValueChange={(val) => {
                      setSelectedProject(val);
                      setSelectedTicket('all');
                    }}
                  >
                    <SelectTrigger className="w-full shadow-sm border-border">
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects.filter(p => selectedTeam === 'all' || p.teamId?.toString() === selectedTeam).map((project: any) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block font-semibold">Ticket</label>
                  <Select
                    value={selectedTicket}
                    onValueChange={setSelectedTicket}
                    disabled={selectedProject === 'all'}
                  >
                    <SelectTrigger className="w-full shadow-sm border-border">
                      <SelectValue placeholder={selectedProject === 'all' ? "Select Project First" : "All Tickets"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tickets</SelectItem>
                      {tickets
                        .filter(t => t.projectId?.toString() === selectedProject)
                        .map((ticket: any) => (
                          <SelectItem key={ticket.jiraKey} value={ticket.jiraKey}>
                            {ticket.jiraKey}: {ticket.title.length > 30 ? ticket.title.substring(0, 30) + '...' : ticket.title}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground mb-1 block font-semibold">Date Range</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <input
                        type="date"
                        className="w-full pl-7 pr-2 py-1.5 border border-border bg-background rounded-md text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="relative flex-1">
                      <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <input
                        type="date"
                        className="w-full pl-7 pr-2 py-1.5 border border-border bg-background rounded-md text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Movement History & Audit Trail</CardTitle>
                  <p className="text-sm text-muted-foreground">Click any row to view full ticket details and context</p>
                </div>
                <Badge variant="outline" className="bg-muted/50">
                  {filteredMovements.length} Records Found
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">

              <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto relative">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10 border-b">
                    <tr>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest">Ticket Key</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest text-center">Transition</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest">To Status</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest">Assignee</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest">Timestamp</th>
                      <th className="p-4 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.slice(0, visibleCount).map((movement: any, idx: number) => (
                      <tr
                        key={idx}
                        className={cn(
                          "border-b hover:bg-muted/50 cursor-pointer transition-colors group",
                          movement.isRollback ? 'bg-destructive/[0.03]' : ''
                        )}
                        onClick={() => handleRowClick(movement)}
                      >
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:underline">{movement.jiraKey}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-3">
                            <Badge variant="outline" className="text-[10px] font-bold tracking-tight bg-background">{movement.fromStatus}</Badge>
                            <ArrowRight className={cn(
                              "w-4 h-4",
                              movement.isRollback ? 'text-destructive rotate-180' : 'text-blue-500'
                            )} />
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className={cn(
                            "text-[10px] font-bold tracking-tight px-2 py-0.5",
                            movement.isRollback ? 'bg-destructive shadow-lg shadow-destructive/20' : 'bg-green-600 shadow-lg shadow-green-500/20'
                          )}>
                            {movement.toStatus}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                              {movement.changedBy?.charAt(0)}
                            </div>
                            <span className="text-sm text-foreground font-medium">{movement.changedBy}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-muted-foreground font-mono">
                            {new Date(movement.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {movement.isRollback ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="destructive" className="text-[9px] px-1.5 h-4 font-black">ROLLBACK</Badge>
                              {movement.justification && <MessageSquare className="w-3 h-3 text-destructive animate-pulse" />}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 h-4 bg-green-500/10 text-green-500 border-green-500/20 font-black">FORWARD</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-border">
                {filteredMovements.slice(0, visibleCount).map((movement: any, idx: number) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-4 hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer",
                      movement.isRollback ? 'bg-destructive/[0.05]' : ''
                    )}
                    onClick={() => handleRowClick(movement)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">{movement.jiraKey}</span>
                        {movement.isRollback && (
                          <Badge variant="destructive" className="text-[8px] h-4 px-1 font-black">ROLLBACK</Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(movement.createdAt).toLocaleDateString()} {new Date(movement.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-[9px] font-bold tracking-tight truncate max-w-[100px]">{movement.fromStatus}</Badge>
                      <ArrowRight className={cn(
                        "w-3 h-3 shrink-0",
                        movement.isRollback ? 'text-destructive rotate-180' : 'text-blue-500'
                      )} />
                      <Badge className={cn(
                        "text-[9px] font-bold tracking-tight truncate max-w-[100px]",
                        movement.isRollback ? 'bg-destructive' : 'bg-green-600'
                      )}>
                        {movement.toStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-semibold">{movement.changedBy}</span>
                      </div>
                      {movement.isRollback && movement.justification && (
                        <Badge variant="outline" className="text-[8px] text-destructive border-destructive/30 flex items-center gap-1">
                          <MessageSquare className="w-2 h-2" /> JUSTIFIED
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {filteredMovements.length > visibleCount && (
                <div className="p-4 border-t bg-muted/30/50 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount(prev => prev + 20)}
                    className="gap-2 bg-white"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Load More Movements ({filteredMovements.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-destructive/20 overflow-hidden">
            <CardHeader className="border-b bg-destructive/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-destructive" />
                  <CardTitle className="text-lg">Rollback Management</CardTitle>
                </div>
                <Badge variant="outline" className="border-destructive/20 text-destructive bg-card">
                  {rollbacksList.filter(m => !m.justification).length} Pending Justifications
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Ticket</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Transition</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Justification</th>
                      <th className="p-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollbacksList.map((m: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-destructive/10 cursor-pointer" onClick={() => handleRowClick(m)}>
                        <td className="p-4">
                          <span className="text-sm font-bold text-foreground">{m.jiraKey}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{m.fromStatus}</span>
                            <ArrowRight className="w-3 h-3 rotate-180 text-destructive/70" />
                            <span className="font-bold text-destructive">{m.toStatus}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {m.justification ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Justified</Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Unjustified</Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                            {m.justification || 'No justification provided yet...'}
                          </p>
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant={m.justification ? "outline" : "default"}
                            className={cn("h-8 text-xs", !m.justification && "bg-destructive hover:bg-destructive/80 text-destructive-foreground")}
                            onClick={(e) => handleJustifyClick(m, e)}
                          >
                            {m.justification ? 'Edit Justification' : 'Justify Rollback'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {rollbacksList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground italic">No rollbacks found with the current filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent className="sm:max-w-md md:max-w-lg lg:max-w-xl">
              <SheetHeader className="border-b pb-4 px-6 mt-4">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                    <Ticket className="w-6 h-6 text-blue-600" />
                    {selectedMovement?.jiraKey}
                  </SheetTitle>
                  {selectedMovement?.ticketDetails && (
                    <Badge className={getStatusColor(selectedMovement.ticketDetails.status)}>
                      {getStatusLabel(selectedMovement.ticketDetails.status)}
                    </Badge>
                  )}
                </div>
                <SheetDescription className="text-base font-medium text-foreground mt-2">
                  {selectedMovement?.ticketDetails?.title}
                </SheetDescription>
              </SheetHeader>

              <div className="py-6 space-y-8 overflow-y-auto max-h-[calc(100vh-200px)] px-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Complexity</p>
                    <p className="text-xl font-bold text-foreground">
                      C{selectedMovement?.ticketDetails?.complexity || 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20">
                    <p className="text-[10px] text-destructive uppercase tracking-wider mb-1">Risk Level</p>
                    <p className="text-xl font-bold text-destructive">
                      R{selectedMovement?.ticketDetails?.risk || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                    <User className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Assigned To</p>
                      <p className="text-sm font-semibold">{selectedMovement?.ticketDetails?.assignedTo || 'Unassigned'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">System Ingested At</p>
                      <p className="text-sm font-semibold">
                        {selectedMovement?.ticketDetails?.createdAt ? new Date(selectedMovement.ticketDetails.createdAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedMovement?.isRollback && (
                  <div className={cn(
                    "p-5 rounded-2xl border-2 transition-all",
                    selectedMovement.justification
                      ? "bg-green-500/5 border-green-500/20 shadow-[0_0_15px_-5px_rgba(34,197,94,0.1)]"
                      : "bg-destructive/10 border-destructive/20 shadow-[0_0_15px_-5px_rgba(239,68,68,0.1)]"
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          selectedMovement.justification ? "bg-green-500/10" : "bg-destructive/10"
                        )}>
                          <AlertCircle className={cn("w-4 h-4", selectedMovement.justification ? "text-green-500" : "text-destructive")} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Rollback Audit Trail</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 text-[10px] font-bold rounded-lg hover:bg-muted/50 transition-colors"
                        onClick={() => handleJustifyClick(selectedMovement)}
                      >
                        {selectedMovement.justification ? 'Update Reason' : 'Justify Now'}
                      </Button>
                    </div>
                    <div className="bg-card/40 rounded-xl p-4 border border-border/50 backdrop-blur-sm">
                      {selectedMovement.justification ? (
                        <div className="space-y-3">
                          <p className="text-sm text-foreground font-medium leading-relaxed italic whitespace-pre-wrap">"{selectedMovement.justification}"</p>
                          <div className="flex flex-col gap-1.5 border-t border-border/30 pt-3">
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Justified By: <span className="text-foreground">{selectedMovement.justifiedBy || 'Admin'}</span></p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Date: <span className="text-foreground">{selectedMovement.justifiedAt ? new Date(selectedMovement.justifiedAt).toLocaleString() : 'N/A'}</span></p>
                            </div>
                            <p className="text-[9px] text-green-600 font-bold flex items-center gap-1 uppercase tracking-widest mt-1"><CheckCircle className="w-3 h-3" /> Verified for Audit</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-destructive font-bold leading-relaxed">Required: Action Pending</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">This transition requires a documented justification for quality assurance and governance tracking.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Ticket Lifecycle History</h4>
                  <div className="space-y-3">
                    {movements
                      .filter(m => m.jiraKey === selectedMovement?.jiraKey)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((historyItem, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "p-4 rounded-xl border transition-all",
                            historyItem.id === selectedMovement.id
                              ? "bg-blue-500/10 border-blue-500/20 ring-1 ring-blue-500/10"
                              : "bg-card border-border"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {new Date(historyItem.createdAt).toLocaleString()}
                            </span>
                            {historyItem.isRollback && (
                              <Badge variant="destructive" className="text-[8px] h-4">ROLLBACK</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-[10px] font-medium h-5">{historyItem.fromStatus}</Badge>
                            <ArrowRight className={cn("w-3 h-3", historyItem.isRollback ? "text-red-500 rotate-180" : "text-emerald-500")} />
                            <Badge className={cn("text-[10px] font-bold h-5", historyItem.isRollback ? "bg-red-600" : "bg-green-600")}>
                              {historyItem.toStatus}
                            </Badge>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 opacity-70">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="text-[10px] font-medium text-muted-foreground">{historyItem.changedBy}</span>
                            </div>
                            {historyItem.isRollback && (
                              <Button variant="ghost" className="h-6 text-[9px] font-bold p-0 px-2" onClick={(e) => handleJustifyClick(historyItem, e)}>
                                {historyItem.justification ? 'View Log' : 'Justify'}
                              </Button>
                            )}
                          </div>

                          {historyItem.isRollback && historyItem.justification && (
                            <div className="mt-2 pt-2 border-t border-dashed text-xs text-muted-foreground italic">
                              Reason: {historyItem.justification}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 border-t mt-auto flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsSheetOpen(false)}>Close</Button>
                {selectedMovement?.ticketDetails && (
                  <Button
                    variant="default"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => window.open(`https://nibss.atlassian.net/browse/${selectedMovement.jiraKey}`, '_blank')}
                  >
                    View JIRA <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Dialog open={isJustifyModalOpen} onOpenChange={setIsJustifyModalOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-red-600" />
                  Justify Rollback: {justifyingMovement?.jiraKey}
                </DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20 mb-2">
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase">From</p>
                    <span className="text-xs font-bold text-foreground">{justifyingMovement?.fromStatus}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 rotate-180 text-destructive/50" />
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase">To (Rollback)</p>
                    <span className="text-xs font-black text-destructive">{justifyingMovement?.toStatus}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground">Justification Reason</label>
                  <Textarea
                    placeholder="Ex: Discovered bug in SIT, Requirements changed during testing, Failed internal verification..."
                    className="min-h-[120px] text-sm"
                    value={justificationText}
                    onChange={(e) => setJustificationText(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground italic">This justification is required for quality audits and resource optimization analysis.</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsJustifyModalOpen(false)}>Cancel</Button>
                <Button
                  className="bg-destructive hover:bg-destructive/80 text-destructive-foreground"
                  onClick={submitJustification}
                  disabled={submittingJustification || !justificationText.trim()}
                >
                  {submittingJustification ? 'Saving...' : 'Save Justification'}
                </Button>
              </DialogFooter>

              {submittingJustification && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-2 text-foreground">
                    <RotateCcw className="h-8 w-8 animate-spin text-destructive" />
                    <p className="text-sm font-medium">Saving Justification...</p>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}