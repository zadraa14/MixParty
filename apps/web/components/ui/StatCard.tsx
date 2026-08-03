import type { ReactNode } from "react";
import { GlassCard } from "./GlassCard";
import type { MixPartyAccent } from "../../lib/mixparty-theme";

type StatCardProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  accent?: MixPartyAccent;
  animated?: boolean;
};

export function StatCard({
  label,
  value,
  description,
  icon,
  accent = "purple",
  animated = true,
}: StatCardProps) {
  return (
    <GlassCard accent={accent} padding="sm" hoverable>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`mp-stat-label mp-stat-label--${accent}`}>{label}</p>
          <div className={animated ? "mp-number-pop mt-2" : "mt-2"}>
            <span className="font-[family:var(--font-exo-2)] text-2xl font-black text-white">
              {value}
            </span>
          </div>
          {description && <div className="mt-1 text-xs text-white/35">{description}</div>}
        </div>
        {icon && <div className={`mp-stat-icon mp-stat-icon--${accent}`}>{icon}</div>}
      </div>
    </GlassCard>
  );
}
