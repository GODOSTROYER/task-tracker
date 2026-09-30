"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function WorkspaceNameDialog({ open, onOpenChange, title, inputId, name, onNameChange, error, busy, onSubmit, submitLabel }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  inputId: string;
  name: string;
  onNameChange: (name: string) => void;
  error: string;
  busy: boolean;
  onSubmit: () => Promise<void>;
  submitLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="rounded-lg border-[#e4e7eb] bg-white p-6 text-[#171b22] tracking-normal motion-reduce:animate-none sm:max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle className="pr-6 text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <form className="space-y-5" onSubmit={event => { event.preventDefault(); void onSubmit(); }}>
          <div className="space-y-2">
            <label htmlFor={inputId} className="text-[13px] font-medium text-[#68717f]">Name</label>
            <Input id={inputId} value={name} onChange={event => onNameChange(event.target.value)} placeholder="Workspace name" autoFocus disabled={busy} aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} className="h-10 rounded-md border-[#e4e7eb] text-sm focus-visible:border-[#087f70] focus-visible:ring-[#087f70]/20" />
            {error && <p id={`${inputId}-error`} role="alert" className="break-words text-sm text-red-700">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#e4e7eb] pt-4">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)} className="rounded-md text-[13px] text-[#68717f] hover:bg-[#f5f6f8]">Cancel</Button>
            <Button type="submit" disabled={busy || !name.trim()} className="rounded-md bg-[#087f70] text-[13px] text-white hover:bg-[#066b5e] focus-visible:ring-[#087f70]/30">
              {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
              {busy ? "Saving..." : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
