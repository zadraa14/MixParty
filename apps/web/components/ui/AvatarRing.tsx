import { cn } from "../../lib/cn";

type AvatarRingProps = {
  src?: string;
  alt: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  dj?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

export function AvatarRing({
  src,
  alt,
  fallback = "?",
  size = "md",
  online = false,
  dj = false,
  className,
}: AvatarRingProps) {
  return (
    <span className={cn("mp-avatar-ring", sizeClasses[size], className)}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full rounded-[inherit] object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-[inherit] bg-[#171126] font-black uppercase">
          {fallback.slice(0, 1)}
        </span>
      )}
      {dj && <span className="mp-avatar-ring__dj" aria-label="DJ">DJ</span>}
      {online && <span className="mp-avatar-ring__online" aria-label="En ligne" />}
    </span>
  );
}
