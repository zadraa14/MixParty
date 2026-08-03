import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type GradientTextProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  animated?: boolean;
};

export function GradientText({
  children,
  className,
  animated = false,
  ...props
}: GradientTextProps) {
  return (
    <span
      className={cn(
        "mp-gradient-text",
        animated && "mp-gradient-text--animated",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
