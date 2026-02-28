import * as signalR from '@microsoft/signalr';

export class RealTimeService {
  private connection: signalR.HubConnection | null = null;
  private readonly hubUrl = 'http://localhost:5001/ticketHub';

  async startConnection(): Promise<void> {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl)
      .withAutomaticReconnect()
      .build();

    try {
      await this.connection.start();
      console.log('SignalR Connected');
    } catch (error) {
      console.error('SignalR Connection Error:', error);
    }
  }

  async stopConnection(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      console.log('SignalR Disconnected');
    }
  }

  // Join project group for targeted notifications
  async joinProjectGroup(projectId: string): Promise<void> {
    if (this.connection) {
      await this.connection.invoke('JoinProjectGroup', projectId);
    }
  }

  // Leave project group
  async leaveProjectGroup(projectId: string): Promise<void> {
    if (this.connection) {
      await this.connection.invoke('LeaveProjectGroup', projectId);
    }
  }

  // Listen for ticket updates
  onTicketUpdated(callback: (data: any) => void): void {
    if (this.connection) {
      this.connection.on('TicketUpdated', callback);
    }
  }

  // Listen for incident updates
  onIncidentUpdated(callback: (data: any) => void): void {
    if (this.connection) {
      this.connection.on('IncidentUpdated', callback);
    }
  }

  // Listen for test notifications
  onTestNotification(callback: (data: any) => void): void {
    if (this.connection) {
      this.connection.on('TestNotification', callback);
    }
  }

  // Remove all listeners
  removeAllListeners(): void {
    if (this.connection) {
      this.connection.off('TicketUpdated');
      this.connection.off('IncidentUpdated');
      this.connection.off('TestNotification');
    }
  }

  // Get connection state
  getConnectionState(): signalR.HubConnectionState | null {
    return this.connection?.state || null;
  }
}

export const realTimeService = new RealTimeService();