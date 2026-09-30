'use client';

import { Check, Circle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface Props {
  password: string;
  id?: string;
}

const rules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One special character (!@#$%...)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(p) },
];

export function PasswordRequirements({ password, id }: Props) {
  const reducedMotion = useReducedMotion();
  return (
    <div id={id} className="empty:hidden">
      <AnimatePresence initial={false}>
        {password && <motion.ul
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
          className="space-y-1.5 overflow-hidden"
          aria-label="Password requirements"
        >
          {rules.map((rule) => {
            const passed = rule.test(password);
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-2 text-xs transition-colors ${passed ? 'text-[#087f70]' : 'text-[#68717f]'}`}
              >
                <span className="inline-flex size-4 shrink-0 items-center justify-center">
                  <AnimatePresence initial={false} mode="wait">
                    <motion.span
                      key={passed ? 'passed' : 'pending'}
                      initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.12 }}
                      className="inline-flex"
                    >
                      {passed ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-2" aria-hidden="true" />}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="sr-only">{passed ? 'Met: ' : 'Required: '}</span>
                {rule.label}
              </li>
            );
          })}
        </motion.ul>}
      </AnimatePresence>
    </div>
  );
}

/** Returns true when all rules pass */
export function isPasswordValid(password: string): boolean {
  return rules.every((r) => r.test(password));
}
