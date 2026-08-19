"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  Headphones,
  Home as HomeIcon,
  Info,
  KeyRound,
  LayoutGrid,
  ListMusic,
  LogIn,
  Menu,
  MessageCircle,
  Mail,
  Music2,
  Play,
  QrCode,
  Radio,
  RotateCcw,
  Sparkles,
  Star,
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

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";

type GoogleCredentialResponse = {
  credential?: string;
};


const DEMO_TRACKS = [
  {
    title: "Electric Bloom",
    artist: "Aurora Static",
    duration: "04:21",
    cover: "/demo-covers/electric-bloom.png",
  },
  {
    title: "Midnight Energy",
    artist: "Nova Pulse",
    duration: "03:42",
    cover: "/demo-covers/midnight-energy.png",
  },
  {
    title: "Afterglow Drive",
    artist: "Echo District",
    duration: "03:56",
    cover: "/demo-covers/afterglow-drive.png",
  },
  {
    title: "Neon Mirage",
    artist: "Velvet Circuit",
    duration: "03:28",
    cover: "/demo-covers/neon-mirage.png",
  },
] as const;


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
  const [mobileJoinOpen, setMobileJoinOpen] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleInitializedRef = useRef(false);
  const onboardingIntentRef = useRef<OnboardingIntent>(null);
  const [demoVotes, setDemoVotes] = useState(186);
  const [demoGuests, setDemoGuests] = useState(24);
  const [demoTrackIndex, setDemoTrackIndex] = useState(0);
  const demoTrack = DEMO_TRACKS[demoTrackIndex];

  useEffect(() => {
    onboardingIntentRef.current = onboardingIntent;
  }, [onboardingIntent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    const hidden: Array<{ element: HTMLElement; display: string }> = [];

    const hideInstallCta = () => {
      document.querySelectorAll<HTMLElement>("button, a").forEach((element) => {
        const label = (element.textContent || "").trim().toLowerCase();
        if (
          label.includes("installer l’app") ||
          label.includes("installer l'app")
        ) {
          if (!hidden.some((item) => item.element === element)) {
            hidden.push({
              element,
              display: element.style.display,
            });
          }
          element.style.display = "none";
        }
      });
    };

    hideInstallCta();
    const observer = new MutationObserver(hideInstallCta);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      hidden.forEach(({ element, display }) => {
        element.style.display = display;
      });
    };
  }, []);

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

  useEffect(() => {
    const voteTimer = window.setInterval(() => {
      setDemoVotes((value) => (value >= 193 ? 186 : value + 1));
    }, 4200);

    const guestTimer = window.setInterval(() => {
      setDemoGuests((value) => (value >= 27 ? 24 : value + 1));
    }, 9700);

    const trackTimer = window.setInterval(() => {
      setDemoTrackIndex((index) => (index + 1) % DEMO_TRACKS.length);
      setDemoVotes(186);
    }, 18000);

    return () => {
      window.clearInterval(voteTimer);
      window.clearInterval(guestTimer);
      window.clearInterval(trackTimer);
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

  async function finishAccountAuthentication(
    nextAccount: MixPartyAccount,
    token: string,
  ) {
    localStorage.setItem(ACCOUNT_TOKEN_KEY, token);
    localStorage.setItem(NAME_KEY, nextAccount.name);

    if (nextAccount.avatar) {
      localStorage.setItem(PHOTO_KEY, nextAccount.avatar);
    }

    setAccount(nextAccount);
    setAuthPassword("");
    setEmailFormOpen(false);
    setSocialNotice("");

    const intent = onboardingIntentRef.current;
    setOnboardingIntent(null);

    if (intent === "create") {
      window.setTimeout(() => void createPartyDirect(), 0);
    } else if (intent === "join") {
      window.setTimeout(() => joinPartyDirect(), 0);
    }
  }

  async function handleGoogleCredential(response: GoogleCredentialResponse) {
    const credential = String(response?.credential || "").trim();
    if (!credential) {
      setSocialNotice("Google n’a pas renvoyé d’identifiant. Réessaie.");
      return;
    }

    setAuthBusy(true);
    setSocialNotice("");

    try {
      const apiResponse = await fetch(`${getApiBaseUrl()}/account/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      const data = await apiResponse.json().catch(() => ({}));

      if (!apiResponse.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Connexion avec Google impossible.",
        );
      }

      const nextAccount = data?.account as MixPartyAccount | undefined;
      const token = String(data?.token || "");

      if (!nextAccount?.id || !token) {
        throw new Error("Réponse du compte Google incomplète.");
      }

      await finishAccountAuthentication(nextAccount, token);
    } catch (error) {
      console.error("Google Sign-In MixParty:", error);
      setSocialNotice(
        error instanceof Error
          ? error.message
          : "Connexion avec Google impossible.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  function renderGoogleButton() {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    const googleApi = (window as any).google?.accounts?.id;
    if (!googleApi) return;

    if (!googleInitializedRef.current) {
      googleApi.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      googleInitializedRef.current = true;
    }

    googleButtonRef.current.innerHTML = "";

    googleApi.renderButton(googleButtonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "left",
      locale: "fr",
      width: Math.min(400, Math.max(280, googleButtonRef.current.clientWidth || 400)),
    });

    setGoogleReady(true);
  }

  function loadGoogleIdentityServices() {
    if (!GOOGLE_CLIENT_ID) {
      setSocialNotice(
        "Ajoute NEXT_PUBLIC_GOOGLE_CLIENT_ID dans les variables du Web pour activer Google.",
      );
      return;
    }

    if ((window as any).google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mixparty-google="1"]',
    );

    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client?hl=fr";
    script.async = true;
    script.defer = true;
    script.dataset.mixpartyGoogle = "1";
    script.onload = () => renderGoogleButton();
    script.onerror = () =>
      setSocialNotice("Impossible de charger la connexion Google.");
    document.head.appendChild(script);
  }

  function socialAuthNotConfigured(provider: "Apple") {
    setSocialNotice(
      "Connexion Apple prévue pour plus tard, au moment de la publication iOS.",
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

      await finishAccountAuthentication(nextAccount, token);
    } catch (error) {
      console.error(error);
      setAuthError(error instanceof Error ? error.message : "Connexion MixParty impossible.");
    } finally {
      setAuthBusy(false);
    }
  }

  useEffect(() => {
    if (!onboardingIntent) return;

    const timer = window.setTimeout(() => {
      loadGoogleIdentityServices();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [onboardingIntent]);

  return (
    <>
      {showLoader && <MixPartyLoader visible={loaderVisible} />}

      <main className="relative isolate min-h-[100dvh] overflow-hidden bg-[#070711] text-white">
        <MixPartyBackground />
        <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_18%_16%,rgba(124,58,237,.15),transparent_30%),radial-gradient(circle_at_82%_20%,rgba(236,72,153,.13),transparent_28%),radial-gradient(circle_at_72%_78%,rgba(249,115,22,.09),transparent_32%),linear-gradient(to_bottom,rgba(7,7,17,.02),rgba(7,7,17,.28))]" />


        {/* =========================================================
            MOBILE HOMEPAGE V9 — maquette validée
            Texte haut gauche + faux téléphone haut droite
            2 CTA / reprendre / 4 avantages / navigation
            Statique, premium, lisible.
           ========================================================= */}
        <div className="relative z-10 mx-auto min-h-[100dvh] w-full max-w-[520px] overflow-x-hidden px-3 pb-[max(.55rem,env(safe-area-inset-bottom))] pt-[max(.5rem,env(safe-area-inset-top))] lg:hidden">
          {/* HEADER */}
          <header className="flex h-[52px] items-center justify-between rounded-[19px] border border-white/[0.08] bg-[#080710]/95 px-3 shadow-[0_12px_30px_rgba(0,0,0,.26)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <img
                src="/branding/icon.png"
                alt="MixParty"
                className="h-8 w-8 object-contain"
              />
              <span className="font-[family:var(--font-exo-2)] text-[1.32rem] font-black tracking-[-.035em]">
                Mix<span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-orange-300 bg-clip-text text-transparent">Party</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {account ? (
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-fuchsia-300/15 bg-fuchsia-500/10 text-[10px] font-black"
                  aria-label="Mon profil"
                >
                  {account.avatar ? (
                    <img src={account.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    account.name.slice(0, 1).toUpperCase()
                  )}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-500/[0.05] px-2.5 py-1.5 text-[7px] font-black uppercase tracking-[.1em] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live
                </span>
              )}

              <button
                type="button"
                onClick={() => router.push(account ? "/profile" : "/")}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/68"
                aria-label="Menu"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* HERO — texte gauche / faux téléphone droite */}
          <section className="mt-3 grid grid-cols-[.92fr_1.08fr] items-start gap-2">
            <div className="min-w-0 pt-4">
              <span className="inline-flex rounded-[11px] border border-white/10 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 px-2.5 py-1.5 text-[6px] font-black uppercase tracking-[.04em] text-white shadow-[0_8px_20px_rgba(236,72,153,.16)]">
                La musique, tous ensemble
              </span>

              <h1 className="mt-4 font-[family:var(--font-exo-2)] text-[clamp(1.9rem,8.7vw,2.9rem)] font-black leading-[.91] tracking-[-.055em]">
                <span className="block text-white">La soirée</span>
                <span className="block text-white">appartient</span>
                <span className="block bg-gradient-to-r from-fuchsia-400 via-pink-400 to-orange-300 bg-clip-text text-transparent">
                  à tout le
                </span>
                <span className="block bg-gradient-to-r from-fuchsia-400 via-pink-400 to-orange-300 bg-clip-text text-transparent">
                  monde !
                </span>
              </h1>

              <p className="mt-4 max-w-[170px] text-[8.8px] font-medium leading-[1.5] text-white/45">
                Ajoute tes sons, vote avec tes amis et crée l’ambiance ensemble.
              </p>

              <div className="mt-4 inline-flex items-center gap-1.5 text-[8px] font-black text-fuchsia-300">
                <Radio className="h-3 w-3" />
                100% participatif
              </div>
            </div>

            {/* Faux téléphone premium */}
            <div className="relative mx-auto w-full max-w-[180px]">
              <div className="pointer-events-none absolute -inset-3 rounded-[34px] bg-[radial-gradient(circle_at_50%_20%,rgba(236,72,153,.18),transparent_48%),radial-gradient(circle_at_50%_90%,rgba(249,115,22,.08),transparent_48%)] blur-2xl" />
              <div className="relative rounded-[30px] border border-fuchsia-300/22 bg-gradient-to-b from-[#1b1024] via-[#08070d] to-[#040408] p-[2px] shadow-[0_18px_46px_rgba(0,0,0,.48),0_0_24px_rgba(236,72,153,.08)]">
                <div className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#05050a] px-2 pb-2.5 pt-5">
                  <div className="absolute left-1/2 top-1.5 h-2.5 w-12 -translate-x-1/2 rounded-full bg-black/70" />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[6.4px] font-black text-white/92">MixParty Live</p>
                      <p className="text-[4.3px] font-black uppercase tracking-[.12em] text-fuchsia-400">En lecture</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[4.8px] font-black text-white/55">
                      <UsersRound className="h-2.5 w-2.5" />
                      {demoGuests}
                    </span>
                  </div>

                  <div className="relative mt-2 overflow-hidden rounded-[13px] border border-white/[0.07]">
                    <img src={demoTrack.cover} alt="" className="aspect-square w-full object-cover" />
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/55 text-white">
                        <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-2 truncate font-[family:var(--font-exo-2)] text-[9px] font-black">
                    {demoTrack.title}
                  </h3>
                  <p className="truncate text-[5.6px] font-bold text-fuchsia-300/70">
                    {demoTrack.artist}
                  </p>

                  <div className="mt-2 h-[3px] rounded-full bg-white/[0.07]">
                    <div className="h-full w-[48%] rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400" />
                  </div>
                  <div className="mt-1 flex justify-between text-[4.6px] font-bold text-white/25">
                    <span>1:28</span>
                    <span>{demoTrack.duration}</span>
                  </div>

                  <div className="mt-2 grid grid-cols-[1fr_34px_1fr] items-center gap-1.5">
                    <div className="grid h-8 place-items-center rounded-[9px] border border-white/[0.07] bg-white/[0.025] text-[4.8px] font-black text-white/45">
                      ♡
                    </div>
                    <div className="grid h-8 w-8 place-items-center rounded-full border border-fuchsia-300/35 bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white shadow-[0_0_16px_rgba(236,72,153,.18)]">
                      <Play className="ml-0.5 h-3 w-3 fill-current" />
                    </div>
                    <div className="grid h-8 place-items-center rounded-[9px] border border-white/[0.07] bg-white/[0.025] text-[4.8px] font-black text-white/45">
                      ▶|
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-[10px] border border-white/[0.06] bg-white/[0.02]">
                    <div className="grid h-8 place-items-center border-r border-white/[0.05] text-center">
                      <strong className="text-[6px] text-fuchsia-200">{demoVotes}</strong>
                      <span className="text-[4px] font-bold text-white/28">votes</span>
                    </div>
                    <div className="grid h-8 place-items-center text-center">
                      <strong className="text-[6px] text-cyan-200">38</strong>
                      <span className="text-[4px] font-bold text-white/28">en file</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2 CTA */}
          <section className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={createParty}
              disabled={creatingParty}
              className="flex h-[72px] items-center gap-2 rounded-[19px] border border-pink-300/25 bg-gradient-to-br from-fuchsia-600 via-pink-500 to-orange-400 px-3 text-left shadow-[0_12px_30px_rgba(236,72,153,.16)] disabled:opacity-60"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25 text-white">
                <span className="relative block h-5 w-5">
                  <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-current" />
                  <span className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 rounded-full bg-current" />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[10px] font-black leading-4">
                  {creatingParty ? "Création…" : "Créer ma soirée"}
                </strong>
                <span className="block text-[7px] font-semibold text-white/65">Deviens le DJ</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/75" />
            </button>

            <button
              type="button"
              onClick={() => setMobileJoinOpen(true)}
              className="flex h-[72px] items-center gap-2 rounded-[19px] border border-violet-300/22 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 px-3 text-left shadow-[0_12px_30px_rgba(109,40,217,.15)]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/20 text-violet-100">
                <UsersRound className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[10px] font-black leading-4">Rejoindre une soirée</strong>
                <span className="block text-[7px] font-semibold text-white/60">Avec un code</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/70" />
            </button>
          </section>

          {/* REPRENDRE */}
          {lastParty ? (
            <button
              type="button"
              onClick={resumeLastParty}
              className="mt-3 flex h-[58px] w-full items-center gap-3 rounded-[18px] border border-cyan-300/15 bg-[linear-gradient(120deg,rgba(13,20,31,.92),rgba(15,17,32,.92),rgba(5,45,55,.62))] px-3 text-left shadow-[0_12px_26px_rgba(0,0,0,.18)]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-emerald-300/20 bg-emerald-500/10 text-emerald-300">
                <RotateCcw className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[9.5px] font-black">Reprendre ma soirée</strong>
                <span className="mt-0.5 block truncate text-[6.8px] text-white/35">
                  {lastParty.code} · {lastParty.role === "dj" ? "Organisateur" : "Invité"}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-cyan-200/60" />
            </button>
          ) : (
            <div className="mt-3 flex h-[58px] items-center gap-3 rounded-[18px] border border-cyan-300/10 bg-[linear-gradient(120deg,rgba(13,20,31,.86),rgba(15,17,32,.88),rgba(5,45,55,.52))] px-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-emerald-300/18 bg-emerald-500/10 text-emerald-300">
                <RotateCcw className="h-4 w-4" />
              </span>
              <div>
                <strong className="block text-[9.5px] font-black text-white/80">Reprendre ma soirée</strong>
                <span className="text-[6.8px] text-white/30">Ta dernière soirée apparaîtra ici</span>
              </div>
            </div>
          )}

          {/* 4 avantages */}
          <section className="mt-3 grid grid-cols-4 gap-1.5">
            {[
              {
                Icon: Music2,
                title: "Musique illimitée",
                text: "Tous tes sons",
                card: "border-pink-300/20 bg-gradient-to-b from-pink-500/[0.14] to-pink-950/[0.16]",
                icon: "text-pink-300",
              },
              {
                Icon: UsersRound,
                title: "Tous ensemble",
                text: "Votez ensemble",
                card: "border-violet-300/20 bg-gradient-to-b from-violet-500/[0.14] to-violet-950/[0.16]",
                icon: "text-violet-300",
              },
              {
                Icon: Star,
                title: "Badges & stats",
                text: "Progresse",
                card: "border-orange-300/20 bg-gradient-to-b from-orange-500/[0.14] to-orange-950/[0.16]",
                icon: "text-orange-300",
              },
              {
                Icon: Bot,
                title: "PartyBrain",
                text: "Plus malin",
                card: "border-cyan-300/20 bg-gradient-to-b from-cyan-500/[0.12] to-cyan-950/[0.16]",
                icon: "text-cyan-300",
              },
            ].map(({ Icon, title, text: featureText, card, icon }) => (
              <article
                key={title}
                className={`min-w-0 rounded-[17px] border p-2.5 text-center ${card}`}
              >
                <Icon className={`mx-auto h-5 w-5 ${icon}`} />
                <h2 className="mt-2 text-[7px] font-black leading-[1.15] text-white/88">
                  {title}
                </h2>
                <p className="mt-1 text-[5.3px] leading-[1.25] text-white/32">
                  {featureText}
                </p>
              </article>
            ))}
          </section>

          {/* NAV */}
          <nav className="mt-3 grid h-[48px] grid-cols-4 rounded-[17px] border border-white/[0.08] bg-[#080710]/95 p-1">
            {[
              { label: "Accueil", Icon: HomeIcon, action: () => {} },
              { label: "Créer", Icon: Sparkles, action: () => void createParty() },
              { label: "Rejoindre", Icon: UsersRound, action: () => setMobileJoinOpen(true) },
              { label: "Profil", Icon: UserRound, action: () => router.push(account ? "/profile" : "/") },
            ].map(({ label, Icon, action }, index) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-[13px] text-[6.4px] font-black ${
                  index === 0
                    ? "border border-fuchsia-300/20 bg-fuchsia-500/[0.08] text-fuchsia-200"
                    : "text-white/38"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </nav>

          {/* MODAL REJOINDRE */}
          {mobileJoinOpen ? (
            <div className="fixed inset-0 z-[10050] grid place-items-center bg-[#05030b]/92 px-4">
              <div className="w-full max-w-[350px] rounded-[24px] border border-white/10 bg-[#0b0913]/98 p-5 shadow-[0_24px_70px_rgba(0,0,0,.56)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[.16em] text-fuchsia-300">
                      Code soirée
                    </p>
                    <h2 className="mt-1 font-[family:var(--font-exo-2)] text-lg font-black">
                      Rejoindre MixParty
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileJoinOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <input
                  value={partyCode}
                  onChange={(event) => setPartyCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => event.key === "Enter" && joinParty()}
                  maxLength={8}
                  autoFocus
                  placeholder="CODE"
                  className="mt-4 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-center text-sm font-black uppercase tracking-[.2em] outline-none focus:border-fuchsia-400/45"
                />

                <button
                  type="button"
                  onClick={joinParty}
                  className="mt-3 h-11 w-full rounded-2xl border border-fuchsia-300/20 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 text-xs font-black"
                >
                  Rejoindre la soirée
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative z-10 mx-auto hidden w-full max-w-[1440px] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] sm:px-6 lg:block lg:px-10 xl:px-14">
          <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-full opacity-[0.055] lg:block [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:48px_48px]" />
          <MixPartyHeader />

          <section className="grid items-center gap-8 pb-12 pt-7 sm:pb-16 sm:pt-12 lg:min-h-[760px] lg:grid-cols-[minmax(0,.95fr)_minmax(560px,1.05fr)] lg:gap-10 lg:pb-20 lg:pt-10">
            <div className="relative mx-auto w-full max-w-2xl text-center lg:mx-0 lg:text-left">
              <div className="pointer-events-none absolute -left-10 top-8 hidden h-56 w-56 rounded-full bg-violet-500/10 blur-3xl lg:block" />
              <div className="pointer-events-none absolute -right-12 bottom-8 hidden h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl lg:block" />
              <div className="relative">
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
                  className="mixparty-hero-cta mixparty-hero-cta--create group relative overflow-hidden rounded-[28px] p-[1px] text-left transition duration-300 hover:-translate-y-1 disabled:opacity-60"
                >
                  <span className="mixparty-hero-cta__inner flex min-h-[112px] items-center gap-4 rounded-[27px] px-5 py-5 backdrop-blur-xl sm:min-h-[126px]">
                    <span className="mixparty-hero-cta__icon mixparty-hero-cta__icon--create grid h-14 w-14 shrink-0 place-items-center rounded-2xl">
                      {creatingParty ? <span className="mp-button-spinner" /> : <Sparkles className="h-7 w-7 text-fuchsia-200" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-lg font-black text-white sm:text-xl">
                        {creatingParty ? "Création..." : "Créer ma soirée"}
                      </strong>
                      <span className="mt-1 block text-sm font-semibold text-white/50">Deviens le DJ</span>
                    </span>
                    <span className="mixparty-hero-cta__arrow grid h-9 w-9 shrink-0 place-items-center rounded-full">
                      <ArrowRight className="h-4 w-4 text-white/75 transition group-hover:translate-x-1" />
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => document.getElementById("rejoindre")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="mixparty-hero-cta mixparty-hero-cta--join group flex min-h-[114px] items-center gap-4 rounded-[28px] px-5 py-5 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 sm:min-h-[128px]"
                >
                  <span className="mixparty-hero-cta__icon mixparty-hero-cta__icon--join grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-violet-100">
                    <UsersRound className="h-7 w-7" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-lg font-black text-white sm:text-xl">Rejoindre une soirée</strong>
                    <span className="mt-1 block text-sm font-semibold text-white/50">Avec un code</span>
                  </span>
                  <span className="mixparty-hero-cta__arrow grid h-9 w-9 shrink-0 place-items-center rounded-full">
                    <ArrowRight className="h-4 w-4 text-white/70 transition group-hover:translate-x-1" />
                  </span>
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
            </div>

            <div className="relative mx-auto w-full max-w-[760px] lg:justify-self-end">
              {/* Desktop ambient halo */}
              <div className="pointer-events-none absolute -inset-14 hidden rounded-[52px] bg-[radial-gradient(circle_at_26%_18%,rgba(168,85,247,.34),transparent_30%),radial-gradient(circle_at_84%_22%,rgba(236,72,153,.28),transparent_28%),radial-gradient(circle_at_78%_82%,rgba(249,115,22,.24),transparent_32%)] blur-3xl lg:block" />
              <div className="mixparty-corner-glow mixparty-corner-glow--tl pointer-events-none absolute hidden lg:block" />
              <div className="mixparty-corner-glow mixparty-corner-glow--tr pointer-events-none absolute hidden lg:block" />
              <div className="mixparty-corner-glow mixparty-corner-glow--br pointer-events-none absolute hidden lg:block" />
              <div className="pointer-events-none absolute -inset-x-16 top-1/2 hidden h-px bg-gradient-to-r from-transparent via-fuchsia-400/30 to-transparent lg:block" />

              <div className="mixparty-premium-console group relative overflow-hidden rounded-[40px] p-[1px] lg:transition lg:duration-500 lg:hover:-translate-y-1">
                <div className="mixparty-top-neon pointer-events-none absolute left-5 right-[28%] top-0 h-[2px] rounded-full bg-gradient-to-r from-fuchsia-300 via-pink-300 to-transparent" />
                <div className="mixparty-edge-glow pointer-events-none absolute inset-0 rounded-[38px] border border-transparent" />
                <div className="mixparty-console-breath pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-violet-500/18 blur-3xl" />
                <div className="mixparty-console-breath pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full bg-fuchsia-500/18 blur-3xl" />
                <div className="mixparty-console-breath pointer-events-none absolute -bottom-24 right-12 h-64 w-64 rounded-full bg-orange-400/14 blur-3xl" />

                {/* subtle animated sheen on desktop */}
                <div className="pointer-events-none absolute inset-0 hidden overflow-hidden rounded-[36px] lg:block">
                  <div className="absolute -left-[45%] top-0 h-full w-[35%] rotate-12 bg-gradient-to-r from-transparent via-white/[0.045] to-transparent blur-xl transition-transform duration-[1400ms] ease-out group-hover:translate-x-[430%]" />
                </div>

                <div className="mixparty-premium-console-inner relative rounded-[39px] p-4 backdrop-blur-2xl sm:p-5 lg:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-pink-300/20 bg-gradient-to-r from-fuchsia-500/20 to-pink-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-pink-100 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_22px_rgba(236,72,153,.08)]">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-45" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_14px_rgba(244,114,182,.95)]" />
                        </span>
                        Live
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-[family:var(--font-exo-2)] text-sm font-black tracking-[-0.01em] text-white">MixParty Live</p>
                        <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/28">Soirée de Ben</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3.5 py-2.5 text-right shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/24">Code soirée</p>
                      <p className="mt-0.5 text-xs font-black tracking-[0.18em] text-white/78">6XP7Q</p>
                    </div>
                  </div>

                  <div className="mixparty-now-card mt-4 overflow-hidden rounded-[30px] p-4 sm:p-5 lg:p-6">
                    <div className="grid gap-5 sm:grid-cols-[235px_minmax(0,1fr)] lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-8">
                      <div className="mixparty-cover-frame relative aspect-square overflow-hidden rounded-[28px] bg-[#0b0914]">
                        <img
                          key={demoTrack.cover}
                          src={demoTrack.cover}
                          alt={`Jaquette fictive ${demoTrack.title}`}
                          className="mixparty-demo-cover h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,.035),transparent_24%,transparent_56%,rgba(4,3,10,.16)_70%,rgba(4,3,10,.72)_100%)]" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.045] to-transparent opacity-70" />
                      </div>

                      <div className="min-w-0 sm:flex sm:flex-col sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="h-px w-5 bg-gradient-to-r from-fuchsia-400 to-transparent" />
                            <p className="text-[9px] font-black uppercase tracking-[0.20em] text-fuchsia-300">En lecture</p>
                          </div>
                          <h3 className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black leading-tight tracking-[-0.035em] text-white sm:text-[2rem] lg:text-[2.15rem]">
                            {demoTrack.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white/42">{demoTrack.artist}</p>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[8px] font-black uppercase tracking-[0.10em] text-white/30">
                              <span className="grid h-4 w-5 place-items-center rounded bg-red-500 text-[7px] text-white">▶</span>
                              YouTube
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 rounded-[20px] border border-fuchsia-300/[0.08] bg-[linear-gradient(145deg,rgba(236,72,153,.045),rgba(255,255,255,.018))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.035),0_12px_32px_rgba(0,0,0,.15)]">
                          <div className="flex items-end justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-400/10 text-lg shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">🔥</span>
                              <div>
                                <strong className="mixparty-live-number block text-lg font-black text-white">{demoVotes}</strong>
                                <span className="text-[9px] font-bold uppercase tracking-[0.10em] text-white/28">votes live</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold tabular-nums text-white/32">02:41 / {demoTrack.duration}</span>
                          </div>

                          <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-white/[0.07] shadow-inner">
                            <div key={demoTrackIndex} className="mixparty-demo-progress relative h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400 shadow-[0_0_20px_rgba(236,72,153,.42)]">
                              <span className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-white/75 bg-white shadow-[0_0_16px_rgba(255,255,255,.62),0_0_20px_rgba(236,72,153,.42)]" />
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[9px] font-black tabular-nums text-white/24">
                            <span>02:41</span>
                            <span>{demoTrack.duration}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mixparty-stats-panel mt-3 grid grid-cols-3 overflow-hidden rounded-[26px]">
                    <div className="group/stat px-3 py-4 text-center transition lg:hover:bg-violet-400/[0.035] sm:px-4">
                      <UsersRound className="mx-auto h-5 w-5 text-violet-300 drop-shadow-[0_0_10px_rgba(196,181,253,.25)]" />
                      <strong className="mixparty-live-number mt-2 block font-[family:var(--font-exo-2)] text-xl font-black">{demoGuests}</strong>
                      <span className="mt-0.5 block text-[9px] font-black uppercase tracking-[0.10em] text-white/28">Invités</span>
                    </div>
                    <div className="group/stat border-x border-white/[0.07] px-3 py-4 text-center transition lg:hover:bg-pink-400/[0.035] sm:px-4">
                      <Vote className="mx-auto h-5 w-5 text-pink-300 drop-shadow-[0_0_10px_rgba(249,168,212,.25)]" />
                      <strong className="mixparty-live-number mt-2 block font-[family:var(--font-exo-2)] text-xl font-black">{demoVotes}</strong>
                      <span className="mt-0.5 block text-[9px] font-black uppercase tracking-[0.10em] text-white/28">Votes</span>
                    </div>
                    <div className="group/stat px-3 py-4 text-center transition lg:hover:bg-orange-400/[0.035] sm:px-4">
                      <Headphones className="mx-auto h-5 w-5 text-orange-300 drop-shadow-[0_0_10px_rgba(253,186,116,.25)]" />
                      <strong className="mt-2 block font-[family:var(--font-exo-2)] text-xl font-black">38</strong>
                      <span className="mt-0.5 block text-[9px] font-black uppercase tracking-[0.10em] text-white/28">Titres en file</span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button type="button" className="mixparty-action-card mixparty-action-card--pink group/action relative min-h-[88px] overflow-hidden rounded-[22px] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition duration-300 lg:hover:-translate-y-1 lg:hover:border-pink-300/32 lg:hover:shadow-[0_14px_35px_rgba(236,72,153,.10)]">
                      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-300/60 to-transparent opacity-0 transition group-hover/action:opacity-100" />
                      <span className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-pink-300/10 bg-pink-400/10 text-pink-200">
                          <Vote className="h-5 w-5" />
                        </span>
                        <span>
                          <strong className="block text-sm font-black">Voter</strong>
                          <span className="mt-0.5 block text-[9px] font-semibold text-white/30">Pour ce titre</span>
                        </span>
                      </span>
                    </button>

                    <button type="button" className="mixparty-action-card mixparty-action-card--violet group/action relative min-h-[88px] overflow-hidden rounded-[22px] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition duration-300 lg:hover:-translate-y-1 lg:hover:border-violet-300/32 lg:hover:bg-violet-400/[0.07] lg:hover:shadow-[0_14px_35px_rgba(139,92,246,.10)]">
                      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent opacity-0 transition group-hover/action:opacity-100" />
                      <span className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-300/10 bg-violet-400/10 text-violet-200">
                          <ListMusic className="h-5 w-5" />
                        </span>
                        <span>
                          <strong className="block text-sm font-black">Voir la file</strong>
                          <span className="mt-0.5 block text-[9px] font-semibold text-white/30">Prochains titres</span>
                        </span>
                      </span>
                    </button>

                    <button type="button" className="mixparty-action-card mixparty-action-card--orange group/action relative min-h-[88px] overflow-hidden rounded-[22px] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition duration-300 lg:hover:-translate-y-1 lg:hover:border-orange-300/32 lg:hover:bg-orange-400/[0.07] lg:hover:shadow-[0_14px_35px_rgba(249,115,22,.10)]">
                      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/60 to-transparent opacity-0 transition group-hover/action:opacity-100" />
                      <span className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-orange-300/10 bg-orange-400/10 text-orange-200">
                          <UsersRound className="h-5 w-5" />
                        </span>
                        <span>
                          <strong className="block text-sm font-black">Participants</strong>
                          <span className="mt-0.5 block text-[9px] font-semibold text-white/30">Voir les invités</span>
                        </span>
                      </span>
                    </button>
                  </div>

                  <div className="mixparty-queue-panel mt-3 rounded-[26px] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="h-px w-4 bg-fuchsia-400/70" />
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-fuchsia-300">Dans la file</p>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-[0.10em] text-white/24">Voir toute la file →</span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {[
                        ["2", "Midnight Energy", "Nova Pulse", "/demo-covers/midnight-energy.png"],
                        ["3", "Afterglow Drive", "Echo District", "/demo-covers/afterglow-drive.png"],
                        ["4", "Neon Mirage", "Velvet Circuit", "/demo-covers/neon-mirage.png"],
                      ].map(([rank, title, artist, cover]) => (
                        <div key={`${rank}-${title}`} className="group/song flex min-w-0 items-center gap-2 rounded-[17px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,.028),rgba(255,255,255,.012))] p-2 transition duration-300 lg:hover:-translate-y-0.5 lg:hover:border-fuchsia-300/[0.16] lg:hover:bg-white/[0.045] lg:hover:shadow-[0_10px_28px_rgba(0,0,0,.18)]">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-black/20 shadow-[0_8px_22px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.04)]">
                            <img src={cover} alt="" className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-white">{title}</p>
                            <p className="mt-0.5 truncate text-[9px] font-semibold text-white/28">{artist}</p>
                          </div>
                          <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-1.5 py-1 text-[9px] font-black text-white/25">#{rank}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop depth / reflection */}
              <div className="pointer-events-none mx-auto mt-5 hidden h-8 w-[86%] rounded-[50%] bg-fuchsia-500/10 blur-2xl lg:block" />
            </div>
          </section>

          <div className="mx-auto hidden h-px w-[92%] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent lg:block" />
          <section id="rejoindre" className="py-8 sm:py-12 lg:py-14">
            <div className="group relative mx-auto grid max-w-6xl gap-6 overflow-hidden rounded-[34px] border border-white/[0.10] bg-[linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.022))] p-5 shadow-[0_30px_100px_rgba(0,0,0,.30),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-2xl sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-9">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/65 to-transparent" />
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
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

          <div className="mx-auto hidden max-w-5xl items-center gap-3 py-3 lg:flex">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-400/15 to-fuchsia-400/30" />
            <div className="mixparty-wave-line flex items-end gap-1" aria-hidden="true">
              {[10,18,12,24,16,28,14,22,11,20,13,26,17,23,12,18].map((height, index) => (
                <span key={index} className="mixparty-wave-bar w-[2px] rounded-full bg-gradient-to-t from-violet-500 via-fuchsia-400 to-orange-300" style={{ height }} />
              ))}
            </div>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-orange-400/15 to-fuchsia-400/30" />
          </div>

          <div className="mx-auto hidden h-px w-[92%] bg-gradient-to-r from-transparent via-fuchsia-300/[0.08] to-transparent lg:block" />
          <section className="py-10 sm:py-16 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Pourquoi MixParty</span>
              <div className="mt-3 flex items-center justify-center gap-4">
                <span className="hidden h-px w-16 bg-gradient-to-r from-transparent to-fuchsia-400/35 sm:block" />
                <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Tout comprendre en quelques secondes.</h2>
                <span className="hidden h-px w-16 bg-gradient-to-l from-transparent to-orange-400/30 sm:block" />
              </div>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/42 sm:text-base">
                Pas de menus compliqués : chacun sait immédiatement quoi faire pendant la soirée.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4">
              {[
                { icon: Headphones, title: "Tous les sons", text: "Cherche et ajoute facilement les morceaux que tu veux.", accent: "text-fuchsia-300 bg-fuchsia-400/10", aura: "from-fuchsia-500/18 via-pink-500/8 to-transparent", iconGlow: "shadow-[0_0_28px_rgba(217,70,239,.12)]" },
                { icon: UsersRound, title: "Tous ensemble", text: "Chaque invité participe et influence la playlist.", accent: "text-violet-300 bg-violet-400/10", aura: "from-violet-500/18 via-purple-500/8 to-transparent", iconGlow: "shadow-[0_0_28px_rgba(139,92,246,.12)]" },
                { icon: Bot, title: "PartyBrain", text: "Des suggestions adaptées à l’ambiance de la soirée.", accent: "text-cyan-300 bg-cyan-400/10", aura: "from-cyan-500/15 via-violet-500/8 to-transparent", iconGlow: "shadow-[0_0_28px_rgba(34,211,238,.10)]" },
                { icon: LayoutGrid, title: "Badges & stats", text: "Garde ta progression avec un compte MixParty.", accent: "text-orange-300 bg-orange-400/10", aura: "from-orange-500/18 via-pink-500/8 to-transparent", iconGlow: "shadow-[0_0_28px_rgba(249,115,22,.12)]" },
              ].map(({ icon: Icon, title, text: description, accent, aura, iconGlow }) => (
                <article key={title} className="group relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018))] p-5 shadow-[0_22px_70px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.04)] backdrop-blur-xl transition duration-500 lg:hover:-translate-y-2 lg:hover:scale-[1.015] lg:hover:border-white/[0.15] lg:hover:shadow-[0_34px_100px_rgba(0,0,0,.34)] sm:p-6">
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${aura} opacity-35 transition duration-500 lg:group-hover:opacity-75`} />
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-70" />
                  <div className={`relative grid h-12 w-12 place-items-center rounded-2xl ${accent} ${iconGlow} transition duration-500 lg:group-hover:scale-110`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="relative mt-5 text-lg font-black">{title}</h3>
                  <p className="relative mt-2 text-sm leading-6 text-white/40">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="mx-auto hidden h-px w-[92%] bg-gradient-to-r from-transparent via-violet-300/[0.08] to-transparent lg:block" />
          <section className="py-10 sm:py-16 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-300">Comment ça marche</span>
              <div className="mt-3 flex items-center justify-center gap-4">
                <span className="hidden h-px w-16 bg-gradient-to-r from-transparent to-violet-400/35 sm:block" />
                <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Quatre étapes. Une seule ambiance.</h2>
                <span className="hidden h-px w-16 bg-gradient-to-l from-transparent to-pink-400/30 sm:block" />
              </div>
            </div>

            <div className="relative mt-8 grid gap-4 md:grid-cols-2 lg:mt-12 lg:grid-cols-4">
              <div className="pointer-events-none absolute left-[8%] right-[8%] top-8 hidden h-px bg-gradient-to-r from-violet-500/0 via-fuchsia-400/30 to-orange-400/0 lg:block" />
              {STEPS.map(({ number, title, text: description, icon: Icon }, index) => (
                <article key={number} className="group relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(10,9,19,.82),rgba(255,255,255,.018))] p-5 shadow-[0_20px_65px_rgba(0,0,0,.20),inset_0_1px_0_rgba(255,255,255,.035)] backdrop-blur-xl transition duration-300 lg:hover:-translate-y-1 lg:hover:border-fuchsia-300/20 lg:hover:shadow-[0_28px_85px_rgba(0,0,0,.28)] sm:p-6">
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/35 to-transparent" />
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
            <div className="group relative mx-auto max-w-6xl overflow-hidden rounded-[34px] border border-fuchsia-300/15 bg-[linear-gradient(120deg,rgba(124,58,237,.12),rgba(236,72,153,.10)_52%,rgba(249,115,22,.10))] p-6 shadow-[0_30px_100px_rgba(236,72,153,.12),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-2xl sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/70 to-transparent" />
              <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-orange-400/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 left-10 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
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
                className="group/cta relative mt-5 inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white px-7 text-sm font-black text-[#17131d] shadow-[0_15px_45px_rgba(255,255,255,.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(255,255,255,.16)] lg:mt-0 lg:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                Créer ma soirée
              </button>
            </div>
          </section>

          <div className="mx-auto mt-4 h-px w-full max-w-6xl bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
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
              <div className="relative min-h-12 w-full">
                <div
                  ref={googleButtonRef}
                  className="flex min-h-12 w-full items-center justify-center overflow-hidden rounded-2xl bg-white"
                />
                {!googleReady ? (
                  <button
                    type="button"
                    onClick={loadGoogleIdentityServices}
                    disabled={authBusy}
                    className="absolute inset-0 flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white px-4 text-sm font-black text-[#17141d] transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    <span className="text-lg font-black text-[#4285F4]">G</span>
                    Continuer avec Google
                    <span className="text-[9px] font-bold text-black/40">Gmail / Android</span>
                  </button>
                ) : null}
              </div>

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


      <style jsx global>{`


        .mixparty-corner-glow {
          z-index: 0;
          border-radius: 999px;
          filter: blur(26px);
          opacity: .95;
          mix-blend-mode: screen;
          animation: mixpartyCornerPulse 4.8s ease-in-out infinite;
        }

        .mixparty-corner-glow--tl {
          width: 210px;
          height: 210px;
          left: -58px;
          top: -62px;
          background:
            radial-gradient(circle at 48% 52%,
              rgba(244,114,182,.72) 0%,
              rgba(217,70,239,.48) 28%,
              rgba(139,92,246,.24) 50%,
              transparent 72%);
        }

        .mixparty-corner-glow--tr {
          width: 160px;
          height: 160px;
          right: -44px;
          top: -34px;
          background:
            radial-gradient(circle,
              rgba(236,72,153,.42) 0%,
              rgba(168,85,247,.18) 48%,
              transparent 74%);
          animation-delay: -1.2s;
        }

        .mixparty-corner-glow--br {
          width: 220px;
          height: 220px;
          right: -74px;
          bottom: -74px;
          background:
            radial-gradient(circle,
              rgba(249,115,22,.46) 0%,
              rgba(236,72,153,.18) 44%,
              transparent 72%);
          animation-delay: -2.1s;
        }

        .mixparty-top-neon {
          z-index: 5;
          box-shadow:
            0 0 6px rgba(255,255,255,.5),
            0 0 14px rgba(244,114,182,.72),
            0 0 30px rgba(217,70,239,.58),
            0 0 48px rgba(168,85,247,.28);
          opacity: .98;
        }

        @keyframes mixpartyCornerPulse {
          0%, 100% { transform: scale(1); opacity: .72; }
          50% { transform: scale(1.09); opacity: 1; }
        }

        .mixparty-premium-console {
          position: relative;
          border: 1px solid rgba(244,114,182,.28);
          background:
            linear-gradient(145deg, rgba(29,13,40,.98), rgba(8,7,17,.985) 54%, rgba(27,12,17,.98));
          box-shadow:
            0 60px 180px rgba(0,0,0,.68),
            0 0 0 1px rgba(236,72,153,.12),
            -18px -16px 42px rgba(244,114,182,.16),
            -30px -26px 80px rgba(217,70,239,.18),
            0 0 58px rgba(217,70,239,.30),
            0 0 125px rgba(236,72,153,.28),
            48px 48px 125px rgba(249,115,22,.14);
        }

        .mixparty-premium-console::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(120deg, rgba(232,121,249,.95), rgba(236,72,153,.22) 38%, rgba(249,115,22,.78) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: .82;
          filter: drop-shadow(0 0 18px rgba(236,72,153,.36));
        }

        .mixparty-premium-console::after {
          content: "";
          position: absolute;
          width: 42%;
          height: 34%;
          right: -7%;
          bottom: -10%;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(249,115,22,.28), rgba(236,72,153,.08) 45%, transparent 72%);
          filter: blur(30px);
          pointer-events: none;
        }

        .mixparty-premium-console-inner {
          border: 1px solid rgba(255,255,255,.065);
          background:
            radial-gradient(circle at 18% 8%, rgba(168,85,247,.08), transparent 30%),
            radial-gradient(circle at 92% 82%, rgba(249,115,22,.07), transparent 35%),
            rgba(6,5,13,.60);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        }

        .mixparty-now-card {
          border: 1px solid rgba(255,255,255,.095);
          background:
            linear-gradient(145deg, rgba(255,255,255,.064), rgba(255,255,255,.016)),
            radial-gradient(circle at 18% 22%, rgba(168,85,247,.07), transparent 42%),
            radial-gradient(circle at 92% 70%, rgba(249,115,22,.055), transparent 38%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.05),
            0 24px 65px rgba(0,0,0,.22);
        }

        .mixparty-cover-frame {
          border: 1px solid rgba(244,114,182,.25);
          box-shadow:
            0 30px 80px rgba(0,0,0,.42),
            0 0 0 1px rgba(236,72,153,.07),
            0 0 34px rgba(217,70,239,.16),
            0 0 60px rgba(249,115,22,.08);
        }

        .mixparty-stats-panel {
          border: 1px solid rgba(255,255,255,.09);
          background: linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.014));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.045),
            0 18px 44px rgba(0,0,0,.18);
        }

        .mixparty-action-card {
          border: 1px solid rgba(255,255,255,.09);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.04),
            0 12px 34px rgba(0,0,0,.14);
          transition: transform .28s ease, box-shadow .28s ease, border-color .28s ease, background .28s ease;
        }

        .mixparty-action-card--pink {
          background: linear-gradient(145deg, rgba(190,24,93,.24), rgba(88,28,135,.14) 58%, rgba(249,115,22,.08));
          border-color: rgba(244,114,182,.24);
        }
        .mixparty-action-card--violet {
          background: linear-gradient(145deg, rgba(109,40,217,.22), rgba(76,29,149,.13) 60%, rgba(236,72,153,.055));
          border-color: rgba(196,181,253,.20);
        }
        .mixparty-action-card--orange {
          background: linear-gradient(145deg, rgba(194,65,12,.24), rgba(120,53,15,.13) 58%, rgba(236,72,153,.055));
          border-color: rgba(253,186,116,.22);
        }

        @media (min-width: 1024px) {
          .mixparty-action-card:hover {
            transform: translateY(-4px);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.06),
              0 22px 48px rgba(0,0,0,.22),
              0 0 28px rgba(236,72,153,.08);
          }
        }

        .mixparty-queue-panel {
          border: 1px solid rgba(255,255,255,.085);
          background:
            linear-gradient(145deg, rgba(255,255,255,.035), rgba(255,255,255,.012)),
            radial-gradient(circle at 85% 90%, rgba(249,115,22,.045), transparent 40%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
        }


        .mixparty-hero-cta {
          position: relative;
          isolation: isolate;
          box-shadow:
            0 24px 70px rgba(0,0,0,.26),
            inset 0 1px 0 rgba(255,255,255,.05);
        }

        .mixparty-hero-cta::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          z-index: -2;
        }

        .mixparty-hero-cta::after {
          content: "";
          position: absolute;
          inset: -20%;
          border-radius: inherit;
          pointer-events: none;
          z-index: -3;
          filter: blur(30px);
          opacity: .38;
          transition: opacity .3s ease, transform .3s ease;
        }

        .mixparty-hero-cta--create {
          border: 1px solid rgba(244,114,182,.34);
          background:
            linear-gradient(120deg, rgba(236,72,153,.72), rgba(168,85,247,.42) 48%, rgba(249,115,22,.62));
          box-shadow:
            0 26px 80px rgba(236,72,153,.20),
            0 0 34px rgba(236,72,153,.10),
            inset 0 1px 0 rgba(255,255,255,.08);
        }

        .mixparty-hero-cta--create::before {
          background:
            linear-gradient(145deg, rgba(74,19,63,.90), rgba(41,15,59,.92) 58%, rgba(85,30,20,.88));
        }

        .mixparty-hero-cta--create::after {
          background:
            radial-gradient(circle at 28% 34%, rgba(236,72,153,.48), transparent 36%),
            radial-gradient(circle at 78% 70%, rgba(249,115,22,.34), transparent 40%);
        }

        .mixparty-hero-cta--join {
          border: 1px solid rgba(196,181,253,.22);
          background:
            linear-gradient(145deg, rgba(74,42,135,.56), rgba(63,33,111,.44) 58%, rgba(120,40,115,.32));
          box-shadow:
            0 24px 72px rgba(109,40,217,.16),
            0 0 30px rgba(139,92,246,.08),
            inset 0 1px 0 rgba(255,255,255,.06);
        }

        .mixparty-hero-cta--join::before {
          background:
            linear-gradient(145deg, rgba(49,28,92,.90), rgba(32,22,66,.92) 58%, rgba(63,24,67,.88));
        }

        .mixparty-hero-cta--join::after {
          background:
            radial-gradient(circle at 30% 32%, rgba(139,92,246,.38), transparent 38%),
            radial-gradient(circle at 80% 72%, rgba(236,72,153,.22), transparent 42%);
        }

        .mixparty-hero-cta__inner {
          background:
            linear-gradient(145deg, rgba(23,11,32,.60), rgba(23,10,26,.40));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.05);
        }

        .mixparty-hero-cta__icon {
          border: 1px solid rgba(255,255,255,.08);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.05),
            0 10px 24px rgba(0,0,0,.16);
          transition: transform .3s ease, box-shadow .3s ease;
        }

        .mixparty-hero-cta__icon--create {
          background:
            linear-gradient(145deg, rgba(236,72,153,.22), rgba(249,115,22,.10)),
            rgba(18,7,23,.72);
          color: rgba(251,207,232,1);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.06),
            0 0 28px rgba(236,72,153,.10);
        }

        .mixparty-hero-cta__icon--join {
          background:
            linear-gradient(145deg, rgba(139,92,246,.22), rgba(236,72,153,.08)),
            rgba(20,11,42,.72);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.06),
            0 0 26px rgba(139,92,246,.10);
        }

        .mixparty-hero-cta__arrow {
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.035);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
          transition: background .3s ease, border-color .3s ease, transform .3s ease;
        }

        @media (min-width: 1024px) {
          .mixparty-hero-cta:hover {
            transform: translateY(-5px) scale(1.012);
          }

          .mixparty-hero-cta:hover::after {
            opacity: .70;
            transform: scale(1.05);
          }

          .mixparty-hero-cta:hover .mixparty-hero-cta__icon {
            transform: scale(1.08) rotate(-2deg);
          }

          .mixparty-hero-cta:hover .mixparty-hero-cta__arrow {
            background: rgba(255,255,255,.07);
            border-color: rgba(255,255,255,.14);
            transform: scale(1.06);
          }

          .mixparty-hero-cta--create:hover {
            box-shadow:
              0 30px 90px rgba(236,72,153,.28),
              0 0 44px rgba(236,72,153,.14),
              0 0 80px rgba(249,115,22,.08);
          }

          .mixparty-hero-cta--join:hover {
            box-shadow:
              0 30px 84px rgba(109,40,217,.22),
              0 0 40px rgba(139,92,246,.12);
          }
        }


        .mobile-demo-phone-shell {
          background:
            linear-gradient(135deg, rgba(217,70,239,.85), rgba(139,92,246,.28) 38%, rgba(249,115,22,.65));
        }

        .mobile-demo-phone-shell::before {
          content: "";
          position: absolute;
          inset: -18px;
          z-index: -1;
          border-radius: 52px;
          background:
            radial-gradient(circle at 18% 12%, rgba(168,85,247,.22), transparent 36%),
            radial-gradient(circle at 82% 84%, rgba(236,72,153,.18), transparent 38%);
          filter: blur(24px);
          pointer-events: none;
        }

        .mobile-phone-action {
          display: flex;
          min-height: 58px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 17px;
          background: rgba(255,255,255,.025);
          color: rgba(255,255,255,.62);
        }

        .mobile-phone-action strong {
          font-size: 11px;
          color: rgba(255,255,255,.90);
        }

        .mobile-phone-action span {
          font-size: 7px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: rgba(255,255,255,.28);
        }

        .mobile-home-pill {
          position: relative;
          isolation: isolate;
        }

        .mobile-home-pill::after {
          content: "";
          position: absolute;
          inset: -10px;
          z-index: -1;
          border-radius: inherit;
          background: linear-gradient(90deg, rgba(124,58,237,.25), rgba(236,72,153,.18), rgba(249,115,22,.18));
          filter: blur(16px);
        }

        @media (max-width: 420px) {
          .mobile-demo-phone-shell {
            width: 96%;
          }
        }




        
        @media (max-width: 1023px) {
          .mixparty-demo-progress,
          .mixparty-wave-bar,
          .mixparty-live-number,
          .mixparty-console-breath,
          .mixparty-edge-glow,
          .mixparty-console-scan,
          .mixparty-corner-glow {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 1023px) {
          .mixparty-demo-progress,
          .mixparty-wave-bar,
          .mixparty-live-number,
          .mixparty-console-breath,
          .mixparty-edge-glow,
          .mixparty-console-scan,
          .mixparty-corner-glow {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 1023px) {
          .mixparty-demo-progress,
          .mixparty-wave-bar,
          .mixparty-live-number,
          .mixparty-console-breath,
          .mixparty-edge-glow,
          .mixparty-console-scan,
          .mixparty-corner-glow {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 1023px) {
          .mixparty-demo-progress,
          .mixparty-wave-bar,
          .mixparty-live-number,
          .mixparty-console-breath,
          .mixparty-edge-glow,
          .mixparty-console-scan,
          .mixparty-corner-glow {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 1023px) {
          .mixparty-demo-progress,
          .mixparty-wave-bar,
          .mixparty-live-number,
          .mixparty-console-breath,
          .mixparty-edge-glow,
          .mixparty-console-scan,
          .mixparty-corner-glow {
            animation: none !important;
            transition: none !important;
          }
        }

@keyframes mixpartyDemoProgress {
          from { width: 0%; }
          to { width: 100%; }
        }

        @keyframes mixpartySoftPulse {
          0%, 100% { opacity: .55; transform: scale(1); }
          50% { opacity: .9; transform: scale(1.06); }
        }

        .mixparty-demo-progress {
          width: 10%;
          animation: mixpartyDemoProgress 18s linear forwards;
        }

        @media (min-width: 1024px) {
          .mixparty-demo-progress {
            animation-duration: 18s;
          }
        }

                @keyframes mixpartyEdgeGlow {
          0%, 100% { box-shadow: inset 0 0 0 1px rgba(236,72,153,.06), inset 0 0 28px rgba(168,85,247,.035); opacity: .65; }
          50% { box-shadow: inset 0 0 0 1px rgba(251,146,60,.09), inset 0 0 40px rgba(236,72,153,.06); opacity: 1; }
        }

        @keyframes mixpartyScan {
          0% { transform: translateY(-120%); opacity: 0; }
          12% { opacity: .18; }
          50% { opacity: .10; }
          100% { transform: translateY(520%); opacity: 0; }
        }

        .mixparty-edge-glow {
          animation: mixpartyEdgeGlow 5.5s ease-in-out infinite;
        }

        .mixparty-console-scan {
          animation: mixpartyScan 7s linear infinite;
        }

@keyframes mixpartyCoverIn {
          from { opacity: 0; transform: scale(1.035); filter: saturate(.8) brightness(.85); }
          to { opacity: 1; transform: scale(1); filter: saturate(1) brightness(1); }
        }

        .mixparty-demo-cover {
          animation: mixpartyCoverIn .85s cubic-bezier(.22,.8,.24,1) both;
        }

        @keyframes mixpartyConsoleBreath {
          0%, 100% { opacity: .55; transform: scale(1); }
          50% { opacity: .9; transform: scale(1.025); }
        }

        @keyframes mixpartyWave {
          0%, 100% { transform: scaleY(.55); opacity: .45; }
          50% { transform: scaleY(1); opacity: .95; }
        }

        @keyframes mixpartyNumberPop {
          0%, 86%, 100% { transform: translateY(0) scale(1); }
          90% { transform: translateY(-2px) scale(1.08); }
          94% { transform: translateY(0) scale(1); }
        }

        @keyframes mixpartySectionFloat {
          0%, 100% { transform: translate3d(0,0,0); }
          50% { transform: translate3d(0,-4px,0); }
        }

        .mixparty-wave-bar {
          transform-origin: bottom;
          animation: mixpartyWave 1.3s ease-in-out infinite;
        }

        .mixparty-wave-bar:nth-child(2n) { animation-delay: -0.32s; }
        .mixparty-wave-bar:nth-child(3n) { animation-delay: -0.62s; }
        .mixparty-wave-bar:nth-child(5n) { animation-delay: -0.88s; }

        .mixparty-live-number {
          animation: mixpartyNumberPop 4.2s ease-in-out infinite;
        }

        .mixparty-console-breath {
          animation: mixpartyConsoleBreath 6s ease-in-out infinite;
        }

        @media (min-width: 1024px) {
          .mixparty-wave-line {
            filter: drop-shadow(0 0 10px rgba(236,72,153,.18));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mixparty-demo-progress {
            width: 80%;
            animation: none;
          }

          .mixparty-wave-bar,
          .mixparty-live-number,
          .mixparty-console-breath,
          .mixparty-edge-glow,
          .mixparty-console-scan,
          .mixparty-corner-glow {
            animation: none;
          }
        }
      `}</style>

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
