import { Radio } from "lucide-react";
import { MixPartyLogo, NeonBadge } from "./ui";

export default function MixPartyHeader() {
  return (
    <header className="flex items-center justify-between gap-4 py-2 sm:py-4">
      <MixPartyLogo variant="full" size="md" />
      <NeonBadge accent="success" pulse className="hidden sm:inline-flex">
        <Radio className="h-3.5 w-3.5" />
        Soirées en direct
      </NeonBadge>
    </header>
  );
}
