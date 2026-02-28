import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "@/app/components/RootLayout";
import { ExecutiveDashboardReal } from "@/app/pages/ExecutiveDashboardReal";
import { IncidentTrackerReal } from "@/app/pages/IncidentTrackerReal";
import { DevelopmentTrackerReal } from "@/app/pages/DevelopmentTrackerReal";
import { TicketMovementReal } from "@/app/pages/TicketMovementReal";
import { AnalyticsReal } from "@/app/pages/AnalyticsReal";
import { SLAComplianceReal } from "@/app/pages/SLAComplianceReal";
import { Reports } from "@/app/pages/Reports";
import { NotificationsReal } from "@/app/pages/NotificationsReal";
import { DatabaseViewer } from "@/app/pages/DatabaseViewer";
import { Login } from "@/app/pages/Login";
import { Register } from "@/app/pages/Register";
import { UserManagement } from "@/app/pages/UserManagement";
import { JiraMapping } from "@/app/pages/JiraMapping";
import { EscalationsReal } from "@/app/pages/EscalationsReal";
import { DevelopmentIncidentsReal } from "@/app/pages/DevelopmentIncidentsReal";
import { SystemSettings } from "@/app/pages/SystemSettings";
import { NibssGpt } from "@/app/pages/NibssGpt";


const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: ExecutiveDashboardReal },
      { path: "incidents", Component: IncidentTrackerReal },
      { path: "escalations", Component: EscalationsReal },
      { path: "development", Component: DevelopmentTrackerReal },
      { path: "development-incidents", Component: DevelopmentIncidentsReal },
      { path: "ticket-movement", Component: TicketMovementReal },
      { path: "analytics", Component: AnalyticsReal },
      { path: "sla-compliance", Component: SLAComplianceReal },
      { path: "reports", Component: Reports },
      { path: "notifications", Component: NotificationsReal },
      { path: "database", Component: DatabaseViewer },
      { path: "admin/users", Component: UserManagement },
      { path: "admin/jira", Component: JiraMapping },
      { path: "gpt", Component: NibssGpt },
      { path: "settings", Component: SystemSettings },
    ],
  },
]);
