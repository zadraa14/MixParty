"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { MixPartyAccent } from "../../lib/mixparty-theme";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  accent?: MixPartyAccent | "none";
  hoverable?: boolean;
  animatedBorder?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
};

const accentClasses = {
  none: "",
  purple: "mp-glass-card--purple",
  pink: "mp-glass-card--pink",
  orange: "mp-glass-card--orange",
  cyan: "mp-glass-card--cyan",
  success: "mp-glass-card--success",
  danger: "mp-glass-card--danger",
};

const paddingClasses = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function GlassCard({
  children,
  className,
  accent = "none",
  hoverable = false,
  animatedBorder = false,
  padding = "md",
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "mp-glass-card",
        accentClasses[accent],
        paddingClasses[padding],
        hoverable && "mp-glass-card--hoverable",
        animatedBorder && "mp-glass-card--animated",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
