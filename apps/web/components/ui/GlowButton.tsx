"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { MixPartyAccent } from "../../lib/mixparty-theme";

type GlowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  accent?: MixPartyAccent;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
  shine?: boolean;
};

const accentClasses = {
  purple: "mp-glow-button--purple",
  pink: "mp-glow-button--pink",
  orange: "mp-glow-button--orange",
  cyan: "mp-glow-button--cyan",
  success: "mp-glow-button--success",
  danger: "mp-glow-button--danger",
};

const sizeClasses = {
  sm: "min-h-10 px-4 py-2 text-xs",
  md: "min-h-12 px-5 py-3 text-sm",
  lg: "min-h-14 px-6 py-4 text-base",
};

export function GlowButton({
  children,
  className,
  accent = "purple",
  size = "md",
  fullWidth = false,
  loading = false,
  shine = true,
  disabled,
  type = "button",
  ...props
}: GlowButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "mp-glow-button",
        accentClasses[accent],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {shine && <span className="mp-glow-button__shine" aria-hidden="true" />}
      <span className="mp-glow-button__content">
        {loading && <span className="mp-button-spinner" aria-hidden="true" />}
        {children}
      </span>
    </button>
  );
}
