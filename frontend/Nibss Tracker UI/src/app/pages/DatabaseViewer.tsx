import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Database, RefreshCw, Table as TableIcon, Terminal, Play, Download, Search, ChevronRight, Layers } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/ui/loading';
import { ErrorDisplay } from '@/app/components/ui/error';
import { apiService } from '@/services/apiService';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

export function DatabaseViewer() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);
  const [tableColumns, setTableColumns] = useState<string[]>([]);

  // Pagination - Updated to 10 records per user request
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tablesData = await apiService.getDatabaseTables();
      setTables(tablesData);
      if (tablesData.length > 0 && !selectedTable) {
        // Just set the first table, the useEffect for selectedTable will trigger the load
        handleTableSelect(tablesData[0]);
      }
    } catch (err) {
      setError('Failed to load database schema. Ensure the backend is running and you are logged in.');
      console.error('Database viewer error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTable]);

  const runQuery = async (queryToRun: string = sqlQuery) => {
    let finalQuery = queryToRun.trim();
    if (!finalQuery) {
      toast.error('SQL query cannot be empty');
      return;
    }

    const isSelect = /^\s*SELECT/i.test(finalQuery);
    const hasLimit = /\bLIMIT\s+\d+/i.test(finalQuery);

    if (isSelect && !hasLimit) {
      finalQuery = finalQuery.replace(/;\s*$/, '');
      finalQuery = `${finalQuery} LIMIT ${pageSize}`;
      setSqlQuery(finalQuery);
    }

    // To accurately check if there's MORE, we fetch actualLimit + 1 internally
    let executableQuery = finalQuery;
    let actualLimit = pageSize;

    if (isSelect) {
      const limitMatch = finalQuery.match(/\bLIMIT\s+(\d+)/i);
      if (limitMatch) {
        actualLimit = parseInt(limitMatch[1]);
        executableQuery = finalQuery.replace(/\bLIMIT\s+(\d+)/i, `LIMIT ${actualLimit + 1}`);
      }
    }

    setQueryLoading(true);
    try {
      console.log('Executing SQL (Internal +1 check):', executableQuery);
      const results = await apiService.executeDatabaseQuery(executableQuery);

      if (Array.isArray(results)) {
        if (results.length > actualLimit) {
          setQueryResults(results.slice(0, actualLimit));
          setHasMore(true);
        } else {
          setQueryResults(results);
          setHasMore(false);
        }

        if (results.length > 0) {
          setColumns(Object.keys(results[0]));
          toast.success(`Query returned ${Math.min(results.length, actualLimit)} rows`);
        } else {
          toast.info('Query executed successfully but returned 0 rows');
          if (selectedTable) {
            const tableCols = await apiService.getTableColumns(selectedTable);
            setColumns(tableCols);
          }
        }
      } else if (results && results.affectedRows !== undefined) {
        toast.success(`Execution successful. ${results.affectedRows} rows affected.`);
        setQueryResults([]);
        setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (err: any) {
      console.error('SQL Execution Error:', err);
      toast.error(err.message || 'Error executing query.');
    } finally {
      setQueryLoading(false);
    }
  };

  const handleTableSelect = async (tableName: string) => {
    setSelectedTable(tableName);
    setPage(0);
    const initialQuery = `SELECT * FROM ${tableName} LIMIT ${pageSize}`;
    setSqlQuery(initialQuery);
    runQuery(initialQuery);

    // Fetch columns for the sidebar schema helper
    try {
      const cols = await apiService.getTableColumns(tableName);
      setTableColumns(cols);
    } catch (e) {
      console.error('Error fetching table columns:', e);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handlePageChange = async (direction: 'next' | 'prev') => {
    const nextPageIndex = direction === 'next' ? page + 1 : Math.max(0, page - 1);
    const offset = nextPageIndex * pageSize;

    let query = sqlQuery.trim();
    const baseQuery = query.replace(/\s+LIMIT\s+\d+/i, '').replace(/\s+OFFSET\s+\d+/i, '').replace(/;\s*$/, '');

    // Fetch pageSize + 1 to check for next page
    const executableQuery = `${baseQuery} LIMIT ${pageSize + 1} OFFSET ${offset}`;

    setQueryLoading(true);
    try {
      const results = await apiService.executeDatabaseQuery(executableQuery);
      if (Array.isArray(results)) {
        if (results.length > pageSize) {
          setQueryResults(results.slice(0, pageSize));
          setHasMore(true);
        } else {
          setQueryResults(results);
          setHasMore(false);
        }
        setPage(nextPageIndex);
      } else {
        setHasMore(false);
        toast.info('No more records found');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error navigating pages');
    } finally {
      setQueryLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (queryResults.length === 0) {
      toast.error('No data available to export');
      return;
    }

    try {
      const headers = columns.join(',');
      const rows = queryResults.map(row =>
        columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',')
      );

      const csvContent = [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${selectedTable || 'query_results'}_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Excel-compatible CSV exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export data');
    }
  };

  const handleRefresh = async () => {
    setQueryLoading(true);
    try {
      await fetchTables();
      if (sqlQuery) {
        await runQuery(sqlQuery);
      }
      toast.success('Data refreshed');
    } catch (err) {
      toast.error('Refresh failed');
    } finally {
      setQueryLoading(false);
    }
  };

  if (loading && tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <LoadingSpinner />
        <p className="text-muted-foreground animate-pulse font-medium">Connecting to Oversight Engine...</p>
      </div>
    );
  }

  if (error && tables.length === 0) {
    return <ErrorDisplay message={error} onRetry={fetchTables} />;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
            <Database className="w-9 h-9 text-green-600" />
            Database Explorer
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Connected to <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider">nibss_oversight</code>
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          Internal Oversight Tool • Confidential
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table Selector Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/60 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Layers className="w-4 h-4 text-green-600" />
                System Tables
              </CardTitle>
            </CardHeader>
            <div className="p-2 overflow-y-auto">
              <div className="space-y-1">
                {tables.map(table => (
                  <button
                    key={table}
                    onClick={() => handleTableSelect(table)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group",
                      selectedTable === table
                        ? "bg-green-600 text-white shadow-md shadow-green-600/20 font-bold"
                        : "hover:bg-muted text-foreground/80 hover:text-foreground font-medium"
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <TableIcon className={cn("w-4 h-4", selectedTable === table ? "text-white" : "text-muted-foreground group-hover:text-green-600")} />
                      <span className="truncate">{table}</span>
                    </div>
                    {selectedTable === table ? <ChevronRight className="w-4 h-4" /> : null}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {selectedTable && tableColumns.length > 0 && (
            <Card className="border-border/60 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
              <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b py-3">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                  <Terminal className="w-3.5 h-3.5 text-blue-500" />
                  {selectedTable} Columns
                </CardTitle>
              </CardHeader>
              <div className="p-4 bg-muted/5">
                <div className="flex flex-wrap gap-1.5">
                  {tableColumns.map(col => (
                    <Badge key={col} variant="outline" className="bg-white dark:bg-slate-950 text-[10px] font-mono py-0.5 px-2 border-slate-200 dark:border-slate-800">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Query & Results Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* SQL Editor */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-900 border-b flex flex-row items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-green-500" />
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-100">SQL Interpreter</CardTitle>
              </div>
              <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400 font-bold tracking-widest uppercase">
                PostgreSQL Mode
              </Badge>
            </CardHeader>
            <CardContent className="p-0 bg-slate-950">
              <Textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    runQuery();
                  }
                }}
                placeholder="Enter SQL SELECT or UPDATE query..."
                className="min-h-[150px] font-mono text-sm bg-transparent border-0 text-green-400 p-6 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-800"
              />
              <div className="p-4 border-t border-slate-900 bg-slate-900/50 flex items-center justify-between">
                <p className="text-[10px] text-slate-500 font-medium italic">Pro-tip: Press <kbd className="bg-slate-800 px-1 rounded text-slate-300">Ctrl/Cmd + Enter</kbd> to run. Rule: {pageSize} records per page.</p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setSqlQuery('')}
                    className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest h-10"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={() => runQuery()}
                    disabled={queryLoading || !sqlQuery.trim()}
                    className="bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-xs px-6 gap-2 h-10 shadow-lg shadow-green-600/20"
                  >
                    {queryLoading ? <LoadingSpinner /> : <Play className="w-4 h-4 fill-current" />}
                    Run Query
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card className="border-border/60 shadow-md overflow-hidden min-h-[400px]">
            <CardHeader className="bg-muted/20 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-base font-black flex items-center gap-2 uppercase tracking-tight">
                  <Search className="w-5 h-5 text-green-600" />
                  Query Results
                </CardTitle>
                {queryResults.length > 0 && (
                  <p className="text-[11px] text-muted-foreground font-medium mt-1 uppercase tracking-wider">
                    Displaying {queryResults.length} records {selectedTable && `from ${selectedTable}`}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={queryResults.length === 0}
                  className="h-9 px-4 text-xs font-bold gap-2 hover:bg-green-600 hover:text-white transition-all"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={queryLoading}
                  className="h-9 w-9 p-0 hover:border-green-600 hover:text-green-600 transition-all"
                >
                  <RefreshCw className={cn("w-4 h-4", queryLoading && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {queryResults.length > 0 ? (
                <div className="flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border/60">
                          {columns.map(col => (
                            <th key={col} className="text-left px-4 py-3 font-black text-muted-foreground uppercase tracking-widest border-r border-border/30 last:border-r-0 whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {queryResults.map((row, idx) => (
                          <tr key={idx} className="hover:bg-green-50/30 dark:hover:bg-green-950/10 transition-colors">
                            {columns.map(col => (
                              <td key={col} className="px-4 py-2.5 font-medium text-foreground/80 border-r border-border/20 last:border-r-0 max-w-[300px] truncate">
                                {row[col] !== null && row[col] !== undefined ? row[col].toString() : <span className="text-muted-foreground/40 italic">null</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer / Pagination */}
                  <div className="p-6 bg-muted/10 border-t flex flex-col items-center gap-4">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        onClick={() => handlePageChange('prev')}
                        disabled={queryLoading || page === 0}
                        className="font-black uppercase tracking-widest text-[10px] h-10 px-6 border-2"
                      >
                        Previous
                      </Button>
                      <div className="bg-card px-4 py-2 rounded-lg border-2 border-border font-black text-xs min-w-[100px] text-center">
                        PAGE {page + 1}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handlePageChange('next')}
                        disabled={queryLoading || !hasMore}
                        className="font-black uppercase tracking-widest text-[10px] h-10 px-6 border-2"
                      >
                        Next
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">
                      Showing items {page * pageSize + 1} - {page * pageSize + queryResults.length}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <Database className="w-8 h-8 text-muted-foreground opacity-30" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">No data returned</h3>
                    <p className="text-sm text-muted-foreground max-w-[300px] mx-auto">Selected table or query has no records or failed to execute.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}