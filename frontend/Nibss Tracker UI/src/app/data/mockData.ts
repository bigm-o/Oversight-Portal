// Mock data for NIBSS Tracker

export interface AgileTeam {
  id: string;
  name: string;
  lead: string;
  members: number;
  activeSprint: string;
  totalProjects: number;
  completionRate: number;
}

export interface Project {
  id: string;
  name: string;
  teamId: string;
  status: 'Active' | 'On Hold' | 'Completed';
  startDate: Date;
  targetDate: Date;
  totalTickets: number;
  completedTickets: number;
  deliveryPoints: number;
  completedPoints: number;
}

export interface Ticket {
  id: string;
  title: string;
  projectId: string;
  teamId: string;
  status: 'TO DO' | 'IN PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DEVOPS' | 'READY TO TEST' | 'QA TEST' | 'SECURITY TEST' | 'UAT' | 'CAB READY' | 'PRODUCTION READY' | 'LIVE';
  deliveryPoints: number;
  assignee: string;
  sprint: string;
  previousStatus?: string;
  isRollback: boolean;
  createdAt: Date;
  updatedAt: Date;
  priority: 'High' | 'Medium' | 'Low';
  description?: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  source: 'Jira' | 'Freshdesk';
  slaStatus: 'On Track' | 'At Risk' | 'Breached';
  slaTimeRemaining: number; // in minutes
  downtime: number; // in minutes
  assignee: string;
  teamId?: string;
  institution: string;
  createdAt: Date;
  resolvedAt?: Date;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
}

export interface TicketHistory {
  ticketId: string;
  timestamp: Date;
  fromStatus: string;
  toStatus: string;
  user: string;
  reason?: string;
  isRollback: boolean;
}

export interface KPI {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  unit?: string;
}

// Mock Agile Teams
export const mockAgileTeams: AgileTeam[] = [
  {
    id: 'team-1',
    name: 'Collections',
    lead: 'Adebayo Oluwaseun',
    members: 12,
    activeSprint: 'Sprint 24',
    totalProjects: 5,
    completionRate: 92,
  },
  {
    id: 'team-2',
    name: 'Core Switching',
    lead: 'Chioma Nwosu',
    members: 15,
    activeSprint: 'Sprint 24',
    totalProjects: 7,
    completionRate: 88,
  },
  {
    id: 'team-3',
    name: 'Data & Identity',
    lead: 'Ibrahim Mohammed',
    members: 10,
    activeSprint: 'Sprint 24',
    totalProjects: 4,
    completionRate: 95,
  },
  {
    id: 'team-4',
    name: 'Enterprise Solutions',
    lead: 'Fatima Abubakar',
    members: 13,
    activeSprint: 'Sprint 24',
    totalProjects: 6,
    completionRate: 90,
  },
];

// Mock Projects
export const mockProjects: Project[] = [
  // Collections Team Projects
  {
    id: 'proj-1',
    name: 'Payment Gateway Integration',
    teamId: 'team-1',
    status: 'Active',
    startDate: new Date('2025-01-15'),
    targetDate: new Date('2025-03-30'),
    totalTickets: 24,
    completedTickets: 18,
    deliveryPoints: 156,
    completedPoints: 124,
  },
  {
    id: 'proj-2',
    name: 'Collections API v2.0',
    teamId: 'team-1',
    status: 'Active',
    startDate: new Date('2025-01-10'),
    targetDate: new Date('2025-04-15'),
    totalTickets: 18,
    completedTickets: 12,
    deliveryPoints: 98,
    completedPoints: 65,
  },
  // Core Switching Team Projects
  {
    id: 'proj-3',
    name: 'Real-time Transaction Processing',
    teamId: 'team-2',
    status: 'Active',
    startDate: new Date('2025-01-05'),
    targetDate: new Date('2025-03-20'),
    totalTickets: 32,
    completedTickets: 28,
    deliveryPoints: 210,
    completedPoints: 185,
  },
  {
    id: 'proj-4',
    name: 'Switch Monitoring Dashboard',
    teamId: 'team-2',
    status: 'Active',
    startDate: new Date('2025-02-01'),
    targetDate: new Date('2025-05-01'),
    totalTickets: 15,
    completedTickets: 5,
    deliveryPoints: 78,
    completedPoints: 26,
  },
  // Data & Identity Team Projects
  {
    id: 'proj-5',
    name: 'BVN Verification Module',
    teamId: 'team-3',
    status: 'Active',
    startDate: new Date('2025-01-20'),
    targetDate: new Date('2025-04-10'),
    totalTickets: 20,
    completedTickets: 16,
    deliveryPoints: 130,
    completedPoints: 110,
  },
  {
    id: 'proj-6',
    name: 'Data Analytics Platform',
    teamId: 'team-3',
    status: 'Active',
    startDate: new Date('2025-01-12'),
    targetDate: new Date('2025-03-25'),
    totalTickets: 28,
    completedTickets: 24,
    deliveryPoints: 165,
    completedPoints: 145,
  },
  // Enterprise Solutions Team Projects
  {
    id: 'proj-7',
    name: 'Enterprise Portal Redesign',
    teamId: 'team-4',
    status: 'Active',
    startDate: new Date('2025-01-08'),
    targetDate: new Date('2025-04-30'),
    totalTickets: 22,
    completedTickets: 14,
    deliveryPoints: 142,
    completedPoints: 92,
  },
  {
    id: 'proj-8',
    name: 'API Management System',
    teamId: 'team-4',
    status: 'Active',
    startDate: new Date('2025-02-01'),
    targetDate: new Date('2025-05-15'),
    totalTickets: 19,
    completedTickets: 8,
    deliveryPoints: 105,
    completedPoints: 44,
  },
];

// Mock Tickets
export const mockTickets: Ticket[] = [
  // Payment Gateway Integration tickets
  {
    id: 'JIRA-1001',
    title: 'Implement Multi-Factor Authentication',
    projectId: 'proj-1',
    teamId: 'team-1',
    status: 'IN PROGRESS',
    deliveryPoints: 8,
    assignee: 'Tunde Bakare',
    sprint: 'Sprint 24',
    createdAt: new Date('2025-01-15T09:00:00'),
    updatedAt: new Date('2025-02-03T10:30:00'),
    priority: 'High',
    isRollback: false,
    description: 'Add MFA to payment gateway for enhanced security',
  },
  {
    id: 'JIRA-1002',
    title: 'Payment Reconciliation Module',
    projectId: 'proj-1',
    teamId: 'team-1',
    status: 'REVIEW',
    deliveryPoints: 13,
    assignee: 'Grace Okafor',
    sprint: 'Sprint 24',
    createdAt: new Date('2025-01-18T10:00:00'),
    updatedAt: new Date('2025-02-02T14:00:00'),
    priority: 'High',
    isRollback: false,
    description: 'Automated payment reconciliation system',
  },
  {
    id: 'JIRA-1003',
    title: 'API Rate Limiting Enhancement',
    projectId: 'proj-1',
    teamId: 'team-1',
    status: 'IN PROGRESS',
    deliveryPoints: 5,
    assignee: 'Ngozi Eze',
    sprint: 'Sprint 24',
    previousStatus: 'QA TEST',
    createdAt: new Date('2025-01-20T11:00:00'),
    updatedAt: new Date('2025-02-03T08:00:00'),
    priority: 'Medium',
    isRollback: true,
    description: 'Enhance API rate limiting for gateway',
  },
  {
    id: 'JIRA-1004',
    title: 'Gateway Performance Optimization',
    projectId: 'proj-1',
    teamId: 'team-1',
    status: 'LIVE',
    deliveryPoints: 8,
    assignee: 'Emeka Okonkwo',
    sprint: 'Sprint 23',
    createdAt: new Date('2025-01-10T08:00:00'),
    updatedAt: new Date('2025-02-01T16:00:00'),
    priority: 'Medium',
    isRollback: false,
    description: 'Optimize gateway for high-volume transactions',
  },
  // Real-time Transaction Processing tickets
  {
    id: 'JIRA-2001',
    title: 'Real-time Fraud Detection',
    projectId: 'proj-3',
    teamId: 'team-2',
    status: 'QA TEST',
    deliveryPoints: 13,
    assignee: 'Yusuf Abdullahi',
    sprint: 'Sprint 24',
    createdAt: new Date('2025-01-10T08:00:00'),
    updatedAt: new Date('2025-02-01T16:00:00'),
    priority: 'High',
    isRollback: false,
    description: 'ML-based fraud detection system',
  },
  {
    id: 'JIRA-2002',
    title: 'Transaction Routing Logic',
    projectId: 'proj-3',
    teamId: 'team-2',
    status: 'UAT',
    deliveryPoints: 8,
    assignee: 'Chukwudi Ike',
    sprint: 'Sprint 24',
    createdAt: new Date('2025-01-25T09:00:00'),
    updatedAt: new Date('2025-02-03T09:00:00'),
    priority: 'High',
    isRollback: false,
    description: 'Intelligent routing for transaction processing',
  },
  {
    id: 'JIRA-2003',
    title: 'Switch Failover Mechanism',
    projectId: 'proj-3',
    teamId: 'team-2',
    status: 'PRODUCTION READY',
    deliveryPoints: 13,
    assignee: 'Aisha Bello',
    sprint: 'Sprint 24',
    createdAt: new Date('2025-01-08T11:00:00'),
    updatedAt: new Date('2025-02-02T15:00:00'),
    priority: 'Critical',
    isRollback: false,
    description: 'Automatic failover for switch redundancy',
  },
  // BVN Verification Module tickets
  {
    id: 'JIRA-3001',
    title: 'BVN Validation API',
    projectId: 'proj-5',
    teamId: 'team-3',
    status: 'DEVOPS',
    deliveryPoints: 8,
    assignee: 'Amina Hassan',
    sprint: 'Sprint 24',
    createdAt: new Date('2025-01-20T11:00:00'),
    updatedAt: new Date('2025-02-03T11:00:00'),
    priority: 'High',
    isRollback: false,
    description: 'API for BVN validation and verification',
  },
  {
    id: 'JIRA-3002',
    title: 'Identity Matching Algorithm',
    projectId: 'proj-5',
    teamId: 'team-3',
    status: 'SECURITY TEST',
    deliveryPoints: 13,
    assignee: 'Bola Adeyemi',
    sprint: 'Sprint 24',
    createdAt: new Date('2025-01-15T09:00:00'),
    updatedAt: new Date('2025-02-02T14:00:00'),
    priority: 'High',
    isRollback: false,
    description: 'Advanced matching for identity verification',
  },
  // Enterprise Portal Redesign tickets
  {
    id: 'JIRA-4001',
    title: 'Dashboard UI/UX Redesign',
    projectId: 'proj-7',
    teamId: 'team-4',
    status: 'READY TO TEST',
    deliveryPoints: 13,
    assignee: 'Kemi Johnson',
    sprint: 'Sprint 24',
    createdAt: new Date('2025-01-08T10:00:00'),
    updatedAt: new Date('2025-02-01T12:00:00'),
    priority: 'Medium',
    isRollback: false,
    description: 'Modern redesign of enterprise dashboard',
  },
  {
    id: 'JIRA-4002',
    title: 'Mobile Responsive Design',
    projectId: 'proj-7',
    teamId: 'team-4',
    status: 'BLOCKED',
    deliveryPoints: 8,
    assignee: 'Segun Afolabi',
    sprint: 'Sprint 24',
    createdAt: new Date('2025-01-22T09:00:00'),
    updatedAt: new Date('2025-02-03T08:00:00'),
    priority: 'Medium',
    isRollback: false,
    description: 'Mobile-first responsive design implementation',
  },
  {
    id: 'JIRA-4003',
    title: 'User Access Management',
    projectId: 'proj-7',
    teamId: 'team-4',
    status: 'TO DO',
    deliveryPoints: 5,
    assignee: 'Unassigned',
    sprint: 'Sprint 25',
    createdAt: new Date('2025-02-01T11:00:00'),
    updatedAt: new Date('2025-02-01T11:00:00'),
    priority: 'Low',
    isRollback: false,
    description: 'Role-based access control system',
  },
];

// Mock incidents
export const mockIncidents: Incident[] = [
  {
    id: 'INC-2025-001',
    title: 'Core Banking API Timeout',
    severity: 'Critical',
    status: 'In Progress',
    source: 'Jira',
    slaStatus: 'At Risk',
    slaTimeRemaining: 45,
    downtime: 120,
    assignee: 'Adebayo Oluwaseun',
    teamId: 'team-2',
    institution: 'Access Bank',
    createdAt: new Date('2025-02-03T08:30:00'),
    priority: 'P1',
  },
  {
    id: 'INC-2025-002',
    title: 'Transaction Processing Delay',
    severity: 'High',
    status: 'Open',
    source: 'Freshdesk',
    slaStatus: 'On Track',
    slaTimeRemaining: 180,
    downtime: 0,
    assignee: 'Chioma Nwosu',
    teamId: 'team-2',
    institution: 'GTBank',
    createdAt: new Date('2025-02-03T10:15:00'),
    priority: 'P2',
  },
  {
    id: 'INC-2025-003',
    title: 'Dashboard Loading Issues',
    severity: 'Medium',
    status: 'Resolved',
    source: 'Jira',
    slaStatus: 'On Track',
    slaTimeRemaining: 0,
    downtime: 30,
    assignee: 'Ibrahim Mohammed',
    teamId: 'team-4',
    institution: 'First Bank',
    createdAt: new Date('2025-02-02T14:20:00'),
    resolvedAt: new Date('2025-02-03T09:00:00'),
    priority: 'P3',
  },
  {
    id: 'INC-2025-004',
    title: 'Authentication Service Outage',
    severity: 'Critical',
    status: 'Resolved',
    source: 'Jira',
    slaStatus: 'Breached',
    slaTimeRemaining: 0,
    downtime: 240,
    assignee: 'Fatima Abubakar',
    teamId: 'team-3',
    institution: 'Zenith Bank',
    createdAt: new Date('2025-02-01T16:00:00'),
    resolvedAt: new Date('2025-02-02T10:30:00'),
    priority: 'P1',
  },
  {
    id: 'INC-2025-005',
    title: 'Report Generation Failure',
    severity: 'Low',
    status: 'Open',
    source: 'Freshdesk',
    slaStatus: 'On Track',
    slaTimeRemaining: 720,
    downtime: 0,
    assignee: 'Emeka Okonkwo',
    teamId: 'team-1',
    institution: 'UBA',
    createdAt: new Date('2025-02-03T11:00:00'),
    priority: 'P4',
  },
];

// Mock ticket history
export const mockTicketHistory: TicketHistory[] = [
  {
    ticketId: 'JIRA-1003',
    timestamp: new Date('2025-02-03T08:00:00'),
    fromStatus: 'QA TEST',
    toStatus: 'IN PROGRESS',
    user: 'John Doe (QA Lead)',
    reason: 'Failed regression testing - authentication flow broken',
    isRollback: true,
  },
  {
    ticketId: 'JIRA-1003',
    timestamp: new Date('2025-02-02T14:00:00'),
    fromStatus: 'REVIEW',
    toStatus: 'QA TEST',
    user: 'System Auto',
    isRollback: false,
  },
  {
    ticketId: 'JIRA-1003',
    timestamp: new Date('2025-02-01T10:00:00'),
    fromStatus: 'IN PROGRESS',
    toStatus: 'REVIEW',
    user: 'Ngozi Eze',
    isRollback: false,
  },
  {
    ticketId: 'JIRA-1001',
    timestamp: new Date('2025-02-03T10:30:00'),
    fromStatus: 'IN PROGRESS',
    toStatus: 'IN PROGRESS',
    user: 'Tunde Bakare',
    reason: 'Updated implementation approach',
    isRollback: false,
  },
  {
    ticketId: 'JIRA-1001',
    timestamp: new Date('2025-01-28T09:00:00'),
    fromStatus: 'TO DO',
    toStatus: 'IN PROGRESS',
    user: 'Scrum Master',
    isRollback: false,
  },
];

// Mock KPIs
export const mockKPIs: KPI[] = [
  {
    label: 'Open Incidents',
    value: 12,
    change: -8,
    trend: 'down',
  },
  {
    label: 'SLA Breaches',
    value: 3,
    change: 50,
    trend: 'up',
  },
  {
    label: 'Delivery Points (Sprint)',
    value: 87,
    change: 12,
    trend: 'up',
  },
  {
    label: 'System Downtime',
    value: 45,
    change: -25,
    trend: 'down',
    unit: 'mins',
  },
  {
    label: 'Active Rollbacks',
    value: 2,
    change: 0,
    trend: 'stable',
  },
  {
    label: 'Avg Resolution Time',
    value: 4.2,
    change: -15,
    trend: 'down',
    unit: 'hrs',
  },
];

// Chart data for trends
export const incidentTrendData = [
  { month: 'Aug', incidents: 45, resolved: 42 },
  { month: 'Sep', incidents: 38, resolved: 36 },
  { month: 'Oct', incidents: 52, resolved: 48 },
  { month: 'Nov', incidents: 41, resolved: 40 },
  { month: 'Dec', incidents: 35, resolved: 34 },
  { month: 'Jan', incidents: 28, resolved: 26 },
  { month: 'Feb', incidents: 15, resolved: 12 },
];

export const deliveryPointsData = [
  { sprint: 'S19', planned: 80, completed: 78, efficiency: 97.5 },
  { sprint: 'S20', planned: 85, completed: 82, efficiency: 96.5 },
  { sprint: 'S21', planned: 90, completed: 85, efficiency: 94.4 },
  { sprint: 'S22', planned: 88, completed: 87, efficiency: 98.9 },
  { sprint: 'S23', planned: 92, completed: 90, efficiency: 97.8 },
  { sprint: 'S24', planned: 95, completed: 87, efficiency: 91.6 },
];

export const slaComplianceData = [
  { team: 'Collections', compliance: 95, breaches: 2, total: 40 },
  { team: 'Core Switching', compliance: 88, breaches: 5, total: 42 },
  { team: 'Data & Identity', compliance: 92, breaches: 3, total: 38 },
  { team: 'Enterprise Solutions', compliance: 90, breaches: 4, total: 40 },
];

export const downtimeByInstitution = [
  { name: 'Access Bank', downtime: 120 },
  { name: 'GTBank', downtime: 45 },
  { name: 'First Bank', downtime: 30 },
  { name: 'Zenith Bank', downtime: 240 },
  { name: 'UBA', downtime: 15 },
  { name: 'Others', downtime: 85 },
];
