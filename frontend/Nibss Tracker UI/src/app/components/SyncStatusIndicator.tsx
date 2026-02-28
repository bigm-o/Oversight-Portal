import { useSync, SyncStatus } from '@/contexts/SyncContext';
import { RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/app/components/ui/progress';
import { cn } from '@/app/components/ui/utils';

export function SyncStatusIndicator() {
    const { currentJob } = useSync();

    if (!currentJob || currentJob.status === SyncStatus.Idle) {
        return null;
    }

    const isRunning = currentJob.status === SyncStatus.Running;
    const isCompleted = currentJob.status === SyncStatus.Completed;
    const isFailed = currentJob.status === SyncStatus.Failed;

    return (
        <div className={cn(
            "fixed bottom-6 right-6 z-50 w-80 p-4 rounded-xl border shadow-2xl transition-all duration-500 animate-in slide-in-from-bottom-10",
            isRunning ? "bg-white border-blue-100" :
                isCompleted ? "bg-green-50 border-green-200" :
                    "bg-red-50 border-red-200"
        )}>
            <div className="flex items-start gap-3 mb-3">
                <div className={cn(
                    "p-2 rounded-lg",
                    isRunning ? "bg-blue-100 text-blue-600" :
                        isCompleted ? "bg-green-100 text-green-600" :
                            "bg-red-100 text-red-600"
                )}>
                    {isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> :
                        isCompleted ? <CheckCircle className="w-5 h-5" /> :
                            <AlertCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                        {currentJob.type} Sync
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                        {currentJob.message}
                    </p>
                </div>
            </div>

            {isRunning && (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                        <span>Progress</span>
                        <span>{Math.round(currentJob.progress)}%</span>
                    </div>
                    <Progress value={currentJob.progress} className="h-1.5 bg-blue-100" />
                </div>
            )}

            {(isCompleted || isFailed) && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-center mt-1">
                    {isCompleted ? "Successfully Processed" : "Sync Interrupted"}
                </p>
            )}
        </div>
    );
}
