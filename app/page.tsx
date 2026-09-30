"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, FileText, Layers2, CircleCheck } from "lucide-react";
import { useUser } from "@/lib/contexts/AuthContext";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { WorkspacePreview } from "@/components/workspace-preview";
import { easeOut } from "@/lib/motion";

const steps = [
  { title: "Capture", icon: FileText, color: "text-[#4f79c7]" },
  { title: "Organize", icon: Layers2, color: "text-[#b88931]" },
  { title: "Complete", icon: CircleCheck, color: "text-primary" },
];

export default function HomePage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  useEffect(() => { if (isSignedIn) router.replace("/workspaces"); }, [isSignedIn, router]);

  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="border-b border-border/70 bg-white">
        <nav aria-label="Main navigation" className="mx-auto flex h-18 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8 lg:px-12">
          <Brand />
          <div className="flex items-center gap-1 sm:gap-3">
            <Button asChild variant="ghost" className="px-2 sm:px-3"><Link href="/login">Sign in</Link></Button>
            <Button asChild className="hidden sm:inline-flex"><Link href="/signup">Get started <ArrowRight /></Link></Button>
          </div>
        </nav>
      </header>
      <main>
        <section aria-labelledby="hero-title" className="landing-hero">
          <motion.div initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }} className="landing-intro mx-auto max-w-4xl px-4 text-center">
            <h1 id="hero-title" className="text-[40px] font-semibold leading-[1.08] sm:text-[64px] lg:text-[76px]">ProductSpace</h1>
            <p className="mt-3 text-base text-muted-foreground sm:mt-4 sm:text-xl">Your tasks. A little more in flow.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 sm:mt-7 sm:gap-3">
              <Button asChild className="h-10 px-3 sm:h-11 sm:px-5"><Link href="/signup">Get started <ArrowRight className="hidden sm:block" /></Link></Button>
              <Button asChild variant="outline" className="h-10 px-3 sm:h-11 sm:px-5"><a href="#preview"><span className="sm:hidden">Explore workspace</span><span className="hidden sm:inline">Explore the workspace</span></a></Button>
            </div>
          </motion.div>
          <WorkspacePreview />
        </section>
        <section aria-labelledby="workflow-title" className="border-t border-border px-4 py-8 sm:px-8 md:py-16">
          <div className="mx-auto max-w-6xl">
            <motion.h2 initial={reducedMotion ? false : { opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.7 }} id="workflow-title" className="text-center text-[26px] font-semibold leading-tight sm:text-4xl">A place for every next step.</motion.h2>
            <div className="mx-auto mt-8 grid max-w-4xl grid-cols-3 gap-3 sm:mt-12 sm:gap-10">
              {steps.map(({ title, icon: Icon, color }, index) => (
                <motion.div key={title} initial={reducedMotion ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: reducedMotion ? 0 : index * 0.08 }} className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Icon strokeWidth={1.5} className={`size-7 sm:size-9 ${color}`} /><h3 className="text-sm font-semibold sm:text-lg">{title}</h3>
                </motion.div>
              ))}
            </div>
            <motion.figure initial={reducedMotion ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} className="mt-12 overflow-hidden border-y border-border bg-[#f5f6f8]">
              <Image src="/workspace-preview.jpg" alt="ProductSpace workspace with a task board, priorities, and due dates" width={1440} height={900} sizes="(max-width: 1200px) 100vw, 1152px" className="h-auto w-full" />
            </motion.figure>
          </div>
        </section>
        <section className="border-y border-border bg-[#edf6f2] px-4 py-12 text-center sm:py-16">
          <h2 className="text-2xl font-semibold sm:text-3xl">Make room for your best work.</h2>
          <Button asChild className="mt-6 h-11 px-6"><Link href="/signup">Create your workspace <ArrowRight /></Link></Button>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-6 px-5 py-8 text-sm sm:px-12">
        <Brand className="text-base" />
        <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
          <a href="https://github.com/GODOSTROYER/task-tracker" className="rounded-sm transition-colors hover:text-foreground">Source code</a>
          <a href="https://www.arnavbule.in" className="rounded-sm transition-colors hover:text-foreground">Arnav Bule</a>
        </div>
      </footer>
    </div>
  );
}
