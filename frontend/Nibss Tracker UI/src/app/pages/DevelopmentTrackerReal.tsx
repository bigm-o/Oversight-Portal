import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/app/components/ui/card';
import { Users, Folder, ChevronRight, GitBranch, Calendar, Target, Clock, XCircle, AlertTriangle, CheckCircle, Archive, Settings, Zap } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { LoadingSpinner } from '@/app/components/ui/loading';
import { ErrorDisplay } from '@/app/components/ui/error';
import { apiService } from '@/services/apiService';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

import { useAuth } from '@/contexts/AuthContext';
import { useSync, SyncStatus } from '@/contexts/SyncContext';

// ─────────────────────────────────────────────────────────────────────────────
// Per-team board column schemas
// These define the EXACT column layout as it appears on each live JIRA board.
// Defined outside the component to avoid recreation on every render.
// ─────────────────────────────────────────────────────────────────────────────

type BoardCol = {
  label: string;
  color: string;
  // Sprint board: match on the raw JIRA status string (case-insensitive)
  matchSprint: (s: string) => boolean;
  // Execution board: match on TicketStatus numeric value (0-12)
  matchExec: (n: number) => boolean;
};

const C = {
  todo: 'bg-slate-500/5 dark:bg-slate-500/10 border-slate-200/50',
  prog: 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-200/50',
  block: 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-200/50',
  review: 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-200/50',
  devops: 'bg-cyan-500/5 dark:bg-cyan-500/10 border-cyan-200/50',
  rtt: 'bg-sky-500/5 dark:bg-sky-500/10 border-sky-200/50',
  test: 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-200/50',
  sec: 'bg-orange-500/5 dark:bg-orange-500/10 border-orange-200/50',
  uat: 'bg-teal-500/5 dark:bg-teal-500/10 border-teal-200/50',
  cab: 'bg-violet-500/5 dark:bg-violet-500/10 border-violet-200/50',
  prod: 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-200/50',
  done: 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-200/50',
};

/** Case-insensitive, trimmed exact-string matching */
function ss(...vals: string[]) {
  const lc = vals.map(v => v.trim().toLowerCase());
  return (s: string) => lc.includes(s.trim().toLowerCase());
}

/** Substring matching */
function sc(...patterns: string[]) {
  const lc = patterns.map(p => p.toLowerCase());
  return (s: string) => lc.some(p => s.toLowerCase().includes(p));
}

/** Numeric set matching */
function ns(...nums: number[]) {
  return (n: number) => nums.includes(n);
}

const TEAM_COLS: Record<string, BoardCol[]> = {
  // ── Collections Scrum (SKP) ─────────────────────────────────────────────
  'Collections': [
    { label: 'TODO', color: C.todo, matchSprint: ss('Backlog', 'To Do', 'Selected for Development', 'Open', 'New'), matchExec: ns(0) },
    { label: 'In Progress', color: C.prog, matchSprint: ss('In Progress'), matchExec: ns(1) },
    { label: 'BLOCKED', color: C.block, matchSprint: ss('Blocked', 'On Hold', 'Impediment'), matchExec: ns(2) },
    { label: 'Review', color: C.review, matchSprint: ss('Review', 'In Review', 'Code Review', 'Peer Review'), matchExec: ns(3) },
    { label: 'DEVOPS', color: C.devops, matchSprint: ss('DevOps', 'DEVOPS'), matchExec: ns(4) },
    { label: 'READY TO TEST', color: C.rtt, matchSprint: ss('READY TO TEST', 'Ready to Test', 'Ready For Test', 'Ready to Deploy (Test)', 'Ready to Deploy ( Test)'), matchExec: ns(5) },
    { label: 'IN TEST', color: C.test, matchSprint: ss('IN TEST', 'In Test', 'QA Test', 'QA', 'Test', 'Testing', 'QA TEST'), matchExec: ns(6) },
    { label: 'UAT', color: C.uat, matchSprint: ss('UAT', 'User Acceptance Testing'), matchExec: ns(8) },
    { label: 'SECURITY TESTING', color: C.sec, matchSprint: sc('security'), matchExec: ns(7) },
    { label: 'CAB READY', color: C.cab, matchSprint: ss('CAB READY', 'CAB', 'INTEGRATION ( CERTIFICATION)', 'Integration (Certification)', 'Certification', 'CAB-READY'), matchExec: ns(9) },
    { label: 'PRODUCTION READY', color: C.prod, matchSprint: ss('Production Ready', 'PRODUCTION READY', 'Ready to deploy', 'Ready to Deploy', 'READY TO DEPLOY'), matchExec: ns(10) },
    { label: 'DONE', color: C.done, matchSprint: ss('Done', 'DONE', 'Live', 'LIVE', 'Completed', 'Closed', 'Released'), matchExec: ns(11) },
  ],

  // ── IR Board (Data & Identity) ───────────────────────────────────────────
  'Data & Identity': [
    { label: 'TODO', color: C.todo, matchSprint: ss('Backlog', 'To Do', 'Selected for Development', 'Open', 'New'), matchExec: ns(0) },
    { label: 'In Progress', color: C.prog, matchSprint: ss('In Progress'), matchExec: ns(1) },
    { label: 'BLOCKED', color: C.block, matchSprint: ss('Blocked', 'On Hold', 'Impediment'), matchExec: ns(2) },
    { label: 'Review', color: C.review, matchSprint: ss('Review', 'In Review', 'Code Review', 'Peer Review'), matchExec: ns(3) },
    { label: 'DEVOPS', color: C.devops, matchSprint: ss('DevOps', 'DEVOPS'), matchExec: ns(4) },
    { label: 'READY TO TEST', color: C.rtt, matchSprint: ss('READY TO TEST', 'Ready to Test', 'Ready For Test', 'Ready to Deploy (Test)', 'Ready to Deploy ( Test)'), matchExec: ns(5) },
    { label: 'QA TEST', color: C.test, matchSprint: ss('QA TEST', 'QA', 'Test', 'Testing', 'IN TEST', 'In Test', 'QA Test'), matchExec: ns(6) },
    { label: 'SECURITY TESTING', color: C.sec, matchSprint: sc('security'), matchExec: ns(7) },
    { label: 'UAT', color: C.uat, matchSprint: ss('UAT', 'User Acceptance Testing'), matchExec: ns(8) },
    { label: 'CAB-READY', color: C.cab, matchSprint: ss('CAB READY', 'CAB', 'CAB-READY', 'Certification', 'INTEGRATION ( CERTIFICATION)'), matchExec: ns(9) },
    { label: 'PRODUCTION-READY', color: C.prod, matchSprint: ss('Production Ready', 'PRODUCTION READY', 'Ready to deploy', 'Ready to Deploy', 'READY TO DEPLOY'), matchExec: ns(10) },
    { label: 'LIVE', color: C.done, matchSprint: ss('Done', 'DONE', 'Live', 'LIVE', 'Completed', 'Closed', 'Released'), matchExec: ns(11) },
  ],

  // ── CASP Board (Core Switching) ──────────────────────────────────────────
  'Core Switching': [
    { label: 'UP NEXT', color: C.todo, matchSprint: ss('Backlog', 'To Do', 'Selected for Development', 'Open', 'New', 'Up Next'), matchExec: ns(0) },
    { label: 'In Progress', color: C.prog, matchSprint: ss('In Progress'), matchExec: ns(1) },
    { label: 'BLOCKED', color: C.block, matchSprint: ss('Blocked', 'On Hold', 'Impediment'), matchExec: ns(2) },
    { label: 'Review', color: C.review, matchSprint: ss('Review', 'In Review', 'Code Review', 'Peer Review'), matchExec: ns(3) },
    { label: 'READY TO TEST', color: C.rtt, matchSprint: ss('READY TO TEST', 'Ready to Test', 'Ready For Test', 'Ready to Deploy (Test)', 'Ready to Deploy ( Test)'), matchExec: ns(5) },
    { label: 'TEST', color: C.test, matchSprint: ss('Test', 'Testing', 'IN TEST', 'In Test', 'QA Test', 'QA', 'QA TEST'), matchExec: ns(6) },
    { label: 'READY TO DEPLOY', color: C.prod, matchSprint: ss('Certification', 'CAB READY', 'CAB', 'Ready to deploy', 'Ready to Deploy', 'READY TO DEPLOY', 'Production Ready', 'PRODUCTION READY', 'DevOps', 'DEVOPS', 'Security Testing', 'UAT'), matchExec: ns(4, 7, 8, 9, 10) },
    { label: 'DONE', color: C.done, matchSprint: ss('Done', 'DONE', 'Live', 'LIVE', 'Completed', 'Closed', 'Released'), matchExec: ns(11) },
  ],

  // ── Enterprise Solution Board (BARP3) ─────────────────────────────────────
  'Enterprise Solution': [
    { label: 'TODO', color: C.todo, matchSprint: ss('Backlog', 'To Do', 'Selected for Development', 'Open', 'New'), matchExec: ns(0) },
    { label: 'In Progress', color: C.prog, matchSprint: ss('In Progress'), matchExec: ns(1) },
    { label: 'BLOCKED', color: C.block, matchSprint: ss('Blocked', 'On Hold', 'Impediment'), matchExec: ns(2) },
    { label: 'Review', color: C.review, matchSprint: ss('Review', 'In Review', 'Code Review', 'Peer Review'), matchExec: ns(3) },
    { label: 'DEVOPS', color: C.devops, matchSprint: ss('DevOps', 'DEVOPS'), matchExec: ns(4) },
    { label: 'READY TO TEST', color: C.rtt, matchSprint: ss('READY TO TEST', 'Ready to Test', 'Ready For Test', 'Ready to Deploy (Test)', 'Ready to Deploy ( Test)'), matchExec: ns(5) },
    { label: 'TEST', color: C.test, matchSprint: ss('Test', 'Testing', 'IN TEST', 'In Test', 'QA Test', 'QA', 'QA TEST'), matchExec: ns(6) },
    { label: 'CERTIFICATION', color: C.cab, matchSprint: ss('Certification', 'CERTIFICATION', 'INTEGRATION ( CERTIFICATION)', 'Integration (Certification)'), matchExec: ns(9) },
    { label: 'SECURITY TESTING', color: C.sec, matchSprint: sc('security'), matchExec: ns(7) },
    { label: 'CAB READY', color: C.uat, matchSprint: ss('CAB READY', 'CAB', 'CAB-READY', 'UAT'), matchExec: ns(8) },
    { label: 'PRODUCTION READY', color: C.prod, matchSprint: ss('Production Ready', 'PRODUCTION READY', 'Ready to deploy', 'Ready to Deploy', 'READY TO DEPLOY'), matchExec: ns(10) },
    { label: 'DONE', color: C.done, matchSprint: ss('Done', 'DONE', 'Live', 'LIVE', 'Completed', 'Closed', 'Released'), matchExec: ns(11) },
  ],
};
// Aliases for name variants stored in DB
TEAM_COLS['Enterprise Solutions'] = TEAM_COLS['Enterprise Solution'];

/** Fallback columns when team name isn't recognised */
const FALLBACK_COLS: BoardCol[] = [
  { label: 'TODO', color: C.todo, matchSprint: ss('Backlog', 'To Do', 'Open', 'New', 'Selected for Development'), matchExec: ns(0) },
  { label: 'In Progress', color: C.prog, matchSprint: ss('In Progress'), matchExec: ns(1) },
  { label: 'BLOCKED', color: C.block, matchSprint: ss('Blocked', 'On Hold'), matchExec: ns(2) },
  { label: 'Review', color: C.review, matchSprint: ss('Review', 'In Review'), matchExec: ns(3) },
  { label: 'READY TO TEST', color: C.rtt, matchSprint: ss('READY TO TEST', 'Ready to Test', 'Ready For Test'), matchExec: ns(5) },
  { label: 'QA / TEST', color: C.test, matchSprint: ss('Test', 'QA', 'QA TEST', 'IN TEST'), matchExec: ns(6) },
  { label: 'CAB / CERT', color: C.cab, matchSprint: ss('CAB READY', 'Certification', 'CAB'), matchExec: ns(9) },
  { label: 'PRODUCTION READY', color: C.prod, matchSprint: ss('Production Ready', 'Ready to Deploy'), matchExec: ns(10) },
  { label: 'LIVE / DONE', color: C.done, matchSprint: ss('Done', 'Live', 'Completed'), matchExec: ns(11) },
];

export function DevelopmentTrackerReal() {
  const { user } = useAuth();
  const { startSync, jobs } = useSync();
  const [tickets, setTickets] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'teams' | 'projects' | 'project_detail' | 'sprint_board'>('teams');
  const [activeProjectTab, setActiveProjectTab] = useState<'governance' | 'board'>('governance');
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [sprintBoardTickets, setSprintBoardTickets] = useState<any[]>([]);
  const [isSyncingSprintBoard, setIsSyncingSprintBoard] = useState(false);
  const [justificationModal, setJustificationModal] = useState(false);
  const [selectedBreachedProject, setSelectedBreachedProject] = useState<any>(null);
  const [justification, setJustification] = useState('');
  const [breachedProjects, setBreachedProjects] = useState<any[]>([]);
  const [atRiskProjects, setAtRiskProjects] = useState<any[]>([]);
  const [justifiedBreaches, setJustifiedBreaches] = useState<any[]>([]);
  const [teamSettingsModal, setTeamSettingsModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);

  const editableTeams = useMemo(() => {
    if (user?.role === 'Admin' || user?.permissions?.admin) return teams;
    const userTeamIds = user?.permissions?.teams || [];
    return teams.filter(t => userTeamIds.map(Number).includes(t.id));
  }, [teams, user]);

  useEffect(() => {
    if (teamSettingsModal && editableTeams.length === 1 && !editingTeam) {
      setEditingTeam(editableTeams[0]);
    }
  }, [teamSettingsModal, editableTeams, editingTeam]);

  const isSyncing = jobs['JIRA']?.status === SyncStatus.Running;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch teams, tickets, and projects in parallel
      const [teamsData, ticketsData, projectsData] = await Promise.all([
        apiService.getTeams(),
        apiService.getTickets(),
        apiService.getProjects()
      ]) as [any[], any[], any[]];

      console.log('Teams data:', teamsData);
      console.log('Current user:', user);
      console.log('User permissions:', user?.permissions);

      // Filter teams based on permissions
      let filteredTeams = teamsData;

      const isAdmin = user?.role === 'Admin' || user?.permissions?.admin;

      if (!isAdmin && user) {
        const allowedTeamIds = user.permissions?.teams || [];
        // Strict filtering: only show teams explicitly in the allowed list
        filteredTeams = teamsData.filter((t: any) => allowedTeamIds.includes(t.id));

        console.log('Applying team filtering:', {
          userRole: user.role,
          isAdmin,
          userPermissions: user.permissions,
          allowedTeamIds,
          teamsBefore: teamsData.length,
          teamsAfter: filteredTeams.length,
          filtered: filteredTeams
        });
      } else if (isAdmin) {
        console.log('User is admin, showing all teams');
      }

      setTeams(filteredTeams);
      setTickets(ticketsData);
      setProjects(projectsData);
    } catch (err) {
      setError('Failed to load development data. Please check if the backend is running.');
      console.error('Development tracker fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Reset view to teams on mount
    setCurrentView('teams');
    setSelectedTeam(null);
    setSelectedProject(null);
  }, [user]); // Re-fetch data if user permissions change (e.g. from refreshUser)

  const loadSprintBoardTickets = async (teamId: number) => {
    try {
      const tickets = await apiService.getSprintBoardTickets(teamId);
      setSprintBoardTickets(tickets as any[]);
    } catch (err) {
      console.error('Failed to load sprint board tickets:', err);
    }
  };

  const handleSyncSprintBoard = async (teamId: number, projectKey: string) => {
    if (!projectKey) {
      alert("No primary Agile project key assigned to this team.");
      return;
    }

    try {
      setIsSyncingSprintBoard(true);
      await apiService.syncSprintBoard(teamId, projectKey);

      // Wait a moment for background sync to at least start, maybe check status ideally
      setTimeout(() => {
        loadSprintBoardTickets(teamId);
        setIsSyncingSprintBoard(false);
      }, 3000);

    } catch (err) {
      console.error('Failed to sync sprint board:', err);
      setIsSyncingSprintBoard(false);
    }
  };

  function getStatusNumber(status: any): number {
    if (typeof status === 'number') return status;
    // Aggressively normalize: uppercase + strip ALL non-alphanumeric characters
    const s = String(status).toUpperCase().replace(/[^A-Z0-9]/g, '');

    // LIVE / DONE (11)
    if (['LIVE', 'DONE', 'COMPLETED', 'CLOSED', 'RELEASED'].includes(s)) return 11;

    // PRODUCTION READY / READY TO DEPLOY (10)
    if (s === 'PRODUCTIONREADY' || s === 'READYTODEPLOY' || s === 'READYTODELIVER' ||
      s === 'READYTODEPLOYPROD' || s === 'APPROVEDFORPRODUCTION') return 10;

    // CAB READY / CERTIFICATION (9)
    if (s === 'CABREADY' || s === 'CAB' || s === 'CERTIFICATION' ||
      s === 'INTEGRATIONCERTIFICATION' || s === 'CERTIFICATIONREADY' ||
      s === 'READYFORDEPLOY' || s === 'APPROVEDFORDEPLOY') return 9;

    // UAT (8)
    if (s === 'UAT' || s === 'USERACCEPTANCETESTING' || s === 'ACCEPTANCETESTING') return 8;

    // SECURITY TESTING (7)
    if (s.includes('SECURITYTESTING') || s.includes('SECURITY') || s === 'PENETRATIONTEST') return 7;

    // QA TEST / IN TEST (6)
    if (s === 'QATEST' || s === 'QA' || s === 'QUALITYASSURANCE' ||
      s === 'INTEST' || s === 'INTESTING' || s === 'TEST' ||
      s === 'TESTING' || s === 'SYSTEMTEST' || s === 'STEST') return 6;

    // READY TO TEST (5)
    if (s === 'READYTOTEST' || s === 'READYFORTESTING' || s === 'READYFORTEST' ||
      s === 'READYTODEPLOYTEST' || s === 'READYFORQA' || s === 'READYFORTESTENV') return 5;

    // DEVOPS (4)
    if (s === 'DEVOPS' || s === 'DEVOPSREVIEW' || s === 'DEPLOYMENTREADY') return 4;

    // REVIEW / CODE REVIEW (3)
    if (s === 'REVIEW' || s === 'INREVIEW' || s === 'CODEREVIEW' ||
      s === 'PEERREVIEW' || s === 'TECHNICALREVIEW') return 3;

    // BLOCKED (2)
    if (s === 'BLOCKED' || s === 'IMPEDIMENT' || s === 'ONHOLD') return 2;

    // IN PROGRESS / DOING (1)
    if (s === 'INPROGRESS' || s === 'PROGRESS' || s === 'DOING' ||
      s === 'INDEVELOPMENT' || s === 'DEVELOPMENT' || s === 'ACTIVE' ||
      s === 'STARTED' || s === 'WORKINGON') return 1;

    // TO DO / BACKLOG / SELECTED FOR DEVELOPMENT (0)
    if (s === 'TODO' || s === 'BACKLOG' || s === 'OPEN' || s === 'NEW' ||
      s === 'SELECTEDFORDEVELOPMENT' || s === 'SELECTED' ||
      s === 'TOBESTARTED' || s === 'READYFORDEVELOPMENT' ||
      s === 'APPROVED' || s === 'PLANNED' || s === 'REFINED') return 0;

    // Default: treat any unknown status as TO DO (0)
    return 0;
  }

  // Assigns a Tailwind color class based on workflow stage (used for dynamic board columns)
  function getStatusColor(n: number): string {
    if (n >= 11) return 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-200/50';  // Done
    if (n === 10) return 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-200/50';    // Production Ready
    if (n === 9) return 'bg-violet-500/5 dark:bg-violet-500/10 border-violet-200/50';    // CAB / Cert
    if (n === 8) return 'bg-teal-500/5 dark:bg-teal-500/10 border-teal-200/50';          // UAT
    if (n === 7) return 'bg-orange-500/5 dark:bg-orange-500/10 border-orange-200/50';    // Security
    if (n === 6) return 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-200/50';       // QA / Test
    if (n === 5) return 'bg-sky-500/5 dark:bg-sky-500/10 border-sky-200/50';             // Ready to Test
    if (n === 4) return 'bg-cyan-500/5 dark:bg-cyan-500/10 border-cyan-200/50';          // DevOps
    if (n === 3) return 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-200/50';    // Review
    if (n === 2) return 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-200/50';          // Blocked
    if (n === 1) return 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-200/50';          // In Progress
    return 'bg-slate-500/5 dark:bg-slate-500/10 border-slate-200/50';                     // To Do / Backlog
  }

  // Maps numeric TicketStatus enum values (from DB/API) to human-readable labels
  const ticketStatusLabel = (n: number): string => ({
    0: 'To Do', 1: 'In Progress', 2: 'Blocked', 3: 'Review',
    4: 'DevOps', 5: 'Ready to Test', 6: 'QA / In Test',
    7: 'Security Testing', 8: 'UAT', 9: 'CAB / Certification',
    10: 'Production Ready', 11: 'Live / Done', 12: 'Rollback'
  } as Record<number, string>)[n] ?? 'Pending Classification';


  const getPriorityLabel = (priority: number) => {
    const map = { 0: 'Low', 1: 'Medium', 2: 'High' };
    return map[priority as keyof typeof map] || 'Medium';
  };

  const getPriorityColor = (priority: number) => {
    const map = { 0: 'bg-green-100 text-green-800', 1: 'bg-yellow-100 text-yellow-800', 2: 'bg-red-100 text-red-800' };
    return map[priority as keyof typeof map] || 'bg-yellow-100 text-yellow-800';
  };


  const handleAddJustification = (project: any) => {
    setSelectedBreachedProject(project);
    setJustificationModal(true);
  };

  const handleSubmitJustification = () => {
    if (selectedBreachedProject && justification.trim()) {
      setJustifiedBreaches((prev: any[]) => [...prev, {
        ...selectedBreachedProject,
        justification: justification.trim(),
        justifiedAt: new Date().toLocaleString()
      }]);
      setBreachedProjects((prev: any[]) => prev.filter((proj: any) => proj.id !== selectedBreachedProject.id));
      setJustificationModal(false);
      setJustification('');
      setSelectedBreachedProject(null);
    }
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam) return;
    try {
      setIsUpdatingTeam(true);
      console.log(`Calling PUT: /teams/${editingTeam.id}`);
      await apiService.put(`/teams/${editingTeam.id}`, editingTeam);
      await fetchData(); // Refresh all data
      setTeamSettingsModal(false);
      setEditingTeam(null);
    } catch (err: any) {
      console.error('Failed to update team:', err);
      console.log('Attempted update with payload:', editingTeam);
      alert(`Failed to update team settings: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUpdatingTeam(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={fetchData} />;
  }

  return (
    <div className="max-w-full overflow-hidden space-y-6">
      {/* Dynamic Page Header */}
      {/* Dynamic Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-green-600" />
            {currentView === 'teams' ? 'Development Tracker' :
              currentView === 'projects' ? `${selectedTeam?.name} Projects` :
                currentView === 'sprint_board' ? `${selectedTeam?.name} Live Sprint` :
                  selectedProject?.name}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {currentView === 'teams' ? 'Agile teams and sprint progress' :
              currentView === 'projects' ? 'Active projects and delivery metrics' :
                currentView === 'sprint_board' ? 'Live cross-project sprint visibility' :
                  'Project governance and execution board'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentView === 'teams' && (user?.role === 'Admin' || user?.permissions?.admin || (user?.permissions?.teams && user.permissions.teams.length > 0)) && (
            <Button
              variant="outline"
              onClick={() => {
                setEditingTeam(null);
                setTeamSettingsModal(true);
              }}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Team Settings
            </Button>
          )}

          <Button
            onClick={async () => {
              try {
                // Trigger sync in background - don't wait for it
                await startSync('JIRA');
                // Optionally refresh data after a short delay to pick up any immediate updates
                setTimeout(() => {
                  fetchData();
                }, 2000);
              } catch (err) {
                console.error('Sync failed:', err);
              }
            }}
            disabled={isSyncing}
            className="flex items-center gap-2"
          >
            <div className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
            </div>
            {isSyncing ? 'Syncing...' : 'Sync JIRA Data'}
          </Button>
        </div>
      </div>


      {/* Teams View */}
      {currentView === 'teams' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teams.map((team: any) => {
              // Use projects provided by the team object (from backend) or fallback to manual filter
              const teamProjects = team.projects || projects.filter((p: any) =>
                (p.teamId || p.teamid) === team.id
              );

              const teamTickets = tickets.filter((t: any) =>
                teamProjects.some((p: any) => p.id === (t.projectId || t.projectid))
              );

              const totalProjectsCount = teamProjects.length;
              const totalTicketsCount = teamTickets.length;
              const completedTicketsCount = teamTickets.filter(t => getStatusNumber(t.status) === 11).length;
              const deliveryEfficiencyValue = totalTicketsCount > 0
                ? Math.round((completedTicketsCount / totalTicketsCount) * 100)
                : 0;

              return (
                <Card
                  key={team.id}
                  className="border-l-4 border-l-green-700 cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => {
                    setSelectedTeam({ ...team, projects: teamProjects });
                    setCurrentView('projects');
                  }}
                >
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl">{team.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{team.lead}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Team Members</p>
                        <p className="text-lg font-bold text-foreground">{team.members}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Projects</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalProjectsCount}</p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs text-muted-foreground">Current Sprint</p>
                        <p className="text-sm font-semibold text-foreground">
                          {team.sprintTicketCount || 0} Tickets
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Delivery Progress</span>
                        <span className="text-sm font-semibold text-green-700 dark:text-green-500">{deliveryEfficiencyValue}%</span>
                      </div>
                      <Progress value={deliveryEfficiencyValue} className="h-2" />
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/30 border-t">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm text-muted-foreground">Total Tickets (Done/Total):</span>
                      <span className="text-lg font-bold text-foreground">{completedTicketsCount}/{totalTicketsCount}</span>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>



          {/* Timeline Breached Projects */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <div>
                  <CardTitle>Timeline Breached Projects</CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">Projects requiring justification and review</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p className="font-semibold">No breached projects requiring justification</p>
                <p className="text-sm italic mt-2 opacity-70">Note: Functional timeline tracking will be added in a future version.</p>
              </div>
            </CardContent>
          </Card>

          {/* At Risk Projects */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div>
                  <CardTitle>At Risk Projects</CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">Projects approaching timeline deadline</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-orange-400" />
                <p className="font-semibold">No projects currently at risk</p>
                <p className="text-sm italic mt-2 opacity-70">Note: Functional timeline tracking will be added in a future version.</p>
              </div>
            </CardContent>
          </Card>

          {/* Justification Modal */}
          <Dialog open={justificationModal} onOpenChange={setJustificationModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Timeline Breach Justification</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {selectedBreachedProject && (
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <p className="text-sm font-medium text-foreground">{selectedBreachedProject.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedBreachedProject.id} • {selectedBreachedProject.team}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Justification
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Explain why the timeline was not met..."
                    className="w-full h-32 px-3 py-2 border border-border bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setJustificationModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitJustification} disabled={!justification.trim()}>
                  Submit Justification
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Justified Breaches Log */}
          {/* Team Settings Modal */}
          <Dialog open={teamSettingsModal} onOpenChange={setTeamSettingsModal}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-green-600" />
                  Team Governance Settings
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Team to Configure</label>
                  <Select
                    value={editingTeam?.id?.toString() || ''}
                    onValueChange={(val) => {
                      const selected = teams.find(t => t.id.toString() === val);
                      setEditingTeam(selected ? { ...selected } : null);
                    }}
                  >
                    <SelectTrigger className="w-full h-12 rounded-xl font-bold">
                      <SelectValue placeholder="Choose a team..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {editableTeams.map((t: any) => (
                        <SelectItem key={t.id} value={t.id.toString()} className="font-bold">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editingTeam && (
                  <div className="space-y-6 pt-4 border-t border-border animate-in fade-in slide-in-from-top-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Display Name</label>
                      <input
                        type="text"
                        value={editingTeam.name || ''}
                        onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                        className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Responsible Team Lead</label>
                      <input
                        type="text"
                        value={editingTeam.lead || ''}
                        onChange={(e) => setEditingTeam({ ...editingTeam, lead: e.target.value })}
                        className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operational Headcount</label>
                      <input
                        type="number"
                        value={editingTeam.members || 0}
                        onChange={(e) => setEditingTeam({ ...editingTeam, members: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-3">
                <Button variant="ghost" className="font-bold uppercase text-[10px] tracking-widest" onClick={() => setTeamSettingsModal(false)}>
                  Dismiss
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white font-bold uppercase text-[10px] tracking-widest px-8 shadow-lg shadow-green-500/20"
                  onClick={handleUpdateTeam}
                  disabled={isUpdatingTeam || !editingTeam}
                >
                  {isUpdatingTeam ? 'Persisting...' : 'Commit Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {justifiedBreaches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Breach Justification Log</CardTitle>
                <p className="text-sm text-muted-foreground">Historical record of justified timeline breaches</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {justifiedBreaches.map((breach, index) => (
                    <div key={index} className="bg-muted/30 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-2">{breach.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-700 mb-2">
                            <span>{breach.id}</span>
                            <span>•</span>
                            <span>{breach.team}</span>
                            <span>•</span>
                            <span>Lead: {breach.lead}</span>
                          </div>
                          <div className="bg-white border border-border rounded p-3 mt-3">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Justification:</p>
                            <p className="text-sm text-foreground">{breach.justification}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">Justified at: {breach.justifiedAt}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Projects View */}
      {currentView === 'projects' && selectedTeam && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setCurrentView('teams')}
              className="flex items-center gap-2"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to Teams
            </Button>
            <Button
              onClick={() => {
                setCurrentView('sprint_board');
                loadSprintBoardTickets(selectedTeam.id);
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            >
              <Zap className="w-4 h-4" />
              Current Sprint Board
            </Button>
          </div>

          <div className="space-y-4">
            {selectedTeam.projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/20 border border-dashed rounded-xl">
                <Folder className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No Projects Found</h3>
                <p className="text-muted-foreground max-w-xs mt-1">
                  This team doesn't have any projects mapped yet. Create one in the JIRA Mapping section.
                </p>
              </div>
            ) : (
              selectedTeam.projects.map((project: any) => {
                const projectTickets = tickets.filter((t: any) => (t.projectId || t.projectid) === project.id);
                const totalTicketsCount = projectTickets.length;
                const completedTicketsCount = projectTickets.filter((t: any) => getStatusNumber(t.status) === 11).length;

                const totalPoints = projectTickets.reduce((sum: number, t: any) => sum + (t.deliveryPoints || 0), 0);
                const completedPoints = projectTickets
                  .filter((t: any) => getStatusNumber(t.status) === 11)
                  .reduce((sum: number, t: any) => sum + (t.deliveryPoints || 0), 0);

                const ticketProgress = totalTicketsCount > 0 ? (completedTicketsCount / totalTicketsCount) * 100 : 0;
                const pointsProgress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

                return (
                  <Card
                    key={project.id}
                    className="border cursor-pointer hover:shadow-lg transition-all"
                    onClick={() => {
                      setSelectedProject(project);
                      setCurrentView('project_detail');
                      setActiveProjectTab('governance');
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                            <Folder className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {project.name}
                            </CardTitle>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                          {(() => {
                            const earliestDate = projectTickets.length > 0
                              ? new Date(Math.min(...projectTickets.map(t => new Date(t.createdAt).getTime())))
                              : null;
                            const latestDate = projectTickets.length > 0
                              ? new Date(Math.max(...projectTickets.map(t => new Date(t.updatedAt || t.jiraUpdatedAt || t.createdAt).getTime())))
                              : null;

                            return (
                              <>
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Start Date
                                  </p>
                                  <p className="text-sm font-semibold">{earliestDate ? earliestDate.toLocaleDateString() : 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Target className="w-3 h-3" /> Latest Activity
                                  </p>
                                  <p className="text-sm font-semibold">{latestDate ? latestDate.toLocaleDateString() : 'N/A'}</p>
                                </div>
                              </>
                            );
                          })()}
                          <div>
                            <p className="text-xs text-muted-foreground">Tickets</p>
                            <p className="text-sm font-semibold">{completedTicketsCount}/{totalTicketsCount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Delivery Points</p>
                            <p className="text-sm font-semibold">{completedPoints}/{totalPoints}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">Ticket Progress</span>
                              <span className="text-xs font-semibold text-foreground">{ticketProgress.toFixed(0)}%</span>
                            </div>
                            <Progress value={ticketProgress} className="h-2" />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">Points Progress</span>
                              <span className="text-xs font-semibold text-green-500">{pointsProgress.toFixed(0)}%</span>
                            </div>
                            <Progress value={pointsProgress} className="h-2" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Project Detail View (Unified Governance + Operational) */}
      {currentView === 'project_detail' && selectedProject && (
        (() => {
          const projectTickets = tickets.filter((t: any) => (t.projectId || t.projectid) === selectedProject.id);
          const slaBreachesCount = projectTickets.filter((t: any) => {
            const daysActive = Math.floor((new Date().getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            return daysActive > 14 && getStatusNumber(t.status) < 11;
          }).length;

          const staleTicketsCount = projectTickets.filter((t: any) => {
            const lastUpdate = new Date(t.updatedAt || t.jiraUpdatedAt || t.createdAt).getTime();
            const daysSinceUpdate = Math.floor((new Date().getTime() - lastUpdate) / (1000 * 60 * 60 * 24));
            return daysSinceUpdate > 7 && getStatusNumber(t.status) < 11;
          }).length;

          const completedPointsCount = projectTickets
            .filter(t => getStatusNumber(t.status) === 11)
            .reduce((s, t) => s + (t.deliveryPoints || 0), 0);

          const totalPointsValue = projectTickets.reduce((s, t) => s + (t.deliveryPoints || 0), 0);

          return (
            <div className="space-y-6 max-w-full">
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('projects')}
                  className="flex items-center gap-2 w-fit -ml-2 text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Back to Projects
                </Button>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full border border-border">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Lead: <span className={!selectedProject?.lead || selectedProject.lead === 'Unassigned' ? 'text-orange-500 italic' : 'text-foreground'}>
                        {selectedProject?.lead || 'Unassigned'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Operational Execution (Active WIP Only) */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-1">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-1.5 bg-blue-600 rounded-full"></div>
                    <h2 className="text-lg font-black text-foreground tracking-tight uppercase">Active Execution Board</h2>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-100 w-fit">WIP TRACKING</Badge>
                </div>

                <div className="w-full max-w-full overflow-hidden">
                  <Card className="w-full shadow-xl border-0 bg-muted/30/50 backdrop-blur-sm overflow-hidden">
                    <CardContent className="p-0">
                      <div className="w-full overflow-x-auto custom-scrollbar p-6">
                        {tickets.filter((t: any) => t.projectId === selectedProject.id).length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                              <CheckCircle className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">All Clear</h3>
                            <p className="text-muted-foreground max-w-sm mt-1">No tickets currently in active execution stages.</p>
                          </div>
                        ) : (
                          (() => {
                            const projectTickets = tickets.filter((t: any) => t.projectId === selectedProject.id);
                            // Use the team's exact column schema (excluding first=TODO and last=DONE, handled by sections below)
                            const teamSchema = TEAM_COLS[selectedTeam?.name] ?? FALLBACK_COLS;
                            // Execution board shows all middle columns (exclude TODO idx 0 and DONE idx last)
                            const execCols = teamSchema.slice(1, teamSchema.length - 1);

                            return (
                              <div className="flex gap-6 min-w-max">
                                {execCols.map((col: BoardCol) => {
                                  const colTickets = projectTickets.filter((t: any) =>
                                    col.matchExec(getStatusNumber(t.status))
                                  );

                                  return (
                                    <div key={col.label} className={`${col.color} rounded-2xl p-5 w-80 flex-shrink-0 border shadow-sm flex flex-col h-[600px]`}>
                                      <div className="flex items-center justify-between mb-5 shrink-0">
                                        <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{col.label}</h3>
                                        <Badge variant="outline" className="bg-background/50 border-border text-foreground font-black h-5 shadow-sm">{colTickets.length}</Badge>
                                      </div>
                                      <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar flex-1">
                                        {colTickets.map((ticket: any) => {
                                          const daysActive = Math.floor((new Date().getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                                          const isSlaBreach = daysActive > 14 && getStatusNumber(ticket.status) < 11;

                                          return (
                                            <div
                                              key={ticket.id}
                                              className={`bg-card border-2 rounded-xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden ${ticket.isRollback ? 'border-destructive/50' :
                                                isSlaBreach ? 'border-orange-500/50' :
                                                  'border-border hover:border-blue-500'
                                                }`}
                                              onClick={() => setSelectedTicket(ticket)}
                                            >
                                              {isSlaBreach && !ticket.isRollback && (
                                                <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
                                                  <div className="absolute top-0 right-0 transform translate-x-6 translate-y-2 rotate-45 bg-orange-500 text-white text-[8px] font-black py-0.5 px-6 shadow-sm">
                                                    BREACH
                                                  </div>
                                                </div>
                                              )}

                                              {ticket.isRollback && (
                                                <Badge variant="destructive" className="mb-3 text-[10px] h-4 font-black tracking-widest rounded-sm">ROLLBACK RISK</Badge>
                                              )}
                                              <h4 className="font-bold text-foreground text-[14px] leading-snug mb-3 group-hover:text-blue-500 transition-colors line-clamp-2 h-10">
                                                {ticket.title || `Ticket #${ticket.id}`}
                                              </h4>
                                              <div className="flex items-center justify-between mb-4">
                                                <div className="px-2 py-0.5 bg-muted rounded text-[9px] font-mono font-bold text-muted-foreground uppercase">
                                                  {ticket.jiraKey}
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-background p-0.5 pr-2 rounded-full border border-border shadow-sm">
                                                  <div className="w-5 h-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-[10px] font-black text-white">
                                                    {(ticket.assignedTo || 'U').charAt(0)}
                                                  </div>
                                                  <span className="text-[10px] text-muted-foreground font-bold truncate max-w-[60px]">{ticket.assignedTo || 'Unassigned'}</span>
                                                </div>
                                              </div>

                                              <div className="flex items-center justify-between pt-3 border-t border-border">
                                                <div className="flex items-center gap-2">
                                                  <div className="flex -space-x-1.5">
                                                    <div title="Complexity" className={`w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-black shadow-sm ${ticket.complexity >= 3 ? 'bg-destructive/20 text-destructive' : 'bg-blue-500/20 text-blue-500'}`}>
                                                      C{ticket.complexity}
                                                    </div>
                                                    <div title="Risk" className={`w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-black shadow-sm ${ticket.risk >= 3 ? 'bg-destructive/20 text-destructive' : 'bg-orange-500/20 text-orange-500'}`}>
                                                      R{ticket.risk}
                                                    </div>
                                                  </div>
                                                  <span className="text-[11px] font-black text-foreground tracking-tight">{ticket.deliveryPoints} Pts</span>
                                                </div>
                                                <Badge className={`text-[9px] h-5 px-2 font-black shadow-sm ${getPriorityColor(ticket.priority || 1)}`}>
                                                  P{ticket.priority || 1}
                                                </Badge>
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {colTickets.length === 0 && (
                                          <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl opacity-40 hover:opacity-70 transition-opacity flex flex-col items-center justify-center">
                                            <GitBranch className="w-8 h-8 text-gray-300 mb-2" />
                                            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Idle Queue</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Inactive Assets (Done & Backlog) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                  {/* Done Tickets Section */}
                  <Card className="border-0 shadow-lg bg-card overflow-hidden">
                    <CardHeader className="p-5 border-b bg-green-500/5 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-black text-foreground uppercase tracking-tight">Completed Assets</CardTitle>
                          <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest mt-0.5">Live in Production</p>
                        </div>
                      </div>
                      <Badge className="bg-green-600 text-white font-black">{tickets.filter((t: any) => t.projectId === selectedProject.id && getStatusNumber(t.status) === 11).length}</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[350px] overflow-y-auto custom-scrollbar divide-y divide-border">
                        {tickets.filter((t: any) => t.projectId === selectedProject.id && getStatusNumber(t.status) === 11).map((ticket: any) => (
                          <div key={ticket.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between cursor-pointer group" onClick={() => setSelectedTicket(ticket)}>
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground shrink-0 group-hover:bg-green-500/20 group-hover:text-green-500 transition-colors">
                                {ticket.jiraKey.split('-')[1]}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-bold text-foreground truncate mb-0.5 group-hover:text-green-500">{ticket.title}</p>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{ticket.assignedTo || 'Unassigned'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 pl-4">
                              <div className="text-right">
                                <p className="text-[11px] font-black text-foreground">{ticket.deliveryPoints} Pts</p>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase">{new Date(ticket.updatedAt).toLocaleDateString()}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        ))}
                        {tickets.filter((t: any) => t.projectId === selectedProject.id && getStatusNumber(t.status) === 11).length === 0 && (
                          <div className="p-12 text-center text-muted-foreground">
                            <p className="text-xs font-medium uppercase tracking-widest">No completed assets yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Backlog Tickets Section */}
                  <Card className="border-0 shadow-lg bg-card overflow-hidden">
                    <CardHeader className="p-5 border-b bg-muted/50 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                          <Archive className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-black text-foreground uppercase tracking-tight">Project Backlog</CardTitle>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Awaiting Prioritization</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-muted text-foreground font-black">{tickets.filter((t: any) => t.epicKey === selectedProject.jiraKey && getStatusNumber(t.status) === 0).length}</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[350px] overflow-y-auto custom-scrollbar divide-y divide-border">
                        {tickets.filter((t: any) => t.epicKey === selectedProject.jiraKey && getStatusNumber(t.status) === 0).map((ticket: any) => (
                          <div key={ticket.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between cursor-pointer group" onClick={() => setSelectedTicket(ticket)}>
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <Badge className={getPriorityColor(ticket.priority || 1)}>P{ticket.priority || 1}</Badge>
                              <div className="truncate">
                                <p className="text-xs font-bold text-foreground truncate mb-0.5 group-hover:text-blue-500">{ticket.title}</p>
                                <p className="text-[10px] text-muted-foreground font-mono font-bold">{ticket.jiraKey}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 pl-4">
                              <div className="text-right">
                                <p className="text-[11px] font-black text-foreground">{ticket.deliveryPoints} Pts</p>
                                <div className="flex -space-x-1 mt-1 justify-end">
                                  <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-background text-[7px] flex items-center justify-center font-black">C{ticket.complexity}</div>
                                  <div className="w-4 h-4 rounded-full bg-orange-500/20 border border-background text-[7px] flex items-center justify-center font-black">R{ticket.risk}</div>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        ))}
                        {tickets.filter((t: any) => t.epicKey === selectedProject.jiraKey && getStatusNumber(t.status) === 0).length === 0 && (
                          <div className="p-12 text-center text-muted-foreground">
                            <p className="text-xs font-medium uppercase tracking-widest">Backlog is empty</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          );
        })())}

      {/* Sprint Board View */}
      {currentView === 'sprint_board' && selectedTeam && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentView('projects')}
              className="flex items-center gap-2"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to Projects
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Deterministic team name → JIRA project key mapping
                  const teamProjectKeyMap: Record<string, string> = {
                    'Collections': 'SKP',
                    'Data & Identity': 'IR',
                    'Core Switching': 'CASP',
                    'Enterprise Solution': 'BARP3',
                    'Enterprise Solutions': 'BARP3',
                  };
                  const primaryKey = teamProjectKeyMap[selectedTeam.name] ||
                    selectedTeam.projects?.[0]?.jiraKey ||
                    (selectedTeam.name.includes('Collection') ? 'SKP' :
                      selectedTeam.name.includes('Switching') ? 'CASP' :
                        selectedTeam.name.includes('Identity') ? 'IR' : 'BARP3');
                  handleSyncSprintBoard(selectedTeam.id, primaryKey);
                }}
                disabled={isSyncingSprintBoard}
                className="flex items-center gap-2"
              >
                <div className={`w-3 h-3 ${isSyncingSprintBoard ? 'animate-spin' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                </div>
                {isSyncingSprintBoard ? 'Syncing Board...' : 'Sync Active Sprint Board'}
              </Button>
              <div className="h-6 w-1.5 bg-indigo-600 rounded-full"></div>
              <div>
                <h2 className="text-xl font-black text-foreground tracking-tight uppercase">{selectedTeam.name} — Active Sprint</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedTeam.name === 'Collections' ? 'Collections Scrum Board (SKP)' :
                    selectedTeam.name === 'Data & Identity' ? 'IR Board (IR)' :
                      selectedTeam.name === 'Core Switching' ? 'Core Switching Scrum Board (CASP)' :
                        'Enterprise Solution Board (BARP3)'}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-full overflow-hidden">
            <Card className="w-full shadow-xl border-0 bg-muted/30/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto custom-scrollbar p-6">
                  {(() => {
                    const teamTickets = sprintBoardTickets;

                    if (teamTickets.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-bold text-foreground">No Tickets</h3>
                          <p className="text-muted-foreground max-w-sm mt-1">This team has no tickets assigned across any mapped projects.</p>
                        </div>
                      );
                    }

                    // Look up the per-team static column schema (exact JIRA board layout)
                    const sprintSchema = TEAM_COLS[selectedTeam?.name] ?? FALLBACK_COLS;

                    return (
                      <div className="flex gap-6 min-w-max">
                        {sprintSchema.map((col: BoardCol) => {
                          // Match tickets using the column's string matcher against the raw JIRA status
                          const colTickets = teamTickets.filter(
                            (t: any) => col.matchSprint(String(t.status ?? ''))
                          );

                          return (
                            <div key={col.label} className={`${col.color} rounded-2xl p-5 w-80 flex-shrink-0 border shadow-sm flex flex-col h-[700px]`}>
                              <div className="flex items-center justify-between mb-5 shrink-0">
                                <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest leading-tight">{col.label}</h3>
                                <Badge variant="outline" className="bg-background/50 border-border text-foreground font-black h-5 shadow-sm ml-2 shrink-0">{colTickets.length}</Badge>
                              </div>
                              <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar flex-1">
                                {colTickets.map((ticket: any) => {
                                  const daysActive = Math.floor((new Date().getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                                  const isSlaBreach = daysActive > 14 && getStatusNumber(ticket.status) < 11;

                                  return (
                                    <div
                                      key={ticket.id}
                                      className={`bg-card border-2 rounded-xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden ${ticket.isRollback ? 'border-destructive/50' : isSlaBreach ? 'border-orange-500/50' : 'border-border hover:border-indigo-500'}`}
                                      onClick={() => setSelectedTicket(ticket)}
                                    >
                                      {isSlaBreach && !ticket.isRollback && (
                                        <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
                                          <div className="absolute top-0 right-0 transform translate-x-6 translate-y-2 rotate-45 bg-orange-500 text-white text-[8px] font-black py-0.5 px-6 shadow-sm">
                                            BREACH
                                          </div>
                                        </div>
                                      )}
                                      {ticket.isRollback && (
                                        <Badge variant="destructive" className="mb-3 text-[10px] h-4 font-black tracking-widest rounded-sm">ROLLBACK RISK</Badge>
                                      )}
                                      <h4 className="font-bold text-foreground text-[14px] leading-snug mb-2 group-hover:text-indigo-500 transition-colors line-clamp-2 h-10">
                                        {ticket.title || `Ticket #${ticket.id}`}
                                      </h4>
                                      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
                                        <span className="font-semibold block truncate max-w-[140px]" title={ticket.assignedTo || 'Unassigned'}>
                                          {ticket.assignedTo || 'Unassigned'}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="px-2 py-0.5 bg-muted rounded text-[9px] font-mono font-bold text-muted-foreground uppercase">
                                          {ticket.jiraKey}
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-background p-0.5 pr-2 rounded-full border border-border shadow-sm">
                                          <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-700 flex items-center justify-center font-black text-[9px]">
                                            {ticket.deliveryPoints || 0}
                                          </div>
                                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">PTS</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}


      {/* Ticket Detail Offcanvas */}
      <Sheet open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedTicket && (
            <>
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="text-xl font-bold">{selectedTicket.title || 'Ticket Details'}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6 px-8">
                {/* Status & Priority Section */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status & Priority</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge>{['TO DO', 'IN PROGRESS', 'BLOCKED', 'REVIEW', 'DEVOPS', 'READY TO TEST', 'QA TEST', 'SECURITY TESTING', 'UAT', 'CAB READY', 'PRODUCTION READY', 'LIVE', 'ROLLBACK'][getStatusNumber(selectedTicket.status)]}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Severity</span>
                      <Badge className={getPriorityColor(selectedTicket.priority || 1)}>
                        {getPriorityLabel(selectedTicket.priority || 1)}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Priority</span>
                      <span className="text-sm font-medium text-foreground">P{selectedTicket.priority || 1}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Source</span>
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">JIRA</Badge>
                    </div>
                  </div>
                </div>

                {/* Ticket Details Section */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ticket Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Ticket ID</span>
                      <span className="text-sm font-medium text-foreground text-right">{selectedTicket.jiraKey || `PROJ-${selectedTicket.id}`}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Project</span>
                      <span className="text-sm font-medium text-foreground text-right">
                        {selectedTeam?.projects?.find((p: any) => p.id === selectedTicket.projectId)?.name || "Unknown Project"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Assignee</span>
                      <span className="text-sm font-medium text-foreground text-right">{selectedTicket.assignedTo || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Created At</span>
                      <span className="text-sm font-medium text-foreground text-right">{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Delivery Points</span>
                      <span className="text-sm font-medium text-destructive text-right">{selectedTicket.deliveryPoints}</span>
                    </div>
                  </div>
                </div>

                {/* Description Section */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Description</h3>
                  <div className="bg-muted/50 p-4 rounded-lg border border-border text-sm text-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {selectedTicket.description || "No description provided."}
                  </div>
                </div>

                {/* Complexity & Risk Section */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Complexity & Risk</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Complexity</span>
                      <p className="text-lg font-semibold text-foreground mt-1">C{selectedTicket.complexity}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Risk</span>
                      <p className="text-lg font-semibold text-foreground mt-1">R{selectedTicket.risk}</p>
                    </div>
                  </div>
                </div>

                {/* Rollback Alert */}
                {selectedTicket.isRollback && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <p className="text-sm font-semibold text-destructive">⚠️ This ticket experienced a rollback</p>
                  </div>
                )}

                {/* Timeline Section */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ticket Timeline</h3>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="w-0.5 h-full bg-border mt-2"></div>
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-medium text-foreground">{['TO DO', 'IN PROGRESS', 'BLOCKED', 'REVIEW', 'DEVOPS', 'READY TO TEST', 'QA TEST', 'SECURITY TESTING', 'UAT', 'CAB READY', 'PRODUCTION READY', 'LIVE', 'ROLLBACK'][getStatusNumber(selectedTicket.status)]}</p>
                        <p className="text-xs text-muted-foreground mt-1">Currently in progress</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                          <GitBranch className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Created</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Justification Modal */}
      <Dialog open={justificationModal} onOpenChange={setJustificationModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Breach Justification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">Explain why the SLA/Target date was breached for {selectedBreachedProject?.name}:</p>
            <textarea
              className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter justification..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJustificationModal(false)}>Cancel</Button>
            <Button onClick={handleSubmitJustification}>Submit Justification</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
