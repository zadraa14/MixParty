import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { MixPartyAccent } from "../../lib/mixparty-theme";

type NeonBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  accent?: MixPartyAccent;
  pulse?: boolean;
};

export function NeonBadge({
  children,
  accent = "purple",
  pulse = false,
  className,
  ...props
}: NeonBadgeProps) {
  return (
    <span
      className={cn(
        "mp-neon-badge",
        `mp-neon-badge--${accent}`,
        pulse && "mp-neon-badge--pulse",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
