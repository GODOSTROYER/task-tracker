"use client";

import { Sidebar } from "@/components/sidebar";
import { usePathname } from "next/navigation";

const AUTH_PATHS = ["/login", "/register", "/signup", "/", "/forgot-password", "/reset-password", "/verify-email"];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentPath = pathname ?? "";

  if (AUTH_PATHS.includes(currentPath)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-[#F8F9FD] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
