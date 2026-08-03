import { cn } from "../../lib/cn";
import { GradientText } from "./GradientText";

type MixPartyLogoProps = {
  variant?: "icon" | "wordmark" | "full";
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
  priority?: boolean;
};

const iconSizes = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
};

const textSizes = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-5xl",
};

export function MixPartyLogo({
  variant = "full",
  size = "md",
  animated = true,
  className,
}: MixPartyLogoProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3",
        animated && "mp-logo-breathe",
        className,
      )}
      aria-label="MixParty"
    >
      {(variant === "icon" || variant === "full") && (
        <img
          src="/branding/icon.png"
          alt=""
          aria-hidden="true"
          className={cn("shrink-0 object-contain", iconSizes[size])}
        />
      )}

      {(variant === "wordmark" || variant === "full") && (
        <span
          className={cn(
            "-skew-x-6 font-[family:var(--font-exo-2)] font-black tracking-[0.14em]",
            textSizes[size],
          )}
        >
          <span className="text-white">MIX</span>
          <GradientText>PARTY</GradientText>
        </span>
      )}
    </div>
  );
}
