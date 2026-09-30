"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { easeOut } from "@/lib/motion";

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: easeOut }}>{children}</MotionConfig>;
}
