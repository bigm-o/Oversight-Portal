import React, { createContext, useContext, useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { toast } from 'sonner';

export enum SyncStatus {
    Running = 0,
    Completed = 1,
    Failed = 2,
    Idle = 3
}

export interface SyncJobStatus {
    jobId: string;
    type: string;
    status: SyncStatus;
    message: string;
    progress: number;
}

interface SyncContextType {
    jobs: Record<string, SyncJobStatus | null>;
    startSync: (type: 'JIRA' | 'Incidents' | 'Escalations') => Promise<string>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [jobs, setJobs] = useState<Record<string, SyncJobStatus | null>>({
        JIRA: null,
        Incidents: null,
        Escalations: null
    });
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const shownToastIdRef = React.useRef<Record<string, string | number | null>>({});

    useEffect(() => {
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl('http://localhost:5001/ticketHub')
            .withAutomaticReconnect()
            .build();

        setConnection(newConnection);
    }, []);

    const normalizeType = (raw: string) => {
        if (!raw) return raw;
        const lower = raw.toLowerCase();
        if (lower.includes('jira')) return 'JIRA';
        if (lower.includes('escalat')) return 'Escalations';
        if (lower.includes('incident') || lower.includes('request') || lower.includes('fresh')) return 'Incidents';
        return raw;
    };

    useEffect(() => {
        if (connection) {
            connection.start()
                .then(() => {
                    console.log('SignalR Connected');
                    connection.on('SyncStatusUpdated', (status: SyncJobStatus) => {
                        console.log('Sync status update:', status);
                        // Normalize the incoming type to our frontend keys
                        const key = normalizeType(status.type);
                        const normalizedStatus: SyncJobStatus = { ...status, type: key };

                        // Update jobs map for this normalized type
                        setJobs(prev => ({ ...prev, [key]: normalizedStatus }));

                        const syncLabel = key === 'Incidents' ? 'Freshworks' : key === 'JIRA' ? 'Jira' : key === 'Escalations' ? 'Escalations' : status.type;

                        if (normalizedStatus.status === SyncStatus.Running) {
                            console.log(`Starting ${syncLabel} sync - showing loading toast for key=${key}`);
                            // Dismiss any previous toast for this normalized key
                            const prevId = shownToastIdRef.current[key];
                            if (prevId != null) {
                                toast.dismiss(prevId);
                            }
                            // Show "ongoing" toast when sync starts
                            const toastId = toast.loading(`${syncLabel} sync ongoing`, {
                                description: 'Syncing data in background...',
                            });
                            shownToastIdRef.current[key] = toastId;
                            console.log(`Loading toast shown for ${key} with ID: ${toastId}`);
                        } else if (normalizedStatus.status === SyncStatus.Completed) {
                            console.log(`${syncLabel} sync completed - updating toast to success for key=${key}`);
                            // Dismiss the loading toast for this normalized key
                            const prevId = shownToastIdRef.current[key];
                            if (prevId != null) {
                                toast.dismiss(prevId);
                            }
                            // Show success toast
                            toast.success(`${syncLabel} sync complete`, {
                                description: status.message,
                                duration: 5000,
                            });
                            shownToastIdRef.current[key] = null;
                            // Clear status immediately so UI buttons/toasts stop showing running state
                            setJobs(prev => ({ ...prev, [key]: null }));
                        } else if (normalizedStatus.status === SyncStatus.Failed) {
                            console.log(`${syncLabel} sync failed - showing error toast for key=${key}`);
                            // Dismiss the loading toast for this normalized key
                            const prevId = shownToastIdRef.current[key];
                            if (prevId != null) {
                                toast.dismiss(prevId);
                            }
                            // Show error toast
                            toast.error(`${syncLabel} sync failed`, {
                                description: status.message,
                                duration: 7000,
                            });
                            shownToastIdRef.current[key] = null;
                            // Clear status immediately so UI buttons/toasts stop showing running state
                            setJobs(prev => ({ ...prev, [key]: null }));
                        }
                    });
                })
                .catch(e => console.log('SignalR Connection Error: ', e));
        }
    }, [connection]);

    const startSync = async (type: 'JIRA' | 'Incidents' | 'Escalations'): Promise<string> => {
        try {
            const syncLabel = type === 'Incidents' ? 'Freshworks' : type === 'Escalations' ? 'Escalations' : 'Jira';

            // Immediately set Running status for UI feedback
            const optimisticJob: SyncJobStatus = {
                jobId: `${type}-${Date.now()}`,
                type: type,
                status: SyncStatus.Running,
                message: 'Syncing data in background...',
                progress: 0
            };
            setJobs(prev => ({ ...prev, [type]: optimisticJob }));

            // Show loading toast immediately
            // Dismiss any existing toast for this type
            const prevId = shownToastIdRef.current[type];
            if (prevId != null) toast.dismiss(prevId);
            const toastId = toast.loading(`${syncLabel} sync ongoing`, {
                description: 'Syncing data in background...',
            });
            shownToastIdRef.current[type] = toastId;
            console.log(`Loading toast shown immediately for ${type} with ID: ${toastId}`);

            // Now make the actual API call
            let endpoint = '/governance/sync';
            if (type === 'JIRA') endpoint = '/jira/sync';
            if (type === 'Escalations') endpoint = '/escalations/sync';

            const response = await fetch(`http://localhost:5001/api${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            console.log(`Sync initiated for ${type}, jobId: ${data.jobId}`);

            // Update stored jobId with real jobId from backend
            setJobs(prev => prev[type] ? ({ ...prev, [type]: { ...prev[type]!, jobId: data.jobId } }) : prev);

            // For JIRA syncs, start a polling fallback to ensure completion is observed
            // This catches cases where SignalR updates are missed
            if (type === 'JIRA' && data.jobId) {
                const jobId = data.jobId;
                let pollCount = 0;
                const maxPolls = 300; // Poll for ~10 minutes (300 polls × 2s)

                (async () => {
                    try {
                        for (; ;) {
                            pollCount++;
                            await new Promise(r => setTimeout(r, 2000));

                            // Stop polling after timeout
                            if (pollCount > maxPolls) {
                                console.warn('JIRA polling: Timeout after 10 minutes, clearing state and assuming sync stuck');
                                const prevId = shownToastIdRef.current['JIRA'];
                                if (prevId != null) toast.dismiss(prevId);
                                toast.error('Jira sync timeout', { description: 'No status update received in 10 minutes', duration: 7000 });
                                shownToastIdRef.current['JIRA'] = null;
                                setJobs(prev => ({ ...prev, JIRA: null }));
                                break;
                            }

                            try {
                                const res = await fetch(`http://localhost:5001/api/sync/status/${jobId}`);
                                if (!res.ok) {
                                    console.log(`[Poll ${pollCount}] Status endpoint returned ${res.status}, retrying...`);
                                    continue;
                                }

                                const s = await res.json();
                                console.log(`[Poll ${pollCount}] JIRA status response:`, s, 'status value:', s.status, 'status type:', typeof s.status);

                                // Backend returns numeric enum values: Running=0, Completed=1, Failed=2, Idle=3
                                // Check both numeric and string forms for safety
                                const isCompleted = s.status === 1 || s.status === SyncStatus.Completed || s.status === 'Completed';
                                const isFailed = s.status === 2 || s.status === SyncStatus.Failed || s.status === 'Failed';

                                if (isCompleted) {
                                    console.log('✓ [Poll', pollCount, '] JIRA sync completed (status=', s.status, '), clearing loading state');
                                    const prevId = shownToastIdRef.current['JIRA'];
                                    if (prevId != null) toast.dismiss(prevId);
                                    toast.success('Jira sync complete', { description: s.message || 'Sync finished successfully', duration: 5000 });
                                    shownToastIdRef.current['JIRA'] = null;
                                    setJobs(prev => ({ ...prev, JIRA: null }));
                                    break;
                                }
                                if (isFailed) {
                                    console.log('✗ [Poll', pollCount, '] JIRA sync failed (status=', s.status, '), clearing loading state');
                                    const prevId = shownToastIdRef.current['JIRA'];
                                    if (prevId != null) toast.dismiss(prevId);
                                    toast.error('Jira sync failed', { description: s.message || 'Sync encountered an error', duration: 7000 });
                                    shownToastIdRef.current['JIRA'] = null;
                                    setJobs(prev => ({ ...prev, JIRA: null }));
                                    break;
                                }
                                // Still Running, continue polling
                                if (pollCount % 5 === 0) {
                                    console.log(`[Poll ${pollCount}] Still running, continuing to poll...`);
                                }
                            } catch (pollErr) {
                                console.error(`[Poll ${pollCount}] Error fetching status:`, pollErr);
                                // Continue polling despite fetch errors
                            }
                        }
                    } catch (e) {
                        console.error('JIRA poll error:', e);
                    }
                })();
            }

            return data.jobId;
        } catch (err) {
            console.error('Failed to start sync:', err);
            // Dismiss loading toast on error for this type
            const prevId = shownToastIdRef.current[type];
            if (prevId != null) {
                toast.dismiss(prevId);
            }
            // Show error toast
            toast.error('Failed to trigger background sync');
            setJobs(prev => ({ ...prev, [type]: null }));
            shownToastIdRef.current[type] = null;
            return '';
        }
    };

    return (
        <SyncContext.Provider value={{ jobs, startSync }}>
            {children}
        </SyncContext.Provider>
    );
};

export const useSync = () => {
    const context = useContext(SyncContext);
    if (context === undefined) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
};
