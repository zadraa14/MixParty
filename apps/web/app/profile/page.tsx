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
  Disc3,
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
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  featuredBadges?: string[];
  badgeUnlocks?: Array<{
    badgeId: string;
    unlockedAt: number;
    partyCode?: string;
  }>;
  history?: Array<{
    partyCode: string;
    joinedAt: number;
    lastSeenAt: number;
    role: "participant" | "host";
    endedAt?: number;
    finalRank?: number;
    partyScore?: number;
    participationCounted?: boolean;
    resultCounted?: boolean;
    durationCreditedMs?: number;
  }>;
  customization: {
    avatarFrame?: string;
    profileTheme?: string;
    joinEffect?: string;
  };
};


const PROFILE_STAT_CARDS = [
  {
    key: "partiesJoined",
    label: "Soirées",
    icon: History,
    accent: "text-violet-200",
    iconBg: "from-violet-500/30 to-indigo-500/10",
    glow: "bg-violet-500/20",
    border: "border-violet-300/15",
    live: true,
  },
  {
    key: "wins",
    label: "Victoires",
    icon: Crown,
    accent: "text-amber-200",
    iconBg: "from-amber-400/30 to-orange-500/10",
    glow: "bg-amber-400/20",
    border: "border-amber-300/15",
    live: true,
  },
  {
    key: "podiums",
    label: "Podiums",
    icon: Trophy,
    accent: "text-cyan-200",
    iconBg: "from-cyan-400/30 to-blue-500/10",
    glow: "bg-cyan-400/20",
    border: "border-cyan-300/15",
    live: true,
  },
  {
    key: "votesGiven",
    label: "Votes",
    icon: Vote,
    accent: "text-pink-200",
    iconBg: "from-pink-400/30 to-fuchsia-500/10",
    glow: "bg-pink-400/20",
    border: "border-pink-300/15",
    live: true,
  },
  {
    key: "songsAdded",
    label: "Morceaux",
    icon: Music2,
    accent: "text-orange-200",
    iconBg: "from-orange-400/30 to-rose-500/10",
    glow: "bg-orange-400/20",
    border: "border-orange-300/15",
    live: true,
  },
] as const;


const PROFILE_BADGES = [
  {
    id: "createur-mixparty",
    name: "Créateur de MixParty",
    condition: "Badge unique réservé au créateur de MixParty",
    image: "/badges/createur-mixparty.png",
  },
  {
    id: "premiere-soiree",
    name: "Première Soirée",
    condition: "Participer à sa première soirée validée",
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
    id: "premier-vote-recu",
    name: "Premier Vote Reçu",
    condition: "Recevoir son premier vote",
    image: "/badges/premier-vote-recu.png",
  },
  {
    id: "premier-host",
    name: "Premier Host",
    condition: "Organiser sa première soirée validée",
    image: "/badges/premier-host.png",
  },
  {
    id: "habitue",
    name: "Habitué",
    condition: "Participer à 5 soirées validées",
    image: "/badges/habitue.png",
  },
  {
    id: "fetard",
    name: "Fêtard",
    condition: "Participer à 10 soirées validées",
    image: "/badges/fetard.png",
  },
  {
    id: "pilier-de-soiree",
    name: "Pilier de soirée",
    condition: "Participer à 25 soirées validées",
    image: "/badges/pilier-de-soiree.png",
  },
  {
    id: "veteran-mixparty",
    name: "Vétéran MixParty",
    condition: "Participer à 50 soirées validées",
    image: "/badges/veteran-mixparty.png",
  },
  {
    id: "centurion",
    name: "Centurion",
    condition: "Participer à 100 soirées validées",
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
  {
    id: "aimant-a-votes",
    name: "Aimant à votes",
    condition: "Recevoir 100 votes cumulés",
    image: "/badges/aimant-a-vote.png",
  },
  {
    id: "chouchou-du-public",
    name: "Chouchou du Public",
    condition: "Recevoir 500 votes cumulés",
    image: "/badges/chouchou-du-public.png",
  },
  {
    id: "hitmaker",
    name: "Hitmaker",
    condition: "Avoir 10 morceaux ayant atteint au moins 5 votes",
    image: "/badges/hitmaker.png",
  },
  {
    id: "hitmaker-ii",
    name: "Hitmaker II",
    condition: "Avoir 50 morceaux ayant atteint au moins 5 votes",
    image: "/badges/hitmaker-ii.png",
  },
  {
    id: "hitmaker-iii",
    name: "Hitmaker III",
    condition: "Avoir 100 morceaux ayant atteint au moins 5 votes",
    image: "/badges/hitmaker-iii.png",
  },
  {
    id: "maitre-de-ceremonie",
    name: "Maître de cérémonie",
    condition: "Organiser 5 soirées validées",
    image: "/badges/maitre-de-ceremonie.png",
  },
  {
    id: "maison-de-la-fete",
    name: "Maison de la fête",
    condition: "Organiser 25 soirées validées",
    image: "/badges/maison-de-la-fete.png",
  },
  {
    id: "host-legendaire",
    name: "Host légendaire",
    condition: "Organiser 50 soirées validées",
    image: "/badges/host-legendaire.png",
  },
  {
    id: "grosse-soiree",
    name: "Grosse soirée",
    condition: "Organiser une soirée accueillant au moins 25 personnes différentes",
    image: "/badges/grosse-soiree.png",
  },
  {
    id: "bon-public",
    name: "Bon Public",
    condition: "Voter pour les morceaux de 10 personnes différentes",
    image: "/badges/bon-public.png",
  },
  {
    id: "premier-podium",
    name: "Premier podium",
    condition: "Terminer dans le Top 3 d'une soirée validée",
    image: "/badges/premier-podium.png",
  },
  {
    id: "habitue-du-podium",
    name: "Habitué du podium",
    condition: "Terminer 5 fois dans le Top 3",
    image: "/badges/habitue-du-podium.png",
  },
  {
    id: "champion",
    name: "Champion",
    condition: "Remporter une soirée validée",
    image: "/badges/champion.png",
  },
  {
    id: "double-couronne",
    name: "Double Couronne",
    condition: "Remporter 2 soirées validées",
    image: "/badges/double-couronne.png",
  },
  {
    id: "collectionneur-de-couronnes",
    name: "Collectionneur de Couronnes",
    condition: "Remporter 5 soirées validées",
    image: "/badges/collectionneur-de-couronnes.png",
  },
  {
    id: "roi-de-la-soiree",
    name: "Roi de la soirée",
    condition: "Terminer n°1 du classement final avec le meilleur PartyScore",
    image: "/badges/roi-de-la-soiree.png",
  },
  {
    id: "intouchable",
    name: "Intouchable",
    condition: "Remporter 3 soirées classées consécutivement",
    image: "/badges/intouchable.png",
  },
  {
    id: "legende-mixparty",
    name: "Légende MixParty",
    condition: "Remporter 10 soirées validées",
    image: "/badges/top-dj.png",
  },
  {
    id: "compatible",
    name: "Compatible",
    condition: "Ajouter 5 morceaux consécutifs compatibles avec l'ambiance musicale de la soirée",
    image: "/badges/compatible.png",
  },
  {
    id: "partybrain-approved",
    name: "PartyBrain Approved",
    condition: "Ajouter 5 morceaux consécutifs exceptionnellement cohérents avec l'ambiance",
    image: "/badges/partybrain-approved.png",
  },
  {
    id: "maitre-partybrain",
    name: "Maître PartyBrain",
    condition: "Maintenir une qualité PartyBrain moyenne d'au moins 80/100 sur 20 ajouts",
    image: "/badges/maitre-partybrain.png",
  },
  {
    id: "serie-parfaite",
    name: "Série parfaite",
    condition: "Avoir 5 morceaux consécutifs joués jusqu'au bout et obtenant chacun au moins 5 votes",
    image: "/badges/serie-parfaite.png",
  },
  {
    id: "machine-a-danser",
    name: "Machine à danser",
    condition: "Recevoir 5 votes consécutifs sur au moins 3 de tes morceaux dans une même soirée",
    image: "/badges/machine-a-danser.png",
  },
  {
    id: "soiree-adoree",
    name: "Soirée Adorée",
    condition: "Organiser une soirée avec au moins 10 participants, 30 votes et 10 morceaux joués",
    image: "/badges/soiree-adoree.png",
  },
  {
    id: "secret-roi-cache",
    name: "ROI CACHÉ",
    condition: "Gagner une soirée sans avoir été dans le Top 3 pendant la majorité des classements intermédiaires",
    image: "/badges/secret-roi-cache.png",
    secret: true,
  },
  {
    id: "banger",
    name: "Banger",
    condition: "Faire atteindre au moins 10 votes à un de tes morceaux",
    image: "/badges/banger.png",
  },
  {
    id: "banger-nucleaire",
    name: "Banger Nucléaire",
    condition: "Faire atteindre au moins 25 votes à un de tes morceaux",
    image: "/badges/banger-nucleaire.png",
  },
  {
    id: "dans-le-mille",
    name: "Dans le mille",
    condition: "Avoir 5 de tes morceaux joués consécutivement sans skip",
    image: "/badges/dans-le-mille.png",
  },
  {
    id: "encore-lui",
    name: "Encore lui ?!",
    condition: "Ajouter 3 titres différents du même artiste en moins de 10 minutes",
    image: "/badges/encore-lui.png",
  },
  {
    id: "speed-dj",
    name: "Speed DJ",
    condition: "Ajouter un morceau moins de 30 secondes après avoir rejoint la soirée",
    image: "/badges/speed-dj.png",
  },
  {
    id: "survivant",
    name: "Survivant",
    condition: "Rester dans une même soirée pendant au moins 5 heures",
    image: "/badges/survivant.png",
  },
  {
    id: "increvable",
    name: "Increvable",
    condition: "Rester dans une même soirée pendant au moins 8 heures",
    image: "/badges/increvable.png",
  },
  {
    id: "oiseau-de-nuit",
    name: "Oiseau de nuit",
    condition: "Ajouter un morceau après au moins 3 heures sans avoir ajouté de musique dans cette soirée",
    image: "/badges/oiseau-de-nuit.png",
  },
  {
    id: "secret-sniper",
    name: "SNIPER",
    condition: "Ajouter un morceau dans les 5 dernières minutes de la soirée et atteindre au moins 10 votes",
    image: "/badges/secret-sniper.png",
    secret: true,
  },
  {
    id: "secret-devin",
    name: "DEVIN",
    condition: "Ajouter un morceau avant le premier vote de la soirée puis terminer avec le morceau le plus voté",
    image: "/badges/secret-devin.png",
    secret: true,
  },
  {
    id: "secret-pepite-cachee",
    name: "PÉPITE CACHÉE",
    condition: "Ajouter un morceau jamais encore ajouté sur MixParty et atteindre au moins 5 votes",
    image: "/badges/secret-pepite-cachee.png",
    secret: true,
  },
  {
    id: "secret-comeback",
    name: "COMEBACK",
    condition: "Ajouter un morceau qui reste à 0 vote pendant au moins 30 min puis atteint 10 votes",
    image: "/badges/secret-comeback.png",
    secret: true,
  },
  {
    id: "secret-jackpot",
    name: "JACKPOT",
    condition: "Ajouter 5 morceaux dans une même soirée et faire atteindre au moins 5 votes aux cinq",
    image: "/badges/secret-jackpot.png",
    secret: true,
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
  const searchParams = useSearchParams();
  const embedded = searchParams.get("embedded") === "1";
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
  const [showAllUnlockedBadges, setShowAllUnlockedBadges] = useState(false);
  const [showBadgePicker, setShowBadgePicker] = useState(false);
  const [featuredDraft, setFeaturedDraft] = useState<string[]>([]);
  const [savingFeaturedBadges, setSavingFeaturedBadges] = useState(false);
  const [featuredBadgesMessage, setFeaturedBadgesMessage] = useState("");
  const [activeProfileTab, setActiveProfileTab] = useState<
    "profile" | "badges" | "stats" | "history"
  >("profile");
  const [historyVisibleCount, setHistoryVisibleCount] = useState(5);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const profileTopRef = useRef<HTMLDivElement | null>(null);
  const badgesSectionRef = useRef<HTMLElement | null>(null);
  const statsSectionRef = useRef<HTMLDivElement | null>(null);
  const historySectionRef = useRef<HTMLElement | null>(null);


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
    {
      label: "Soirées organisées",
      value: account ? String(account.stats.partiesHosted ?? 0) : "—",
      icon: Crown,
      accent: "text-amber-200",
      iconBg: "from-amber-400/25 to-orange-500/10",
      border: "border-amber-300/10",
      glow: "bg-amber-400/15",
    },
    {
      label: "Votes reçus",
      value: account ? String(account.stats.votesReceived ?? 0) : "—",
      icon: Heart,
      accent: "text-pink-200",
      iconBg: "from-pink-400/25 to-fuchsia-500/10",
      border: "border-pink-300/10",
      glow: "bg-pink-400/15",
    },
    {
      label: "Morceaux joués",
      value: account ? String(account.stats.songsPlayed ?? 0) : "—",
      icon: Play,
      accent: "text-violet-200",
      iconBg: "from-violet-400/25 to-indigo-500/10",
      border: "border-violet-300/10",
      glow: "bg-violet-400/15",
    },
    {
      label: "Morceaux ≥ 5 votes",
      value: account ? String(account.stats.songsWith5Votes ?? 0) : "—",
      icon: TrendingUp,
      accent: "text-cyan-200",
      iconBg: "from-cyan-400/25 to-blue-500/10",
      border: "border-cyan-300/10",
      glow: "bg-cyan-400/15",
    },
    {
      label: "Temps en soirée",
      value: account ? formatActiveTime(account.stats.activeMinutes ?? 0) : "—",
      icon: Clock3,
      accent: "text-orange-200",
      iconBg: "from-orange-400/25 to-rose-500/10",
      border: "border-orange-300/10",
      glow: "bg-orange-400/15",
    },
  ];

  const qualifiedParties = account?.stats.partiesJoined || 0;
  const wins = account?.stats.wins || 0;
  const podiums = account?.stats.podiums || 0;
  const songsAdded = account?.stats.songsAdded || 0;
  const songsWith5Votes = account?.stats.songsWith5Votes || 0;
  const votesReceived = account?.stats.votesReceived || 0;
  const activeMinutes = account?.stats.activeMinutes || 0;

  const winRate =
    qualifiedParties > 0 ? Math.round((wins / qualifiedParties) * 100) : 0;
  const podiumRate =
    qualifiedParties > 0 ? Math.round((podiums / qualifiedParties) * 100) : 0;
  const hitRate =
    songsAdded > 0 ? Math.round((songsWith5Votes / songsAdded) * 100) : 0;
  const averageVotesPerSong =
    songsAdded > 0 ? votesReceived / songsAdded : 0;
  const averagePartyMinutes =
    qualifiedParties > 0 ? Math.round(activeMinutes / qualifiedParties) : 0;

  const rankedHistory = (account?.history || []).filter(
    (entry) => typeof entry.finalRank === "number" && entry.finalRank > 0,
  );
  const scoredHistory = (account?.history || []).filter(
    (entry) => typeof entry.partyScore === "number",
  );

  const bestRank =
    rankedHistory.length > 0
      ? Math.min(...rankedHistory.map((entry) => Number(entry.finalRank)))
      : null;
  const bestPartyScore =
    scoredHistory.length > 0
      ? Math.max(...scoredHistory.map((entry) => Number(entry.partyScore || 0)))
      : null;

  const performanceStats = [
    {
      label: "Taux de victoire",
      value: `${winRate} %`,
      percent: Math.min(100, winRate),
      detail: `${wins} victoire${wins > 1 ? "s" : ""} / ${qualifiedParties} soirée${qualifiedParties > 1 ? "s" : ""}`,
      icon: Crown,
    },
    {
      label: "Taux de podium",
      value: `${podiumRate} %`,
      percent: Math.min(100, podiumRate),
      detail: `${podiums} podium${podiums > 1 ? "s" : ""} / ${qualifiedParties} soirée${qualifiedParties > 1 ? "s" : ""}`,
      icon: Trophy,
    },
    {
      label: "Taux de Hit",
      value: `${hitRate} %`,
      percent: Math.min(100, hitRate),
      detail: `${songsWith5Votes} morceau${songsWith5Votes > 1 ? "x" : ""} à 5+ votes`,
      icon: TrendingUp,
    },
  ];

  const personalRecords = [
    {
      label: "Meilleur classement",
      value: bestRank ? `#${bestRank}` : "—",
      detail: bestRank === 1 ? "Victoire" : bestRank ? "Classement final" : "Aucun classement final",
      icon: Trophy,
      accent: "text-amber-300",
      glow: "from-amber-500/20 via-yellow-400/10 to-transparent",
      panel: "from-amber-500/[0.12] via-orange-500/[0.04] to-white/[0.02]",
      border: "border-amber-300/15",
      iconWrap: "border-amber-300/20 bg-amber-400/10 text-amber-200",
      spark: "text-amber-200/70",
      chip: "TOP",
    },
    {
      label: "Meilleur PartyScore",
      value: bestPartyScore !== null ? String(bestPartyScore) : "—",
      detail: "Record sur une soirée terminée",
      icon: Zap,
      accent: "text-fuchsia-300",
      glow: "from-fuchsia-500/20 via-pink-400/10 to-transparent",
      panel: "from-fuchsia-500/[0.12] via-pink-500/[0.05] to-white/[0.02]",
      border: "border-fuchsia-300/15",
      iconWrap: "border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-200",
      spark: "text-fuchsia-200/70",
      chip: "SCORE",
    },
    {
      label: "Votes / morceau",
      value: averageVotesPerSong > 0 ? averageVotesPerSong.toFixed(1).replace(".", ",") : "0",
      detail: "Moyenne de votes reçus",
      icon: Heart,
      accent: "text-cyan-300",
      glow: "from-cyan-500/20 via-sky-400/10 to-transparent",
      panel: "from-cyan-500/[0.12] via-sky-500/[0.05] to-white/[0.02]",
      border: "border-cyan-300/15",
      iconWrap: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
      spark: "text-cyan-200/70",
      chip: "MOYENNE",
    },
    {
      label: "Durée moyenne",
      value: averagePartyMinutes > 0 ? formatActiveTime(averagePartyMinutes) : "—",
      detail: "Par soirée validée",
      icon: Clock3,
      accent: "text-violet-300",
      glow: "from-violet-500/20 via-purple-400/10 to-transparent",
      panel: "from-violet-500/[0.12] via-purple-500/[0.05] to-white/[0.02]",
      border: "border-violet-300/15",
      iconWrap: "border-violet-300/20 bg-violet-400/10 text-violet-200",
      spark: "text-violet-200/70",
      chip: "TEMPS",
    },
  ];

  const unlockedProfileBadges = PROFILE_BADGES.filter((badge) =>
    account?.badges?.includes(badge.id),
  );

  const featuredBadgeIds =
    account?.featuredBadges?.filter((badgeId) =>
      account.badges.includes(badgeId),
    ) || [];

  const effectiveFeaturedBadgeIds =
    featuredBadgeIds.length > 0
      ? featuredBadgeIds.slice(0, 5)
      : unlockedProfileBadges
          .slice()
          .sort((a, b) => {
            const aDate =
              account?.badgeUnlocks?.find((item) => item.badgeId === a.id)
                ?.unlockedAt || 0;
            const bDate =
              account?.badgeUnlocks?.find((item) => item.badgeId === b.id)
                ?.unlockedAt || 0;
            return bDate - aDate;
          })
          .slice(0, 5)
          .map((badge) => badge.id);

  const visibleProfileBadges = (
    showAllUnlockedBadges
      ? unlockedProfileBadges
      : PROFILE_BADGES.filter((badge) =>
          effectiveFeaturedBadgeIds.includes(badge.id),
        )
  ).sort((a, b) => {
    if (showAllUnlockedBadges) {
      const aDate =
        account?.badgeUnlocks?.find((item) => item.badgeId === a.id)
          ?.unlockedAt || 0;
      const bDate =
        account?.badgeUnlocks?.find((item) => item.badgeId === b.id)
          ?.unlockedAt || 0;
      return bDate - aDate;
    }

    return (
      effectiveFeaturedBadgeIds.indexOf(a.id) -
      effectiveFeaturedBadgeIds.indexOf(b.id)
    );
  });

  function openBadgePicker() {
    setFeaturedDraft(effectiveFeaturedBadgeIds);
    setFeaturedBadgesMessage("");
    setShowBadgePicker(true);
  }

  function toggleFeaturedBadge(badgeId: string) {
    setFeaturedBadgesMessage("");
    setFeaturedDraft((current) => {
      if (current.includes(badgeId)) {
        return current.filter((id) => id !== badgeId);
      }

      if (current.length >= 5) {
        setFeaturedBadgesMessage("Tu peux afficher 5 badges maximum.");
        return current;
      }

      return [...current, badgeId];
    });
  }

  async function saveFeaturedBadges() {
    if (!account) return;

    setSavingFeaturedBadges(true);
    setFeaturedBadgesMessage("");

    try {
      const token = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";
      const response = await fetch(`${getApiBaseUrl()}/account/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          featuredBadges: featuredDraft,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Impossible d’enregistrer.");
      }

      setAccount(data.account || account);
      setShowBadgePicker(false);
    } catch (error) {
      setFeaturedBadgesMessage(
        error instanceof Error ? error.message : "Impossible d’enregistrer.",
      );
    } finally {
      setSavingFeaturedBadges(false);
    }
  }


  function navigateProfileTab(
    tab: "profile" | "badges" | "stats" | "history",
  ) {
    setActiveProfileTab(tab);

    const target =
      tab === "profile"
        ? profileTopRef.current
        : tab === "badges"
          ? badgesSectionRef.current
          : tab === "stats"
            ? statsSectionRef.current
            : historySectionRef.current;

    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const allProfileHistory = [...(account?.history || [])].sort(
    (a, b) =>
      (b.endedAt || b.lastSeenAt || b.joinedAt) -
      (a.endedAt || a.lastSeenAt || a.joinedAt),
  );

  const profileHistory = allProfileHistory.slice(0, historyVisibleCount);
  const hasMoreHistory = historyVisibleCount < allProfileHistory.length;


  function openPartyRecap(partyCode: string) {
    const href = `/party/${encodeURIComponent(partyCode)}/result`;

    if (embedded && window.top && window.top !== window) {
      window.top.location.assign(href);
      return;
    }

    window.location.assign(href);
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#070711] font-[family:var(--font-geist-sans)] text-white">
      <MixPartyBackground />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.035),transparent_36%),linear-gradient(to_bottom,rgba(7,7,17,.02),rgba(7,7,17,.28))]" />

      <div ref={profileTopRef} className="relative z-10 mx-auto w-full max-w-[1480px] scroll-mt-6 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 py-2 sm:py-4">
          {!embedded ? (<Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-3.5 text-sm font-black text-white/75 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </Link>) : null}

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
          {profileStats.map(
            ({
              label,
              value,
              icon: Icon,
              accent,
              iconBg,
              glow,
              border,
              live,
            }) => (
              <article
                key={label}
                className={`group relative overflow-hidden rounded-[26px] border ${border} bg-[linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025))] p-4 shadow-[0_20px_55px_rgba(0,0,0,.20)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075] sm:p-5`}
              >
                <div
                  className={`pointer-events-none absolute -right-7 -top-8 h-24 w-24 rounded-full ${glow} blur-[38px] transition duration-500 group-hover:scale-125`}
                />
                <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="relative flex items-center justify-between gap-3">
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br ${iconBg} shadow-[0_10px_25px_rgba(0,0,0,.20)]`}
                  >
                    <Icon className={`h-5 w-5 ${accent}`} />
                  </span>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[.14em] ${
                      account && live
                        ? "border-emerald-300/15 bg-emerald-500/[0.07] text-emerald-200/80"
                        : "border-white/10 bg-white/[0.04] text-white/25"
                    }`}
                  >
                    {account ? (live ? "À jour" : "Phase 2") : "Compte requis"}
                  </span>
                </div>

                <div className="relative mt-4">
                  <p className="font-[family:var(--font-exo-2)] text-3xl font-black tracking-tight text-white sm:text-[32px]">
                    {value}
                  </p>
                  <p className="mt-1 text-xs font-black text-white/45">
                    {label}
                  </p>
                </div>
              </article>
            ),
          )}
        </section>

        <div ref={statsSectionRef} className="mt-4 scroll-mt-6">
          <button
            type="button"
            onClick={() => setShowDetailedStats((value) => !value)}
            className="group flex min-h-12 w-full items-center justify-between gap-4 rounded-[22px] border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-left shadow-[0_14px_40px_rgba(0,0,0,.14)] backdrop-blur-xl transition hover:border-fuchsia-300/20 hover:bg-white/[0.055]"
            aria-expanded={showDetailedStats}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-fuchsia-300/15 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 text-fuchsia-200">
                <TrendingUp className="h-4 w-4" />
              </span>

              <div className="min-w-0">
                <p className="font-[family:var(--font-exo-2)] text-sm font-black text-white/80">
                  {showDetailedStats ? "Masquer les stats détaillées" : "Voir les stats détaillées"}
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-white/30">
                  Ratios, records personnels et performances
                </p>
              </div>
            </div>

            <ChevronDown
              className={`h-5 w-5 shrink-0 text-white/35 transition-transform duration-300 ${
                showDetailedStats ? "rotate-180 text-fuchsia-200" : ""
              }`}
            />
          </button>

          {showDetailedStats ? (
            <div className="mt-3 animate-[statsReveal_.22s_ease-out]">
        <section
          className="rounded-[30px] border border-white/[0.08] bg-white/[0.035] p-4 shadow-[0_22px_65px_rgba(0,0,0,.18)] backdrop-blur-xl sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-300">
                Stats V3
              </p>
              <h2 className="mt-1 font-[family:var(--font-exo-2)] text-xl font-black">
                Progression & performances
              </h2>
              <p className="mt-2 text-xs leading-5 text-white/35">
                Tes statistiques MixParty calculées à partir de tes soirées validées.
              </p>
            </div>

            <span className="rounded-full border border-emerald-300/15 bg-emerald-500/[0.07] px-3 py-1 text-[9px] font-black uppercase tracking-[.14em] text-emerald-200/80">
              En direct
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {detailedStats.map(
              ({
                label,
                value,
                icon: Icon,
                accent,
                iconBg,
                border,
                glow,
              }) => (
                <article
                  key={label}
                  className={`group relative overflow-hidden rounded-[22px] border ${border} bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(0,0,0,.12))] p-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-white/15`}
                >
                  <div
                    className={`pointer-events-none absolute -right-6 -top-7 h-20 w-20 rounded-full ${glow} blur-[34px]`}
                  />

                  <div className="relative flex items-start justify-between gap-3">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-gradient-to-br ${iconBg}`}
                    >
                      <Icon className={`h-4 w-4 ${accent}`} />
                    </span>

                    <Sparkles className={`h-3 w-3 ${accent} opacity-30`} />
                  </div>

                  <p className="relative mt-3 font-[family:var(--font-exo-2)] text-xl font-black text-white">
                    {value}
                  </p>
                  <p className="relative mt-1 text-[10px] font-bold leading-4 text-white/40">
                    {label}
                  </p>
                </article>
              ),
            )}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <div className="rounded-[24px] border border-white/[0.07] bg-black/15 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-300">
                    Performance
                  </p>
                  <h3 className="mt-1 font-[family:var(--font-exo-2)] text-lg font-black">
                    Tes ratios
                  </h3>
                </div>
                <TrendingUp className="h-5 w-5 text-cyan-300/70" />
              </div>

              <div className="mt-5 space-y-5">
                {performanceStats.map(({ label, value, percent, detail, icon: Icon }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/45">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white/70">
                            {label}
                          </p>
                          <p className="mt-0.5 truncate text-[9px] font-bold text-white/25">
                            {detail}
                          </p>
                        </div>
                      </div>

                      <p className="font-[family:var(--font-exo-2)] text-lg font-black">
                        {account ? value : "—"}
                      </p>
                    </div>

                    <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/35">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-700"
                        style={{ width: `${account ? percent : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-amber-500/[0.025] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.16em] text-amber-300">
                    Records personnels
                  </p>
                  <h3 className="mt-1 font-[family:var(--font-exo-2)] text-lg font-black">
                    Tes meilleurs chiffres
                  </h3>
                </div>
                <Star className="h-5 w-5 text-amber-300/75" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {personalRecords.map(
                  ({
                    label,
                    value,
                    detail,
                    icon: Icon,
                    accent,
                    glow,
                    panel,
                    border,
                    iconWrap,
                    spark,
                    chip,
                  }) => (
                    <article
                      key={label}
                      className={`group relative overflow-hidden rounded-[20px] border ${border} bg-gradient-to-br ${panel} p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-0.5`}
                    >
                      <div className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r ${glow}`} />
                      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/[0.03] blur-2xl" />

                      <div className="relative flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] ${border} ${accent} bg-black/15`}>
                          {chip}
                        </span>
                        <Sparkles className={`h-3.5 w-3.5 ${spark}`} />
                      </div>

                      <div className="relative mt-3 flex items-start justify-between gap-3">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${iconWrap}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <p className={`text-right font-[family:var(--font-exo-2)] text-[28px] leading-none font-black ${accent}`}>
                          {account ? value : "—"}
                        </p>
                      </div>

                      <div className="relative mt-4">
                        <p className="text-[11px] font-black text-white/80">
                          {label}
                        </p>
                        <p className="mt-1 text-[9px] font-bold leading-4 text-white/35">
                          {detail}
                        </p>
                      </div>
                    </article>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-[20px] border border-violet-300/10 bg-violet-500/[0.045] p-4">
              <p className="text-[9px] font-black uppercase tracking-[.14em] text-violet-300/75">
                Soirées jouées
              </p>
              <p className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black">
                {account ? qualifiedParties : "—"}
              </p>
              <p className="mt-1 text-[9px] font-bold text-white/25">
                Participations validées
              </p>
            </article>

            <article className="rounded-[20px] border border-pink-300/10 bg-pink-500/[0.045] p-4">
              <p className="text-[9px] font-black uppercase tracking-[.14em] text-pink-300/75">
                Efficacité musicale
              </p>
              <p className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black">
                {account ? `${hitRate} %` : "—"}
              </p>
              <p className="mt-1 text-[9px] font-bold text-white/25">
                De tes morceaux atteignent 5+ votes
              </p>
            </article>

            <article className="rounded-[20px] border border-orange-300/10 bg-orange-500/[0.045] p-4">
              <p className="text-[9px] font-black uppercase tracking-[.14em] text-orange-300/75">
                Temps cumulé
              </p>
              <p className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black">
                {account ? formatActiveTime(activeMinutes) : "—"}
              </p>
              <p className="mt-1 text-[9px] font-bold text-white/25">
                Passé dans des soirées MixParty
              </p>
            </article>
          </div>
        </section>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_.8fr]">
          <section ref={badgesSectionRef} className="scroll-mt-6 rounded-[32px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_70px_rgba(0,0,0,.26)] backdrop-blur-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-300">Collection</p>
                <h2 className="mt-1 font-[family:var(--font-exo-2)] text-2xl font-black">Mes badges</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/40">Tes badges MixParty se débloquent automatiquement selon tes soirées validées, tes votes et tes morceaux.</p>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/10 text-fuchsia-200">
                <Medal className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold text-white/35">
                {showAllUnlockedBadges
                  ? `${unlockedProfileBadges.length} badge${unlockedProfileBadges.length > 1 ? "s" : ""} débloqué${unlockedProfileBadges.length > 1 ? "s" : ""}`
                  : "Les 5 badges que tu choisis d’afficher sur ton profil."}
              </p>

              {!showAllUnlockedBadges ? (
                <button
                  type="button"
                  onClick={openBadgePicker}
                  disabled={!account || unlockedProfileBadges.length === 0}
                  className="rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] text-fuchsia-100 transition hover:bg-fuchsia-500/[0.14] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Choisir mes badges
                </button>
              ) : null}
            </div>

            {visibleProfileBadges.length > 0 ? (
              <div
                className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 ${
                  showAllUnlockedBadges ? "xl:grid-cols-4" : "xl:grid-cols-5"
                }`}
              >
                {visibleProfileBadges.map((badge) => {
                  const unlockInfo = account?.badgeUnlocks?.find(
                    (item) => item.badgeId === badge.id,
                  );

                  return (
                    <button
                      type="button"
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      className="group relative overflow-hidden rounded-[24px] border border-emerald-300/20 bg-gradient-to-b from-white/[0.07] to-emerald-500/[0.04] p-3 text-center shadow-[0_16px_45px_rgba(0,0,0,.24)] transition hover:-translate-y-0.5 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
                    >
                      <div className="relative mx-auto aspect-square w-full max-w-[150px] overflow-hidden rounded-[20px]">
                        <img
                          src={badge.image}
                          alt={badge.name}
                          className="h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,.38)] transition duration-500 group-hover:scale-[1.04]"
                        />
                        <div className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-emerald-300/25 bg-emerald-500/20 backdrop-blur-xl">
                          <BadgeCheck className="h-4 w-4 text-emerald-200" />
                        </div>
                      </div>

                      <p className="mt-3 text-xs font-black text-white">
                        {badge.name}
                      </p>

                      {unlockInfo?.unlockedAt ? (
                        <p className="mt-2 text-[9px] leading-4 text-white/35">
                          Obtenu le{" "}
                          {new Date(unlockInfo.unlockedAt).toLocaleDateString(
                            "fr-FR",
                          )}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-white/[0.07] bg-black/15 p-6 text-center">
                <Medal className="mx-auto h-7 w-7 text-white/20" />
                <p className="mt-3 text-sm font-black text-white/45">
                  Aucun badge débloqué pour le moment.
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowAllUnlockedBadges((value) => !value)}
                disabled={unlockedProfileBadges.length === 0}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.07] px-4 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Medal className="h-4 w-4" />
                {showAllUnlockedBadges
                  ? "Revenir à mes 5 badges"
                  : "Tout voir — badges débloqués"}
              </button>

              <Link
                href="/badges"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.07] px-4 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-500/[0.12]"
              >
                <LockKeyhole className="h-4 w-4" />
                Explorer tous les badges
              </Link>
            </div>
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

        <section
          ref={historySectionRef}
          className="mt-6 scroll-mt-6 overflow-hidden rounded-[32px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(139,92,246,.025),rgba(0,0,0,.08))] p-5 shadow-[0_24px_70px_rgba(0,0,0,.22)] backdrop-blur-2xl sm:p-6"
        >
          <div className="relative">
            <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-400/10 blur-[80px]" />
            <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-[80px]" />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.08] text-cyan-200">
                    <History className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">
                      Historique
                    </p>
                    <h2 className="mt-0.5 font-[family:var(--font-exo-2)] text-2xl font-black">
                      Mes dernières soirées
                    </h2>
                  </div>
                </div>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
                  Tes participations récentes, tes rôles et tes résultats finaux.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-white/40">
                  {allProfileHistory.length} soirée{allProfileHistory.length > 1 ? "s" : ""}
                </span>
                <span className="rounded-full border border-emerald-300/15 bg-emerald-500/[0.07] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-emerald-200/80">
                  À jour
                </span>
              </div>
            </div>

            {profileHistory.length > 0 ? (
              <div className="relative mt-5 space-y-3">
                {profileHistory.map((entry, index) => {
                  const dateValue =
                    entry.endedAt || entry.lastSeenAt || entry.joinedAt;
                  const rank = Number(entry.finalRank || 0);
                  const isWinner = rank === 1;
                  const isPodium = rank > 1 && rank <= 3;

                  return (
                    <article
                      key={`${entry.partyCode}-${entry.joinedAt}-${index}`}
                      onClick={() => {
                        if (entry.endedAt) openPartyRecap(entry.partyCode);
                      }}
                      role={entry.endedAt ? "button" : undefined}
                      tabIndex={entry.endedAt ? 0 : undefined}
                      onKeyDown={(event) => {
                        if (entry.endedAt && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          openPartyRecap(entry.partyCode);
                        }
                      }}
                      className={`group relative overflow-hidden rounded-[22px] border p-4 transition duration-300 hover:-translate-y-0.5 ${
                        entry.endedAt ? "cursor-pointer" : ""
                      } ${
                        isWinner
                          ? "border-amber-300/20 bg-gradient-to-r from-amber-500/[0.10] via-orange-500/[0.04] to-black/10"
                          : isPodium
                            ? "border-cyan-300/15 bg-gradient-to-r from-cyan-500/[0.08] via-blue-500/[0.03] to-black/10"
                            : "border-white/[0.07] bg-black/15 hover:border-white/15"
                      }`}
                    >
                      <div
                        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-[40px] ${
                          isWinner
                            ? "bg-amber-400/15"
                            : isPodium
                              ? "bg-cyan-400/12"
                              : "bg-violet-500/8"
                        }`}
                      />

                      <div className="relative grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${
                              isWinner
                                ? "border-amber-300/20 bg-amber-500/10 text-amber-200"
                                : isPodium
                                  ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-200"
                                  : "border-violet-300/10 bg-violet-500/[0.06] text-violet-200/70"
                            }`}
                          >
                            {isWinner ? (
                              <Crown className="h-5 w-5" />
                            ) : isPodium ? (
                              <Trophy className="h-5 w-5" />
                            ) : (
                              <Disc3 className="h-5 w-5" />
                            )}
                          </span>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-[family:var(--font-exo-2)] text-sm font-black text-white/90">
                                Soirée {entry.partyCode}
                              </p>

                              <span
                                className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] ${
                                  entry.role === "host"
                                    ? "border-fuchsia-300/15 bg-fuchsia-500/[0.08] text-fuchsia-200"
                                    : "border-white/10 bg-white/[0.04] text-white/40"
                                }`}
                              >
                                {entry.role === "host" ? "Host" : "Participant"}
                              </span>

                              {isWinner ? (
                                <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-amber-200">
                                  Victoire
                                </span>
                              ) : isPodium ? (
                                <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-cyan-200">
                                  Podium
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-white/30">
                              <span>
                                {new Date(dateValue).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                              </span>
                              <span className="text-white/15">•</span>
                              <span>
                                {new Date(dateValue).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          {rank > 0 ? (
                            <div
                              className={`min-w-[68px] rounded-2xl border px-3 py-2 text-center ${
                                isWinner
                                  ? "border-amber-300/20 bg-amber-500/[0.08]"
                                  : isPodium
                                    ? "border-cyan-300/20 bg-cyan-500/[0.08]"
                                    : "border-white/10 bg-white/[0.035]"
                              }`}
                            >
                              <p className="text-[8px] font-black uppercase tracking-[.12em] text-white/30">
                                Rang
                              </p>
                              <p
                                className={`mt-1 font-[family:var(--font-exo-2)] text-lg font-black ${
                                  isWinner
                                    ? "text-amber-200"
                                    : isPodium
                                      ? "text-cyan-200"
                                      : "text-white/70"
                                }`}
                              >
                                #{rank}
                              </p>
                            </div>
                          ) : null}

                          {typeof entry.partyScore === "number" ? (
                            <div className="min-w-[86px] rounded-2xl border border-fuchsia-300/10 bg-fuchsia-500/[0.05] px-3 py-2 text-center">
                              <p className="text-[8px] font-black uppercase tracking-[.12em] text-fuchsia-200/50">
                                PartyScore
                              </p>
                              <p className="mt-1 font-[family:var(--font-exo-2)] text-lg font-black text-fuchsia-100">
                                {entry.partyScore}
                              </p>
                            </div>
                          ) : null}
                          {entry.endedAt ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openPartyRecap(entry.partyCode);
                              }}
                              className="min-h-[52px] rounded-2xl border border-violet-300/15 bg-violet-500/[0.07] px-3 py-2 text-[10px] font-black text-violet-100 transition hover:border-fuchsia-300/20 hover:bg-fuchsia-500/[0.09]"
                            >
                              Voir le récap →
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}

                {allProfileHistory.length > 5 ? (
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
                    {hasMoreHistory ? (
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryVisibleCount((current) =>
                            Math.min(current + 5, allProfileHistory.length),
                          )
                        }
                        className="min-h-11 rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.07] px-5 text-sm font-black text-cyan-100 transition hover:border-cyan-300/25 hover:bg-cyan-500/[0.12]"
                      >
                        Voir 5 soirées de plus
                      </button>
                    ) : null}

                    {historyVisibleCount > 5 ? (
                      <button
                        type="button"
                        onClick={() => setHistoryVisibleCount(5)}
                        className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white/50 transition hover:bg-white/[0.08]"
                      >
                        Réduire l’historique
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="relative mt-5 rounded-[24px] border border-white/[0.07] bg-black/15 p-7 text-center">
                <History className="mx-auto h-7 w-7 text-white/20" />
                <p className="mt-3 text-sm font-black text-white/45">
                  Ton historique apparaîtra ici après tes soirées.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            { id: "profile" as const, label: "Profil", detail: "Identité & avatar", Icon: UserRound },
            { id: "badges" as const, label: "Badges", detail: "Mes badges", Icon: Medal },
            { id: "stats" as const, label: "Statistiques", detail: "Progression", Icon: Trophy },
            { id: "history" as const, label: "Historique", detail: "Tes soirées", Icon: History },
          ].map(({ id, label, detail, Icon }) => {
            const active = activeProfileTab === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => navigateProfileTab(id)}
                className={`group flex min-h-20 items-center gap-3 rounded-[24px] border px-4 text-left backdrop-blur-xl transition hover:-translate-y-0.5 ${
                  active
                    ? "border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-500/15 to-violet-500/10 shadow-[0_16px_45px_rgba(168,85,247,.12)]"
                    : "border-white/[0.08] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.055]"
                }`}
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${
                    active
                      ? "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-200"
                      : "border-white/10 bg-white/[0.04] text-white/45"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-[family:var(--font-exo-2)] text-sm font-black text-white/80">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-bold text-white/35">
                    {detail}
                  </span>
                </span>
              </button>
            );
          })}
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


      {showBadgePicker ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4 backdrop-blur-xl"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowBadgePicker(false);
            }
          }}
        >
          <section className="w-full max-w-[760px] overflow-hidden rounded-[32px] border border-white/10 bg-[#15101f] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-fuchsia-300">
                  Profil public
                </p>
                <h3 className="mt-1 font-[family:var(--font-exo-2)] text-2xl font-black">
                  Choisis tes 5 badges
                </h3>
                <p className="mt-2 text-sm text-white/40">
                  Sélectionne jusqu’à 5 badges déjà débloqués. Ils seront affichés
                  dans la section « Mes badges » de ton profil.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBadgePicker(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-black/25 text-white/45 transition hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3">
              <p className="text-xs font-black text-white/45">
                Sélection
              </p>
              <p className="font-[family:var(--font-exo-2)] text-lg font-black text-fuchsia-200">
                {featuredDraft.length} / 5
              </p>
            </div>

            <div className="mt-4 grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
              {unlockedProfileBadges.map((badge) => {
                const selected = featuredDraft.includes(badge.id);

                return (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => toggleFeaturedBadge(badge.id)}
                    className={`relative overflow-hidden rounded-[22px] border p-3 text-center transition ${
                      selected
                        ? "border-fuchsia-300/35 bg-fuchsia-500/[0.10] ring-2 ring-fuchsia-400/20"
                        : "border-white/[0.07] bg-black/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="relative mx-auto aspect-square w-full max-w-[120px]">
                      <img
                        src={badge.image}
                        alt={badge.name}
                        className="h-full w-full object-contain"
                      />
                      {selected ? (
                        <div className="absolute right-0 top-0 grid h-8 w-8 place-items-center rounded-full border border-fuchsia-300/25 bg-fuchsia-500/25">
                          <BadgeCheck className="h-4 w-4 text-fuchsia-100" />
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[11px] font-black text-white/75">
                      {badge.name}
                    </p>
                  </button>
                );
              })}
            </div>

            {featuredBadgesMessage ? (
              <p className="mt-3 text-sm font-bold text-amber-200">
                {featuredBadgesMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowBadgePicker(false)}
                className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white/55 transition hover:bg-white/[0.08]"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={saveFeaturedBadges}
                disabled={savingFeaturedBadges}
                className="min-h-11 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/[0.12] px-5 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-500/[0.18] disabled:opacity-50"
              >
                {savingFeaturedBadges ? "Enregistrement…" : "Enregistrer mes badges"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
                  src={("secret" in selectedBadge && selectedBadge.secret && !unlocked) ? "/branding/icon.png" : selectedBadge.image}
                  alt={("secret" in selectedBadge && selectedBadge.secret && !unlocked) ? "Badge secret" : selectedBadge.name}
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
                  {"secret" in selectedBadge && selectedBadge.secret && !unlocked ? "Badge secret" : selectedBadge.name}
                </h2>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/50">
                  {"secret" in selectedBadge && selectedBadge.secret && !unlocked
                    ? "Condition inconnue"
                    : selectedBadge.condition}
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
      <style jsx global>{`
        @keyframes statsReveal {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
