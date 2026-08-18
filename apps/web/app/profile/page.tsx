"use client";

import Link from "next/link";
import { getApiBaseUrl } from "../../lib/config";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Crown,
  Gem,
  History,
  Images,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  KeyRound,
  Medal,
  Music2,
  Pencil,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  X,
  Vote,
  Zap,
  Clock3,
  Heart,
  Play,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import MixPartyBackground from "../../components/MixPartyBackground";

const NAME_KEY = "playerName";
const PHOTO_KEY = "mixparty.profile.photo.v1";
const PARTICIPANT_ID_KEY = "mixparty.participant.id";

const ACCOUNT_TOKEN_KEY = "mixparty.account.token.v1";

type MixPartyAccount = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: number;
  updatedAt: number;
  plan: "free" | "premium";
  premiumTrialStartedAt?: number;
  premiumTrialEndsAt?: number;
  stats: {
    partiesJoined: number;
    partiesHosted: number;
    wins: number;
    podiums: number;
    votesGiven: number;
    votesReceived: number;
    songsAdded: number;
    songsPlayed: number;
    songsWith5Votes: number;
    activeMinutes: number;
  };
  badges: string[];
  badgeUnlocks?: Array<{
    badgeId: string;
    unlockedAt: number;
    partyCode?: string;
  }>;
  history?: Array<{ partyCode: string; joinedAt: number; lastSeenAt: number; role: "participant" | "host" }>;
  customization: {
    avatarFrame?: string;
    profileTheme?: string;
    joinEffect?: string;
  };
};


const PROFILE_STAT_CARDS = [
  { key: "partiesJoined", label: "Soirées", icon: History, accent: "text-violet-300", live: true },
  { key: "wins", label: "Victoires", icon: Crown, accent: "text-amber-300", live: false },
  { key: "podiums", label: "Podiums", icon: Trophy, accent: "text-cyan-300", live: false },
  { key: "votesGiven", label: "Votes", icon: Vote, accent: "text-pink-300", live: true },
  { key: "songsAdded", label: "Morceaux", icon: Music2, accent: "text-orange-300", live: true },
] as const;


const PROFILE_BADGES = [
  {
    id: "premiere-soiree",
    name: "Première Soirée",
    condition: "Participer à sa première soirée",
    image: "/badges/premiere-soiree.png",
  },
  {
    id: "premier-son",
    name: "Premier Son",
    condition: "Ajouter son premier morceau",
    image: "/badges/premier-son.png",
  },
  {
    id: "premier-vote",
    name: "Premier Vote",
    condition: "Voter pour la première fois",
    image: "/badges/premier-vote.png",
  },
  {
    id: "premier-host",
    name: "Premier Host",
    condition: "Organiser sa première soirée",
    image: "/badges/premier-host.png",
  },
  {
    id: "habitue",
    name: "Habitué",
    condition: "Participer à 5 soirées",
    image: "/badges/habitue.png",
  },
  {
    id: "fetard",
    name: "Fêtard",
    condition: "Participer à 10 soirées",
    image: "/badges/fetard.png",
  },
  {
    id: "pilier-de-soiree",
    name: "Pilier de soirée",
    condition: "Participer à 25 soirées",
    image: "/badges/pilier-de-soiree.png",
  },
  {
    id: "veteran-mixparty",
    name: "Vétéran MixParty",
    condition: "Participer à 50 soirées",
    image: "/badges/veteran-mixparty.png",
  },
  {
    id: "centurion",
    name: "Centurion",
    condition: "Participer à 100 soirées",
    image: "/badges/centurion.png",
  },
  {
    id: "supporter",
    name: "Supporter",
    condition: "Effectuer 50 votes",
    image: "/badges/supporter.png",
  },
  {
    id: "super-votant",
    name: "Super Votant",
    condition: "Effectuer 250 votes",
    image: "/badges/super-votant.png",
  },
] as const;

type ProfileBadge = (typeof PROFILE_BADGES)[number];

function formatActiveTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.floor(Number(minutes || 0)));
  if (safeMinutes < 60) return `${safeMinutes} min`;
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes}` : `${hours} h`;
}


const BADGE_PREVIEWS = [
  { title: "Premier Son", tone: "from-violet-500/40 via-fuchsia-500/15 to-transparent", icon: Music2, ring: "border-violet-300/20" },
  { title: "Champion", tone: "from-amber-400/35 via-orange-500/12 to-transparent", icon: Trophy, ring: "border-amber-300/20" },
  { title: "Hitmaker", tone: "from-fuchsia-500/35 via-violet-500/12 to-transparent", icon: Zap, ring: "border-fuchsia-300/20" },
  { title: "Badge secret", tone: "from-cyan-500/25 via-violet-500/10 to-transparent", icon: LockKeyhole, ring: "border-cyan-300/20" },
] as const;

async function compressProfilePhoto(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture de l’image impossible."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error("Image invalide."));
    next.src = source;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Compression de l’image impossible.");

  const side = Math.min(image.width, image.height);
  const sourceX = (image.width - side) / 2;
  const sourceY = (image.height - side) / 2;

  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 256, 256);
  return canvas.toDataURL("image/webp", 0.78);
}

export default function ProfilePage() {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [photo, setPhoto] = useState("");
  const [draftPhoto, setDraftPhoto] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [account, setAccount] = useState<MixPartyAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [selectedBadge, setSelectedBadge] = useState<ProfileBadge | null>(null);


  useEffect(() => {
    const savedName = localStorage.getItem(NAME_KEY)?.trim() || "";
    const savedPhoto = localStorage.getItem(PHOTO_KEY) || "";
    let savedParticipantId = localStorage.getItem(PARTICIPANT_ID_KEY) || "";

    if (!savedParticipantId) {
      savedParticipantId =
        globalThis.crypto?.randomUUID?.() ||
        `participant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(PARTICIPANT_ID_KEY, savedParticipantId);
    }

    setName(savedName);
    setDraftName(savedName);
    setAuthName(savedName);
    setPhoto(savedPhoto);
    setDraftPhoto(savedPhoto);
    setParticipantId(savedParticipantId);
    setReady(true);

    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";
    if (!token) {
      setAccountLoading(false);
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/account/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (!response.ok) {
          localStorage.removeItem(ACCOUNT_TOKEN_KEY);
          return;
        }

        const data = await response.json();
        const nextAccount = data?.account as MixPartyAccount | undefined;
        if (!nextAccount?.id) return;

        setAccount(nextAccount);
        setName(nextAccount.name);
        setDraftName(nextAccount.name);
        setAuthName(nextAccount.name);

        if (nextAccount.avatar) {
          setPhoto(nextAccount.avatar);
          setDraftPhoto(nextAccount.avatar);
          localStorage.setItem(PHOTO_KEY, nextAccount.avatar);
        }

        localStorage.setItem(NAME_KEY, nextAccount.name);
      } catch (loadAccountError) {
        console.error("Impossible de charger le compte MixParty", loadAccountError);
      } finally {
        setAccountLoading(false);
      }
    })();
  }, []);

  async function choosePhoto(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choisis une image valide.");
      return;
    }

    setError("");
    setProcessingPhoto(true);

    try {
      setDraftPhoto(await compressProfilePhoto(file));
    } catch (photoError) {
      console.error(photoError);
      setError("Impossible d’utiliser cette photo. Essaie avec une autre image.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  function startEditing() {
    setDraftName(name);
    setDraftPhoto(photo);
    setError("");
    setEditing(true);
  }

  function cancelEditing() {
    setDraftName(name);
    setDraftPhoto(photo);
    setError("");
    setEditing(false);
  }

  async function saveProfile() {
    const normalizedName = draftName.trim();

    if (!normalizedName) {
      setError("Entre ton prénom ou ton pseudo.");
      return;
    }

    if (!draftPhoto) {
      setError("Ajoute une photo de profil.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const token = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";

      if (account && token) {
        const response = await fetch(`${getApiBaseUrl()}/account/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: normalizedName,
            avatar: draftPhoto,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Impossible de modifier ton compte.");
        }

        if (data?.account) setAccount(data.account as MixPartyAccount);
      }

      localStorage.setItem(NAME_KEY, normalizedName);
      localStorage.setItem(PHOTO_KEY, draftPhoto);

      setName(normalizedName);
      setPhoto(draftPhoto);

      window.dispatchEvent(
        new CustomEvent("mixparty-profile-updated", {
          detail: {
            name: normalizedName,
            photo: draftPhoto,
            participantId,
          },
        }),
      );

      setEditing(false);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer ton profil.");
    } finally {
      setSaving(false);
    }
  }

  function openAuth(mode: "register" | "login") {
    setAuthMode(mode);
    setAuthName(name);
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthOpen(true);
  }

  async function submitAuth() {
    setAuthError("");
    const email = authEmail.trim().toLowerCase();
    const password = authPassword;
    const nextName = (authMode === "register" ? authName : name).trim();

    if (!email) {
      setAuthError("Entre ton adresse e-mail.");
      return;
    }
    if (password.length < 8) {
      setAuthError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (authMode === "register" && nextName.length < 2) {
      setAuthError("Choisis un pseudo d’au moins 2 caractères.");
      return;
    }

    setAuthBusy(true);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/account/${authMode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            authMode === "register"
              ? { email, password, name: nextName, avatar: photo || undefined }
              : { email, password },
          ),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Connexion MixParty impossible.");
      }

      const nextAccount = data?.account as MixPartyAccount | undefined;
      const token = String(data?.token || "");
      if (!nextAccount?.id || !token) {
        throw new Error("Réponse du compte MixParty incomplète.");
      }

      localStorage.setItem(ACCOUNT_TOKEN_KEY, token);
      localStorage.setItem(NAME_KEY, nextAccount.name);
      if (nextAccount.avatar) localStorage.setItem(PHOTO_KEY, nextAccount.avatar);

      setAccount(nextAccount);
      setName(nextAccount.name);
      setDraftName(nextAccount.name);
      setAuthName(nextAccount.name);

      if (nextAccount.avatar) {
        setPhoto(nextAccount.avatar);
        setDraftPhoto(nextAccount.avatar);
      }

      setAuthOpen(false);
      setAuthPassword("");
    } catch (submitError) {
      console.error(submitError);
      setAuthError(
        submitError instanceof Error
          ? submitError.message
          : "Connexion MixParty impossible.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function logoutAccount() {
    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";

    try {
      if (token) {
        await fetch(`${getApiBaseUrl()}/account/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}

    localStorage.removeItem(ACCOUNT_TOKEN_KEY);
    setAccount(null);
  }

  const displayName = name || "Ton profil";
  const displayInitial = (name || "M").charAt(0).toUpperCase();
  const profileStats = PROFILE_STAT_CARDS.map((item) => ({
    ...item,
    value: account ? String(account.stats[item.key] ?? 0) : "—",
  }));

  const detailedStats = [
    { label: "Soirées organisées", value: account ? String(account.stats.partiesHosted ?? 0) : "—", icon: Crown },
    { label: "Votes reçus", value: account ? String(account.stats.votesReceived ?? 0) : "—", icon: Heart },
    { label: "Morceaux joués", value: account ? String(account.stats.songsPlayed ?? 0) : "—", icon: Play },
    { label: "Morceaux ≥ 5 votes", value: account ? String(account.stats.songsWith5Votes ?? 0) : "—", icon: TrendingUp },
    { label: "Temps en soirée", value: account ? formatActiveTime(account.stats.activeMinutes ?? 0) : "—", icon: Clock3 },
  ];

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#070711] font-[family:var(--font-geist-sans)] text-white">
      <MixPartyBackground />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.035),transparent_36%),linear-gradient(to_bottom,rgba(7,7,17,.02),rgba(7,7,17,.28))]" />

      <div className="relative z-10 mx-auto w-full max-w-[1480px] px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 py-2 sm:py-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-3.5 text-sm font-black text-white/75 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <img src="/branding/icon.png" alt="MixParty" className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
            <div className="hidden sm:block">
              <p className="-skew-x-6 font-[family:var(--font-exo-2)] text-lg font-black tracking-[.14em]">
                <span className="text-white">MIX</span>
                <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">PARTY</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/30">Mon espace</p>
            </div>
          </div>
        </header>

        <section className="mt-5 overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055] shadow-[0_30px_100px_rgba(0,0,0,.42)] backdrop-blur-2xl sm:mt-8 sm:rounded-[36px]">
          <div className="relative overflow-hidden px-5 pb-6 pt-7 sm:px-10 sm:pb-10 sm:pt-10 lg:px-12">
            <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-violet-600/20 blur-[90px]" />
            <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-fuchsia-600/15 blur-[100px]" />
            <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                <div className="relative shrink-0">
                  <div className="absolute -inset-4 rounded-[42px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 opacity-35 blur-xl" />
                  <div className="absolute -inset-2 rounded-[38px] border border-white/10 bg-gradient-to-br from-white/10 via-transparent to-white/[0.02] shadow-[0_0_45px_rgba(168,85,247,.24)]" />
                  <div className="relative h-36 w-36 overflow-hidden rounded-[36px] border border-white/20 bg-[#0d0817] p-1.5 shadow-[0_22px_55px_rgba(0,0,0,.5)] sm:h-44 sm:w-44 lg:h-48 lg:w-48">
                    <div className="absolute inset-0 rounded-[36px] bg-[conic-gradient(from_210deg,rgba(139,92,246,.55),rgba(236,72,153,.55),rgba(251,146,60,.48),rgba(34,211,238,.45),rgba(139,92,246,.55))] opacity-60" />
                    <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-[30px] border border-black/30 bg-gradient-to-br from-[#171024] to-[#090610]">
                      {ready && photo ? (
                        <img src={photo} alt={`Photo de ${displayName}`} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-[family:var(--font-exo-2)] text-4xl font-black text-white/70">{displayInitial}</span>
                      )}
                    </div>
                  </div>
                  <span className="absolute -left-3 top-5 grid h-9 w-9 place-items-center rounded-2xl border border-white/15 bg-black/55 text-fuchsia-200 shadow-xl backdrop-blur-xl">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span className="absolute -bottom-2 -right-2 grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-xl">
                    <BadgeCheck className="h-5 w-5" />
                  </span>
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[9px] font-black uppercase tracking-[.16em] text-white/45 backdrop-blur-xl">
                    Cadre profil
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <span className="rounded-full border border-violet-300/15 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-violet-200">Profil MixParty</span>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] ${
                      account
                        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                        : "border-white/10 bg-white/[0.05] text-white/40"
                    }`}>
                      {account ? `Compte ${account.plan === "premium" ? "Premium" : "Free"}` : "Profil local"}
                    </span>
                  </div>

                  <h1 className="mt-3 truncate font-[family:var(--font-exo-2)] text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                    {ready ? displayName : "Chargement…"}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45 sm:text-base lg:text-lg">
                    Ta progression, tes badges et l’histoire de tes soirées MixParty.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={startEditing}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-5 text-sm font-black text-white transition hover:border-fuchsia-300/30 hover:bg-fuchsia-500/10"
              >
                <Pencil className="h-4 w-4" />
                Modifier le profil
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
          {profileStats.map(({ label, value, icon: Icon, accent, live }) => (
            <article key={label} className="rounded-[26px] border border-white/10 bg-white/[0.055] p-4 shadow-[0_18px_45px_rgba(0,0,0,.18)] backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <Icon className={`h-5 w-5 ${accent}`} />
                <span className={`text-[9px] font-black uppercase tracking-[.15em] ${account && live ? "text-emerald-300/70" : "text-white/25"}`}>
                  {account ? (live ? "À jour" : "Phase 2") : "Compte requis"}
                </span>
              </div>
              <p className="mt-4 font-[family:var(--font-exo-2)] text-2xl font-black sm:text-3xl">{value}</p>
              <p className="mt-1 text-xs font-bold text-white/40">{label}</p>
            </article>
          ))}
        </section>

        <section className="mt-4 rounded-[26px] border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-300">Stats V2</p>
              <h2 className="mt-1 font-[family:var(--font-exo-2)] text-lg font-black">Progression détaillée</h2>
            </div>
            <span className="rounded-full border border-emerald-300/15 bg-emerald-500/[0.07] px-3 py-1 text-[9px] font-black uppercase tracking-[.14em] text-emerald-200/80">
              En direct
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {detailedStats.map(({ label, value, icon: Icon }) => (
              <article key={label} className="rounded-[20px] border border-white/[0.07] bg-black/15 p-3.5">
                <Icon className="h-4 w-4 text-white/40" />
                <p className="mt-3 font-[family:var(--font-exo-2)] text-xl font-black">{value}</p>
                <p className="mt-1 text-[10px] font-bold leading-4 text-white/35">{label}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_.8fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_70px_rgba(0,0,0,.26)] backdrop-blur-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-300">Collection</p>
                <h2 className="mt-1 font-[family:var(--font-exo-2)] text-2xl font-black">Mes badges</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/40">Tes premiers badges MixParty se débloquent maintenant automatiquement avec tes actions en soirée.</p>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/10 text-fuchsia-200">
                <Medal className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PROFILE_BADGES.map((badge) => {
                const unlocked = Boolean(account?.badges?.includes(badge.id));
                const unlockInfo = account?.badgeUnlocks?.find((item) => item.badgeId === badge.id);

                return (
                  <button
                    type="button"
                    key={badge.id}
                    onClick={() => setSelectedBadge(badge)}
                    className={`group relative overflow-hidden rounded-[24px] border p-3 text-center transition hover:-translate-y-0.5 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 ${
                      unlocked
                        ? "border-emerald-300/20 bg-gradient-to-b from-white/[0.07] to-emerald-500/[0.04] shadow-[0_16px_45px_rgba(0,0,0,.24)]"
                        : "border-white/[0.08] bg-black/15"
                    }`}
                  >
                    <div className="relative mx-auto aspect-square w-full max-w-[150px] overflow-hidden rounded-[20px]">
                      <img
                        src={badge.image}
                        alt={badge.name}
                        className={`h-full w-full object-contain transition duration-500 ${
                          unlocked
                            ? "drop-shadow-[0_12px_24px_rgba(0,0,0,.38)] group-hover:scale-[1.04]"
                            : "grayscale opacity-20 blur-[1.5px]"
                        }`}
                      />
                      {!unlocked ? (
                        <div className="absolute inset-0 grid place-items-center bg-black/25">
                          <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/55 backdrop-blur-xl">
                            <LockKeyhole className="h-4 w-4 text-white/45" />
                          </div>
                        </div>
                      ) : (
                        <div className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-emerald-300/25 bg-emerald-500/20 backdrop-blur-xl">
                          <BadgeCheck className="h-4 w-4 text-emerald-200" />
                        </div>
                      )}
                    </div>

                    <p className={`mt-3 text-xs font-black ${unlocked ? "text-white" : "text-white/45"}`}>
                      {badge.name}
                    </p>
                    <p className={`mt-1 text-[9px] font-black uppercase tracking-[.13em] ${
                      unlocked ? "text-emerald-300" : "text-white/20"
                    }`}>
                      {unlocked ? "Débloqué" : "À débloquer"}
                    </p>

                    {unlocked && unlockInfo?.unlockedAt ? (
                      <p className="mt-2 text-[9px] leading-4 text-white/35">
                        Obtenu le {new Date(unlockInfo.unlockedAt).toLocaleDateString("fr-FR")}
                      </p>
                    ) : null}
                  </button>
                );
              })}

              <article className="relative overflow-hidden rounded-[24px] border border-cyan-300/10 bg-gradient-to-br from-cyan-500/[0.06] to-violet-500/[0.04] p-3 text-center">
                <div className="mx-auto grid aspect-square w-full max-w-[150px] place-items-center rounded-[20px] border border-white/[0.08] bg-black/20">
                  <div>
                    <LockKeyhole className="mx-auto h-7 w-7 text-white/35" />
                    <p className="mt-2 text-[11px] font-black text-white/35">???</p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-black text-white/55">Badge secret</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[.13em] text-cyan-200/35">Condition inconnue</p>
              </article>
            </div>

            <p className="mt-3 text-center text-[10px] font-bold text-white/25">
              Clique sur un badge pour l’agrandir et voir sa condition.
            </p>

            <button type="button" disabled className="mt-5 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/35">
              <Medal className="h-4 w-4" />
              Voir toute la collection — bientôt
            </button>
          </section>

          <section className="relative overflow-hidden rounded-[32px] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(245,158,11,.14),rgba(236,72,153,.09)_46%,rgba(139,92,246,.10))] p-5 shadow-[0_28px_90px_rgba(245,158,11,.08),0_24px_70px_rgba(0,0,0,.30)] backdrop-blur-2xl sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-amber-400/20 blur-[70px]" />
            <div className="pointer-events-none absolute -left-14 bottom-0 h-36 w-36 rounded-full bg-fuchsia-500/15 blur-[70px]" />
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-amber-200">Bientôt</span>
                <Gem className="h-5 w-5 text-amber-200" />
              </div>

              <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-amber-300/15 bg-black/20 px-3 py-2 text-amber-200">
                <Crown className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[.18em]">Personnalisation avancée</span>
              </div>

              <h2 className="mt-4 font-[family:var(--font-exo-2)] text-2xl font-black">
                MixParty <span className="bg-gradient-to-r from-amber-300 via-orange-300 to-fuchsia-300 bg-clip-text text-transparent">Premium</span>
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/45">Plus tard, Premium donnera accès à la personnalisation complète de tes soirées et de ton univers MixParty.</p>

              <div className="mt-5 space-y-3">
                {["Nom et identité de soirée", "Thèmes visuels premium", "Personnalisation du Mode TV"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-3.5 py-3">
                    <Star className="h-4 w-4 shrink-0 text-amber-300" />
                    <span className="text-xs font-bold text-white/65">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            { label: "Profil", detail: "Identité & avatar", Icon: UserRound, active: true },
            { label: "Badges", detail: "Collection", Icon: Medal, active: false },
            { label: "Statistiques", detail: "Progression", Icon: Trophy, active: false },
            { label: "Historique", detail: "Tes soirées", Icon: History, active: false },
          ].map(({ label, detail, Icon, active }) => (
            <button
              key={label}
              type="button"
              disabled={!active}
              className={`group flex min-h-20 items-center gap-3 rounded-[24px] border px-4 text-left backdrop-blur-xl transition ${
                active
                  ? "border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-500/15 to-violet-500/10 shadow-[0_16px_45px_rgba(168,85,247,.12)]"
                  : "cursor-not-allowed border-white/[0.08] bg-white/[0.035] opacity-55"
              }`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${active ? "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-200" : "border-white/10 bg-white/[0.04] text-white/35"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-[family:var(--font-exo-2)] text-sm font-black text-white/80">{label}</span>
                <span className="mt-0.5 block text-[11px] font-bold text-white/30">{active ? detail : `${detail} · bientôt`}</span>
              </span>
            </button>
          ))}
        </section>

        <section className="mt-6 overflow-hidden rounded-[30px] border border-cyan-300/10 bg-white/[0.05] shadow-[0_22px_70px_rgba(0,0,0,.24)] backdrop-blur-2xl">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">Compte & sécurité</p>
                <h2 className="mt-1 font-[family:var(--font-exo-2)] text-xl font-black">
                  {account ? "Ton compte MixParty" : "Sauvegarde ta progression"}
                </h2>
                {account ? (
                  <div className="mt-2 space-y-1 text-sm text-white/45">
                    <p className="truncate"><span className="text-white/70">E-mail :</span> {account.email}</p>
                    <p>
                      <span className="text-white/70">Statut :</span>{" "}
                      {account.plan === "premium" ? "MixParty Premium" : "MixParty Free"}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/40">
                    Crée un compte permanent pour retrouver plus tard tes badges, tes statistiques et l’historique de tes soirées sur tous tes appareils.
                  </p>
                )}
              </div>
            </div>

            {accountLoading ? (
              <span className="inline-flex min-h-11 items-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white/40">
                Vérification…
              </span>
            ) : account ? (
              <button
                type="button"
                onClick={() => void logoutAccount()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-red-300/15 bg-red-500/[0.08] px-4 text-xs font-black uppercase tracking-[.12em] text-red-100 transition hover:bg-red-500/[0.14]"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            ) : (
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => openAuth("login")}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-xs font-black text-white/75 transition hover:bg-white/[0.1]"
                >
                  <LogIn className="h-4 w-4" />
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => openAuth("register")}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/15"
                >
                  <BadgeCheck className="h-4 w-4" />
                  Créer mon compte
                </button>
              </div>
            )}
          </div>
        </section>

        <footer className="py-8 text-center text-xs text-white/25">
          <span className="font-black text-white/35">MixParty</span> · Ton profil, ta progression, tes soirées.
        </footer>
      </div>


      {selectedBadge ? (() => {
        const unlocked = Boolean(account?.badges?.includes(selectedBadge.id));
        const unlockInfo = account?.badgeUnlocks?.find(
          (item) => item.badgeId === selectedBadge.id,
        );

        return (
          <div
            className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#05030c]/92 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-2xl"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setSelectedBadge(null);
            }}
          >
            <section className="relative w-full max-w-lg overflow-hidden rounded-[34px] border border-white/12 bg-[#100b19]/96 p-5 text-center shadow-[0_35px_120px_rgba(0,0,0,.72)] sm:p-7">
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />

              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/30 text-white/55 transition hover:bg-white/10 hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mx-auto mt-5 w-full max-w-[320px]">
                <img
                  src={selectedBadge.image}
                  alt={selectedBadge.name}
                  className={`mx-auto aspect-square w-full object-contain transition ${
                    unlocked
                      ? "drop-shadow-[0_24px_55px_rgba(0,0,0,.5)]"
                      : "grayscale opacity-35"
                  }`}
                />
              </div>

              <div className="mt-4">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[.15em] ${
                    unlocked
                      ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.05] text-white/40"
                  }`}
                >
                  {unlocked ? "Badge débloqué" : "Badge à débloquer"}
                </span>

                <h2 className="mt-3 font-[family:var(--font-exo-2)] text-2xl font-black sm:text-3xl">
                  {selectedBadge.name}
                </h2>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/50">
                  {selectedBadge.condition}
                </p>

                {unlocked && unlockInfo?.unlockedAt ? (
                  <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-emerald-300/10 bg-emerald-500/[0.06] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-300">
                      Obtenu le {new Date(unlockInfo.unlockedAt).toLocaleDateString("fr-FR")}
                    </p>
                    {unlockInfo.partyCode ? (
                      <p className="mt-1 text-xs font-bold text-white/35">
                        Soirée {unlockInfo.partyCode}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        );
      })() : null}

      {authOpen ? (
        <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#05030c]/92 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-2xl">
          <section className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-[#100b19]/95 p-5 shadow-[0_35px_120px_rgba(0,0,0,.68)] sm:p-7">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />

            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">Compte MixParty</p>
              <h2 className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black">
                {authMode === "register" ? "Créer mon compte" : "Me connecter"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/40">
                {authMode === "register"
                  ? "Ton profil devient permanent. Les statistiques et badges seront branchés ensuite."
                  : "Retrouve ton identité MixParty sur cet appareil."}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {authMode === "register" ? (
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[.16em] text-white/45">Pseudo</span>
                  <div className="relative mt-2">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      maxLength={24}
                      autoComplete="nickname"
                      className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-base font-bold outline-none transition focus:border-cyan-400/45 focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </div>
                </label>
              ) : null}

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[.16em] text-white/45">E-mail</span>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="toi@exemple.fr"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-base font-bold outline-none transition placeholder:text-white/20 focus:border-cyan-400/45 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[.16em] text-white/45">Mot de passe</span>
                <div className="relative mt-2">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    placeholder="8 caractères minimum"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-base font-bold outline-none transition placeholder:text-white/20 focus:border-cyan-400/45 focus:ring-4 focus:ring-cyan-500/10"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !authBusy) void submitAuth();
                    }}
                  />
                </div>
              </label>
            </div>

            {authError ? (
              <p className="mt-4 rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
                {authError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void submitAuth()}
              disabled={authBusy}
              className="mt-5 min-h-14 w-full rounded-2xl border border-white/15 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 px-4 text-sm font-black shadow-[0_14px_35px_rgba(236,72,153,.22)] transition hover:brightness-110 disabled:opacity-50"
            >
              {authBusy
                ? "Connexion…"
                : authMode === "register"
                  ? "Créer mon compte MixParty"
                  : "Se connecter"}
            </button>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "register" ? "login" : "register");
                  setAuthError("");
                  setAuthPassword("");
                }}
                className="text-xs font-black text-cyan-200/75 hover:text-cyan-100"
              >
                {authMode === "register" ? "J’ai déjà un compte" : "Créer un compte"}
              </button>
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-white/55"
              >
                Fermer
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-[9998] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#05030c]/92 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-2xl">
          <section className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-[#100b19]/95 p-5 shadow-[0_35px_120px_rgba(0,0,0,.68)] sm:p-7">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />

            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-300">Mon profil</p>
              <h2 className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black">Modifier mon identité</h2>
              <p className="mt-2 text-sm leading-6 text-white/40">Pour l’instant, ces informations restent enregistrées sur cet appareil comme aujourd’hui.</p>
            </div>

            <button type="button" onClick={() => galleryInputRef.current?.click()} className="group relative mx-auto mt-6 block h-32 w-32 rounded-[30px] border border-white/15 bg-black/25 p-1">
              <span className="absolute -inset-1 -z-10 rounded-[34px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 opacity-55 blur-md" />
              <span className="grid h-full w-full place-items-center overflow-hidden rounded-[25px] bg-[#0d0817]">
                {draftPhoto ? <img src={draftPhoto} alt="Aperçu de ta photo" className="h-full w-full object-cover" /> : <UserRound className="h-10 w-10 text-white/35" />}
              </span>
              <span className="absolute -bottom-2 -right-2 grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-xl">
                {processingPhoto ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Camera className="h-5 w-5" />}
              </span>
            </button>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" disabled={processingPhoto} onClick={() => cameraInputRef.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-pink-400/25 bg-pink-500/10 px-3 text-sm font-black text-pink-100 disabled:opacity-50">
                <Camera className="h-4 w-4" /> Photo
              </button>
              <button type="button" disabled={processingPhoto} onClick={() => galleryInputRef.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-3 text-sm font-black text-violet-100 disabled:opacity-50">
                <Images className="h-4 w-4" /> Galerie
              </button>
            </div>

            <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { void choosePhoto(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
            <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void choosePhoto(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />

            <label className="mt-6 block">
              <span className="text-[11px] font-black uppercase tracking-[.18em] text-white/45">Prénom / pseudo</span>
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={24} className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base font-bold outline-none transition focus:border-fuchsia-400/50 focus:ring-4 focus:ring-fuchsia-500/10" />
            </label>

            {error ? <p className="mt-3 rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{error}</p> : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={cancelEditing} className="min-h-13 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-black text-white/60">Annuler</button>
              <button type="button" onClick={saveProfile} disabled={saving || processingPhoto || !draftName.trim() || !draftPhoto} className="min-h-13 rounded-2xl border border-white/15 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 px-4 text-sm font-black shadow-[0_14px_35px_rgba(236,72,153,.22)] disabled:opacity-40">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
