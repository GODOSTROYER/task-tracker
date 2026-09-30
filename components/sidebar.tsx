"use client";

import { cn } from "@/lib/utils";
import { LogOut, Plus, Settings, House, File, Pencil, Loader2, RefreshCw } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/AuthContext";
import { useState } from "react";
import { useWorkspaces, type Workspace } from "@/lib/contexts/WorkspacesContext";
import { api, getToken } from "@/lib/api";
import { WorkspaceNameDialog } from "@/components/workspace-name-dialog";
import { Brand } from "@/components/brand";

const NAVIGATION = [
  { href: "/workspaces", label: "Workspaces", icon: House },
  { href: "/settings", label: "Settings", icon: Settings },
];
const focusStyle = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f70]";

export function Sidebar() {
  const { signOut, user } = useUser();
  const { workspaces, loading, error: loadError } = useWorkspaces();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [renameName, setRenameName] = useState("");
  const accountName = user?.name?.trim() || user?.email || "My account";

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

  return (
    <aside aria-label="Main navigation" className="flex h-full w-[240px] max-w-full flex-col border-r border-[#e4e7eb] bg-white text-[#171b22] tracking-normal">
      <div className="flex h-20 shrink-0 items-center px-6">
        <Brand href="/workspaces" className={cn("text-[22px] font-semibold tracking-normal", focusStyle)} />
      </div>
      <nav aria-label="Primary" className="space-y-1 px-3 pb-5">
        {NAVIGATION.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors hover:bg-[#f5f6f8]", focusStyle, pathname === href ? "bg-[#f5f6f8] font-medium text-[#171b22]" : "text-[#68717f]")}>
            <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.7} />{label}
          </Link>
        ))}
      </nav>
      <div className="mx-5 border-t border-[#e4e7eb]" />
      <nav aria-label="Workspaces" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-2 flex items-center justify-between pl-3 pr-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-normal text-[#68717f]">Workspaces</h2>
          <button onClick={() => { setError(""); setShowCreateDialog(true); }} className={cn("flex size-8 items-center justify-center rounded-md text-[#68717f] transition-colors hover:bg-[#e8f5f1] hover:text-[#087f70]", focusStyle)} title="New workspace" aria-label="New workspace"><Plus className="size-4" /></button>
        </div>
        {loading && <p role="status" className="flex items-center gap-2 px-3 py-2 text-xs text-[#68717f]"><Loader2 aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />Loading workspaces...</p>}
        {loadError && <div role="alert" className="space-y-2 px-3 py-2 text-xs text-red-700"><p className="break-words">{loadError}</p><button className={cn("flex items-center gap-1.5 rounded-sm text-[#087f70] underline underline-offset-2", focusStyle)} onClick={() => window.dispatchEvent(new Event("workspace-updated"))}><RefreshCw className="size-3" />Retry</button></div>}
        <div className="space-y-1">
          {workspaces.map(ws => {
            const isActive = pathname === `/workspaces/${ws.id}` || pathname.startsWith(`/workspaces/${ws.id}/`);
            return (
              <div key={ws.id} className="group/ws relative">
                <Link href={`/workspaces/${ws.id}`} aria-current={isActive ? "page" : undefined} title={ws.name} className={cn("relative flex min-h-10 items-center gap-3 overflow-hidden rounded-md py-2 pl-3 pr-10 text-[13px] transition-colors", focusStyle, isActive ? "bg-[#e8f5f1] font-medium text-[#087f70]" : "text-[#68717f] hover:bg-[#f5f6f8] hover:text-[#171b22]")}>
                  <AnimatePresence initial={false}>
                    {isActive && <motion.span aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} className="absolute inset-y-0 left-0 w-[3px] bg-[#087f70]" />}
                  </AnimatePresence>
                  <File aria-hidden="true" className="size-[17px] shrink-0" strokeWidth={1.7} />
                  <span className="truncate">{ws.name}</span>
                </Link>
                <button onClick={() => { setError(""); setEditingWorkspace(ws); setRenameName(ws.name); }} className={cn("absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[#68717f] transition-[color,background-color,opacity] hover:bg-[#d7eee6] hover:text-[#087f70] md:opacity-0 md:group-hover/ws:opacity-100 md:group-focus-within/ws:opacity-100 [@media(hover:none)]:opacity-100", focusStyle)} title={`Rename ${ws.name}`} aria-label={`Rename ${ws.name}`}><Pencil className="size-3.5" /></button>
              </div>
            );
          })}
        </div>
        {!loading && !loadError && workspaces.length === 0 && <p className="px-3 py-2 text-xs text-[#68717f]">No workspaces yet.</p>}
      </nav>
      <footer className="mx-4 flex shrink-0 items-center gap-2 border-t border-[#e4e7eb] py-5">
        <Link href="/settings" aria-label={`Account settings for ${accountName}`} className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-md", focusStyle)}>
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#d7eee6] text-sm font-semibold text-[#087f70]">{Array.from(accountName)[0]?.toUpperCase()}</span>
          <span className="min-w-0"><span className="block truncate text-[13px] font-medium" title={accountName}>{accountName}</span><span className="block text-xs text-[#68717f]">My account</span></span>
        </Link>
        <button onClick={signOut} aria-label="Sign out" title="Sign out" className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-[#68717f] transition-colors hover:bg-red-50 hover:text-red-700", focusStyle)}><LogOut className="size-4" /></button>
      </footer>
      <WorkspaceNameDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} title="New workspace" inputId="sidebar-new-workspace-name" name={newWorkspaceName} onNameChange={setNewWorkspaceName} error={error} busy={busy} onSubmit={handleCreateWorkspace} submitLabel="Create" />
      <WorkspaceNameDialog open={!!editingWorkspace} onOpenChange={open => { if (!open) setEditingWorkspace(null); }} title="Rename workspace" inputId="sidebar-rename-workspace-name" name={renameName} onNameChange={setRenameName} error={error} busy={busy} onSubmit={handleRenameWorkspace} submitLabel="Save" />
    </aside>
  );
}
