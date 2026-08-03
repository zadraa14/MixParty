import type { ReactNode } from "react";
import { GlassCard } from "./GlassCard";
import { SectionTitle } from "./SectionTitle";
import type { MixPartyAccent } from "../../lib/mixparty-theme";

type MixPanelProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  accent?: MixPartyAccent;
  className?: string;
};

export function MixPanel({
  eyebrow,
  title,
  description,
  action,
  children,
  accent = "purple",
  className,
}: MixPanelProps) {
  return (
    <GlassCard accent={accent} animatedBorder className={className}>
      <SectionTitle
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={action}
        accent={accent}
      />
      <div className="mt-5">{children}</div>
    </GlassCard>
  );
}
