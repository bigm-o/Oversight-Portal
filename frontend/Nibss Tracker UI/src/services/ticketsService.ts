import apiClient from './apiService';

export interface Ticket {
  id: number;
  jiraKey: string;
  title: string;
  description?: string;
  status: TicketStatus;
  complexity: ComplexityLevel;
  risk: RiskLevel;
  deliveryPoints: number;
  cabApproved: boolean;
  cabRejectionReason?: string;
  pointsLocked: boolean;
  projectId: number;
  assignedTo: string;
  jiraUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export enum TicketStatus {
  TODO = 0,
  INPROGRESS = 1,
  TESTING = 2,
  CABAPPROVAL = 3,
  LIVE = 4,
  ROLLBACK = 5
}

export enum ComplexityLevel {
  C1 = 1,
  C2 = 2,
  C3 = 3,
  C4 = 4
}

export enum RiskLevel {
  R1 = 1,
  R2 = 2,
  R3 = 3,
  R4 = 4
}

export const ticketsService = {
  // Get all tickets
  async getTickets(): Promise<Ticket[]> {
    const response = await apiClient.get('/tickets');
    return response.data;
  },

  // Get ticket by ID
  async getTicket(id: number): Promise<Ticket> {
    const response = await apiClient.get(`/tickets/${id}`);
    return response.data;
  },

  // Get ticket by JIRA key
  async getTicketByJiraKey(jiraKey: string): Promise<Ticket> {
    const response = await apiClient.get(`/tickets/jira/${jiraKey}`);
    return response.data;
  },

  // Create new ticket
  async createTicket(ticket: Omit<Ticket, 'id' | 'deliveryPoints' | 'createdAt' | 'updatedAt'>): Promise<Ticket> {
    const response = await apiClient.post('/tickets', ticket);
    return response.data;
  },

  // Update ticket
  async updateTicket(id: number, ticket: Ticket): Promise<Ticket> {
    const response = await apiClient.put(`/tickets/${id}`, ticket);
    return response.data;
  },

  // Delete ticket
  async deleteTicket(id: number): Promise<void> {
    await apiClient.delete(`/tickets/${id}`);
  },

  // Update complexity
  async updateComplexity(id: number, complexity: ComplexityLevel): Promise<any> {
    const response = await apiClient.patch(`/tickets/${id}/complexity`, complexity);
    return response.data;
  },

  // Update risk
  async updateRisk(id: number, risk: RiskLevel): Promise<any> {
    const response = await apiClient.patch(`/tickets/${id}/risk`, risk);
    return response.data;
  }
};