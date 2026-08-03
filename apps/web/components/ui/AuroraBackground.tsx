import type { ReactNode } from "react";
import MixPartyBackground from "../MixPartyBackground";
import { cn } from "../../lib/cn";

type AuroraBackgroundProps = {
  children?: ReactNode;
  className?: string;
  overlay?: "none" | "soft" | "strong";
};

export function AuroraBackground({
  children,
  className,
  overlay = "soft",
}: AuroraBackgroundProps) {
  return (
    <div className={cn("relative isolate min-h-screen overflow-hidden bg-[#070711]", className)}>
      <MixPartyBackground />
      {overlay !== "none" && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed inset-0 z-[1]",
            overlay === "soft" &&
              "bg-[linear-gradient(to_bottom,rgba(7,7,17,.05),rgba(7,7,17,.17)_55%,rgba(7,7,17,.28))]",
            overlay === "strong" &&
              "bg-[linear-gradient(to_bottom,rgba(7,7,17,.24),rgba(7,7,17,.58)_70%,rgba(7,7,17,.78))]",
          )}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
