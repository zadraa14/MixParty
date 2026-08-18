"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Crown,
  Gem,
  History,
  Images,
  LockKeyhole,
  Medal,
  Music2,
  Pencil,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  Vote,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import MixPartyBackground from "../../components/MixPartyBackground";

const NAME_KEY = "playerName";
const PHOTO_KEY = "mixparty.profile.photo.v1";
const PARTICIPANT_ID_KEY = "mixparty.participant.id";

const DEFAULT_STATS = [
  { label: "Soirées", value: "—", icon: History, accent: "text-violet-300" },
  { label: "Victoires", value: "—", icon: Crown, accent: "text-amber-300" },
  { label: "Podiums", value: "—", icon: Trophy, accent: "text-cyan-300" },
  { label: "Votes", value: "—", icon: Vote, accent: "text-pink-300" },
  { label: "Morceaux", value: "—", icon: Music2, accent: "text-orange-300" },
] as const;

const BADGE_PREVIEWS = [
  { title: "Premier Son", tone: "from-violet-500/35 to-fuchsia-500/15", icon: Music2 },
  { title: "Champion", tone: "from-amber-400/30 to-orange-500/10", icon: Trophy },
  { title: "Hitmaker", tone: "from-fuchsia-500/30 to-violet-500/10", icon: Zap },
  { title: "Badge secret", tone: "from-cyan-500/20 to-violet-500/10", icon: LockKeyhole },
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
    setPhoto(savedPhoto);
    setDraftPhoto(savedPhoto);
    setParticipantId(savedParticipantId);
    setReady(true);
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

  function saveProfile() {
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
    setSaving(false);
  }

  const displayName = name || "Ton profil";
  const displayInitial = (name || "M").charAt(0).toUpperCase();

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
                  <div className="absolute -inset-2 rounded-[34px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 opacity-65 blur-md" />
                  <div className="relative h-32 w-32 overflow-hidden rounded-[34px] border border-white/20 bg-[#0d0817] p-1 shadow-[0_18px_45px_rgba(0,0,0,.45)] sm:h-40 sm:w-40 lg:h-44 lg:w-44">
                    <div className="grid h-full w-full place-items-center overflow-hidden rounded-[29px] bg-gradient-to-br from-[#171024] to-[#090610]">
                      {ready && photo ? (
                        <img src={photo} alt={`Photo de ${displayName}`} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-[family:var(--font-exo-2)] text-4xl font-black text-white/70">{displayInitial}</span>
                      )}
                    </div>
                  </div>
                  <span className="absolute -bottom-2 -right-2 grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-xl">
                    <BadgeCheck className="h-5 w-5" />
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <span className="rounded-full border border-violet-300/15 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-violet-200">Profil MixParty</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-white/40">Compte à venir</span>
                  </div>

                  <h1 className="mt-3 truncate font-[family:var(--font-exo-2)] text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                    {ready ? displayName : "Chargement…"}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45 sm:text-base lg:text-lg">
                    Ton futur espace personnel pour retrouver tes soirées, ta progression, tes statistiques et tes badges MixParty.
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
          {DEFAULT_STATS.map(({ label, value, icon: Icon, accent }) => (
            <article key={label} className="rounded-[26px] border border-white/10 bg-white/[0.055] p-4 shadow-[0_18px_45px_rgba(0,0,0,.18)] backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <Icon className={`h-5 w-5 ${accent}`} />
                <span className="text-[9px] font-black uppercase tracking-[.15em] text-white/25">Bientôt</span>
              </div>
              <p className="mt-4 font-[family:var(--font-exo-2)] text-2xl font-black sm:text-3xl">{value}</p>
              <p className="mt-1 text-xs font-bold text-white/40">{label}</p>
            </article>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_.8fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_70px_rgba(0,0,0,.26)] backdrop-blur-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-300">Collection</p>
                <h2 className="mt-1 font-[family:var(--font-exo-2)] text-2xl font-black">Mes badges</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/40">Tes réussites apparaîtront ici dès que le moteur de progression sera connecté.</p>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/10 text-fuchsia-200">
                <Medal className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BADGE_PREVIEWS.map(({ title, tone, icon: Icon }, index) => (
                <div key={title} className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-black/20 p-3 text-center">
                  <div className={`absolute inset-0 bg-gradient-to-br ${tone} opacity-65`} />
                  <div className="relative mx-auto grid aspect-square w-full max-w-[112px] place-items-center rounded-[22px] border border-white/10 bg-black/25 shadow-inner">
                    <Icon className="h-9 w-9 text-white/55" />
                    <LockKeyhole className="absolute right-2.5 top-2.5 h-4 w-4 text-white/25" />
                  </div>
                  <p className="relative mt-3 truncate text-xs font-black text-white/70">{title}</p>
                  <p className="relative mt-1 text-[9px] font-black uppercase tracking-[.12em] text-white/25">{index === 3 ? "Secret" : "À débloquer"}</p>
                </div>
              ))}
            </div>

            <button type="button" disabled className="mt-5 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/35">
              <Medal className="h-4 w-4" />
              Voir toute la collection — bientôt
            </button>
          </section>

          <section className="relative overflow-hidden rounded-[32px] border border-amber-300/15 bg-gradient-to-br from-amber-400/[0.10] via-fuchsia-500/[0.07] to-violet-500/[0.08] p-5 shadow-[0_24px_70px_rgba(0,0,0,.26)] backdrop-blur-2xl sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-amber-400/15 blur-[65px]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-amber-200">Bientôt</span>
                <Gem className="h-5 w-5 text-amber-200" />
              </div>

              <h2 className="mt-5 font-[family:var(--font-exo-2)] text-2xl font-black">
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

        <section className="mt-5 rounded-[30px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Compte & sécurité</p>
                <h2 className="mt-1 font-[family:var(--font-exo-2)] text-lg font-black">Ton compte MixParty</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-white/40">Connexion multi-appareils, sécurité, statut Free/Premium et sauvegarde de la progression seront regroupés ici quand nous brancherons les comptes permanents.</p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.16em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Prochaine étape
            </span>
          </div>
        </section>

        <footer className="py-8 text-center text-xs text-white/25">
          <span className="font-black text-white/35">MixParty</span> · Ton profil, ta progression, tes soirées.
        </footer>
      </div>

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
