"use client";

import { WorkspacesProvider } from "@/lib/contexts/WorkspacesContext";
import { Sidebar } from "@/components/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SESSION_CHANGED } from "@/lib/api";
import { useUser } from "@/lib/contexts/AuthContext";
const AUTH_PATHS = ["/login", "/register", "/signup", "/", "/forgot-password", "/reset-password", "/verify-email"];

function MobileNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 md:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><button aria-label="Open navigation menu" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><Menu className="h-5 w-5" /></button></DialogTrigger>
        <DialogContent aria-describedby={undefined} className="left-0 top-0 h-dvh w-64 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 sm:max-w-64">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="min-h-0" onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}><Sidebar /></div>
        </DialogContent>
      </Dialog>
      <span className="text-lg font-bold text-gray-900">TaskFlow</span>
    </div>
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
  if (sessionError) return <div role="alert" className="p-8 text-red-600">{sessionError} <button className="underline" onClick={() => window.dispatchEvent(new Event(SESSION_CHANGED))}>Retry</button></div>;
  if (!isLoaded || !isSignedIn) return <div role="status" className="p-8 text-gray-500">Loading…</div>;
  return (
    <WorkspacesProvider>
      <div className="flex h-dvh overflow-hidden bg-[#F8F9FD]">
        <div className="hidden shrink-0 md:block"><Sidebar /></div>
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNavigation key={pathname} />
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
        </div>
      </div>
    </WorkspacesProvider>
  );
}
