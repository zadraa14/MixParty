import { useId } from "react";

type MixPartyLogoProps = {
  className?: string;
  animated?: boolean;
  showText?: boolean;
  iconClassName?: string;
};

export default function MixPartyLogo({
  className = "",
  animated = false,
  showText = true,
  iconClassName = "h-12 w-12"
}: MixPartyLogoProps) {
  const gradientId = useId();
  const glowId = useId();

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>

      <svg
        viewBox="0 0 140 100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Logo MixParty"
        className={`block shrink-0 overflow-visible ${iconClassName} ${
          animated ? "mixparty-logo-live" : ""
        }`}
      >

        <defs>

          <linearGradient
            id={gradientId}
            x1="20"
            y1="15"
            x2="120"
            y2="85"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="48%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>

          <filter
            id={glowId}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              stdDeviation="2.2"
              result="blur"
            />

            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

        </defs>

        <g
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          filter={`url(#${glowId})`}
        >

          <circle
            cx="70"
            cy="50"
            r="35"
            strokeWidth="4.5"
          />

          <g
            className="mixparty-wave-left"
            strokeWidth="4"
          >
            <path d="M14 44V56" />
            <path d="M22 37V63" />
            <path d="M30 41V59" />
          </g>

          <g
            className="mixparty-wave-right"
            strokeWidth="4"
          >
            <path d="M110 41V59" />
            <path d="M118 37V63" />
            <path d="M126 44V56" />
          </g>

        </g>

        <g
          fill={`url(#${gradientId})`}
          filter={`url(#${glowId})`}
        >

          <path d="M76 29C76 27.4 77 26 78.5 25.4L94 19.5C96.6 18.5 99.5 20.4 99.5 23.2V30.5L82 37.2V65.5C82 72.1 76.4 77.5 69.5 77.5C62.8 77.5 57.5 73.2 57.5 67.4C57.5 61.5 62.9 56.8 69.7 56.8C72.1 56.8 74.2 57.3 76 58.2V29Z" />

          <path d="M82 32.1L99.5 25.5V32.4L82 39Z" />

        </g>

      </svg>

      {showText && (
        <div className="min-w-0">

          <p className="mixparty-wordmark whitespace-nowrap text-xl font-black tracking-[0.08em]">
            <span className="text-white">
              MIX
            </span>

            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-300 bg-clip-text text-transparent">
              PARTY
            </span>
          </p>

          <p className="whitespace-nowrap text-xs text-white/45">
            La musique appartient à tout le monde.
          </p>

        </div>
      )}

    </div>
  );
}