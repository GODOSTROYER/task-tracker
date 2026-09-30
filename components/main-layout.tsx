"use client";

import { WorkspacesProvider } from "@/lib/contexts/WorkspacesContext";
import { Sidebar } from "@/components/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Loader2, RefreshCw } from "lucide-react";
import { Brand } from "@/components/brand";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SESSION_CHANGED } from "@/lib/api";
import { useUser } from "@/lib/contexts/AuthContext";
const AUTH_PATHS = ["/login", "/register", "/signup", "/", "/forgot-password", "/reset-password", "/verify-email"];

function MobileNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#e4e7eb] bg-white px-4 text-[#171b22] md:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><button aria-label="Open navigation menu" className="rounded-md p-2 text-[#68717f] transition-colors hover:bg-[#f5f6f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f70]"><Menu className="h-5 w-5" /></button></DialogTrigger>
        <DialogContent aria-describedby={undefined} className="left-0 top-0 h-dvh max-h-none w-[240px] max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 motion-reduce:animate-none sm:max-w-[240px]">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="min-h-0" onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}><Sidebar /></div>
        </DialogContent>
      </Dialog>
      <Brand href="/workspaces" className="text-lg font-semibold tracking-normal focus-visible:outline-2 focus-visible:outline-[#087f70]" />
    </header>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, sessionError } = useUser();
  const isPublic = AUTH_PATHS.includes(pathname);
  useEffect(() => {
    if (!isPublic && isLoaded && !isSignedIn && !sessionError) router.replace('/login');
  }, [isPublic, isLoaded, isSignedIn, sessionError, router]);
  if (isPublic) return <>{children}</>;
  if (sessionError) return <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f5f6f8] p-6 text-center text-sm text-[#171b22]"><p className="max-w-md">{sessionError}</p><button className="inline-flex items-center gap-2 rounded-md border border-[#e4e7eb] bg-white px-4 py-2 text-[#087f70] focus-visible:outline-2 focus-visible:outline-[#087f70]" onClick={() => window.dispatchEvent(new Event(SESSION_CHANGED))}><RefreshCw className="size-4" />Retry</button></div>;
  if (!isLoaded || !isSignedIn) return <div role="status" className="flex min-h-dvh items-center justify-center gap-3 bg-[#f5f6f8] p-8 text-sm text-[#68717f]"><Loader2 aria-hidden="true" className="size-4 animate-spin text-[#087f70] motion-reduce:animate-none" />Loading your workspace...</div>;
  return (
    <WorkspacesProvider>
      <div className="flex h-dvh overflow-hidden bg-[#f5f6f8] text-[#171b22] tracking-normal">
        <a href="#main-content" className="sr-only z-[60] rounded-md bg-white text-sm text-[#087f70] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:px-4 focus:py-2 focus:outline-2 focus:outline-[#087f70]">Skip to main content</a>
        <div className="hidden shrink-0 md:block"><Sidebar /></div>
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNavigation key={pathname} />
          <main id="main-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden outline-none">{children}</main>
        </div>
      </div>
    </WorkspacesProvider>
  );
}
