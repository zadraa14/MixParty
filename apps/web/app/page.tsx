"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  Headphones,
  KeyRound,
  LogIn,
  Mail,
  Play,
  QrCode,
  Radio,
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

      <main className="mp521-page relative isolate min-h-[100dvh] overflow-hidden bg-[#070711] text-white">
        <MixPartyBackground />
        <div className="mp521-depth pointer-events-none fixed inset-0 z-[1]" />
        <div className="mp521-particles pointer-events-none fixed inset-0 z-[2]" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-10 xl:px-14">
          <MixPartyHeader />

          <section className="grid min-h-[calc(100dvh-104px)] items-center gap-10 py-10 sm:py-14 lg:min-h-[760px] lg:grid-cols-[minmax(0,1.12fr)_minmax(470px,.88fr)] lg:gap-12 lg:py-12 xl:min-h-[820px] xl:gap-20">
            <div className="relative z-10 max-w-2xl lg:max-w-[720px]">
              <div className="mp521-reveal mp521-reveal-1 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/[0.08] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl sm:text-xs">
                <span className="mp521-live-dot h-2 w-2 rounded-full bg-emerald-400" />
                La soirée devient collaborative
              </div>

              <h1 className="mp521-reveal mp521-reveal-2 mt-6 font-[family:var(--font-exo-2)] text-[clamp(3.25rem,8vw,6.7rem)] font-black leading-[.88] tracking-[-.065em] lg:text-[clamp(5.4rem,7vw,7.6rem)]">
                <span className="block text-white drop-shadow-[0_0_22px_rgba(255,255,255,.11)]">Ta soirée.</span>
                <span className="mp521-hero-gradient block">Leur playlist.</span>
              </h1>

              <p className="mp521-reveal mp521-reveal-3 mt-7 max-w-xl text-base font-medium leading-7 text-white/52 sm:text-lg sm:leading-8 lg:max-w-2xl lg:text-xl lg:leading-9">
                Crée une salle, partage le QR Code et laisse tes invités proposer puis voter pour les prochains titres. MixParty s’occupe du reste.
              </p>

              <div className="mp521-reveal mp521-reveal-4 mt-8 flex flex-col gap-3 sm:flex-row lg:mt-10 lg:gap-4">
                <button type="button" onClick={createParty} disabled={creatingParty} className="mp521-primary-button group">
                  <span className="mp521-button-shine" aria-hidden="true" />
                  <span className="relative z-10 flex items-center justify-center gap-2.5">
                    {creatingParty ? <span className="mp-button-spinner" /> : <Sparkles className="h-5 w-5" />}
                    {creatingParty ? "Création..." : "Créer ma soirée"}
                    {!creatingParty && <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />}
                  </span>
                </button>

                <a href="#rejoindre" className="mp521-secondary-button group">
                  <span className="flex items-center justify-center gap-2.5">
                    <UsersRound className="h-5 w-5" />
                    Rejoindre une soirée
                  </span>
                </a>
              </div>

              <div className="mp521-reveal mp521-reveal-5 mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-white/35 lg:mt-8 lg:gap-x-7 lg:text-sm">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />Sans compte</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />En temps réel</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />Pensé pour mobile</span>
              </div>
            </div>

            <div className="mp521-reveal mp521-reveal-3 relative mx-auto w-full max-w-[570px] lg:mx-0 lg:justify-self-end lg:rounded-[44px] lg:border lg:border-white/[0.08] lg:bg-white/[0.025] lg:px-8 lg:py-10 lg:shadow-[0_35px_120px_rgba(0,0,0,.35),inset_0_1px_0_rgba(255,255,255,.05)] lg:backdrop-blur-sm xl:px-10 xl:py-12">
              <div className="mp521-phone-aura pointer-events-none absolute inset-[10%] rounded-full" />
              <div className="mp521-orbit mp521-orbit-one" />
              <div className="mp521-orbit mp521-orbit-two" />

              <div className="mp521-phone-shell relative mx-auto w-[min(100%,390px)] rounded-[48px] p-[7px] sm:w-[390px] lg:w-[410px] xl:w-[430px]">
                <div className="relative overflow-hidden rounded-[41px] border border-white/[0.09] bg-[#090913] px-5 pb-6 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
                  <div className="mx-auto h-1.5 w-20 rounded-full bg-white/10" />

                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.23em] text-orange-300/75">En lecture</p>
                      <p className="mt-1 text-sm font-black text-white">MixParty Live</p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.08] px-2.5 py-1.5 text-[9px] font-black text-emerald-300">
                      <span className="mp521-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE
                    </div>
                  </div>

                  <div className="mp521-cover relative mx-auto mt-6 aspect-square w-full max-w-[285px] overflow-hidden rounded-[32px]">
                    <div className="mp521-cover-grid absolute inset-0" />
                    <div className="mp521-cover-glow absolute -left-10 top-8 h-40 w-40 rounded-full bg-purple-500/60 blur-[45px]" />
                    <div className="mp521-cover-glow absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-orange-500/55 blur-[50px] [animation-delay:1.2s]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="mp521-vinyl flex h-[68%] w-[68%] items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_center,#0a0a12_0_13%,#f97316_14%_17%,#18111f_18%_26%,#0a0a12_27%_36%,#211228_37%_48%,#07070d_49%_100%)] shadow-[0_24px_70px_rgba(0,0,0,.55),0_0_55px_rgba(236,72,153,.24)]">
                        <div className="h-3 w-3 rounded-full bg-white/85 shadow-[0_0_16px_rgba(255,255,255,.65)]" />
                      </div>
                    </div>
                    <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">PartyBrain selection</p>
                      <p className="mt-1 truncate font-[family:var(--font-exo-2)] text-base font-black">Midnight Energy</p>
                    </div>
                  </div>

                  <div className="mt-5 text-center">
                    <p className="font-[family:var(--font-exo-2)] text-xl font-black tracking-tight">Midnight Energy</p>
                    <p className="mt-1 text-xs font-semibold text-white/35">MixParty Session • 3:42</p>
                  </div>

                  <div className="mp521-waveform mt-5" aria-label="Visualisation audio">
                    {WAVE.map((height, index) => (
                      <span key={index} style={{ height: `${height}%`, animationDelay: `${index * 48}ms` }} />
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-5">
                    <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Titre précédent">
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </button>
                    <button type="button" className="mp521-play-button" aria-label="Lecture">
                      <span className="mp521-play-ring" />
                      <Play className="relative z-10 ml-1 h-7 w-7 fill-current" />
                    </button>
                    <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Titre suivant">
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <div className="mp521-mini-stat"><UsersRound className="h-4 w-4 text-purple-300" /><strong>24</strong><span>invités</span></div>
                    <div className="mp521-mini-stat"><Vote className="h-4 w-4 text-pink-300" /><strong>186</strong><span>votes</span></div>
                    <div className="mp521-mini-stat"><Headphones className="h-4 w-4 text-orange-300" /><strong>38</strong><span>titres</span></div>
                  </div>
                </div>
              </div>

              <div className="mp521-floating-card mp521-floating-card-left hidden sm:flex">
                <div className="mp521-floating-icon bg-purple-400/10 text-purple-200"><UsersRound className="h-4 w-4" /></div>
                <div><strong>+8 invités</strong><span>viennent de rejoindre</span></div>
              </div>
              <div className="mp521-floating-card mp521-floating-card-right hidden sm:flex">
                <div className="mp521-floating-icon bg-orange-400/10 text-orange-200"><WandSparkles className="h-4 w-4" /></div>
                <div><strong>PartyBrain</strong><span>ambiance optimisée</span></div>
              </div>
            </div>
          </section>

          <div className="mx-auto hidden h-px w-[88%] bg-gradient-to-r from-transparent via-white/10 to-transparent lg:block" />

          <section id="rejoindre" className="py-14 sm:py-20 lg:py-16">
            <div className="mp521-join-card mx-auto grid max-w-6xl gap-7 rounded-[34px] border border-white/[0.10] bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.055)] backdrop-blur-xl sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10 xl:p-12">
              <div>
                <span className="mp521-section-kicker">Déjà invité ?</span>
                <h2 className="mt-3 font-[family:var(--font-exo-2)] text-3xl font-black tracking-tight sm:text-4xl">Entre dans la soirée.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/42 sm:text-base">Saisis le code affiché par l’organisateur et rejoins instantanément la playlist collective.</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <input
                  value={partyCode}
                  onChange={(event) => setPartyCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => event.key === "Enter" && joinParty()}
                  maxLength={8}
                  placeholder="CODE"
                  className="mp521-code-input min-w-0 sm:w-44"
                  aria-label="Code de la soirée"
                />
                <button type="button" onClick={joinParty} className="mp521-primary-button mp521-primary-button--compact group">
                  <span className="mp521-button-shine" aria-hidden="true" />
                  <span className="relative z-10 flex items-center justify-center gap-2">Rejoindre <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                </button>
              </div>
            </div>
          </section>

          <section className="py-14 sm:py-20 lg:py-16">
            <div className="mx-auto max-w-4xl text-center">
              <span className="mp521-section-kicker">Pourquoi MixParty</span>
              <h2 className="mt-4 font-[family:var(--font-exo-2)] text-3xl font-black tracking-tight sm:text-5xl">Une soirée qui <span className="mp521-inline-gradient">réagit en direct.</span></h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/42 sm:text-base">Chaque téléphone devient une télécommande musicale collective, sans compte et sans installation compliquée.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4 lg:gap-5">
              {STATS.map(({ label, value, description, icon: Icon, accent }, index) => (
                <article key={label} className={`mp521-stat-card mp521-accent-${accent} border border-white/[0.08] bg-white/[0.035] shadow-[0_18px_55px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.045)] backdrop-blur-xl lg:min-h-[220px] lg:p-7`} style={{ animationDelay: `${index * 100}ms` }}>
                  <div className="mp521-stat-icon"><Icon className="h-5 w-5" /></div>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/27">{label}</p>
                  <p className="mt-2 font-[family:var(--font-exo-2)] text-xl font-black text-white">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-white/38">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="py-14 sm:py-20 lg:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <span className="mp521-section-kicker mp521-section-kicker--pink">Comment ça marche</span>
              <h2 className="mt-4 font-[family:var(--font-exo-2)] text-3xl font-black tracking-tight sm:text-5xl">Quatre étapes. <span className="mp521-inline-gradient">Une seule ambiance.</span></h2>
            </div>
            <div className="mp521-timeline relative mt-12 grid gap-5 lg:mt-14 lg:grid-cols-4 lg:gap-6">
              <div className="mp521-timeline-line hidden lg:block" />
              {STEPS.map(({ number, title, text, icon: Icon, accent }, index) => (
                <article key={number} className={`mp521-step-card mp521-accent-${accent} border border-white/[0.08] bg-black/15 shadow-[0_18px_55px_rgba(0,0,0,.20),inset_0_1px_0_rgba(255,255,255,.04)] backdrop-blur-xl lg:min-h-[240px] lg:p-7`}>
                  <div className="mp521-step-node"><span>{number}</span></div>
                  <div className="mp521-stat-icon"><Icon className="h-5 w-5" /></div>
                  <p className="mt-5 font-[family:var(--font-exo-2)] text-xl font-black">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/40">{text}</p>
                  <span className="mp521-step-index">0{index + 1}</span>
                </article>
              ))}
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
