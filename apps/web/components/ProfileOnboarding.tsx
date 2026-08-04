"use client";

import { Camera, Check, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const NAME_KEY = "playerName";
const PHOTO_KEY = "mixparty.profile.photo.v1";
const PARTICIPANT_ID_KEY = "mixparty.participant.id";

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

  context.drawImage(
    image,
    sourceX,
    sourceY,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas.toDataURL("image/webp", 0.78);
}

export default function ProfileOnboarding() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [photo, setPhoto] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem(NAME_KEY)?.trim() || "";
    const savedPhoto = localStorage.getItem(PHOTO_KEY) || "";

    setFirstName(savedName);
    setPhoto(savedPhoto);
    setOpen(!savedName || !savedPhoto);
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
      setPhoto(await compressProfilePhoto(file));
    } catch (photoError) {
      console.error(photoError);
      setError("Impossible d’utiliser cette photo. Essaie avec une autre image.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  function saveProfile() {
    const normalizedName = firstName.trim();

    if (!normalizedName) {
      setError("Entre ton prénom.");
      return;
    }

    if (!photo) {
      setError("Ajoute une photo de profil.");
      return;
    }

    setSaving(true);
    setError("");

    let participantId = localStorage.getItem(PARTICIPANT_ID_KEY) || "";
    if (!participantId) {
      participantId =
        globalThis.crypto?.randomUUID?.() ||
        `participant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(PARTICIPANT_ID_KEY, participantId);
    }

    localStorage.setItem(NAME_KEY, normalizedName);
    localStorage.setItem(PHOTO_KEY, photo);

    window.dispatchEvent(
      new CustomEvent("mixparty-profile-updated", {
        detail: {
          name: normalizedName,
          photo,
          participantId,
        },
      }),
    );

    setOpen(false);
    setSaving(false);
  }

  if (!ready || !open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#05030c]/95 px-4 py-[max(1rem,env(safe-area-inset-top))] text-white backdrop-blur-2xl">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-violet-600/25 blur-[100px]" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[110px]" />

      <section className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.065] p-5 shadow-[0_35px_120px_rgba(0,0,0,.65)] backdrop-blur-2xl sm:p-7">
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />

        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 shadow-[0_0_36px_rgba(236,72,153,.3)]">
            <Sparkles className="h-6 w-6" />
          </div>

          <p className="mt-4 text-[10px] font-black uppercase tracking-[.24em] text-fuchsia-300">
            Bienvenue sur MixParty
          </p>
          <h1 className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black sm:text-3xl">
            Crée ton profil
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">
            Ton prénom et ta photo seront enregistrés sur cet appareil. Tu ne les
            renseigneras qu’une seule fois.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative mx-auto mt-6 block h-32 w-32 rounded-[30px] border border-white/15 bg-black/25 p-1 shadow-[0_20px_55px_rgba(0,0,0,.35)]"
          aria-label="Choisir une photo de profil"
        >
          <span className="absolute -inset-1 -z-10 rounded-[34px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 opacity-55 blur-md transition group-hover:opacity-85" />

          <span className="grid h-full w-full place-items-center overflow-hidden rounded-[25px] bg-[#0d0817]">
            {photo ? (
              <img src={photo} alt="Aperçu de ta photo" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-white/45">
                <UserRound className="h-9 w-9" />
                <span className="text-[10px] font-black uppercase tracking-[.14em]">
                  Ta photo
                </span>
              </span>
            )}
          </span>

          <span className="absolute -bottom-2 -right-2 grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-xl">
            {processingPhoto ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : photo ? (
              <Check className="h-5 w-5" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(event) => {
            void choosePhoto(event.target.files?.[0] || null);
            event.currentTarget.value = "";
          }}
        />

        <label className="mt-7 block">
          <span className="text-[11px] font-black uppercase tracking-[.18em] text-white/45">
            Ton prénom
          </span>
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && photo) saveProfile();
            }}
            maxLength={24}
            autoComplete="given-name"
            placeholder="Exemple : Ben"
            className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base font-bold outline-none transition placeholder:text-white/25 focus:border-fuchsia-400/50 focus:ring-4 focus:ring-fuchsia-500/10"
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={saveProfile}
          disabled={saving || processingPhoto || !firstName.trim() || !photo}
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 px-5 text-base font-black shadow-[0_16px_42px_rgba(236,72,153,.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Enregistrement…
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              Continuer sur MixParty
            </>
          )}
        </button>

        <p className="mt-4 text-center text-[11px] leading-5 text-white/30">
          Les informations restent enregistrées dans ton navigateur sur cet appareil.
        </p>
      </section>
    </div>
  );
}
