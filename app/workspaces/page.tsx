"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useWorkspaces, type Workspace } from "@/lib/contexts/WorkspacesContext";
import { api, getToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Folder, Loader2, ArrowUpRight, RefreshCw } from "lucide-react";
import { WorkspaceNameDialog } from "@/components/workspace-name-dialog";
import { cn } from "@/lib/utils";

const CARD_ACCENTS = [
  "bg-[#e8f5f1] text-[#087f70]",
  "bg-[#fff0ec] text-[#ba4b35]",
  "bg-[#fff6dc] text-[#946900]",
  "bg-[#edf3ff] text-[#3d67b1]",
];

export default function WorkspacesPage() {
  const router = useRouter();
  const { workspaces, loading, error: loadError } = useWorkspaces();
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const reducedMotion = useReducedMotion();

  const handleCreate = async () => {
    const token = getToken();
    if (!token || !newName.trim() || creating) return;
    setError("");
    try {
      setCreating(true);
      const created = await api<Workspace>("/api/workspaces", {
        method: "POST",
        token,
        body: { name: newName },
      });
      window.dispatchEvent(new Event("workspace-updated"));
      setIsDialogOpen(false);
      setNewName("");
      router.push(`/workspaces/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace.");
    } finally { setCreating(false); }
  };
  const openCreate = () => { setError(""); setIsDialogOpen(true); };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-8 text-[#171b22] tracking-normal md:px-8 md:py-10 lg:px-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5 border-b border-[#e4e7eb] pb-6">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-9 tracking-normal">Workspaces</h1>
          <p className="mt-2 text-sm leading-6 text-[#68717f]">Your projects and tasks.</p>
        </div>
        <Button onClick={openCreate} className="h-10 gap-2 rounded-md bg-[#087f70] px-4 text-[13px] text-white shadow-none transition-colors hover:bg-[#066b5e] focus-visible:ring-[#087f70]/30"><Plus className="size-4" />New workspace</Button>
      </header>

      {loadError && <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[#ba4b35] pl-4 text-sm"><p className="min-w-0 break-words text-red-700">{loadError}</p><Button variant="ghost" onClick={() => window.dispatchEvent(new Event("workspace-updated"))} className="rounded-md text-[13px] text-[#087f70] hover:bg-[#e8f5f1]"><RefreshCw className="size-4" />Retry</Button></div>}

      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.div key="loading" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.12 }} className="flex min-h-48 items-center justify-center gap-3 text-sm text-[#68717f]">
            <Loader2 aria-hidden="true" className="size-4 animate-spin text-[#087f70] motion-reduce:animate-none" />Loading workspaces...
          </motion.div>
        ) : workspaces.length > 0 ? (
          <motion.div key="workspaces" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((ws, i) => (
              <motion.div key={ws.id} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18, delay: reducedMotion ? 0 : Math.min(i * 0.025, 0.12) }}>
                <Link href={`/workspaces/${ws.id}`} className="group flex h-full min-h-[172px] flex-col rounded-lg border border-[#e4e7eb] bg-white p-5 transition-[border-color,box-shadow] duration-150 hover:border-[#a8cfc6] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f70]">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", CARD_ACCENTS[i % CARD_ACCENTS.length])}><Folder aria-hidden="true" className="size-[18px]" strokeWidth={1.7} /></span>
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-[#68717f] transition-colors group-hover:text-[#087f70] group-focus-visible:text-[#087f70]" />
                  </div>
                  <h2 className="break-words text-base font-semibold leading-6 [overflow-wrap:anywhere]">{ws.name}</h2>
                  <p className="mt-2 text-xs leading-5 text-[#68717f]">Created {new Date(ws.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ) : !loadError ? (
          <motion.section key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} className="flex min-h-64 flex-col items-center justify-center text-center">
            <Folder aria-hidden="true" className="mb-4 size-7 text-[#087f70]" strokeWidth={1.5} />
            <h2 className="text-base font-semibold">No workspaces yet</h2>
            <p className="mt-2 max-w-xs text-sm leading-6 text-[#68717f]">Create a workspace to start organizing your tasks.</p>
            <Button onClick={openCreate} variant="ghost" className="mt-4 rounded-md text-[13px] text-[#087f70] hover:bg-[#e8f5f1]"><Plus className="size-4" />New workspace</Button>
          </motion.section>
        ) : null}
      </AnimatePresence>
      <WorkspaceNameDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} title="New workspace" inputId="new-workspace-name" name={newName} onNameChange={setNewName} error={error} busy={creating} onSubmit={handleCreate} submitLabel="Create" />
    </div>
  );
}
