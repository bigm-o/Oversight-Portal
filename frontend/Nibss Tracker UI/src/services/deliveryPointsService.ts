import apiClient from './apiService';
import { ComplexityLevel, RiskLevel } from './ticketsService';

export interface DeliveryPointsCalculation {
  type: string;
  complexity: string;
  risk: string;
  deliveryPoints: number;
  formula: string;
  timestamp: string;
}

export interface DeliveryPointsExample {
  message: string;
  formula: {
    tickets: string;
    incidents: string;
  };
  examples: Array<{
    type: string;
    complexity: string;
    risk: string;
    points: number;
  }>;
  timestamp: string;
}

export const deliveryPointsService = {
  // Calculate ticket points
  async calculateTicketPoints(complexity: ComplexityLevel, risk: RiskLevel): Promise<DeliveryPointsCalculation> {
    const response = await apiClient.get('/deliverypoints/calculate/ticket', {
      params: { complexity, risk }
    });
    return response.data;
  },

  // Calculate incident points
  async calculateIncidentPoints(complexity: ComplexityLevel, risk: RiskLevel): Promise<DeliveryPointsCalculation> {
    const response = await apiClient.get('/deliverypoints/calculate/incident', {
      params: { complexity, risk }
    });
    return response.data;
  },

  // Get examples
  async getExamples(): Promise<DeliveryPointsExample> {
    const response = await apiClient.get('/deliverypoints/examples');
    return response.data;
  }
};