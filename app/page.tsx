"use client";

import { useUser } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Layout, Server, Database, Shield, Layers, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const CORE_FEATURES = [
  "Signup/Login with secure password hashing (bcrypt)",
  "JWT-based auth with protected task/workspace routes",
  "Multi-user task isolation (users see only their own tasks)",
  "Create, update, complete, and delete tasks",
  "PostgreSQL + Sequelize schema for users, workspaces, and tasks",
  "Express layered architecture (controllers/routes/models)",
  "Zod request validation and centralized error middleware",
];

const TECH_STACK = [
  { icon: Server, label: "Node.js + Express + TypeScript", color: "text-green-500" },
  { icon: Database, label: "Neon PostgreSQL + Sequelize", color: "text-blue-500" },
  { icon: Layers, label: "Next.js + React + Tailwind", color: "text-purple-500" },
  { icon: Shield, label: "JWT + bcrypt + Zod", color: "text-amber-500" },
];

export default function HomePage() {
  const { isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.push("/workspaces");
  }, [isSignedIn, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 text-white">
      <nav className="container mx-auto px-4 py-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Layout className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-normal">ProductSpace Task Tracker</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/login"><Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">Sign in</Button></Link>
          <Link href="/signup"><Button className="bg-blue-500 hover:bg-blue-600 text-white">Get started</Button></Link>
        </div>
      </nav>

      <section className="container mx-auto px-4 pt-16 pb-8 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" /> ProductSpace Full Stack Screening Build
          </div>
          <h1 className="break-words text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] mb-6 tracking-normal">
            Production-ready mini SaaS
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">Task Management App</span>
          </h1>
          <p className="text-lg text-white/60 mb-10 max-w-2xl mx-auto">
            Built to match ProductSpace screening requirements with secure authentication, multi-user task ownership,
            and a clean full-stack architecture.
          </p>
          {!isSignedIn && <Link href="/signup"><Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white">Create your account <ArrowRight className="ml-2 h-5 w-5" /></Button></Link>}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-green-400 mb-4">Core Requirement Coverage</h3>
            <ul className="space-y-3">{CORE_FEATURES.map((item) => <li key={item} className="flex gap-2.5 text-sm"><CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" /><span className="text-white/70">{item}</span></li>)}</ul>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-blue-300 mb-4">Tech Stack</h3>
            <div className="grid grid-cols-1 gap-4">{TECH_STACK.map((tech) => <div key={tech.label} className="flex items-center gap-3"><tech.icon className={`h-5 w-5 ${tech.color}`} /><span className="text-white/75">{tech.label}</span></div>)}</div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-8 mt-8">
        <div className="container mx-auto px-4 text-sm text-white/40 flex justify-center">Built for ProductSpace screening · 2026</div>
      </footer>
    </div>
  );
}
