import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { LayoutGrid, FileText, AlertCircle, Search, ExternalLink, Clock, User as UserIcon, Activity, CheckCircle2, ShieldAlert, History, Share2, Layers, ChevronRight, Unlink, Edit3, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/app/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/app/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/app/components/ui/sheet";
import { Input } from "@/app/components/ui/input";
import apiService from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Project {
    id: number;
    name: string;
    jiraKey: string;
    teamId?: number;
    manualMappingCount?: number;
}

interface Ticket {
    id: number;
    jiraKey: string;
    title: string;
    description?: string;
    epicKey?: string;
    status: number | string;
    projectId?: number;
    assignedTo?: string;
    createdAt?: string;
}

export const JiraMapping = () => {
    const { user } = useAuth();
    const [unmappedTickets, setUnmappedTickets] = useState<Ticket[]>([]);
    const [allMappedTickets, setAllMappedTickets] = useState<Ticket[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [teamFilter, setTeamFilter] = useState("all");
    const [visibleOrphansCount, setVisibleOrphansCount] = useState(10);
    const [visibleMappedCount, setVisibleMappedCount] = useState(10);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [activeProjectTab, setActiveProjectTab] = useState<number | null>(null);

    // New project form state
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isSubmittingProject, setIsSubmittingProject] = useState(false);
    const [newProject, setNewProject] = useState<{ name: string; teamId: number | string }>({ name: '', teamId: 'none' });

    // Editing state
    const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
    const [editingProjectName, setEditingProjectName] = useState("");

    const availableTeams = useMemo(() => [
        { id: 1, name: 'Collections', prefix: 'SKP' },
        { id: 2, name: 'Core Switching', prefix: 'IR' },
        { id: 3, name: 'Data & Identity', prefix: 'CASP' },
        { id: 4, name: 'Enterprise Solutions', prefix: 'BARP3' }
    ], []);

    const isAdmin = user?.role === 'Admin' || user?.permissions?.admin;
    const authorizedTeamIds = user?.permissions?.teams || [];

    const filteredAvailableTeams = useMemo(() => {
        if (isAdmin) return availableTeams;
        return availableTeams.filter(t => authorizedTeamIds.map(Number).includes(t.id));
    }, [isAdmin, authorizedTeamIds, availableTeams]);

    useEffect(() => {
        if (filteredAvailableTeams.length === 1 && teamFilter === 'all') {
            setTeamFilter(filteredAvailableTeams[0].id.toString());
        }
    }, [filteredAvailableTeams, teamFilter]);

    useEffect(() => {
        if (isCreatingProject) {
            if (filteredAvailableTeams.length === 1) {
                setNewProject(prev => ({ ...prev, teamId: filteredAvailableTeams[0].id }));
            } else {
                setNewProject(prev => ({ ...prev, teamId: 'none' }));
            }
        }
    }, [isCreatingProject, filteredAvailableTeams]);

    const getTeamIdFromJiraKey = useCallback((key: string) => {
        const prefix = key.split('-')[0].toUpperCase();
        const team = availableTeams.find(t => t.prefix === prefix);
        return team ? team.id : null;
    }, [availableTeams]);

    const fetchTickets = useCallback(async (overriddenTabId?: number | null) => {
        console.log("Fetching tickets/projects. Override Tab ID:", overriddenTabId);
        try {
            const [orphans, allTicketsData, allProjects] = await Promise.all([
                apiService.getUnmappedTickets(),
                apiService.getTickets(),
                apiService.getProjects(true)
            ]);

            setUnmappedTickets(orphans);

            const normalizedTickets = (allTicketsData as any[]).map(t => ({
                ...t,
                projectId: t.projectId !== undefined ? t.projectId : (t.project_id !== undefined ? t.project_id : (t.ProjectId !== undefined ? t.ProjectId : null)),
                epicKey: t.epicKey !== undefined ? t.epicKey : (t.epic_key !== undefined ? t.epic_key : (t.EpicKey !== undefined ? t.EpicKey : null)),
                jiraKey: t.jiraKey || t.jira_key || t.JiraKey || ''
            }));

            const manualMapped = normalizedTickets.filter(t => t.projectId && !t.epicKey);
            setAllMappedTickets(manualMapped);

            const activeProjectIds = new Set(manualMapped.map(t => t.projectId));
            const normalizedProjects = (allProjects as any[]).map(p => {
                const id = p.id !== undefined ? p.id : (p.Id !== undefined ? p.Id : null);
                const name = p.name !== undefined ? p.name : (p.Name !== undefined ? p.Name : '');
                const jiraKey = p.jiraKey || p.jira_key || p.JiraKey || '';
                const teamId = p.teamId !== undefined ? p.teamId : (p.team_id !== undefined ? p.team_id : (p.TeamId !== undefined ? p.TeamId : null));
                const manualMappingCount = p.manualMappingCount ?? p.manual_mapping_count ?? p.ManualMappingCount ?? 0;

                return { ...p, id, name, jiraKey, teamId, manualMappingCount };
            });

            setProjects(normalizedProjects as Project[]);

            const activeProjects = normalizedProjects.filter(p => {
                const isManual = !p.jiraKey || p.jiraKey.trim() === '';
                const hasMapping = activeProjectIds.has(p.id);
                const pTeamId = p.teamId !== null ? Number(p.teamId) : null;
                const isAuthorized = isAdmin || (pTeamId !== null && authorizedTeamIds.map(Number).includes(pTeamId));
                return isAuthorized && (isManual || hasMapping);
            });

            // If we have an override (e.g. from creation), use it. Otherwise use state.
            const currentTab = overriddenTabId !== undefined ? overriddenTabId : activeProjectTab;
            const isTabStillValid = activeProjects.some(p => p.id === currentTab);

            console.log("Tab Validation:", { currentTab, isTabStillValid, activeCount: activeProjects.length });

            if (!isTabStillValid || currentTab === null) {
                if (activeProjects.length > 0) {
                    setActiveProjectTab(activeProjects[0].id);
                } else {
                    setActiveProjectTab(null);
                }
            } else if (overriddenTabId !== undefined) {
                setActiveProjectTab(overriddenTabId);
            }
        } catch (error) {
            console.error("Failed to fetch tickets", error);
        }
    }, [activeProjectTab, isAdmin, authorizedTeamIds]);

    const fetchData = useCallback(async (silent = false, overriddenTabId?: number | null) => {
        if (!silent) setLoading(true);
        try {
            await fetchTickets(overriddenTabId);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [fetchTickets]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateTicketMapping = async (ticketId: number, projectId: number | null) => {
        // Optimistic update
        const ticketToUpdate = unmappedTickets.find(t => t.id === ticketId) || allMappedTickets.find(t => t.id === ticketId);
        if (!ticketToUpdate) return;

        const previousUnmapped = [...unmappedTickets];
        const previousMapped = [...allMappedTickets];

        if (projectId) {
            // Mapping: remove from orphans, add to mapped
            setUnmappedTickets(prev => prev.filter(t => t.id !== ticketId));
            setAllMappedTickets(prev => [...prev, { ...ticketToUpdate, projectId }]);
        } else {
            // Unmapping: remove from mapped, add back to orphans
            setAllMappedTickets(prev => prev.filter(t => t.id !== ticketId));
            setUnmappedTickets(prev => [
                { ...ticketToUpdate, projectId: undefined },
                ...prev
            ].sort((a, b) => (b.id - a.id)));
        }

        try {
            await apiService.mapTicketToProject(ticketId, projectId);
            toast.success(projectId ? "Ticket mapped successfully" : "Ticket unmapped");
            // Silent refresh to ensure sync
            fetchData(true);
        } catch (error) {
            // Rollback on failure
            setUnmappedTickets(previousUnmapped);
            setAllMappedTickets(previousMapped);
            console.error("Mapping update error:", error);
            toast.error("Failed to update ticket mapping");
        }
    };

    const handleCreateProject = async () => {
        if (!newProject.name.trim()) return toast.error("Project name is required");
        if (newProject.teamId === 'none') return toast.error("Please select a responsible team");

        const today = new Date();
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + 30);

        try {
            setIsSubmittingProject(true);
            const projectData = {
                name: newProject.name.trim(),
                teamId: Number(newProject.teamId),
                jiraKey: '',
                status: 'Active',
                startDate: today.toISOString().split('T')[0],
                targetDate: targetDate.toISOString().split('T')[0],
                description: '',
                lead: 'Unassigned'
            };

            const response = await apiService.createProject(projectData) as Project;

            if (response && response.id) {
                toast.success(`Project "${newProject.name.trim()}" created successfully`);

                // Ensure visibility immediately (bypass stale filter state)
                const teamIdStr = newProject.teamId.toString();
                if (teamFilter !== 'all' && teamFilter !== teamIdStr) {
                    setTeamFilter('all');
                }

                setIsCreatingProject(false);
                setNewProject({ name: '', teamId: 'none' });

                // Use the explicit ID to force selection on the new project after fetch
                await fetchData(true, response.id);
            } else {
                throw new Error("Invalid response from server - missing project ID");
            }
        } catch (error) {
            console.error("Project creation error:", error);
            toast.error("Failed to create project. Please verify all details.");
        } finally {
            setIsSubmittingProject(false);
        }
    };

    const handleUpdateProject = async (id: number) => {
        if (!editingProjectName.trim()) return toast.error("Project name cannot be empty");
        try {
            const project = projects.find(p => p.id === id);
            if (!project) return;
            await apiService.updateProject(id, { ...project, name: editingProjectName });
            toast.success("Project updated");
            setEditingProjectId(null);
            fetchData();
        } catch (error) {
            toast.error("Failed to update project");
        }
    };

    const handleDeleteProject = async (id: number) => {
        try {
            await apiService.deleteProject(id);
            toast.success("Project deleted");
            if (activeProjectTab === id) setActiveProjectTab(null);
            fetchData();
        } catch (error) {
            toast.error("Could not delete project. Ensure it has no mapped tickets.");
        }
    };

    const getStatusBadge = (status: number | string) => {
        let statusNum = 0;
        if (typeof status === 'number') {
            statusNum = status;
        } else if (typeof status === 'string') {
            // Check if it's just a number string
            if (!isNaN(Number(status))) {
                statusNum = Number(status);
            } else {
                const normalizedStatus = status.toUpperCase().trim();
                const statusMap: any = {
                    'BACKLOG': 0, 'TODO': 0, 'TO DO': 0,
                    'SELECTED_FOR_DEV': 1, 'SELECTED': 1,
                    'IN_PROGRESS': 2, 'IN PROGRESS': 2, 'INPROGRESS': 2,
                    'REVIEW': 3,
                    'TESTING': 4,
                    'CAB_READY': 5, 'CAB READY': 5, 'CABAPPROVAL': 5, 'CAB APPROVAL': 5,
                    'READY_TO_DEPLOY': 6, 'READY TO DEPLOY': 6, 'LIVE': 7,
                    'DONE': 7,
                    'ROLLBACK': 8
                };
                statusNum = statusMap[normalizedStatus] ?? 0;
            }
        }

        const statuses: Record<number, { label: string, color: string }> = {
            0: { label: 'Backlog', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-400' },
            1: { label: 'To Do', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
            2: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
            3: { label: 'Review', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' },
            4: { label: 'Testing', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
            5: { label: 'CAB Ready', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400' },
            6: { label: 'Ready to Deploy', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
            7: { label: 'Done', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
            8: { label: 'Rollback', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' }
        };
        const s = statuses[statusNum] || statuses[0];
        return <Badge className={cn("border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest", s.color)}>{s.label}</Badge>;
    };

    const filteredOrphans = unmappedTickets.filter(t => {
        const teamId = getTeamIdFromJiraKey(t.jiraKey);
        const isAuthorized = isAdmin || (teamId !== null && authorizedTeamIds.map(Number).includes(Number(teamId)));
        if (!isAuthorized) return false;

        const matchesTeamFilter = teamFilter === "all" || teamId?.toString() === teamFilter;
        if (!matchesTeamFilter) return false;

        const matchesSearch = t.jiraKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    const paginatedOrphans = filteredOrphans.slice(0, visibleOrphansCount);

    // Filter ALL mapped tickets by SEARCH and TEAM
    const filteredMappedTickets = allMappedTickets.filter(t => {
        // Search filter
        const matchesSearch = searchQuery === "" ||
            t.jiraKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.title.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        // Team filter (applied to the ticket itself)
        const ticketTeamId = getTeamIdFromJiraKey(t.jiraKey);
        const ticketMatchesTeam = teamFilter === "all" || ticketTeamId?.toString() === teamFilter;

        return ticketMatchesTeam;
    });

    // Grouping logic for the mapping visualization
    const projectsWithManualMappings = useMemo(() => {
        return (projects as Project[])
            .filter(p => {
                const isManual = !p.jiraKey || p.jiraKey.trim() === '';
                const pTeamId = p.teamId !== null ? Number(p.teamId) : null;

                // 1. Authorization Check (already normalized in fetchTickets, but safe to verify)
                const isAuthorized = isAdmin || (pTeamId !== null && authorizedTeamIds.map(Number).includes(pTeamId));
                if (!isAuthorized) return false;

                // 2. Team Selection Filter
                const matchesTeamFilter = teamFilter === "all" || pTeamId?.toString() === teamFilter;
                if (!matchesTeamFilter) return false;

                // 3. Search Filter (on project name or its manual tickets)
                const ticketsInProject = allMappedTickets.filter(t => t.projectId === p.id);

                const nameMatchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
                const ticketsMatchSearch = ticketsInProject.some(t =>
                    t.jiraKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.title.toLowerCase().includes(searchQuery.toLowerCase())
                );
                const matchesSearch = searchQuery === "" || nameMatchesSearch || ticketsMatchSearch;

                if (!matchesSearch) return false;

                // 4. Governance Rule: 
                //    - Show ALL manual projects
                //    - Show JIRA projects ONLY if they have manual mappings
                const hasManualMapping = (p as any).manualMappingCount > 0 || ticketsInProject.length > 0;

                if (isManual) return true;
                return hasManualMapping;
            })
            .map(p => ({
                ...p,
                tickets: allMappedTickets.filter(t => t.projectId === p.id)
            }));
    }, [projects, allMappedTickets, teamFilter, searchQuery, isAdmin, authorizedTeamIds]);

    const activeProjectData = projectsWithManualMappings.find(p => p.id === activeProjectTab);
    const activeProjectMappedTickets = activeProjectData ? activeProjectData.tickets : [];
    const paginatedMappedTickets = activeProjectMappedTickets.slice(0, visibleMappedCount);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight uppercase flex items-center gap-3">
                        <Share2 className="w-8 h-8 text-green-600" />
                        Jira Governance Mapping
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium italic opacity-80">Orphan ticket routing and project mapping visualization</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => setIsCreatingProject(true)}
                        className="h-10 px-6 font-black uppercase tracking-widest text-[10px] border border-dashed border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-all rounded-xl w-full md:w-auto"
                    >
                        + Create Manual Project
                    </Button>
                </div>
            </div>

            {isCreatingProject && (
                <Card className="border-green-600/40 bg-green-50/10 dark:bg-green-950/20 p-6 md:p-8 rounded-3xl animate-in fade-in zoom-in-95 duration-200 border-2 border-dashed">
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        <div className="flex-1 w-full space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Project Name</label>
                            <Input
                                placeholder="e.g. NIBSSPay Rebuild"
                                value={newProject.name}
                                onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                                className="h-12 bg-white dark:bg-gray-900 border-green-600/40 rounded-xl focus:ring-green-500/20"
                                disabled={isSubmittingProject}
                            />
                        </div>

                        {filteredAvailableTeams.length > 1 && (
                            <div className="w-full md:w-64 space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Responsible Team</label>
                                <Select
                                    value={newProject.teamId.toString()}
                                    onValueChange={val => setNewProject({ ...newProject, teamId: val })}
                                    disabled={isSubmittingProject}
                                >
                                    <SelectTrigger className="h-12 bg-white dark:bg-gray-900 border-green-600/40 rounded-xl">
                                        <SelectValue placeholder="Select a Team" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="none" disabled className="text-muted-foreground italic">Select a Team</SelectItem>
                                        {filteredAvailableTeams.map(t => (
                                            <SelectItem key={t.id} value={t.id.toString()} className="rounded-lg">{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="flex gap-3 w-full md:w-auto">
                            <Button
                                variant="ghost"
                                className="flex-1 md:flex-none font-black uppercase tracking-widest text-[10px] h-12"
                                onClick={() => setIsCreatingProject(false)}
                                disabled={isSubmittingProject}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-10 shadow-lg shadow-green-500/20 rounded-xl"
                                onClick={handleCreateProject}
                                disabled={isSubmittingProject}
                            >
                                {isSubmittingProject ? 'Creating...' : 'Create Project'}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* SECTION: ORPHANED TICKETS (NOW FIRST) */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row flex-1 gap-4 items-center w-full md:w-auto">
                        <div className="relative flex-1 w-full md:w-96 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-green-600 transition-colors" />
                            <Input
                                placeholder="Search orphan tickets..."
                                className="pl-12 h-12 border-border/80 focus:ring-green-500/20 focus:border-green-500 transition-all rounded-2xl bg-card"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-56">
                            <Select value={teamFilter} onValueChange={setTeamFilter}>
                                <SelectTrigger className="h-12 border-border/80 rounded-2xl bg-card font-bold">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-green-600" />
                                        <SelectValue placeholder="All Teams" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    {filteredAvailableTeams.length > 1 && <SelectItem value="all" className="font-bold">All Active Teams</SelectItem>}
                                    {filteredAvailableTeams.map(t => (
                                        <SelectItem key={t.id} value={t.id.toString()} className="font-bold">{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground bg-muted/30 px-6 py-3 rounded-2xl border border-border/80 w-full md:w-auto justify-center">
                        <FileText className="w-4 h-4 text-green-600" />
                        {filteredOrphans.length} Visible Orphan Targets
                    </div>
                </div>

                <Card className="border-0 shadow-2xl shadow-black/5 overflow-hidden rounded-[2.5rem] border border-border/80">
                    <CardHeader className="bg-muted/30 p-6 md:p-10 border-b border-border/80">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-xl font-black flex items-center gap-3 uppercase tracking-tight">
                                    <AlertCircle className="w-6 h-6 text-amber-500" />
                                    Orphaned Tickets
                                </CardTitle>
                                <CardDescription className="font-medium text-sm italic opacity-70">
                                    These tickets lack parent Epics in JIRA. Assign them to target tracker projects for lifecycle visibility.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 border-0">
                                    <TableHead className="w-[140px] font-black uppercase tracking-[0.2em] text-[10px] text-muted-foreground pl-10 h-16">Key Reference</TableHead>
                                    <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-muted-foreground h-16">Title & Summary</TableHead>
                                    <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-muted-foreground w-[300px] md:w-[380px] h-16 text-center">Destination Project Mapping</TableHead>
                                    <TableHead className="text-right font-black uppercase tracking-[0.2em] text-[10px] text-muted-foreground pr-10 h-16">Governance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-32">
                                            <div className="flex flex-col items-center gap-6">
                                                <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                                                <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Synchronizing buffer...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredOrphans.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-32">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                                                </div>
                                                <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Execution Queue Clear</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    <>
                                        {paginatedOrphans.map((ticket) => {
                                            const ticketTeamId = getTeamIdFromJiraKey(ticket.jiraKey);
                                            const filteredProjectsForTicket = (projects as Project[]).filter(p => {
                                                const pTeamId = p.teamId !== null ? Number(p.teamId) : null;
                                                const isAuthorized = isAdmin || (pTeamId !== null && authorizedTeamIds.map(Number).includes(pTeamId));
                                                return isAuthorized && (!ticketTeamId || pTeamId === ticketTeamId);
                                            });

                                            return (
                                                <TableRow
                                                    key={ticket.id}
                                                    className="hover:bg-green-50/50 dark:hover:bg-green-950/10 transition-all border-border/70 group cursor-pointer h-20"
                                                    onClick={() => setSelectedTicket(ticket)}
                                                >
                                                    <TableCell className="pl-10">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <Badge variant="outline" className="font-mono font-black text-[10px] border-border/80 group-hover:text-green-600 group-hover:border-green-600/50 transition-all bg-card px-3 py-1">
                                                                {ticket.jiraKey}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <div className="font-bold text-foreground group-hover:text-green-600 transition-all max-w-md truncate">
                                                                {ticket.title}
                                                            </div>
                                                            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-3">
                                                                <span className="flex items-center gap-1"><UserIcon className="w-2.5 h-2.5" /> {ticket.assignedTo || "Unassigned"}</span>
                                                                <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell onClick={(e) => e.stopPropagation()} className="px-6">
                                                        <Select
                                                            value={ticket.projectId?.toString() || "none"}
                                                            onValueChange={(val) => updateTicketMapping(ticket.id, val === "none" ? null : parseInt(val))}
                                                        >
                                                            <SelectTrigger className="h-11 font-black uppercase tracking-widest text-[10px] focus:ring-green-500/20 border-border/60 bg-card rounded-xl hover:border-green-600/50 transition-all shadow-sm">
                                                                <SelectValue placeholder="Select Destination Project" />
                                                            </SelectTrigger>
                                                            <SelectContent className="max-h-[350px] rounded-xl shadow-2xl border-green-600/40">
                                                                <SelectItem value="none" className="font-bold py-3 text-red-500">Select destination project</SelectItem>
                                                                {filteredProjectsForTicket.map(p => (
                                                                    <SelectItem key={p.id} value={p.id.toString()} className="font-bold py-3 rounded-lg">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">[{p.jiraKey || 'MANUAL'}]</span>
                                                                            <span className="text-sm">{p.name}</span>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                                {filteredProjectsForTicket.length === 0 && (
                                                                    <div className="p-8 text-center space-y-3">
                                                                        <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto opacity-50" />
                                                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-relaxed">
                                                                            No projects mapped to <br /> this team.
                                                                        </p>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="text-[9px] font-black uppercase h-8 px-4"
                                                                            onClick={() => setIsCreatingProject(true)}
                                                                        >
                                                                            Create Project
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-10" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-10 w-10 text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-xl transition-all"
                                                                onClick={() => setSelectedTicket(ticket)}
                                                                title="View Details"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </>
                                )}
                            </TableBody>
                        </Table>

                        {visibleOrphansCount < filteredOrphans.length && (
                            <div className="flex justify-center p-6 md:p-10 bg-muted/20 border-t border-border/80">
                                <Button
                                    variant="outline"
                                    onClick={() => setVisibleOrphansCount(prev => prev + 10)}
                                    className="font-black uppercase tracking-[0.2em] text-[10px] px-8 md:px-12 h-12 border-green-600/50 text-green-700 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-2xl transition-all shadow-lg shadow-green-500/5 group w-full md:w-auto"
                                >
                                    <History className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                                    Load Buffer ({filteredOrphans.length - visibleOrphansCount} remaining)
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* SECTION: TICKET MAPPINGS (NOW SECOND) */}
            <div className="space-y-8">
                <div className="flex items-center gap-3">
                    <Layers className="w-6 h-6 text-green-600" />
                    <h2 className="text-xl font-black uppercase tracking-widest text-foreground">Ticket Mappings</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[500px]">
                    {/* Left Side: Project Navigation Rail */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-muted/10 p-2 rounded-[2rem] border border-border/80 max-h-[600px] overflow-y-auto custom-scrollbar">
                            <div className="sticky top-0 z-10 px-4 py-2 mb-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Active Projects</p>
                                <h3 className="text-sm font-bold">Mapping Context</h3>
                            </div>
                            {projectsWithManualMappings.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        setActiveProjectTab(p.id);
                                        setVisibleMappedCount(10); // Reset pagination on project change
                                    }}
                                    className={cn(
                                        "p-4 rounded-2xl cursor-pointer transition-all group relative overflow-hidden mb-2",
                                        activeProjectTab === p.id
                                            ? "bg-green-600 text-white shadow-xl shadow-green-500/20"
                                            : "hover:bg-muted/50 text-muted-foreground border border-transparent hover:border-green-600/50"
                                    )}
                                >
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="space-y-1">
                                            <p className={cn("text-[9px] font-black uppercase tracking-widest", activeProjectTab === p.id ? "text-green-50" : "text-muted-foreground")}>
                                                {p.jiraKey || 'MANUAL'}
                                            </p>
                                            <h4 className="font-bold text-sm truncate max-w-[180px]">{p.name}</h4>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {p.tickets.length === 0 && !p.jiraKey && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-7 w-7 rounded-lg transition-all",
                                                        activeProjectTab === p.id ? "text-white/60 hover:text-white hover:bg-white/20" : "text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm(`Delete manual project "${p.name}"?`)) {
                                                            handleDeleteProject(p.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                            <div className={cn(
                                                "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all",
                                                activeProjectTab === p.id ? "bg-white/20" : "bg-green-600/10 text-green-600 group-hover:bg-green-600 group-hover:text-white"
                                            )}>
                                                {p.tickets.length}
                                            </div>
                                        </div>
                                    </div>
                                    {activeProjectTab === p.id && (
                                        <div className="absolute top-0 right-0 h-full w-1 bg-white/20" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Side: Dynamic List View */}
                    <div className="lg:col-span-8">
                        <Card className="h-full rounded-[2.5rem] border-0 shadow-2xl shadow-black/5 bg-gradient-to-br from-background to-muted/20 relative overflow-hidden flex flex-col border border-border/80">
                            {activeProjectData ? (
                                <>
                                    <div className="px-8 pt-6 pb-2 border-b border-border/80 sticky top-0 bg-background/50 backdrop-blur-xl z-10">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1 flex-1 mr-4">
                                                {editingProjectId === activeProjectTab ? (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                                        <Input
                                                            value={editingProjectName}
                                                            onChange={e => setEditingProjectName(e.target.value)}
                                                            className="text-xl font-black h-10 bg-white border-2 border-green-600/50 rounded-xl px-4"
                                                            autoFocus
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleUpdateProject(activeProjectData.id);
                                                                if (e.key === 'Escape') setEditingProjectId(null);
                                                            }}
                                                        />
                                                        <Button size="icon" className="h-10 w-10 shrink-0 bg-green-600 rounded-xl" onClick={() => handleUpdateProject(activeProjectData.id)}>
                                                            <Check className="w-4 h-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-xl" onClick={() => setEditingProjectId(null)}>
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 group/title">
                                                        <h3 className="text-2xl font-black text-foreground">{activeProjectData?.name}</h3>
                                                        {!activeProjectData?.jiraKey && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 opacity-0 group-hover/title:opacity-100 transition-opacity rounded-lg hover:bg-green-50 text-green-600"
                                                                onClick={() => {
                                                                    setEditingProjectId(activeProjectTab);
                                                                    setEditingProjectName(activeProjectData?.name || "");
                                                                }}
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                    <span className="flex items-center gap-2"><LayoutGrid className="w-3 h-3" /> {activeProjectData?.jiraKey || 'Manual Context'}</span>
                                                    <span className="flex items-center gap-2"><UserIcon className="w-3 h-3" /> {filteredAvailableTeams.find(t => t.id === activeProjectData?.teamId)?.name || 'Generic'}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Mapping Density</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-black text-green-600">{activeProjectMappedTickets.length}</span>
                                                    <span className="text-xs font-bold text-muted-foreground">Units</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-8 pt-2 pb-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                        {activeProjectMappedTickets.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-40">
                                                <Layers className="w-12 h-12 mb-4" />
                                                <p className="font-black uppercase tracking-widest text-[10px]">No execution units linked</p>
                                                <p className="text-xs font-medium">Select orphan tickets to map them here</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-3 pb-8">
                                                    {paginatedMappedTickets.map((ticket, idx) => (
                                                        <div
                                                            key={ticket.id}
                                                            className="group bg-background/50 border border-border/80 p-6 rounded-[2rem] hover:border-green-600/50 transition-all hover:shadow-lg hover:shadow-black/[0.02] relative"
                                                        >
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-5 flex-1 overflow-hidden">
                                                                    <div className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center text-[10px] font-black text-muted-foreground shrink-0">
                                                                        {idx + 1}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <Badge variant="outline" className="font-mono text-[9px] py-0">{ticket.jiraKey}</Badge>
                                                                            {getStatusBadge(ticket.status)}
                                                                        </div>
                                                                        <h5 className="font-bold text-sm truncate">{ticket.title}</h5>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-10 w-10 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            updateTicketMapping(ticket.id, null);
                                                                        }}
                                                                        title="Unmap Ticket"
                                                                    >
                                                                        <Unlink className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-10 w-10 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded-xl"
                                                                        onClick={() => setSelectedTicket(ticket)}
                                                                    >
                                                                        <ChevronRight className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {visibleMappedCount < activeProjectMappedTickets.length && (
                                                    <div className="flex justify-center pt-2 pb-6">
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => setVisibleMappedCount(prev => prev + 10)}
                                                            className="font-black uppercase tracking-widest text-[9px] text-green-600 hover:bg-green-50 rounded-xl"
                                                        >
                                                            <History className="w-3 h-3 mr-2" />
                                                            Show {Math.min(10, activeProjectMappedTickets.length - visibleMappedCount)} More Mapped Units
                                                        </Button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                                    <Share2 className="w-16 h-16 text-muted-foreground/20 mb-6 animate-pulse" />
                                    <h3 className="text-2xl font-black text-muted-foreground/50">Select a project context</h3>
                                    <p className="text-sm font-medium text-muted-foreground/40 mt-2">View and manage mapping associations for execution units</p>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>

            <div className="bg-green-600/5 border border-green-600/40 p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row gap-8 text-green-700 dark:text-green-400 animate-in slide-in-from-bottom-5 duration-700 border-l-8 border-l-green-600">
                <ShieldAlert className="h-10 w-10 shrink-0 text-green-600 mx-auto md:mx-0" />
                <div className="space-y-3 text-center md:text-left">
                    <p className="font-black uppercase tracking-[0.2em] text-[12px] mb-2 leading-none flex items-center justify-center md:justify-start gap-2">
                        <Activity className="w-4 h-4" /> Architectural Governance: Execution Schema
                    </p>
                    <p className="leading-relaxed opacity-90 font-medium text-sm italic">
                        Tickets mapped here will automatically slot into the <span className="font-black text-green-700 dark:text-green-500 underline underline-offset-8 decoration-2 decoration-green-600/30">Execution Board</span> of the assigned project. They will respect their current JIRA status and contribute to the project's delivery aggregation, velocity calculation, and variance modeling.
                    </p>
                </div>
            </div>

            <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
                <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col border-l-4 border-green-600/50 bg-white dark:bg-slate-950">
                    <SheetHeader className="p-6 md:p-10 bg-green-600/[0.03] border-b border-green-600/10 space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-green-600/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <Badge className="bg-green-600/10 text-green-600 border-none font-mono text-[11px] px-4 py-1.5 font-black uppercase tracking-widest rounded-lg">
                                    {selectedTicket?.jiraKey}
                                </Badge>
                                {selectedTicket && getStatusBadge(selectedTicket.status)}
                            </div>
                        </div>

                        <SheetTitle className="text-2xl md:text-3xl font-black text-foreground tracking-tight leading-[1.1] relative z-10">
                            {selectedTicket?.title}
                        </SheetTitle>

                        <div className="flex flex-wrap items-center gap-6 relative z-10 pt-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-green-500/20">
                                    {selectedTicket?.assignedTo?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Assignee</span>
                                    <span className="text-sm font-bold">{selectedTicket?.assignedTo || "Unassigned"}</span>
                                </div>
                            </div>
                            <div className="h-10 w-px bg-border/50 hidden sm:block" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Created On</span>
                                <span className="text-sm font-bold flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-green-600" />
                                    {selectedTicket?.createdAt ? new Date(selectedTicket.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : '---'}
                                </span>
                            </div>
                        </div>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar">
                        <div className="space-y-4">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                                <div className="w-1.5 h-10 bg-green-600 rounded-full" />
                                Jira content
                            </h4>
                            <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 bg-muted/20 p-6 md:p-8 rounded-[2rem] border border-border/80 whitespace-pre-wrap italic font-medium">
                                {selectedTicket?.description || "No description provided from JIRA execution agent."}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-border/80">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                                <Activity className="w-4 h-4 text-green-600" />
                                Map to Project
                            </h4>
                            <div className="bg-green-600/[0.02] p-6 rounded-[2rem] border border-green-600/10">
                                <Select
                                    value={selectedTicket?.projectId?.toString() || "none"}
                                    onValueChange={(val) => selectedTicket && updateTicketMapping(selectedTicket.id, val === "none" ? null : parseInt(val))}
                                >
                                    <SelectTrigger className="h-14 font-black uppercase tracking-widest text-[11px] focus:ring-green-500/20 border-border/80 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                                        <SelectValue placeholder="Select Destination Project" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[350px] rounded-2xl shadow-2xl border-green-600/40">
                                        <SelectItem value="none" className="font-bold py-3 text-red-500">Select destination project</SelectItem>
                                        {selectedTicket && (projects as Project[]).filter(p => {
                                            const ticketTeamId = getTeamIdFromJiraKey(selectedTicket.jiraKey);
                                            const pTeamId = p.teamId !== null ? Number(p.teamId) : null;
                                            return !ticketTeamId || pTeamId === ticketTeamId;
                                        }).map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()} className="font-bold py-3 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">[{p.jiraKey || 'MANUAL'}]</span>
                                                    <span className="text-sm">{p.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-10 bg-white dark:bg-slate-950 border-t border-border/80 mt-auto">
                        <Button
                            variant="ghost"
                            className="w-full font-black uppercase tracking-[0.3em] text-[11px] h-14 rounded-2xl transition-all active:scale-95 border border-border/80"
                            onClick={() => setSelectedTicket(null)}
                        >
                            Back to List
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
};
