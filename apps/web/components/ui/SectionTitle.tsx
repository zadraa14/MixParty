import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { MixPartyAccent } from "../../lib/mixparty-theme";

type SectionTitleProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  accent?: MixPartyAccent;
  className?: string;
};

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
  accent = "purple",
  className,
}: SectionTitleProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <p className={cn("mp-section-eyebrow", `mp-section-eyebrow--${accent}`)}>
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 font-[family:var(--font-exo-2)] text-xl font-black text-white sm:text-2xl">
          {title}
        </h2>
        {description && (
          <div className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            {description}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
