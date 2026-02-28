const API_BASE_URL = 'http://localhost:5001/api';

// Convert any casing (PascalCase, snake_case) to camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v));
  } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      // 1. Convert PascalCase to camelCase (e.g., Email -> email)
      let camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      // 2. Convert snake_case to camelCase (e.g., first_name -> firstName)
      camelKey = camelKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

class ApiService {
  private baseURL = API_BASE_URL;

  private buildQuery(params?: any): string {
    if (!params) return '';
    const cleanParams: any = {};
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        cleanParams[key] = params[key];
      }
    });
    const qs = new URLSearchParams(cleanParams).toString();
    return qs ? `?${qs}` : '';
  }

  private getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      const errorText = await response.text();
      console.error(`API [GET] error: ${endpoint} -> ${response.status} - ${errorText}`);

      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorText) {
          errorMessage = errorText;
        }
      } catch (e) {
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const camelData = toCamelCase(data);
    return camelData;
  }

  async post<T>(endpoint: string, payload: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API [POST] error: ${endpoint} -> ${response.status} - ${errorText}`);
      let errorMessage = errorText || `HTTP error! status: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        // Not json
      }
      throw new Error(errorMessage);
    }

    const json = await response.json();
    return toCamelCase(json);
  }

  async patch<T>(endpoint: string, payload: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API [PATCH] error: ${endpoint} -> ${response.status} - ${errorText}`);
      let errorMessage = errorText || `HTTP error! status: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        // Not json
      }
      throw new Error(errorMessage);
    }

    const json = await response.json();
    return toCamelCase(json);
  }

  async put<T>(endpoint: string, payload: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API [PUT] error: ${endpoint} -> ${response.status} - ${errorText}`);
      let errorMessage = errorText || `HTTP error! status: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        // Not json
      }
      throw new Error(errorMessage);
    }

    const json = await response.json();
    return toCamelCase(json);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API [DELETE] error: ${endpoint} -> ${response.status} - ${errorText}`);
      let errorMessage = errorText || `HTTP error! status: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        // Not json
      }
      throw new Error(errorMessage);
    }

    try {
      const text = await response.text();
      if (!text) return {} as T;
      const json = JSON.parse(text);
      return toCamelCase(json);
    } catch (e) {
      return {} as T;
    }
  }

  async checkHealth() {
    return this.get('/health');
  }

  async getDashboardData(params?: any) {
    return this.get(`/dashboard${this.buildQuery(params)}`);
  }

  async getTickets(params?: any) {
    return this.get<any[]>(`/tickets${this.buildQuery(params)}`);
  }

  async getSprintBoardTickets(teamId: number) {
    return this.get(`/tickets/sprint-board?teamId=${teamId}`);
  }

  async syncSprintBoard(teamId: number, projectKey: string) {
    return this.post(`/jira/sync-sprint-board?teamId=${teamId}&projectKey=${projectKey}`, {});
  }

  async getTicketMovements(params?: any) {
    return this.get<any[]>(`/tickets/movements${this.buildQuery(params)}`);
  }

  async getRollbacks(params?: any) {
    return this.get<any[]>(`/tickets/rollbacks${this.buildQuery(params)}`);
  }

  async justifyMovement(movementId: number, justification: string, justifiedBy?: string) {
    return this.patch<any>(`/tickets/movements/${movementId}/justification`, { justification, justifiedBy });
  }

  async getIncidents(params?: any) {
    return this.get(`/incidents${this.buildQuery(params)}`);
  }

  async getDeliveryPoints() {
    return this.get('/delivery-points');
  }

  async getTeams() {
    return this.get<any[]>('/teams');
  }

  async syncTeams() {
    return this.post('/teams/sync', {});
  }

  async getProjects(includeEmpty: boolean = false) {
    return this.get(`/projects${includeEmpty ? '?includeEmpty=true' : ''}`);
  }

  async updateProject(id: number, project: any) {
    return this.put(`/projects/${id}`, project);
  }

  async deleteProject(id: number) {
    return this.delete(`/projects/${id}`);
  }

  // Escalation Methods
  async getEscalations(params?: any) {
    return this.get<any[]>(`/escalations${this.buildQuery(params)}`);
  }

  async getDevelopmentIncidents(params?: any) {
    return this.get<any[]>(`/incidents/l4${this.buildQuery(params)}`);
  }

  async syncDevelopmentIncidents() {
    return this.post<any>('/incidents/sync-l4', {});
  }

  async updateDevelopmentIncidentTeam(id: number, team: string) {
    return this.patch<any>(`/incidents/l4/${id}/team`, { team });
  }

  async updateDevelopmentIncidentLevel(id: number, level: string) {
    return this.patch<any>(`/Incidents/l4-reassign/${id}`, { level });
  }

  async getEscalationJourney(externalId: string) {
    return this.get<any[]>(`/escalations/${externalId}/journey`);
  }

  async getEscalationStats(params?: any) {
    return this.get<any>(`/escalations/stats${this.buildQuery(params)}`);
  }

  async getGovernanceAnalytics(params?: any) {
    return this.get<any>(`/GovernanceAnalytics${this.buildQuery(params)}`);
  }

  async getGovernanceCockpit(params?: any) {
    return this.get<any>(`/governance/cockpit${this.buildQuery(params)}`);
  }

  // Jira Integration Methods
  async getJiraProjects() {
    return this.get('/jira/projects');
  }

  async createProject(project: any) {
    return this.post('/projects', project);
  }

  async updateProjectMapping(jiraKey: string, teamId: number | null) {
    return this.post('/jira/mapping', { jiraKey, teamId });
  }

  async syncJiraProjects() {
    return this.post('/jira/sync', {});
  }

  // Auth Methods
  async login(data: any) {
    return this.post('/auth/login', data);
  }

  async inviteUser(email: string, role: string, permissions: any) {
    return this.post('/auth/invite', { email, role, permissions });
  }

  async validateInvite(token: string) {
    return this.get(`/auth/validate-invite/${token}`);
  }

  async registerUser(data: any) {
    return this.post('/auth/register', data);
  }

  // User Management
  async getUsers() {
    return this.get('/users');
  }

  async updateUserPermissions(userId: number, role: string, data: any) {
    const payload = { ...data, role };
    const response = await fetch(`${this.baseURL}/users/${userId}/permissions`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText || `HTTP error! status: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        // Not json
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  async getCurrentUser() {
    return this.get('/users/me');
  }

  async getUnmappedTickets() {
    return this.get<any[]>('/tickets/unmapped');
  }

  async mapTicketToProject(ticketId: number, projectId: number | null) {
    return this.patch<any>(`/tickets/${ticketId}/map`, projectId);
  }

  // Database Viewer Methods
  async getDatabaseTables() {
    return this.get<string[]>('/database/tables');
  }

  async getTableColumns(tableName: string) {
    return this.get<string[]>(`/database/columns/${tableName}`);
  }

  async executeDatabaseQuery(sql: string) {
    return this.post<any>('/database/query', { sql });
  }
}

export const apiService = new ApiService();
export default apiService;