import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Button } from '@/app/components/ui/button';
import { Calendar } from '@/app/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { CalendarIcon, Filter, X, Users, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/app/components/ui/utils';
import { apiService } from '@/services/apiService';

export interface FilterValues {
    startDate?: Date;
    endDate?: Date;
    fromLevel: string;
    toLevel: string;
    teamId?: string;
}

interface FilterBarProps {
    onFilterChange: (filters: FilterValues) => void;
    hideLevels?: boolean;
    showTeams?: boolean;
    singleLevel?: boolean;
}

const LEVELS = ['All Levels', 'L1', 'L2', 'L3', 'L4'];

export function FilterBar({ onFilterChange, hideLevels = false, showTeams = false, singleLevel = false }: FilterBarProps) {
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [fromLevel, setFromLevel] = useState('All Levels');
    const [toLevel, setToLevel] = useState('All Levels');
    const [teamId, setTeamId] = useState('All Teams');
    const [teams, setTeams] = useState<any[]>([]);

    useEffect(() => {
        if (showTeams) {
            apiService.getTeams().then(data => {
                setTeams(data);
            }).catch(err => console.error('Failed to load teams in FilterBar', err));
        }
    }, [showTeams]);


    useEffect(() => {
        const handler = setTimeout(() => {
            onFilterChange({
                startDate,
                endDate,
                fromLevel,
                toLevel,
                teamId: teamId === 'All Teams' ? undefined : teamId
            });
        }, 300);

        return () => clearTimeout(handler);
    }, [startDate, endDate, fromLevel, toLevel, teamId, onFilterChange]);

    const handleReset = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setFromLevel('All Levels');
        setToLevel('All Levels');
        setTeamId('All Teams');
    };

    return (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-800 mb-6 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mr-2">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filters</span>
            </div>

            {/* Date Range */}
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Date Range</span>
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "justify-start text-left font-normal bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-9",
                                    !startDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP") : <span>Start date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={startDate}
                                onSelect={setStartDate}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>

                    <span className="text-slate-400">-</span>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "justify-start text-left font-normal bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-9",
                                    !endDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP") : <span>End date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={endDate}
                                onSelect={setEndDate}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Team Filter */}
            {showTeams && (
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Agile Team</span>
                    <div className="w-48">
                        <Select value={teamId} onValueChange={setTeamId}>
                            <SelectTrigger className="h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-blue-500" />
                                    <SelectValue placeholder="Select Team" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All Teams">All Teams</SelectItem>
                                {teams.map(t => (
                                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* Level Filter(s) */}
            {!hideLevels && (
                <>
                    {singleLevel ? (
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Level</span>
                            <div className="w-36">
                                <Select value={fromLevel} onValueChange={(val) => {
                                    setFromLevel(val);
                                    setToLevel(val);
                                }}>
                                    <SelectTrigger className="h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-3.5 h-3.5 text-rose-500" />
                                            <SelectValue placeholder="Level" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LEVELS.map(l => (
                                            <SelectItem key={l} value={l}>{l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">From</span>
                                <div className="w-36">
                                    <Select value={fromLevel} onValueChange={setFromLevel}>
                                        <SelectTrigger className="h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-3.5 h-3.5 text-rose-500" />
                                                <SelectValue placeholder="From Level" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LEVELS.map(l => (
                                                <SelectItem key={l} value={l}>{l}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">To</span>
                                <div className="w-36">
                                    <Select value={toLevel} onValueChange={setToLevel}>
                                        <SelectTrigger className="h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-3.5 h-3.5 text-rose-500" />
                                                <SelectValue placeholder="To Level" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LEVELS.map(l => (
                                                <SelectItem key={l} value={l}>{l}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            <div className="flex items-center gap-2 ml-auto">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-slate-500 hover:text-slate-700 h-9"
                >
                    <X className="w-4 h-4 mr-1" />
                    Reset
                </Button>
            </div>
        </div>
    );
}
