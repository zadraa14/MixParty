"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  Headphones,
  KeyRound,
  LayoutGrid,
  LogIn,
  Mail,
  Play,
  QrCode,
  Radio,
  RotateCcw,
  Sparkles,
  UserRound,
  UsersRound,
  Vote,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import MixPartyBackground from "../components/MixPartyBackground";
import MixPartyFooter from "../components/MixPartyFooter";
import MixPartyHeader from "../components/MixPartyHeader";
import MixPartyLoader from "../components/MixPartyLoader";
import { getApiBaseUrl } from "../lib/config";

const ACCOUNT_TOKEN_KEY = "mixparty.account.token.v1";
const NAME_KEY = "playerName";
const PHOTO_KEY = "mixparty.profile.photo.v1";

type MixPartyAccount = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
};

type OnboardingIntent = "create" | "join" | null;
type AuthMode = "register" | "login";

const STEPS = [
  { number: "01", title: "Crée", text: "Lance ta salle MixParty en quelques secondes.", icon: Sparkles, accent: "purple" },
  { number: "02", title: "Partage", text: "Tes invités rejoignent la soirée avec le QR Code.", icon: QrCode, accent: "cyan" },
  { number: "03", title: "Vote", text: "Chaque participant influence la prochaine musique.", icon: Vote, accent: "pink" },
  { number: "04", title: "Profite", text: "PartyBrain maintient l’ambiance toute la nuit.", icon: Radio, accent: "orange" },
] as const;

const STATS = [
  { label: "Temps réel", value: "Instantané", description: "Votes, file et participants synchronisés.", icon: Zap, accent: "orange" },
  { label: "Collaboratif", value: "Tout le monde", description: "Chaque invité participe à l’ambiance.", icon: UsersRound, accent: "purple" },
  { label: "PartyBrain", value: "Plus malin", description: "Des suggestions adaptées à ta soirée.", icon: Bot, accent: "cyan" },
  { label: "Accès", value: "1 QR Code", description: "Aucun compte nécessaire pour rejoindre.", icon: QrCode, accent: "pink" },
] as const;

const WAVE = [30, 52, 74, 44, 88, 58, 96, 68, 42, 82, 56, 92, 64, 38, 76, 48, 86, 60, 34, 70, 50, 90, 62, 40, 78, 54, 84, 46];

export default function Home() {
  const router = useRouter();
  const [partyCode, setPartyCode] = useState("");
  const [creatingParty, setCreatingParty] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [account, setAccount] = useState<MixPartyAccount | null>(null);
  const [lastParty, setLastParty] = useState<{
    code: string;
    role: "dj" | "guest";
  } | null>(null);
  const [onboardingIntent, setOnboardingIntent] = useState<OnboardingIntent>(null);
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [socialNotice, setSocialNotice] = useState("");

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLoaderVisible(false), 1900);
    const removeTimer = window.setTimeout(() => setShowLoader(false), 2550);

    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";
    if (token) {
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

          const data = await response.json().catch(() => ({}));
          const nextAccount = data?.account as MixPartyAccount | undefined;
          if (nextAccount?.id) setAccount(nextAccount);
        } catch (error) {
          console.error("Impossible de charger le compte MixParty", error);
        }
      })();
    }

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function detectLastParty() {
      const raw = localStorage.getItem("mixparty.lastParty.v1");
      if (!raw) return;

      try {
        const saved = JSON.parse(raw) as {
          code?: string;
          role?: "dj" | "guest";
        };

        const code = String(saved?.code || "").trim().toUpperCase();

        if (!code) {
          localStorage.removeItem("mixparty.lastParty.v1");
          return;
        }

        const response = await fetch(
          `${getApiBaseUrl()}/party/${encodeURIComponent(code)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          localStorage.removeItem("mixparty.lastParty.v1");
          if (!cancelled) setLastParty(null);
          return;
        }

        const creatorToken = localStorage.getItem(`mixparty_creator_${code}`);

        if (!cancelled) {
          setLastParty({
            code,
            role: creatorToken ? "dj" : "guest",
          });
        }
      } catch {
        localStorage.removeItem("mixparty.lastParty.v1");
      }
    }

    void detectLastParty();

    return () => {
      cancelled = true;
    };
  }, []);

  function accountAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function createPartyDirect() {
    if (creatingParty) return;
    setCreatingParty(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/party`, {
        method: "POST",
        headers: accountAuthHeaders(),
      });

      if (!response.ok) throw new Error(`Erreur API ${response.status}`);

      const party = (await response.json()) as { code?: string; creatorToken?: string };
      if (!party.code || !party.creatorToken) {
        throw new Error("La réponse de création est incomplète.");
      }

      localStorage.setItem(`mixparty_creator_${party.code}`, party.creatorToken);
      localStorage.setItem(
        "mixparty.lastParty.v1",
        JSON.stringify({
          code: party.code,
          role: "dj",
          savedAt: Date.now(),
        }),
      );
      router.push(`/party/${party.code}`);
    } catch (error) {
      console.error(error);
      window.alert("Impossible de créer la soirée. Vérifie que l’API est démarrée.");
      setCreatingParty(false);
    }
  }

  function joinPartyDirect() {
    const normalizedCode = partyCode.trim().toUpperCase();
    if (!normalizedCode) {
      window.alert("Entre un code de soirée");
      return;
    }
    router.push(`/party/${normalizedCode}`);
  }

  function createParty() {
    if (account) {
      void createPartyDirect();
      return;
    }

    setAuthMode("register");
    setEmailFormOpen(false);
    setAuthError("");
    setSocialNotice("");
    setOnboardingIntent("create");
  }

  function joinParty() {
    const normalizedCode = partyCode.trim().toUpperCase();
    if (!normalizedCode) {
      window.alert("Entre un code de soirée");
      return;
    }

    if (account) {
      joinPartyDirect();
      return;
    }

    setAuthMode("register");
    setEmailFormOpen(false);
    setAuthError("");
    setSocialNotice("");
    setOnboardingIntent("join");
  }

  function resumeLastParty() {
    if (!lastParty?.code) return;
    router.push(`/party/${lastParty.code}`);
  }

  function closeOnboarding() {
    if (authBusy) return;
    setOnboardingIntent(null);
    setEmailFormOpen(false);
    setAuthError("");
    setSocialNotice("");
  }

  function continueEphemeral() {
    const intent = onboardingIntent;
    setOnboardingIntent(null);
    setEmailFormOpen(false);
    setAuthError("");
    setSocialNotice("");

    if (intent === "create") {
      void createPartyDirect();
    } else if (intent === "join") {
      joinPartyDirect();
    }
  }

  function openEmailAuth(mode: AuthMode) {
    setAuthMode(mode);
    setEmailFormOpen(true);
    setAuthError("");
    setSocialNotice("");

    if (mode === "register") {
      setAuthName(localStorage.getItem(NAME_KEY)?.trim() || "");
    }
  }

  function socialAuthNotConfigured(provider: "Google" | "Apple") {
    setSocialNotice(
      provider === "Google"
        ? "Connexion Google préparée. On branchera le vrai OAuth Google juste après validation de cette interface."
        : "Connexion Apple prévue pour plus tard, au moment de la publication iOS.",
    );
  }

  async function submitEmailAuth() {
    setAuthError("");

    const email = authEmail.trim().toLowerCase();
    const password = authPassword;
    const name = authName.trim();

    if (!email) {
      setAuthError("Entre ton adresse e-mail.");
      return;
    }

    if (password.length < 8) {
      setAuthError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (authMode === "register" && name.length < 2) {
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
              ? {
                  email,
                  password,
                  name,
                  avatar: localStorage.getItem(PHOTO_KEY) || undefined,
                }
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
      setAuthPassword("");
      setEmailFormOpen(false);

      const intent = onboardingIntent;
      setOnboardingIntent(null);

      if (intent === "create") {
        window.setTimeout(() => void createPartyDirect(), 0);
      } else if (intent === "join") {
        window.setTimeout(() => joinPartyDirect(), 0);
      }
    } catch (error) {
      console.error(error);
      setAuthError(error instanceof Error ? error.message : "Connexion MixParty impossible.");
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <>
      {showLoader && <MixPartyLoader visible={loaderVisible} />}

      <main className="relative isolate min-h-[100dvh] overflow-hidden bg-[#070711] text-white">
        <MixPartyBackground />
        <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_18%_16%,rgba(124,58,237,.15),transparent_30%),radial-gradient(circle_at_82%_20%,rgba(236,72,153,.13),transparent_28%),radial-gradient(circle_at_72%_78%,rgba(249,115,22,.09),transparent_32%),linear-gradient(to_bottom,rgba(7,7,17,.02),rgba(7,7,17,.28))]" />

        <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-10 xl:px-14">
          <MixPartyHeader />

          <section className="grid items-center gap-8 pb-12 pt-7 sm:pb-16 sm:pt-12 lg:min-h-[760px] lg:grid-cols-[minmax(0,1.02fr)_minmax(460px,.98fr)] lg:gap-14 lg:pb-20 lg:pt-10">
            <div className="mx-auto w-full max-w-2xl text-center lg:mx-0 lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/[0.08] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-100 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl sm:text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.9)]" />
                La musique, tous ensemble
              </div>

              <h1 className="mt-6 font-[family:var(--font-exo-2)] text-[clamp(3.25rem,12vw,5.8rem)] font-black leading-[.92] tracking-[-.055em] sm:text-[clamp(4.5rem,10vw,6.8rem)] lg:text-[clamp(5rem,6.4vw,7.4rem)]">
                <span className="block text-white">La soirée appartient</span>
                <span className="block bg-gradient-to-r from-fuchsia-400 via-pink-400 to-orange-300 bg-clip-text text-transparent">
                  à tout le monde !
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-base font-medium leading-7 text-white/52 sm:text-lg sm:leading-8 lg:mx-0 lg:text-xl lg:leading-9">
                Crée ta soirée, partage le QR Code et laisse chacun ajouter ses sons et voter. MixParty garde tout le monde dans la même ambiance.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:mt-10">
                <button
                  type="button"
                  onClick={createParty}
                  disabled={creatingParty}
                  className="group relative overflow-hidden rounded-[26px] border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 p-[1px] text-left shadow-[0_22px_70px_rgba(236,72,153,.22)] transition hover:-translate-y-1 disabled:opacity-60"
                >
                  <span className="flex min-h-[112px] items-center gap-4 rounded-[25px] bg-[#120b1d]/75 px-5 py-5 backdrop-blur-xl sm:min-h-[126px]">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,.09)]">
                      {creatingParty ? <span className="mp-button-spinner" /> : <Sparkles className="h-7 w-7 text-fuchsia-200" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-lg font-black text-white sm:text-xl">
                        {creatingParty ? "Création..." : "Créer ma soirée"}
                      </strong>
                      <span className="mt-1 block text-sm font-semibold text-white/50">Deviens le DJ</span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-white/65 transition group-hover:translate-x-1" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => document.getElementById("rejoindre")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="group flex min-h-[114px] items-center gap-4 rounded-[26px] border border-violet-300/20 bg-gradient-to-br from-violet-500/22 via-purple-500/15 to-fuchsia-500/10 px-5 py-5 text-left shadow-[0_22px_70px_rgba(124,58,237,.14)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-violet-300/35 sm:min-h-[128px]"
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-400/10 text-violet-200">
                    <UsersRound className="h-7 w-7" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-lg font-black text-white sm:text-xl">Rejoindre une soirée</strong>
                    <span className="mt-1 block text-sm font-semibold text-white/50">Avec un code</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-white/50 transition group-hover:translate-x-1" />
                </button>
              </div>

              {lastParty ? (
                <button
                  type="button"
                  onClick={resumeLastParty}
                  className="mt-3 flex w-full items-center gap-3 rounded-[22px] border border-emerald-300/15 bg-emerald-400/[0.06] px-4 py-3.5 text-left backdrop-blur-xl transition hover:border-emerald-300/30 hover:bg-emerald-400/[0.09]"
                >
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-45" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.85)]" />
                  </span>
                  <RotateCcw className="h-4 w-4 shrink-0 text-emerald-200" />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-black text-white">Reprendre la soirée</strong>
                    <span className="block truncate text-xs font-semibold text-white/40">
                      {lastParty.code} • {lastParty.role === "dj" ? "Organisateur" : "Invité"}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/35" />
                </button>
              ) : null}

              <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-white/38 lg:justify-start">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />Profil éphémère possible</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />En temps réel</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />Mobile & PC</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[620px] lg:justify-self-end">
              <div className="pointer-events-none absolute inset-[12%] rounded-full bg-gradient-to-br from-fuchsia-500/25 via-purple-500/12 to-orange-400/20 blur-[70px]" />

              <div className="relative mx-auto w-full max-w-[430px] rotate-[1deg] rounded-[46px] border border-white/10 bg-[#0a0912]/95 p-2 shadow-[0_40px_120px_rgba(0,0,0,.55),0_0_80px_rgba(168,85,247,.12)] sm:p-2.5">
                <div className="overflow-hidden rounded-[39px] border border-white/[0.08] bg-gradient-to-b from-[#11101b] to-[#080811] px-5 pb-5 pt-4">
                  <div className="mx-auto h-1.5 w-20 rounded-full bg-white/10" />

                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-300">En lecture</p>
                      <p className="mt-1 text-sm font-black">MixParty Live</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.08] px-2.5 py-1.5 text-[9px] font-black text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE
                    </span>
                  </div>

                  <div className="relative mt-5 aspect-[1.05/1] overflow-hidden rounded-[30px] border border-white/[0.07] bg-[radial-gradient(circle_at_30%_28%,rgba(168,85,247,.48),transparent_28%),radial-gradient(circle_at_72%_70%,rgba(249,115,22,.38),transparent_32%),linear-gradient(145deg,#100b1d,#181025_58%,#35160d)]">
                    <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:34px_34px]" />
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="grid h-44 w-44 place-items-center rounded-full border border-white/10 bg-[radial-gradient(circle,#fff_0_3%,#f97316_4%_8%,#11111b_9%_20%,#29132f_21%_34%,#08080f_35%_100%)] shadow-[0_22px_65px_rgba(0,0,0,.55),0_0_45px_rgba(236,72,153,.24)]">
                        <div className="h-3 w-3 rounded-full bg-white" />
                      </div>
                    </div>
                    <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl">
                      <p className="text-[8px] font-black uppercase tracking-[0.19em] text-fuchsia-200/70">PartyBrain sélection</p>
                      <p className="mt-1 truncate text-base font-black">Midnight Energy</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xl font-black">Midnight Energy</p>
                    <p className="mt-1 text-xs font-semibold text-white/38">MixParty Session • 3:42</p>
                  </div>

                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full w-[54%] rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400" />
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-5">
                    <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/45" aria-label="Précédent">
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </button>
                    <button type="button" className="grid h-16 w-16 place-items-center rounded-full border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500/22 to-orange-400/16 text-white shadow-[0_0_32px_rgba(236,72,153,.24)]" aria-label="Lecture">
                      <Play className="ml-1 h-7 w-7 fill-current" />
                    </button>
                    <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/45" aria-label="Suivant">
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-3 text-center"><UsersRound className="mx-auto h-4 w-4 text-violet-300" /><strong className="mt-1 block text-sm">24</strong><span className="text-[9px] font-bold text-white/35">invités</span></div>
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-3 text-center"><Vote className="mx-auto h-4 w-4 text-pink-300" /><strong className="mt-1 block text-sm">186</strong><span className="text-[9px] font-bold text-white/35">votes</span></div>
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-3 text-center"><Headphones className="mx-auto h-4 w-4 text-orange-300" /><strong className="mt-1 block text-sm">38</strong><span className="text-[9px] font-bold text-white/35">titres</span></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="rejoindre" className="py-8 sm:py-12 lg:py-14">
            <div className="mx-auto grid max-w-6xl gap-6 rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_26px_90px_rgba(0,0,0,.24)] backdrop-blur-xl sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-9">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-300">Déjà invité ?</span>
                <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Entre dans la soirée.</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/44 sm:text-base">
                  Entre le code affiché par l’organisateur et rejoins la playlist collective.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <input
                  value={partyCode}
                  onChange={(event) => setPartyCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => event.key === "Enter" && joinParty()}
                  maxLength={8}
                  placeholder="CODE"
                  className="h-14 min-w-0 rounded-2xl border border-white/10 bg-black/30 px-5 text-center text-sm font-black uppercase tracking-[.2em] outline-none transition focus:border-fuchsia-400/50 sm:w-48"
                  aria-label="Code de la soirée"
                />
                <button
                  type="button"
                  onClick={joinParty}
                  className="group h-14 rounded-2xl border border-fuchsia-300/20 bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 text-sm font-black shadow-[0_14px_35px_rgba(236,72,153,.18)] transition hover:-translate-y-0.5"
                >
                  <span className="flex items-center justify-center gap-2">
                    Rejoindre
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section className="py-10 sm:py-16 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Pourquoi MixParty</span>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Tout comprendre en quelques secondes.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/42 sm:text-base">
                Pas de menus compliqués : chacun sait immédiatement quoi faire pendant la soirée.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4">
              {[
                { icon: Headphones, title: "Tous les sons", text: "Cherche et ajoute facilement les morceaux que tu veux.", accent: "text-fuchsia-300 bg-fuchsia-400/10" },
                { icon: UsersRound, title: "Tous ensemble", text: "Chaque invité participe et influence la playlist.", accent: "text-violet-300 bg-violet-400/10" },
                { icon: Bot, title: "PartyBrain", text: "Des suggestions adaptées à l’ambiance de la soirée.", accent: "text-cyan-300 bg-cyan-400/10" },
                { icon: LayoutGrid, title: "Badges & stats", text: "Garde ta progression avec un compte MixParty.", accent: "text-orange-300 bg-orange-400/10" },
              ].map(({ icon: Icon, title, text: description, accent }) => (
                <article key={title} className="rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,.20)] backdrop-blur-xl sm:p-6">
                  <div className={`grid h-12 w-12 place-items-center rounded-2xl ${accent}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/40">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="py-10 sm:py-16 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-300">Comment ça marche</span>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Quatre étapes. Une seule ambiance.</h2>
            </div>

            <div className="relative mt-8 grid gap-4 md:grid-cols-2 lg:mt-12 lg:grid-cols-4">
              <div className="pointer-events-none absolute left-[8%] right-[8%] top-8 hidden h-px bg-gradient-to-r from-violet-500/0 via-fuchsia-400/30 to-orange-400/0 lg:block" />
              {STEPS.map(({ number, title, text: description, icon: Icon }, index) => (
                <article key={number} className="relative rounded-[28px] border border-white/[0.08] bg-black/15 p-5 backdrop-blur-xl sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-fuchsia-300/20 bg-fuchsia-400/[0.08] text-xs font-black text-fuchsia-200">
                      {number}
                    </span>
                    <Icon className={`h-5 w-5 ${index === 0 ? "text-violet-300" : index === 1 ? "text-cyan-300" : index === 2 ? "text-pink-300" : "text-orange-300"}`} />
                  </div>
                  <h3 className="mt-5 text-xl font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/40">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="py-10 sm:py-16">
            <div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-fuchsia-300/15 bg-gradient-to-r from-violet-500/[0.10] via-fuchsia-500/[0.08] to-orange-400/[0.08] p-6 shadow-[0_22px_80px_rgba(236,72,153,.10)] sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-300">Ton MixParty, partout</span>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">Prêt à lancer la prochaine soirée ?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/44">
                  Crée un compte pour conserver tes badges, statistiques et historiques, ou continue simplement avec un profil éphémère.
                </p>
              </div>
              <button
                type="button"
                onClick={createParty}
                className="mt-5 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-6 text-sm font-black text-[#17131d] transition hover:-translate-y-0.5 lg:mt-0 lg:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                Créer ma soirée
              </button>
            </div>
          </section>

          <MixPartyFooter />
        </div>
      </main>

      {onboardingIntent ? (
        <div
          className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#05030c]/90 px-4 py-6 backdrop-blur-2xl"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeOnboarding();
          }}
        >
          <section className="relative w-full max-w-[500px] overflow-hidden rounded-[32px] border border-white/10 bg-[#100b19]/97 p-5 shadow-[0_35px_120px_rgba(0,0,0,.70)] sm:p-7">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />

            <button
              type="button"
              onClick={closeOnboarding}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/20 text-white/45 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-300">
                Compte MixParty
              </p>
              <h2 className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black">
                Garde ta progression
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/40">
                Crée ton compte pour conserver badges, statistiques et historique. Tu peux aussi continuer immédiatement sans compte permanent.
              </p>
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => socialAuthNotConfigured("Google")}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white px-4 text-sm font-black text-[#17141d] transition hover:-translate-y-0.5"
              >
                <span className="text-lg font-black text-[#4285F4]">G</span>
                Continuer avec Google
                <span className="text-[9px] font-bold text-black/40">Gmail / Android</span>
              </button>

              <button
                type="button"
                onClick={() => socialAuthNotConfigured("Apple")}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-black px-4 text-sm font-black text-white transition hover:-translate-y-0.5"
              >
                <span className="text-xl leading-none"></span>
                Continuer avec Apple
                <span className="text-[9px] font-bold text-white/30">plus tard</span>
              </button>

              <button
                type="button"
                onClick={() => openEmailAuth("register")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/20 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/12 to-orange-400/10 px-4 text-sm font-black text-fuchsia-100 transition hover:-translate-y-0.5 hover:border-fuchsia-300/35"
              >
                <Mail className="h-4 w-4" />
                Continuer avec une adresse e-mail
              </button>

              <button
                type="button"
                onClick={() => openEmailAuth("login")}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-white/55 transition hover:bg-white/[0.08]"
              >
                <LogIn className="h-4 w-4" />
                J’ai déjà un compte
              </button>
            </div>

            {socialNotice ? (
              <p className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-500/[0.06] px-4 py-3 text-xs font-bold leading-5 text-amber-100/75">
                {socialNotice}
              </p>
            ) : null}

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/22">
                ou
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={continueEphemeral}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.06] px-4 text-sm font-black text-emerald-100 transition hover:border-emerald-300/25 hover:bg-emerald-500/[0.10]"
            >
              <UsersRound className="h-4 w-4" />
              Non merci — continuer en profil éphémère
            </button>
          </section>
        </div>
      ) : null}

      {emailFormOpen ? (
        <div
          className="fixed inset-0 z-[10000] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#05030c]/94 px-4 py-6 backdrop-blur-2xl"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !authBusy) setEmailFormOpen(false);
          }}
        >
          <section className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/10 bg-[#100b19]/98 p-5 shadow-[0_35px_120px_rgba(0,0,0,.70)] sm:p-7">
            <button
              type="button"
              onClick={() => !authBusy && setEmailFormOpen(false)}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/20 text-white/45 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-300">
                Compte MixParty
              </p>
              <h2 className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black">
                {authMode === "register" ? "Créer mon compte" : "Me connecter"}
              </h2>
            </div>

            <div className="mt-6 space-y-4">
              {authMode === "register" ? (
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Pseudo</span>
                  <div className="relative mt-2">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                    <input
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      maxLength={24}
                      autoComplete="nickname"
                      placeholder="Ton pseudo"
                      className="h-14 w-full rounded-2xl border border-white/10 bg-black/25 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-fuchsia-300/35"
                    />
                  </div>
                </label>
              ) : null}

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Adresse e-mail</span>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                  <input
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="toi@email.fr"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/25 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-fuchsia-300/35"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Mot de passe</span>
                <div className="relative mt-2">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    onKeyDown={(event) => event.key === "Enter" && void submitEmailAuth()}
                    placeholder="8 caractères minimum"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/25 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-fuchsia-300/35"
                  />
                </div>
              </label>
            </div>

            {authError ? (
              <p className="mt-4 rounded-2xl border border-red-300/15 bg-red-500/[0.07] px-4 py-3 text-xs font-bold leading-5 text-red-100">
                {authError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void submitEmailAuth()}
              disabled={authBusy}
              className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/20 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {authBusy ? <span className="mp-button-spinner" /> : authMode === "register" ? <Mail className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {authBusy ? "Connexion…" : authMode === "register" ? "Créer mon compte" : "Me connecter"}
            </button>

            <button
              type="button"
              onClick={() => openEmailAuth(authMode === "register" ? "login" : "register")}
              disabled={authBusy}
              className="mt-3 w-full text-center text-xs font-bold text-white/35 transition hover:text-white/60"
            >
              {authMode === "register" ? "J’ai déjà un compte" : "Je veux créer un compte"}
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
