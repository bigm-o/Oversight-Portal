import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { SyncProvider } from "./contexts/SyncContext.tsx";
import { GptProvider } from "./contexts/GptContext.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <ThemeProvider>
      <SyncProvider>
        <GptProvider>
          <App />
        </GptProvider>
      </SyncProvider>
    </ThemeProvider>
  </AuthProvider>
);