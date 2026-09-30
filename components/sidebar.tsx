"use client";

import { cn } from "@/lib/utils";
import {
  LogOut,
  Plus,
  Settings,
  LayoutGrid,
  Layout,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/AuthContext";
import { useState } from "react";
import { useWorkspaces, type Workspace } from "@/lib/contexts/WorkspacesContext";
import { api, getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function Sidebar() {
  const { signOut } = useUser();
  const { workspaces, loading, error: loadError } = useWorkspaces();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [renameName, setRenameName] = useState("");

  const handleCreateWorkspace = async () => {
    const token = getToken();
    if (!token || !newWorkspaceName.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const ws = await api<{ id: string }>("/api/workspaces", {
        method: "POST",
        token,
        body: { name: newWorkspaceName },
      });
      setNewWorkspaceName("");
      setShowCreateDialog(false);
      window.dispatchEvent(new Event("workspace-updated"));
      router.push(`/workspaces/${ws.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace.");
    } finally { setBusy(false); }
  };

  const handleRenameWorkspace = async () => {
    const token = getToken();
    if (!token || !editingWorkspace || !renameName.trim() || busy) return;
    setBusy(true); setError("");
    try {
      await api(`/api/workspaces/${editingWorkspace.id}`, {
        method: "PUT",
        token,
        body: { name: renameName },
      });
      setEditingWorkspace(null);
      setRenameName("");
      window.dispatchEvent(new Event("workspace-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename workspace.");
    } finally { setBusy(false); }
  };

  const openRenameDialog = (e: React.MouseEvent, ws: Workspace) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingWorkspace(ws);
    setRenameName(ws.name);
  };

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-gray-100 shadow-sm">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-100 px-5">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg text-gray-900">
          <div className="h-8 w-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm">
            <Layout className="h-4.5 w-4.5" />
          </div>
          <span className="tracking-tight">TaskFlow</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-5 px-3">
        {/* Overview link */}
        <Link href="/workspaces" className="block mb-5">
          <div className={cn(
            "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
            pathname === "/workspaces"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}>
            <LayoutGrid className={cn(
              "h-4.5 w-4.5 shrink-0",
              pathname === "/workspaces" ? "text-white" : "text-gray-400"
            )} />
            Overview
          </div>
        </Link>

        {/* Workspaces section */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-3 mb-2 group">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Workspaces
            </span>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="p-1 rounded-md text-gray-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
              title="New workspace" aria-label="New workspace"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {loadError && <p role="alert" className="px-3 text-xs text-red-600">{loadError} <button className="underline" onClick={() => window.dispatchEvent(new Event("workspace-updated"))}>Retry</button></p>}
          {workspaces.map((ws) => {
            const isActive = pathname === `/workspaces/${ws.id}`;
            return (
              <div key={ws.id} className="relative group/ws">
                <Link
                  href={`/workspaces/${ws.id}`}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all pr-9",
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  {/* Active accent dot */}
                  <span className={cn(
                    "h-2 w-2 rounded-full shrink-0 transition-all",
                    isActive ? "bg-blue-500" : "bg-gray-200 group-hover/ws:bg-gray-300"
                  )} />
                  <span className="truncate">{ws.name}</span>
                </Link>
                {/* Rename button */}
                <button
                  onClick={(e) => openRenameDialog(e, ws)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover/ws:opacity-100 transition-all z-10"
                  title="Rename" aria-label={`Rename ${ws.name}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          {!loading && !loadError && workspaces.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400 italic">No workspaces yet.</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 space-y-0.5">
        <Link href="/settings" className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left",
          pathname === "/settings" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        )}>
          <Settings className={cn("h-4 w-4 shrink-0", pathname === "/settings" ? "text-blue-500" : "text-gray-400")} />
          Settings
        </Link>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors text-left"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Log out
        </button>
      </div>

      {/* Create workspace dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent aria-describedby={undefined} className="max-w-sm p-0 overflow-hidden rounded-2xl border border-gray-100 shadow-2xl">
          <div className="h-1.5 bg-blue-500 w-full" />
          <div className="px-6 py-5 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-gray-900 font-bold">New Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <label htmlFor="sidebar-new-workspace-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</label>
              <Input id="sidebar-new-workspace-name"
                value={newWorkspaceName}
                onChange={e => setNewWorkspaceName(e.target.value)}
                placeholder="e.g. Marketing, Personal, Q2 Goals"
                className="rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleCreateWorkspace()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setShowCreateDialog(false)} className="rounded-xl text-gray-500">Cancel</Button>
              <Button
                onClick={handleCreateWorkspace}
                disabled={busy || !newWorkspaceName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5"
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename workspace dialog */}
      <Dialog open={!!editingWorkspace} onOpenChange={(o) => !o && setEditingWorkspace(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-sm p-0 overflow-hidden rounded-2xl border border-gray-100 shadow-2xl">
          <div className="h-1.5 bg-violet-500 w-full" />
          <div className="px-6 py-5 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-gray-900 font-bold">Rename Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <label htmlFor="sidebar-rename-workspace-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</label>
              <Input id="sidebar-rename-workspace-name"
                value={renameName}
                onChange={e => setRenameName(e.target.value)}
                placeholder="Workspace name"
                className="rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleRenameWorkspace()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setEditingWorkspace(null)} className="rounded-xl text-gray-500">Cancel</Button>
              <Button
                onClick={handleRenameWorkspace}
                disabled={busy || !renameName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
