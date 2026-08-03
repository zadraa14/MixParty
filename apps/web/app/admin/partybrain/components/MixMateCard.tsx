"use client";

import {
  Check,
  Headphones,
  Music2,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

export type MixMate = {
  id: string;
  name: string;
  avatar?: string | null;
  compatibility: number;
  commonArtists?: string[];
  commonSongs?: number;
  isConnected?: boolean;
};

type MixMateCardProps = {
  mixMate: MixMate;
  onInvite?: (mixMate: MixMate) => void;
  invited?: boolean;
  loading?: boolean;
  className?: string;
};

function clampCompatibility(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function MixMateCard({
  mixMate,
  onInvite,
  invited = false,
  loading = false,
  className = "",
}: MixMateCardProps) {
  const compatibility = clampCompatibility(mixMate.compatibility);
  const artists = mixMate.commonArtists?.filter(Boolean).slice(0, 3) ?? [];
  const disabled = invited || loading || !onInvite;

  return (
    <article
      className={`group relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-fuchsia-400/25 hover:bg-white/[0.075] hover:shadow-[0_24px_70px_rgba(124,58,237,.18)] sm:p-5 ${className}`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-fuchsia-500/20 blur-3xl transition duration-500 group-hover:bg-fuchsia-500/30" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500 via-violet-600 to-cyan-500 p-[2px] shadow-[0_0_28px_rgba(168,85,247,.28)]">
              <div className="grid h-full w-full place-items-center overflow-hidden rounded-[14px] bg-[#10091d] text-sm font-black text-white">
                {mixMate.avatar ? (
                  <img
                    src={mixMate.avatar}
                    alt={`Avatar de ${mixMate.name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(mixMate.name) || <Users className="h-5 w-5" />
                )}
              </div>
            </div>

            {mixMate.isConnected ? (
              <span
                className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-[#0d0717] bg-emerald-400"
                title="En ligne"
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-black text-white">
                  {mixMate.name}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white/45">
                  <Headphones className="h-3.5 w-3.5 text-fuchsia-300" />
                  MixMate recommandé
                </div>
              </div>

              <div className="shrink-0 rounded-xl border border-fuchsia-400/15 bg-fuchsia-500/10 px-2.5 py-1.5 text-right">
                <p className="text-sm font-black text-fuchsia-200">
                  {compatibility}%
                </p>
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">
                  Match
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 transition-all duration-700"
            style={{ width: `${compatibility}%` }}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.16em] text-white/35">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            Vos goûts en commun
          </div>

          {artists.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {artists.map((artist) => (
                <span
                  key={artist}
                  className="max-w-full truncate rounded-full border border-violet-400/15 bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold text-violet-100"
                >
                  {artist}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-white/40">
              Compatibilité calculée à partir de vos écoutes MixParty.
            </p>
          )}

          {typeof mixMate.commonSongs === "number" ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
              <Music2 className="h-3.5 w-3.5 text-fuchsia-300" />
              <span>
                <strong className="text-white/80">{mixMate.commonSongs}</strong>{" "}
                morceau{mixMate.commonSongs > 1 ? "x" : ""} en commun
              </span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onInvite?.(mixMate)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-400/20 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 px-4 py-3 text-sm font-black text-white shadow-[0_12px_35px_rgba(124,58,237,.25)] transition hover:brightness-110 disabled:cursor-default disabled:opacity-60"
        >
          {invited ? (
            <>
              <Check className="h-4 w-4" />
              Invitation envoyée
            </>
          ) : loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Envoi…
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Inviter ce MixMate
            </>
          )}
        </button>
      </div>
    </article>
  );
}
