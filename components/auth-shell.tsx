'use client';

import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Loader2, type LucideIcon } from 'lucide-react';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';

export const authFieldClassName = 'h-11 w-full min-w-0 rounded-[6px] border border-[#e4e7eb] bg-white px-3 text-sm text-[#171b22] shadow-none placeholder:text-[#68717f] focus-visible:border-[#087f70] focus-visible:ring-[#087f70]/20 dark:bg-white dark:text-[#171b22]';
export const authSurfaceClassName = 'text-[#171b22] tracking-normal [&_label]:text-[13px] [&_label]:font-medium [&_label]:tracking-normal [&_label]:text-[#171b22]';
export const authLinkClassName = 'font-medium text-[#087f70] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087f70]';

export function AuthShell({ title, description, children, footer }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <main className={`flex min-h-dvh flex-col bg-[#f5f6f8] ${authSurfaceClassName}`}>
      <header
        className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-[#e4e7eb] bg-white px-5 sm:px-8"
      >
        <Brand href="/" className="text-xl" />
        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-[13px] text-[#68717f] hover:text-[#171b22]">
          <ArrowLeft className="size-3.5" aria-hidden="true" /> Home
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:py-12">
        <motion.section
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="w-full max-w-[400px]"
          aria-labelledby="auth-heading"
        >
          <div className="mb-7">
            <h1 id="auth-heading" className="text-[28px] font-semibold leading-tight tracking-normal">{title}</h1>
            {description && <p className="mt-2 break-words text-sm leading-6 text-[#68717f]">{description}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 border-t border-[#e4e7eb] pt-5 text-center text-sm text-[#68717f]">{footer}</div>}
        </motion.section>
      </div>
    </main>
  );
}

export function AuthFeedback({ message, kind = 'error', id }: { message: string; kind?: 'error' | 'success'; id?: string }) {
  const reducedMotion = useReducedMotion();
  const Icon = kind === 'error' ? CircleAlert : CheckCircle2;
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      id={id}
      className="empty:hidden"
    >
      <AnimatePresence initial={false}>
        {message && <motion.div
          key={kind}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
          className="overflow-hidden"
        >
          <div
            className={`flex items-start gap-2 rounded-[6px] border px-3 py-2.5 text-[13px] leading-5 ${kind === 'error' ? 'border-[#f3d1cb] bg-[#fff4f1] text-[#ac4032]' : 'border-[#c9e4de] bg-[#edf7f4] text-[#087f70]'}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{message}</span>
          </div>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}

export function SubmitButton({ pending, pendingLabel, children, icon: Icon = ArrowRight, className = '', ...props }: ComponentProps<typeof Button> & { pending: boolean; pendingLabel: string; icon?: LucideIcon }) {
  const reducedMotion = useReducedMotion();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={`h-11 rounded-[6px] bg-primary text-primary-foreground shadow-none ${className}`}
    >
      {pending ? <motion.span
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="inline-flex"
      ><Loader2 className="size-4" aria-hidden="true" /></motion.span> : <Icon className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{pending ? pendingLabel : children}</span>
    </Button>
  );
}
