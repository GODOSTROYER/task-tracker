"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken } from '@/lib/api';
export interface Workspace { id: string; name: string; ownerId: string; createdAt: string; }
const WorkspaceContext = createContext({ workspaces: [] as Workspace[], loading: true, error: '' });
export function WorkspacesProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const token = getToken();
      if (!token) { setLoading(false); return; }
      setError('');
      try {
        const data = await api<Workspace[]>('/api/workspaces', { token, signal: request.signal });
        if (!request.signal.aborted) setWorkspaces(data);
      } catch (error) {
        if (!request.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to load workspaces.');
      } finally { if (!request.signal.aborted) setLoading(false); }
    };
    void refresh();
    window.addEventListener('workspace-updated', refresh);
    return () => { controller?.abort(); window.removeEventListener('workspace-updated', refresh); };
  }, []);
  return <WorkspaceContext.Provider value={{ workspaces, loading, error }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspaces() { return useContext(WorkspaceContext); }
