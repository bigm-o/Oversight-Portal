import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { deliveryPointsService, DeliveryPointsCalculation, DeliveryPointsExample } from '../../services/deliveryPointsService';
import { ComplexityLevel, RiskLevel } from '../../services/ticketsService';

export const DeliveryPointsCalculator: React.FC = () => {
  const [complexity, setComplexity] = useState<ComplexityLevel>(ComplexityLevel.C1);
  const [risk, setRisk] = useState<RiskLevel>(RiskLevel.R1);
  const [ticketResult, setTicketResult] = useState<DeliveryPointsCalculation | null>(null);
  const [incidentResult, setIncidentResult] = useState<DeliveryPointsCalculation | null>(null);
  const [examples, setExamples] = useState<DeliveryPointsExample | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExamples();
  }, []);

  const loadExamples = async () => {
    try {
      const data = await deliveryPointsService.getExamples();
      setExamples(data);
    } catch (error) {
      console.error('Failed to load examples:', error);
    }
  };

  const calculatePoints = async () => {
    setLoading(true);
    try {
      const [ticketData, incidentData] = await Promise.all([
        deliveryPointsService.calculateTicketPoints(complexity, risk),
        deliveryPointsService.calculateIncidentPoints(complexity, risk)
      ]);
      
      setTicketResult(ticketData);
      setIncidentResult(incidentData);
    } catch (error) {
      console.error('Failed to calculate points:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Delivery Points Calculator</CardTitle>
          <CardDescription>
            Calculate delivery points for tickets and incidents based on complexity and risk levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Complexity Level</label>
              <Select value={complexity.toString()} onValueChange={(value) => setComplexity(Number(value) as ComplexityLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">C1 - Low Complexity</SelectItem>
                  <SelectItem value="2">C2 - Medium Complexity</SelectItem>
                  <SelectItem value="3">C3 - High Complexity</SelectItem>
                  <SelectItem value="4">C4 - Executive Vision</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Risk Level</label>
              <Select value={risk.toString()} onValueChange={(value) => setRisk(Number(value) as RiskLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">R1 - Low Risk</SelectItem>
                  <SelectItem value="2">R2 - Medium Risk</SelectItem>
                  <SelectItem value="3">R3 - High Risk</SelectItem>
                  <SelectItem value="4">R4 - Critical Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={calculatePoints} disabled={loading} className="w-full">
            {loading ? 'Calculating...' : 'Calculate Delivery Points'}
          </Button>

          {(ticketResult || incidentResult) && (
            <div className="grid grid-cols-2 gap-4 mt-6">
              {ticketResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ticket Points</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <Badge variant="secondary" className="text-2xl p-2">
                        {ticketResult.deliveryPoints} points
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-2">
                        {ticketResult.formula}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {incidentResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Incident Points</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <Badge variant="outline" className="text-2xl p-2">
                        {incidentResult.deliveryPoints} points
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-2">
                        {incidentResult.formula}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {examples && (
        <Card>
          <CardHeader>
            <CardTitle>Formula Examples</CardTitle>
            <CardDescription>
              {examples.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Formulas:</h4>
                <p className="text-sm text-muted-foreground">Tickets: {examples.formula.tickets}</p>
                <p className="text-sm text-muted-foreground">Incidents: {examples.formula.incidents}</p>
              </div>
              
              <div>
                <h4 className="font-medium">Examples:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {examples.examples.map((example, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="text-sm">
                        {example.type} - {example.complexity}/{example.risk}
                      </span>
                      <Badge variant="outline">{example.points} pts</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};