import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, href = "/", className }: { compact?: boolean; href?: string; className?: string }) {
  return <Link href={href} aria-label="ProductSpace home" className={cn("brand-wordmark inline-flex shrink-0 items-center rounded-sm text-foreground", className)}>{compact ? "PS" : "ProductSpace"}</Link>;
}
