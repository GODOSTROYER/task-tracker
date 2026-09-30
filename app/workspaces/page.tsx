"use client";

import { useState } from "react";
import { useWorkspaces, type Workspace } from "@/lib/contexts/WorkspacesContext";
import { api, getToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Loader2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Palette of accent colours cycled per workspace card
const CARD_ACCENTS = [
  { bar: "bg-blue-500",   icon: "bg-blue-50 text-blue-500",   hover: "hover:border-blue-200 hover:ring-blue-100" },
  { bar: "bg-violet-500", icon: "bg-violet-50 text-violet-500", hover: "hover:border-violet-200 hover:ring-violet-100" },
  { bar: "bg-amber-400",  icon: "bg-amber-50 text-amber-500",  hover: "hover:border-amber-200 hover:ring-amber-100" },
  { bar: "bg-emerald-500",icon: "bg-emerald-50 text-emerald-600", hover: "hover:border-emerald-200 hover:ring-emerald-100" },
  { bar: "bg-rose-500",   icon: "bg-rose-50 text-rose-500",    hover: "hover:border-rose-200 hover:ring-rose-100" },
];

export default function WorkspacesPage() {
  const router = useRouter();
  const token = getToken();
  const { workspaces, loading, error: loadError } = useWorkspaces();
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
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
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">My Workspaces</h1>
          <p className="text-gray-400 text-sm">Select a workspace to view and manage its tasks.</p>
        </div>

        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 shadow-sm shadow-blue-200"
        >
          <Plus className="h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {loadError && <p role="alert" className="mb-4 text-sm text-red-600">{loadError} <button className="underline" onClick={() => window.dispatchEvent(new Event("workspace-updated"))}>Retry</button></p>}
      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {workspaces.map((ws, i) => {
          const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
          return (
            <button
              key={ws.id}
              onClick={() => router.push(`/workspaces/${ws.id}`)}
              className={cn(
                "group text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden",
                "hover:shadow-lg hover:ring-1 transition-all duration-150",
                accent.hover
              )}
            >
              {/* Coloured top bar */}
              <div className={cn("h-1.5 w-full", accent.bar)} />

              <div className="p-5">
                {/* Icon + name */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", accent.icon)}>
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                </div>

                <h2 className="font-bold text-gray-900 text-base leading-tight mb-1 group-hover:text-inherit transition-colors line-clamp-1">
                  {ws.name}
                </h2>
                <p className="text-xs text-gray-400">
                  Created {new Date(ws.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </button>
          );
        })}

        {/* Add new card shortcut */}
        <button
          onClick={() => setIsDialogOpen(true)}
          className="group text-left bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all duration-150 p-5 flex flex-col items-center justify-center gap-2 min-h-[130px]"
        >
          <div className="h-10 w-10 rounded-xl border-2 border-dashed border-gray-300 group-hover:border-blue-400 flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-all">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-gray-400 group-hover:text-blue-500 transition-colors">New workspace</span>
        </button>
      </div>

      {/* Create dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm p-0 overflow-hidden rounded-2xl border border-gray-100 shadow-2xl">
          <div className="h-1.5 bg-blue-500 w-full" />
          <div className="px-6 py-5 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-gray-900 font-bold">New Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <Label htmlFor="new-workspace-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</Label>
              <Input id="new-workspace-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Marketing Campaign, Q3 Goals…"
                className="rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl text-gray-500">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
