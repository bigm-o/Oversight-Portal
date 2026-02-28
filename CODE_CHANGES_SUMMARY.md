# Code Changes Summary - Background Sync Implementation

## Overview
This document details the exact code changes made to implement non-blocking background sync.

## File 1: src/main.tsx

### Change: Add SyncProvider to app wrapper

**Before:**
```tsx
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </AuthProvider>
);
```

**After:**
```tsx
import { SyncProvider } from "./contexts/SyncContext.tsx";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <ThemeProvider>
      <SyncProvider>
        <App />
      </SyncProvider>
    </ThemeProvider>
  </AuthProvider>
);
```

**Why:** Makes sync context available to entire app tree

---

## File 2: src/app/pages/IncidentTrackerReal.tsx

### Change 1: Add imports

**Before:**
```tsx
import { useSync } from '@/contexts/SyncContext';
import axios from 'axios';
```

**After:**
```tsx
import { useSync, SyncStatus } from '@/contexts/SyncContext';
import axios from 'axios';
```

### Change 2: Update state and add sync hook

**Before:**
```tsx
export function IncidentTrackerReal() {
  const [cockpitData, setCockpitData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  // ... more state
```

**After:**
```tsx
export function IncidentTrackerReal() {
  const [cockpitData, setCockpitData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ... more state

  const { startSync, currentJob } = useSync();
  const isSyncing = currentJob?.status === SyncStatus.Running && currentJob?.type === 'Incidents';
```

**Why:** Remove local `syncing` state, use context instead. Compute `isSyncing` from sync job status.

### Change 3: Update handleManualSync

**Before:**
```tsx
const handleManualSync = async () => {
  try {
    setSyncing(true);
    await axios.post('http://localhost:5001/api/governance/sync');
    await fetchCockpitData();
  } catch (err: any) {
    console.error('Sync error:', err);
    alert(`Sync failed: ${err.response?.data?.message || err.message}`);
  } finally {
    setSyncing(false);
  }
};
```

**After:**
```tsx
const handleManualSync = async () => {
  try {
    // Trigger sync in background - don't wait for it
    await startSync('Incidents');
    // Optionally refresh data after a short delay to pick up any immediate updates
    setTimeout(() => {
      fetchCockpitData();
    }, 2000);
  } catch (err: any) {
    console.error('Sync error:', err);
  }
};
```

**Why:** 
- Don't await the API call, just return the jobId
- Let SyncContext handle error notifications via toast
- Refresh data after 2 seconds instead of immediately

### Change 4: Update sync button

**Before:**
```tsx
<Button
  onClick={handleManualSync}
  disabled={syncing}
  variant="outline"
  className="border-green-700 text-green-700 hover:bg-green-50 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
>
  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${syncing ? 'animate-spin' : ''}`} />
  {syncing ? 'Syncing...' : 'Sync from API'}
</Button>
```

**After:**
```tsx
<Button
  onClick={handleManualSync}
  disabled={isSyncing}
  variant="outline"
  className="border-green-700 text-green-700 hover:bg-green-50 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
>
  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
  {isSyncing ? 'Syncing...' : 'Sync from API'}
</Button>
```

**Why:** Replace all `syncing` references with `isSyncing` from context

---

## File 3: src/app/pages/DevelopmentTrackerReal.tsx

### Change 1: Add imports

**Before:**
```tsx
import { useAuth } from '@/contexts/AuthContext';
```

**After:**
```tsx
import { useAuth } from '@/contexts/AuthContext';
import { useSync, SyncStatus } from '@/contexts/SyncContext';
```

### Change 2: Add sync hook

**Before:**
```tsx
export function DevelopmentTrackerReal() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  // ... more state
```

**After:**
```tsx
export function DevelopmentTrackerReal() {
  const { user } = useAuth();
  const { startSync, currentJob } = useSync();
  const [tickets, setTickets] = useState([]);
  // ... more state

  const isSyncing = currentJob?.status === SyncStatus.Running && currentJob?.type === 'JIRA';
```

### Change 3: Update sync button handler

**Before:**
```tsx
<Button
  onClick={async () => {
    try {
      setLoading(true);
      await apiService.syncTeams();
      await fetchData();
      alert('Sync completed successfully');
    } catch (err) {
      console.error('Sync failed:', err);
      alert('Sync failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  }}
  className="flex items-center gap-2"
>
  <div className="w-4 h-4 animate-spin-slow">
    {/* SVG */}
  </div>
  Sync JIRA Data
</Button>
```

**After:**
```tsx
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
    {/* SVG */}
  </div>
  {isSyncing ? 'Syncing...' : 'Sync JIRA Data'}
</Button>
```

**Why:**
- Remove `setLoading(true)` blocking pattern
- Call `startSync('JIRA')` without awaiting
- Add `disabled={isSyncing}` to prevent multiple clicks
- Conditionally show spinner and text based on sync state

---

## File 4: src/app/pages/JiraMapping.tsx

### Change 1: Add import

**Before:**
```tsx
import apiService from '@/services/apiService';
```

**After:**
```tsx
import apiService from '@/services/apiService';
import { useSync, SyncStatus } from '@/contexts/SyncContext';
```

### Change 2: Remove syncing state and add sync hook

**Before:**
```tsx
export const JiraMapping = () => {
    const [sources, setSources] = useState<JiraSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [teams, setTeams] = useState<Team[]>([]);

    const availableTeams = [
      // ...
    ];
```

**After:**
```tsx
export const JiraMapping = () => {
    const [sources, setSources] = useState<JiraSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [teams, setTeams] = useState<Team[]>([]);
    const { startSync, currentJob } = useSync();

    const isSyncing = currentJob?.status === SyncStatus.Running && currentJob?.type === 'JIRA';

    const availableTeams = [
      // ...
    ];
```

### Change 3: Update handleSync function

**Before:**
```tsx
const handleSync = async () => {
    try {
        setSyncing(true);
        await apiService.syncJiraProjects();
        // Wait a bit or poll? For now just show triggered.
        setTimeout(fetchData, 2000);
    } catch (error) {
        console.error("Sync failed", error);
    } finally {
        setSyncing(false);
    }
};
```

**After:**
```tsx
const handleSync = async () => {
    try {
        // Trigger sync in background - don't wait for it
        await startSync('JIRA');
        // Optionally refresh data after a short delay to pick up any immediate updates
        setTimeout(fetchData, 2000);
    } catch (error) {
        console.error("Sync failed", error);
    }
};
```

### Change 4: Update sync button

**Before:**
```tsx
<Button onClick={handleSync} disabled={syncing}>
    <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
    {syncing ? 'Syncing...' : 'Sync Now'}
</Button>
```

**After:**
```tsx
<Button onClick={handleSync} disabled={isSyncing}>
    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
    {isSyncing ? 'Syncing...' : 'Sync Now'}
</Button>
```

---

## Pattern Applied: Non-Blocking Sync

### Common Pattern (Before)
```tsx
// BLOCKING - waits for entire sync
const handleSync = async () => {
  try {
    setLoading(true);
    await apiService.sync();        // BLOCKS HERE
    await fetchData();               // BLOCKS HERE
    // User must wait for both to complete
  } finally {
    setLoading(false);
  }
};
```

### New Pattern (After)
```tsx
// NON-BLOCKING - returns immediately
const handleSync = async () => {
  try {
    await startSync('Type');         // Returns with jobId immediately
    setTimeout(() => {
      fetchData();                   // Refresh after delay, but doesn't block
    }, 2000);                        // User can interact immediately
  } catch (err) {
    // Error handled by SyncContext toast
  }
};
```

---

## Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| **State Management** | Local `syncing` state | Global `currentJob` from context |
| **Blocking** | `await` on API call and data fetch | No await on API call |
| **Error Handling** | Alert dialog | Toast notification via SyncContext |
| **User Feedback** | Loading state blocks UI | Spinner animates, page responsive |
| **Navigation** | Blocked during sync | Always allowed |
| **Data Refresh** | Immediate after sync | After 2-second delay |
| **Multiple Syncs** | Not supported | Tracked separately via jobId |
| **Type Safety** | Manual string checking | Enum-based status checking |

---

## Backend API Contracts

### Endpoint: POST /api/governance/sync
```json
Response (Immediate):
{
  "message": "Sync started in background",
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Endpoint: POST /api/jira/sync
```json
Response (Immediate):
{
  "message": "Sync started in background", 
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### SignalR Message: SyncStatusUpdated
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "Incidents",
  "status": 0,  // Running
  "message": "Syncing Freshservice data...",
  "progress": 45,
  "startTime": "2025-02-20T10:30:00Z",
  "endTime": null
}
```

When complete:
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "Incidents",
  "status": 1,  // Completed
  "message": "Sync completed: 234 records updated",
  "progress": 100,
  "startTime": "2025-02-20T10:30:00Z",
  "endTime": "2025-02-20T10:35:42Z"
}
```

---

## Testing Each Change

### Test IncidentTrackerReal
```
1. Open Incidents page
2. Click "Sync from API"
3. Verify: Page shows spinner, button disabled
4. Verify: Can click other buttons (not blocked)
5. Wait: 5-30 seconds for backend sync
6. Verify: Toast shows "Incidents Sync Completed"
7. Verify: Data refreshes after toast
```

### Test DevelopmentTrackerReal
```
1. Open Development Tracker
2. Click "Sync JIRA Data"
3. Verify: Page shows spinner, button disabled
4. Verify: Can navigate to other pages
5. Wait: 5-30 seconds for backend sync
6. Verify: Toast shows "JIRA Sync Completed"
7. Verify: Data refreshes automatically
```

### Test JiraMapping
```
1. Open JIRA Integration
2. Click "Sync Now"
3. Verify: Table remains visible
4. Verify: Can still update mappings
5. Wait: 5-30 seconds for backend sync
6. Verify: Toast shows "JIRA Sync Completed"
7. Verify: New projects appear in table
```

---

## Summary of Pattern

The implementation follows a **three-layer pattern**:

**Layer 1: Component** 
- Calls `startSync(type)` without awaiting
- Optionally refreshes data after delay

**Layer 2: Context**
- Sends POST request to backend
- Listens for SignalR updates
- Shows toast notifications
- Updates global state

**Layer 3: Backend**
- Returns jobId immediately
- Processes sync in background
- Broadcasts status updates via SignalR

This three-layer separation ensures:
✅ UI never blocks
✅ Real-time feedback
✅ Scalable to multiple syncs
✅ Clean code organization
✅ Type-safe communication
