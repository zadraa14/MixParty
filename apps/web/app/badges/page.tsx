"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Crown,
  Filter,
  LockKeyhole,
  Medal,
  Search,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../lib/config";
import MixPartyBackground from "../../components/MixPartyBackground";

const ACCOUNT_TOKEN_KEY = "mixparty.account.token.v1";

type MixPartyAccount = {
  id: string;
  email: string;
  name: string;
  badges: string[];
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
  badgeUnlocks?: Array<{
    badgeId: string;
    unlockedAt: number;
    partyCode?: string;
  }>;
};

const BADGES = [
  {
    id: "createur-mixparty",
    name: "Créateur de MixParty",
    condition: "Badge unique réservé au créateur de MixParty",
    image: "/badges/createur-mixparty.png",
    category: "Prestige",
    rarity: "Unique",
    secret: false,
  },
  {
    id: "premiere-soiree",
    name: "Première Soirée",
    condition: "Participer à sa première soirée validée",
    image: "/badges/premiere-soiree.png",
    category: "Premiers pas",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "premier-son",
    name: "Premier Son",
    condition: "Ajouter son premier morceau",
    image: "/badges/premier-son.png",
    category: "Premiers pas",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "premier-vote",
    name: "Premier Vote",
    condition: "Voter pour la première fois",
    image: "/badges/premier-vote.png",
    category: "Premiers pas",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "premier-vote-recu",
    name: "Premier Vote Reçu",
    condition: "Recevoir son premier vote",
    image: "/badges/premier-vote-recu.png",
    category: "Premiers pas",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "premier-host",
    name: "Premier Host",
    condition: "Organiser sa première soirée validée",
    image: "/badges/premier-host.png",
    category: "Premiers pas",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "habitue",
    name: "Habitué",
    condition: "Participer à 5 soirées validées",
    image: "/badges/habitue.png",
    category: "Fidélité",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "fetard",
    name: "Fêtard",
    condition: "Participer à 10 soirées validées",
    image: "/badges/fetard.png",
    category: "Fidélité",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "pilier-de-soiree",
    name: "Pilier de soirée",
    condition: "Participer à 25 soirées validées",
    image: "/badges/pilier-de-soiree.png",
    category: "Fidélité",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "veteran-mixparty",
    name: "Vétéran MixParty",
    condition: "Participer à 50 soirées validées",
    image: "/badges/veteran-mixparty.png",
    category: "Fidélité",
    rarity: "Épique",
    secret: false,
  },
  {
    id: "centurion",
    name: "Centurion",
    condition: "Participer à 100 soirées validées",
    image: "/badges/centurion.png",
    category: "Fidélité",
    rarity: "Légendaire",
    secret: false,
  },
  {
    id: "supporter",
    name: "Supporter",
    condition: "Effectuer 50 votes",
    image: "/badges/supporter.png",
    category: "Votes",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "super-votant",
    name: "Super Votant",
    condition: "Effectuer 250 votes",
    image: "/badges/super-votant.png",
    category: "Votes",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "aimant-a-votes",
    name: "Aimant à votes",
    condition: "Recevoir 100 votes cumulés",
    image: "/badges/aimant-a-vote.png",
    category: "Votes",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "chouchou-du-public",
    name: "Chouchou du Public",
    condition: "Recevoir 500 votes cumulés",
    image: "/badges/chouchou-du-public.png",
    category: "Votes",
    rarity: "Légendaire",
    secret: false,
  },
  {
    id: "hitmaker",
    name: "Hitmaker",
    condition: "Avoir 10 morceaux ayant atteint au moins 5 votes",
    image: "/badges/hitmaker.png",
    category: "Musique",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "hitmaker-ii",
    name: "Hitmaker II",
    condition: "Avoir 50 morceaux ayant atteint au moins 5 votes",
    image: "/badges/hitmaker-ii.png",
    category: "Musique",
    rarity: "Épique",
    secret: false,
  },
  {
    id: "hitmaker-iii",
    name: "Hitmaker III",
    condition: "Avoir 100 morceaux ayant atteint au moins 5 votes",
    image: "/badges/hitmaker-iii.png",
    category: "Musique",
    rarity: "Légendaire",
    secret: false,
  },
  {
    id: "maitre-de-ceremonie",
    name: "Maître de cérémonie",
    condition: "Organiser 5 soirées validées",
    image: "/badges/maitre-de-ceremonie.png",
    category: "Host",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "maison-de-la-fete",
    name: "Maison de la fête",
    condition: "Organiser 25 soirées validées",
    image: "/badges/maison-de-la-fete.png",
    category: "Host",
    rarity: "Épique",
    secret: false,
  },
  {
    id: "host-legendaire",
    name: "Host légendaire",
    condition: "Organiser 50 soirées validées",
    image: "/badges/host-legendaire.png",
    category: "Host",
    rarity: "Légendaire",
    secret: false,
  },
  {
    id: "grosse-soiree",
    name: "Grosse soirée",
    condition: "Organiser une soirée accueillant au moins 25 personnes différentes",
    image: "/badges/grosse-soiree.png",
    category: "Host",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "bon-public",
    name: "Bon Public",
    condition: "Voter pour les morceaux de 10 personnes différentes",
    image: "/badges/bon-public.png",
    category: "Votes",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "premier-podium",
    name: "Premier podium",
    condition: "Terminer dans le Top 3 d'une soirée validée",
    image: "/badges/premier-podium.png",
    category: "Classement",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "habitue-du-podium",
    name: "Habitué du podium",
    condition: "Terminer 5 fois dans le Top 3",
    image: "/badges/habitue-du-podium.png",
    category: "Classement",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "champion",
    name: "Champion",
    condition: "Remporter une soirée validée",
    image: "/badges/champion.png",
    category: "Classement",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "double-couronne",
    name: "Double Couronne",
    condition: "Remporter 2 soirées validées",
    image: "/badges/double-couronne.png",
    category: "Classement",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "collectionneur-de-couronnes",
    name: "Collectionneur de Couronnes",
    condition: "Remporter 5 soirées validées",
    image: "/badges/collectionneur-de-couronnes.png",
    category: "Classement",
    rarity: "Épique",
    secret: false,
  },
  {
    id: "roi-de-la-soiree",
    name: "Roi de la soirée",
    condition: "Terminer n°1 du classement final avec le meilleur PartyScore",
    image: "/badges/roi-de-la-soiree.png",
    category: "Classement",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "intouchable",
    name: "Intouchable",
    condition: "Remporter 3 soirées classées consécutivement",
    image: "/badges/intouchable.png",
    category: "Classement",
    rarity: "Légendaire",
    secret: false,
  },
  {
    id: "legende-mixparty",
    name: "Légende MixParty",
    condition: "Remporter 10 soirées validées",
    image: "/badges/top-dj.png",
    category: "Classement",
    rarity: "Légendaire",
    secret: false,
  },
  {
    id: "compatible",
    name: "Compatible",
    condition: "Ajouter 5 morceaux consécutifs compatibles avec l'ambiance musicale de la soirée",
    image: "/badges/compatible.png",
    category: "PartyBrain",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "partybrain-approved",
    name: "PartyBrain Approved",
    condition: "Ajouter 5 morceaux consécutifs exceptionnellement cohérents avec l'ambiance",
    image: "/badges/partybrain-approved.png",
    category: "PartyBrain",
    rarity: "Épique",
    secret: false,
  },
  {
    id: "maitre-partybrain",
    name: "Maître PartyBrain",
    condition: "Maintenir une qualité PartyBrain moyenne d'au moins 80/100 sur 20 ajouts",
    image: "/badges/maitre-partybrain.png",
    category: "PartyBrain",
    rarity: "Légendaire",
    secret: false,
  },
  {
    id: "serie-parfaite",
    name: "Série parfaite",
    condition: "Avoir 5 morceaux consécutifs joués jusqu'au bout et obtenant chacun au moins 5 votes",
    image: "/badges/serie-parfaite.png",
    category: "PartyBrain",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "machine-a-danser",
    name: "Machine à danser",
    condition: "Recevoir 5 votes consécutifs sur au moins 3 de tes morceaux dans une même soirée",
    image: "/badges/machine-a-danser.png",
    category: "PartyBrain",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "soiree-adoree",
    name: "Soirée Adorée",
    condition: "Organiser une soirée avec au moins 10 participants, 30 votes et 10 morceaux joués",
    image: "/badges/soiree-adoree.png",
    category: "Host",
    rarity: "Épique",
    secret: false,
  },
  {
    id: "secret-roi-cache",
    name: "ROI CACHÉ",
    condition: "Gagner une soirée sans avoir été dans le Top 3 pendant la majorité des classements intermédiaires",
    image: "/badges/secret-roi-cache.png",
    category: "Secrets",
    rarity: "Mythique",
    secret: true,
  },
  {
    id: "banger",
    name: "Banger",
    condition: "Faire atteindre au moins 10 votes à un de tes morceaux",
    image: "/badges/banger.png",
    category: "Musique",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "banger-nucleaire",
    name: "Banger Nucléaire",
    condition: "Faire atteindre au moins 25 votes à un de tes morceaux",
    image: "/badges/banger-nucleaire.png",
    category: "Musique",
    rarity: "Épique",
    secret: false,
  },
  {
    id: "dans-le-mille",
    name: "Dans le mille",
    condition: "Avoir 5 de tes morceaux joués consécutivement sans skip",
    image: "/badges/dans-le-mille.png",
    category: "Musique",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "encore-lui",
    name: "Encore lui ?!",
    condition: "Ajouter 3 titres différents du même artiste en moins de 10 minutes",
    image: "/badges/encore-lui.png",
    category: "Musique",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "speed-dj",
    name: "Speed DJ",
    condition: "Ajouter un morceau moins de 30 secondes après avoir rejoint la soirée",
    image: "/badges/speed-dj.png",
    category: "Endurance",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "survivant",
    name: "Survivant",
    condition: "Rester dans une même soirée pendant au moins 5 heures",
    image: "/badges/survivant.png",
    category: "Endurance",
    rarity: "Rare",
    secret: false,
  },
  {
    id: "increvable",
    name: "Increvable",
    condition: "Rester dans une même soirée pendant au moins 8 heures",
    image: "/badges/increvable.png",
    category: "Endurance",
    rarity: "Épique",
    secret: false,
  },
  {
    id: "oiseau-de-nuit",
    name: "Oiseau de nuit",
    condition: "Ajouter un morceau après au moins 3 heures sans avoir ajouté de musique dans cette soirée",
    image: "/badges/oiseau-de-nuit.png",
    category: "Endurance",
    rarity: "Commun",
    secret: false,
  },
  {
    id: "secret-sniper",
    name: "SNIPER",
    condition: "Ajouter un morceau dans les 5 dernières minutes de la soirée et atteindre au moins 10 votes",
    image: "/badges/secret-sniper.png",
    category: "Secrets",
    rarity: "Mythique",
    secret: true,
  },
  {
    id: "secret-devin",
    name: "DEVIN",
    condition: "Ajouter un morceau avant le premier vote de la soirée puis terminer avec le morceau le plus voté",
    image: "/badges/secret-devin.png",
    category: "Secrets",
    rarity: "Mythique",
    secret: true,
  },
  {
    id: "secret-pepite-cachee",
    name: "PÉPITE CACHÉE",
    condition: "Ajouter un morceau jamais encore ajouté sur MixParty et atteindre au moins 5 votes",
    image: "/badges/secret-pepite-cachee.png",
    category: "Secrets",
    rarity: "Mythique",
    secret: true,
  },
  {
    id: "secret-comeback",
    name: "COMEBACK",
    condition: "Ajouter un morceau qui reste à 0 vote pendant au moins 30 min puis atteint 10 votes",
    image: "/badges/secret-comeback.png",
    category: "Secrets",
    rarity: "Mythique",
    secret: true,
  },
  {
    id: "secret-jackpot",
    name: "JACKPOT",
    condition: "Ajouter 5 morceaux dans une même soirée et faire atteindre au moins 5 votes aux cinq",
    image: "/badges/secret-jackpot.png",
    category: "Secrets",
    rarity: "Mythique",
    secret: true,
  },
] as const;

type Badge = (typeof BADGES)[number];

const CATEGORY_ORDER = [
  "Tous",
  "Prestige",
  "Premiers pas",
  "Fidélité",
  "Votes",
  "Host",
  "Classement",
  "Musique",
  "Endurance",
  "PartyBrain",
  "Secrets",
] as const;

const RARITY_ORDER = [
  "Toutes",
  "Unique",
  "Commun",
  "Rare",
  "Épique",
  "Légendaire",
  "Mythique",
] as const;

function formatDate(timestamp?: number) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(timestamp);
}

function rarityClass(rarity: Badge["rarity"]) {
  if (rarity === "Unique") return "border-amber-200/35 bg-gradient-to-r from-amber-400/15 via-fuchsia-500/10 to-cyan-400/10 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,.12)]";
  if (rarity === "Mythique") return "border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-200";
  if (rarity === "Légendaire") return "border-amber-300/25 bg-amber-500/10 text-amber-200";
  if (rarity === "Épique") return "border-violet-300/25 bg-violet-500/10 text-violet-200";
  if (rarity === "Rare") return "border-cyan-300/25 bg-cyan-500/10 text-cyan-200";
  return "border-white/10 bg-white/[0.05] text-white/45";
}


type BadgeProgress = {
  current: number;
  target: number;
  label: string;
};

function getBadgeProgress(
  badgeId: string,
  account: MixPartyAccount | null,
): BadgeProgress | null {
  if (!account) return null;

  const stats = account.stats;

  const map: Record<string, BadgeProgress> = {
    "premiere-soiree": { current: stats.partiesJoined, target: 1, label: "soirée" },
    "premier-son": { current: stats.songsAdded, target: 1, label: "morceau" },
    "premier-vote": { current: stats.votesGiven, target: 1, label: "vote" },
    "premier-vote-recu": { current: stats.votesReceived, target: 1, label: "vote reçu" },
    "premier-host": { current: stats.partiesHosted, target: 1, label: "soirée organisée" },

    "habitue": { current: stats.partiesJoined, target: 5, label: "soirées" },
    "fetard": { current: stats.partiesJoined, target: 10, label: "soirées" },
    "pilier-de-soiree": { current: stats.partiesJoined, target: 25, label: "soirées" },
    "veteran-mixparty": { current: stats.partiesJoined, target: 50, label: "soirées" },
    "centurion": { current: stats.partiesJoined, target: 100, label: "soirées" },

    "supporter": { current: stats.votesGiven, target: 50, label: "votes" },
    "super-votant": { current: stats.votesGiven, target: 250, label: "votes" },
    "aimant-a-votes": { current: stats.votesReceived, target: 100, label: "votes reçus" },
    "chouchou-du-public": { current: stats.votesReceived, target: 500, label: "votes reçus" },

    "hitmaker": { current: stats.songsWith5Votes, target: 10, label: "morceaux ≥ 5 votes" },
    "hitmaker-ii": { current: stats.songsWith5Votes, target: 50, label: "morceaux ≥ 5 votes" },
    "hitmaker-iii": { current: stats.songsWith5Votes, target: 100, label: "morceaux ≥ 5 votes" },

    "maitre-de-ceremonie": { current: stats.partiesHosted, target: 5, label: "soirées organisées" },
    "maison-de-la-fete": { current: stats.partiesHosted, target: 25, label: "soirées organisées" },
    "host-legendaire": { current: stats.partiesHosted, target: 50, label: "soirées organisées" },

    "premier-podium": { current: stats.podiums, target: 1, label: "podium" },
    "habitue-du-podium": { current: stats.podiums, target: 5, label: "podiums" },
    "champion": { current: stats.wins, target: 1, label: "victoire" },
    "double-couronne": { current: stats.wins, target: 2, label: "victoires" },
    "collectionneur-de-couronnes": { current: stats.wins, target: 5, label: "victoires" },
    "legende-mixparty": { current: stats.wins, target: 10, label: "victoires" },

    "survivant": { current: stats.activeMinutes, target: 300, label: "minutes en soirée" },
    "increvable": { current: stats.activeMinutes, target: 480, label: "minutes en soirée" },
  };

  return map[badgeId] || null;
}

function progressPercent(progress: BadgeProgress) {
  if (progress.target <= 0) return 0;
  return Math.min(100, Math.round((progress.current / progress.target) * 100));
}

export default function BadgeCollectionPage() {
  const [account, setAccount] = useState<MixPartyAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<(typeof CATEGORY_ORDER)[number]>("Tous");
  const [rarity, setRarity] = useState<(typeof RARITY_ORDER)[number]>("Toutes");
  const [status, setStatus] = useState<"Tous" | "Débloqués" | "À débloquer">("Tous");
  const [sortMode, setSortMode] = useState<
    "Collection" | "Plus proches" | "Rareté" | "Récents"
  >("Collection");
  const [search, setSearch] = useState("");
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [celebratedBadgeId, setCelebratedBadgeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";
        if (!token) return;

        const response = await fetch(`${getApiBaseUrl()}/account/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (!response.ok) return;
        const data = await response.json();

        if (!cancelled) {
          setAccount(data.account || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlockedIds = useMemo(
    () => new Set(account?.badges || []),
    [account?.badges],
  );

  const unlockedCount = BADGES.filter((badge) => unlockedIds.has(badge.id)).length;
  const completion = Math.round((unlockedCount / BADGES.length) * 100);

  const latestUnlock = useMemo(() => {
    const unlocks = account?.badgeUnlocks || [];
    const latest = [...unlocks].sort((a, b) => b.unlockedAt - a.unlockedAt)[0];
    if (!latest) return null;

    const badge = BADGES.find((item) => item.id === latest.badgeId);
    return badge ? { badge, unlock: latest } : null;
  }, [account?.badgeUnlocks]);

  const nearestBadges = useMemo(() => {
    if (!account) return [];

    return BADGES
      .filter((badge) => !badge.secret && !unlockedIds.has(badge.id))
      .map((badge) => {
        const progress = getBadgeProgress(badge.id, account);
        return {
          badge,
          progress,
          percent: progress ? progressPercent(progress) : -1,
        };
      })
      .filter((item) => item.progress)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3);
  }, [account, unlockedIds]);

  useEffect(() => {
    if (!latestUnlock) return;

    const storageKey = `mixparty.badges.last-celebrated.${latestUnlock.badge.id}`;
    const alreadyCelebrated = sessionStorage.getItem(storageKey);

    if (!alreadyCelebrated) {
      setCelebratedBadgeId(latestUnlock.badge.id);
      sessionStorage.setItem(storageKey, "1");

      const timer = window.setTimeout(() => {
        setCelebratedBadgeId(null);
      }, 4500);

      return () => window.clearTimeout(timer);
    }
  }, [latestUnlock]);

  const filteredBadges = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR");

    return BADGES.filter((badge) => {
      const unlocked = unlockedIds.has(badge.id);
      if (category !== "Tous" && badge.category !== category) return false;
      if (rarity !== "Toutes" && badge.rarity !== rarity) return false;
      if (status === "Débloqués" && !unlocked) return false;
      if (status === "À débloquer" && unlocked) return false;

      if (query) {
        const searchable = `${badge.name} ${badge.category} ${badge.rarity}`.toLocaleLowerCase("fr-FR");
        if (!searchable.includes(query)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortMode === "Plus proches") {
        const aProgress = getBadgeProgress(a.id, account);
        const bProgress = getBadgeProgress(b.id, account);
        const aValue = aProgress ? progressPercent(aProgress) : -1;
        const bValue = bProgress ? progressPercent(bProgress) : -1;
        return bValue - aValue || a.name.localeCompare(b.name, "fr");
      }

      if (sortMode === "Rareté") {
        const rarityRank: Record<string, number> = {
          Unique: 6,
          Mythique: 5,
          Légendaire: 4,
          Épique: 3,
          Rare: 2,
          Commun: 1,
        };
        return (
          (rarityRank[b.rarity] || 0) -
            (rarityRank[a.rarity] || 0) ||
          a.name.localeCompare(b.name, "fr")
        );
      }

      if (sortMode === "Récents") {
        const aUnlock = account?.badgeUnlocks?.find((item) => item.badgeId === a.id)?.unlockedAt || 0;
        const bUnlock = account?.badgeUnlocks?.find((item) => item.badgeId === b.id)?.unlockedAt || 0;
        return bUnlock - aUnlock || a.name.localeCompare(b.name, "fr");
      }

      return 0;
    });
  }, [category, rarity, status, search, unlockedIds, sortMode, account]);

  const selectedUnlocked = selectedBadge ? unlockedIds.has(selectedBadge.id) : false;
  const selectedUnlock = selectedBadge
    ? account?.badgeUnlocks?.find((item) => item.badgeId === selectedBadge.id)
    : undefined;

  const selectedProgress = selectedBadge
    ? getBadgeProgress(selectedBadge.id, account)
    : null;
  const selectedPercent = selectedProgress
    ? progressPercent(selectedProgress)
    : 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090611] text-white">
      <MixPartyBackground />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-black text-white/70 backdrop-blur-xl transition hover:bg-white/[0.09]"
          >
            <ArrowLeft className="h-4 w-4" />
            Profil
          </Link>

          <div className="rounded-full border border-emerald-300/15 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-200">
            Collection active
          </div>
        </div>

        <section className="mt-5 overflow-hidden rounded-[34px] border border-white/10 bg-gradient-to-br from-violet-500/[0.11] via-fuchsia-500/[0.07] to-orange-400/[0.07] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_390px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/15 bg-fuchsia-500/[0.07] px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-fuchsia-200">
                <Medal className="h-3.5 w-3.5" />
                Collection MixParty
              </div>
              <h1 className="mt-4 font-[family:var(--font-exo-2)] text-3xl font-black sm:text-5xl">
                Tes badges
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                Explore toute la collection, découvre ta progression et retrouve chaque badge obtenu pendant tes soirées.
              </p>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                    Progression globale
                  </p>
                  <p className="mt-1 font-[family:var(--font-exo-2)] text-3xl font-black">
                    {loading ? "—" : `${unlockedCount} / ${BADGES.length}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-[family:var(--font-exo-2)] text-2xl font-black text-fuchsia-200">
                    {loading ? "—" : `${completion} %`}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-[.13em] text-white/30">
                    complété
                  </p>
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full border border-white/[0.07] bg-black/35">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400 transition-all duration-700"
                  style={{ width: `${loading ? 0 : completion}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
          <div className="rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-white/[0.05] via-violet-500/[0.04] to-fuchsia-500/[0.04] p-4 backdrop-blur-xl sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.17em] text-fuchsia-300">
                  Prochains objectifs
                </p>
                <h2 className="mt-1 font-[family:var(--font-exo-2)] text-xl font-black">
                  Plus proches du déblocage
                </h2>
              </div>
              <Trophy className="h-5 w-5 text-amber-300/70" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {nearestBadges.length === 0 ? (
                <div className="sm:col-span-3 rounded-2xl border border-white/[0.06] bg-black/15 p-5 text-sm text-white/35">
                  Aucun badge chiffré proche pour le moment.
                </div>
              ) : (
                nearestBadges.map(({ badge, progress, percent }) => (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => setSelectedBadge(badge)}
                    className="rounded-[22px] border border-white/[0.07] bg-black/15 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-black/20">
                        <img src={badge.image} alt={badge.name} className="h-full w-full object-contain p-1" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{badge.name}</p>
                        <p className="mt-1 text-[10px] font-bold text-white/35">
                          {progress?.current} / {progress?.target} {progress?.label}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/35">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-right text-[10px] font-black text-fuchsia-200/70">
                      {percent} %
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-300/10 bg-gradient-to-br from-amber-500/[0.08] via-orange-500/[0.04] to-transparent p-4 backdrop-blur-xl sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[.17em] text-amber-300">
              Dernier badge obtenu
            </p>

            {latestUnlock ? (
              <button
                type="button"
                onClick={() => setSelectedBadge(latestUnlock.badge)}
                className="mt-4 flex w-full items-center gap-4 rounded-[22px] border border-amber-300/10 bg-black/15 p-3 text-left transition hover:bg-white/[0.05]"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[20px] border border-white/[0.07] bg-black/20">
                  <img
                    src={latestUnlock.badge.image}
                    alt={latestUnlock.badge.name}
                    className="h-full w-full object-contain p-1"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-[family:var(--font-exo-2)] text-lg font-black">
                    {latestUnlock.badge.name}
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-amber-200/70">
                    {latestUnlock.badge.rarity}
                  </p>
                  <p className="mt-2 text-[10px] font-bold text-white/30">
                    Obtenu le {formatDate(latestUnlock.unlock.unlockedAt)}
                  </p>
                </div>
              </button>
            ) : (
              <div className="mt-4 rounded-[22px] border border-white/[0.06] bg-black/15 p-5 text-sm text-white/35">
                Aucun badge obtenu pour le moment.
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-fuchsia-300" />
            <p className="text-sm font-black">Filtres</p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(250px,1fr)_auto_auto_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un badge…"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-10 pr-4 text-sm font-bold outline-none placeholder:text-white/20 focus:border-fuchsia-300/30"
              />
            </label>

            <select
              value={rarity}
              onChange={(event) => setRarity(event.target.value as (typeof RARITY_ORDER)[number])}
              className="h-12 rounded-2xl border border-white/10 bg-[#15101f] px-4 text-sm font-black text-white outline-none"
            >
              {RARITY_ORDER.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "Tous" | "Débloqués" | "À débloquer")}
              className="h-12 rounded-2xl border border-white/10 bg-[#15101f] px-4 text-sm font-black text-white outline-none"
            >
              <option>Tous</option>
              <option>Débloqués</option>
              <option>À débloquer</option>
            </select>

            <select
              value={sortMode}
              onChange={(event) =>
                setSortMode(
                  event.target.value as
                    | "Collection"
                    | "Plus proches"
                    | "Rareté"
                    | "Récents",
                )
              }
              className="h-12 rounded-2xl border border-white/10 bg-[#15101f] px-4 text-sm font-black text-white outline-none"
            >
              <option>Collection</option>
              <option>Plus proches</option>
              <option>Rareté</option>
              <option>Récents</option>
            </select>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_ORDER.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] transition ${
                  category === item
                    ? "border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100"
                    : "border-white/[0.07] bg-black/15 text-white/35 hover:text-white/60"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-white/35">
            {filteredBadges.length} badge{filteredBadges.length > 1 ? "s" : ""}
          </p>
          <p className="text-[10px] font-black uppercase tracking-[.15em] text-white/20">
            {BADGES.length} badges actifs
          </p>
        </div>

        <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredBadges.map((badge) => {
            const unlocked = unlockedIds.has(badge.id);
            const hideSecret = badge.secret && !unlocked;
            const unlockInfo = account?.badgeUnlocks?.find((item) => item.badgeId === badge.id);
            const progress = getBadgeProgress(badge.id, account);
            const percent = progress ? progressPercent(progress) : 0;

            return (
              <button
                key={badge.id}
                type="button"
                onClick={() => setSelectedBadge(badge)}
                className={`group relative overflow-hidden rounded-[24px] border p-3 text-left transition hover:-translate-y-1 ${
                  unlocked
                    ? "border-emerald-300/20 bg-gradient-to-br from-white/[0.09] to-emerald-500/[0.04] shadow-[0_18px_45px_rgba(0,0,0,.22)]"
                    : "border-white/[0.07] bg-white/[0.025]"
                }`}
              >
                <div className="relative aspect-square overflow-hidden rounded-[20px] border border-white/[0.06] bg-black/25">
                  <img
                    src={hideSecret ? "/branding/icon.png" : badge.image}
                    alt={hideSecret ? "Badge secret" : badge.name}
                    className={`h-full w-full object-contain p-1 transition duration-500 ${
                      unlocked ? "opacity-100" : hideSecret ? "opacity-10 blur-md" : "opacity-20 grayscale"
                    }`}
                  />

                  {hideSecret ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/55">
                      <div className="text-center">
                        <LockKeyhole className="mx-auto h-6 w-6 text-white/35" />
                        <p className="mt-2 text-sm font-black tracking-[.18em] text-white/45">???</p>
                      </div>
                    </div>
                  ) : unlocked ? (
                    <div className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-emerald-300/25 bg-emerald-500/20 backdrop-blur-xl">
                      <Check className="h-4 w-4 text-emerald-200" />
                    </div>
                  ) : (
                    <div className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/45 backdrop-blur-xl">
                      <LockKeyhole className="h-3.5 w-3.5 text-white/35" />
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] ${rarityClass(badge.rarity)}`}>
                    {badge.rarity}
                  </span>

                  <p className="mt-2 min-h-9 text-sm font-black leading-[1.15] text-white/85">
                    {hideSecret ? "Badge secret" : badge.name}
                  </p>

                  <p className={`mt-1 text-[9px] font-black uppercase tracking-[.12em] ${
                    unlocked ? "text-emerald-300" : "text-white/25"
                  }`}>
                    {unlocked ? "Débloqué" : hideSecret ? "???" : "À débloquer"}
                  </p>

                  {!hideSecret && progress ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-2 text-[9px] font-black text-white/35">
                        <span className="truncate">{progress.label}</span>
                        <span className="shrink-0 text-white/55">
                          {Math.min(progress.current, progress.target)} / {progress.target}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/35">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            unlocked
                              ? "bg-emerald-400"
                              : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {unlockInfo?.unlockedAt ? (
                    <p className="mt-2 text-[9px] font-bold text-white/25">
                      Obtenu le {formatDate(unlockInfo.unlockedAt)}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </section>

        {filteredBadges.length === 0 ? (
          <div className="mt-5 rounded-[28px] border border-white/[0.07] bg-white/[0.03] p-8 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-white/20" />
            <p className="mt-3 font-black text-white/45">Aucun badge avec ces filtres.</p>
          </div>
        ) : null}
      </div>

      {celebratedBadgeId ? (() => {
        const badge = BADGES.find((item) => item.id === celebratedBadgeId);
        if (!badge) return null;

        return (
          <div className="pointer-events-none fixed inset-x-0 top-5 z-[60] flex justify-center px-4">
            <div className="animate-[badgePop_.55s_ease-out] rounded-[26px] border border-amber-300/20 bg-[#17101f]/95 p-3 pr-5 shadow-2xl shadow-fuchsia-950/40 backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 overflow-hidden rounded-[18px] border border-amber-300/20 bg-black/30">
                  <img src={badge.image} alt={badge.name} className="h-full w-full object-contain p-1" />
                  <Sparkles className="absolute right-1 top-1 h-4 w-4 text-amber-300" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.16em] text-amber-300">
                    Nouveau badge débloqué
                  </p>
                  <p className="mt-1 font-[family:var(--font-exo-2)] text-lg font-black">
                    {badge.name}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}

      {selectedBadge ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-xl"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedBadge(null);
          }}
        >
          <section className="relative w-full max-w-[520px] overflow-hidden rounded-[34px] border border-white/12 bg-[#15101f] p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setSelectedBadge(null)}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/25 text-white/45 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-black/20">
              <img
                src={selectedBadge.secret && !selectedUnlocked ? "/branding/icon.png" : selectedBadge.image}
                alt={selectedBadge.secret && !selectedUnlocked ? "Badge secret" : selectedBadge.name}
                className={`h-full w-full object-contain p-2 ${
                  selectedBadge.secret && !selectedUnlocked ? "opacity-10 blur-lg" : ""
                }`}
              />
            </div>

            <div className="mt-5 text-center">
              <span className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[.14em] ${rarityClass(selectedBadge.rarity)}`}>
                {selectedBadge.rarity}
              </span>

              <h2 className="mt-3 font-[family:var(--font-exo-2)] text-2xl font-black">
                {selectedBadge.secret && !selectedUnlocked ? "Badge secret" : selectedBadge.name}
              </h2>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/50">
                {selectedBadge.secret && !selectedUnlocked
                  ? "Condition inconnue"
                  : selectedBadge.condition}
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black text-white/40">
                  {selectedBadge.category}
                </span>
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${
                  selectedUnlocked
                    ? "border-emerald-300/15 bg-emerald-500/[0.08] text-emerald-200"
                    : "border-white/10 bg-white/[0.04] text-white/35"
                }`}>
                  {selectedUnlocked ? "Débloqué" : "À débloquer"}
                </span>
              </div>

              {!selectedBadge.secret && selectedProgress ? (
                <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/30">
                        Progression
                      </p>
                      <p className="mt-1 text-sm font-black text-white/70">
                        {selectedProgress.label}
                      </p>
                    </div>
                    <p className="font-[family:var(--font-exo-2)] text-xl font-black">
                      {Math.min(selectedProgress.current, selectedProgress.target)}
                      <span className="text-white/25"> / {selectedProgress.target}</span>
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/35">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedUnlocked
                          ? "bg-emerald-400"
                          : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400"
                      }`}
                      style={{ width: `${selectedPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-right text-[10px] font-black text-white/30">
                    {selectedPercent} %
                  </p>
                </div>
              ) : null}

              {selectedUnlocked && selectedUnlock ? (
                <div className="mt-5 rounded-2xl border border-emerald-300/10 bg-emerald-500/[0.06] p-4">
                  <p className="text-xs font-black text-emerald-200">
                    Obtenu le {formatDate(selectedUnlock.unlockedAt)}
                  </p>
                  {selectedUnlock.partyCode ? (
                    <p className="mt-1 text-[10px] font-bold text-white/35">
                      Soirée {selectedUnlock.partyCode}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
      <style jsx global>{`
        @keyframes badgePop {
          0% {
            opacity: 0;
            transform: translateY(-18px) scale(.92);
          }
          65% {
            opacity: 1;
            transform: translateY(3px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </main>
  );
}
