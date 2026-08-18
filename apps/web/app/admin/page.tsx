"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  LockKeyhole,
  Minus,
  Music2,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  TestTube2,
  UnlockKeyhole,
  Users,
  Vote,
  Zap,
} from "lucide-react";
import { getApiBaseUrl } from "../../lib/config";
import MixPartyBackground from "../../components/MixPartyBackground";

const ACCOUNT_TOKEN_KEY = "mixparty.account.token.v1";

type AdminSong = {
  index: number;
  title: string;
  artistName?: string;
  videoId: string;
  votes: number;
  played: boolean;
  addedBy: string;
  addedByAccountId?: string;
  addedAt: number;
};

type AdminParty = {
  code: string;
  createdAt: number;
  lastActivityAt: number;
  currentSong: number | null;
  participants: number;
  songs: AdminSong[];
};

type AdminIdentity = {
  id: string;
  email: string;
  name: string;
};

type AdminAccount = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
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
};

async function adminFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";
  const headers = new Headers(init?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export default function AdminPage() {
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [parties, setParties] = useState<AdminParty[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [badgeId, setBadgeId] = useState("banger");

  const selectedParty = useMemo(
    () => parties.find((party) => party.code === selectedCode) || parties[0] || null,
    [parties, selectedCode],
  );

  const selectedAccount = useMemo(
    () =>
      accounts.find((account) => account.id === selectedAccountId) ||
      accounts.find((account) => account.id === identity?.id) ||
      accounts[0] ||
      null,
    [accounts, selectedAccountId, identity?.id],
  );

  async function refresh() {
    setError("");
    setNotice("");

    try {
      const meResponse = await adminFetch("/admin/me");
      const meBody = await meResponse.json();

      if (!meResponse.ok) {
        if (meBody?.error === "ADMIN_NOT_CONFIGURED") {
          throw new Error(
            "La console Admin n'est pas encore configurée sur Railway. Ajoute MIXPARTY_ADMIN_EMAILS avec l'e-mail de ton compte.",
          );
        }
        throw new Error("Accès Admin refusé pour ce compte.");
      }

      setIdentity(meBody.account);

      const accountsResponse = await adminFetch("/admin/accounts");
      const accountsBody = await accountsResponse.json();

      if (!accountsResponse.ok) {
        throw new Error(accountsBody?.error || "Impossible de charger les comptes.");
      }

      const nextAccounts = Array.isArray(accountsBody.accounts) ? accountsBody.accounts : [];
      setAccounts(nextAccounts);

      if (!selectedAccountId && meBody.account?.id) {
        setSelectedAccountId(meBody.account.id);
      } else if (
        selectedAccountId &&
        !nextAccounts.some((item: AdminAccount) => item.id === selectedAccountId)
      ) {
        setSelectedAccountId(meBody.account?.id || nextAccounts[0]?.id || "");
      }

      const partiesResponse = await adminFetch("/admin/parties");
      const partiesBody = await partiesResponse.json();

      if (!partiesResponse.ok) {
        throw new Error(partiesBody?.error || "Impossible de charger les soirées.");
      }

      const nextParties = Array.isArray(partiesBody.parties) ? partiesBody.parties : [];
      setParties(nextParties);

      if (!selectedCode && nextParties[0]?.code) {
        setSelectedCode(nextParties[0].code);
      } else if (
        selectedCode &&
        !nextParties.some((party: AdminParty) => party.code === selectedCode)
      ) {
        setSelectedCode(nextParties[0]?.code || "");
      }
    } catch (err) {
      setIdentity(null);
      setParties([]);
      setError(err instanceof Error ? err.message : "Erreur Admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function runAction(key: string, path: string, body: unknown, success: string) {
    setBusy(key);
    setError("");
    setNotice("");

    try {
      const response = await adminFetch(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Action Admin impossible.");
      }

      setNotice(success);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur Admin.");
    } finally {
      setBusy("");
    }
  }

  async function simulateVotes(song: AdminSong, delta: number) {
    if (!selectedParty) return;
    await runAction(
      `vote-${song.index}-${delta}`,
      `/admin/party/${selectedParty.code}/song/${song.index}/simulate-votes`,
      { delta },
      `${delta > 0 ? "+" : ""}${delta} vote(s) simulé(s) sur ${song.title}.`,
    );
  }

  async function simulateOutcome(song: AdminSong, outcome: "completed" | "skipped") {
    if (!selectedParty) return;
    await runAction(
      `${outcome}-${song.index}`,
      `/admin/party/${selectedParty.code}/song/${song.index}/outcome`,
      { outcome },
      outcome === "completed"
        ? `${song.title} marqué comme joué jusqu'au bout.`
        : `${song.title} simulé comme skip.`,
    );
  }

  async function advanceTime(minutes: number) {
    if (!selectedParty) return;
    await runAction(
      `time-${minutes}`,
      "/admin/account/me/advance-party",
      { partyCode: selectedParty.code, minutes },
      `Temps de test avancé de ${minutes} minute(s) pour ${selectedParty.code}.`,
    );
  }

  async function setBadge(unlocked: boolean) {
    if (!badgeId.trim()) return;
    await runAction(
      `badge-${unlocked}`,
      "/admin/account/me/badge",
      {
        badgeId: badgeId.trim(),
        unlocked,
        partyCode: selectedParty?.code,
      },
      unlocked
        ? `Badge ${badgeId.trim()} débloqué en mode test.`
        : `Badge ${badgeId.trim()} reverrouillé.`,
    );
  }

  async function resetSelectedAccountStats() {
    if (!selectedAccount) return;

    const confirmed = window.confirm(
      `Remettre toutes les stats de ${selectedAccount.name || selectedAccount.email} à zéro ?\n\nLes badges déjà débloqués seront conservés.`,
    );
    if (!confirmed) return;

    await runAction(
      `reset-${selectedAccount.id}`,
      `/admin/account/${selectedAccount.id}/reset-stats`,
      {},
      `Stats de ${selectedAccount.name || selectedAccount.email} remises à zéro.`,
    );
  }

  async function scenarioComeback(song: AdminSong) {
    if (!selectedParty) return;
    await runAction(
      `scenario-comeback-${song.index}`,
      `/admin/party/${selectedParty.code}/song/${song.index}/scenario-comeback`,
      {},
      `Scénario COMEBACK appliqué à ${song.title}.`,
    );
  }

  async function scenarioJackpot() {
    if (!selectedParty || !selectedAccount) return;
    await runAction(
      "scenario-jackpot",
      `/admin/party/${selectedParty.code}/scenario-jackpot`,
      { accountId: selectedAccount.id },
      `Scénario JACKPOT appliqué au compte ${selectedAccount.name || selectedAccount.email}.`,
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090611] text-white">
      <MixPartyBackground />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-black text-white/75 backdrop-blur-xl transition hover:bg-white/[0.09]"
          >
            <ArrowLeft className="h-4 w-4" />
            Profil
          </Link>

          <button
            type="button"
            onClick={refresh}
            disabled={busy !== ""}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.07] px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/[0.12] disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>

        <section className="mt-5 overflow-hidden rounded-[34px] border border-red-300/15 bg-gradient-to-br from-red-500/[0.12] via-fuchsia-500/[0.07] to-violet-500/[0.08] p-5 shadow-2xl shadow-red-950/20 backdrop-blur-2xl sm:p-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-red-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Mode Admin — actions de test
              </div>
              <h1 className="mt-4 font-[family:var(--font-exo-2)] text-3xl font-black sm:text-5xl">
                Console MixParty
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                Simule des votes, des skips, du temps de soirée et des badges sans polluer PartyBrain.
              </p>
            </div>

            {identity && (
              <div className="rounded-[24px] border border-emerald-300/15 bg-emerald-500/[0.06] px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-300">
                  Admin authentifié
                </p>
                <p className="mt-1 font-black">{identity.name}</p>
                <p className="text-xs text-white/35">{identity.email}</p>
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center text-white/45">
            Chargement de la console…
          </div>
        ) : error && !identity ? (
          <div className="mt-6 rounded-[28px] border border-red-300/15 bg-red-500/[0.08] p-6">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 text-red-300" />
              <div>
                <p className="font-black text-red-100">Console verrouillée</p>
                <p className="mt-2 text-sm leading-6 text-white/55">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {(error || notice) && (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
                  error
                    ? "border-red-300/15 bg-red-500/[0.08] text-red-100"
                    : "border-emerald-300/15 bg-emerald-500/[0.07] text-emerald-100"
                }`}
              >
                {error || notice}
              </div>
            )}

            <section className="mt-6 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <TestTube2 className="h-4 w-4 text-fuchsia-300" />
                  <h2 className="font-black">Soirées actives</h2>
                </div>

                <div className="mt-4 space-y-2">
                  {parties.length === 0 ? (
                    <p className="rounded-2xl border border-white/5 bg-black/15 p-4 text-sm text-white/35">
                      Aucune soirée active.
                    </p>
                  ) : (
                    parties.map((party) => (
                      <button
                        key={party.code}
                        type="button"
                        onClick={() => setSelectedCode(party.code)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selectedParty?.code === party.code
                            ? "border-fuchsia-300/25 bg-fuchsia-500/[0.10]"
                            : "border-white/6 bg-black/15 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-[family:var(--font-exo-2)] text-lg font-black">
                            {party.code}
                          </span>
                          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-white/50">
                            {party.songs.length} titres
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-white/35">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {party.participants}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Music2 className="h-3.5 w-3.5" />
                            {party.currentSong === null ? "Aucun titre" : `#${party.currentSong + 1}`}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="mt-5 border-t border-white/[0.07] pt-5">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-300">
                    Compte de test
                  </p>

                  <select
                    value={selectedAccount?.id || ""}
                    onChange={(event) => setSelectedAccountId(event.target.value)}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-[#15101f] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-violet-300/30"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name || account.email} — {account.email}
                      </option>
                    ))}
                  </select>

                  {selectedAccount && (
                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-white/45">
                        <span>Soirées <b className="text-white/80">{selectedAccount.stats.partiesJoined}</b></span>
                        <span>Votes reçus <b className="text-white/80">{selectedAccount.stats.votesReceived}</b></span>
                        <span>Morceaux <b className="text-white/80">{selectedAccount.stats.songsAdded}</b></span>
                        <span>Badges <b className="text-white/80">{selectedAccount.badges.length}</b></span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={busy !== "" || !selectedAccount}
                    onClick={resetSelectedAccountStats}
                    className="mt-3 w-full rounded-xl border border-red-300/15 bg-red-500/[0.08] px-3 py-2.5 text-xs font-black text-red-100 transition hover:bg-red-500/[0.14] disabled:opacity-40"
                  >
                    Remettre les stats à zéro
                  </button>
                  <p className="mt-2 text-[10px] leading-4 text-white/25">
                    Remet les compteurs, l'historique de participation et les données de test à zéro. Les badges déjà obtenus restent conservés.
                  </p>
                </div>

                {selectedParty && (
                  <div className="mt-5 border-t border-white/[0.07] pt-5">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-300">
                      Temps de test — ton compte
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[30, 300, 480].map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          disabled={busy !== ""}
                          onClick={() => advanceTime(minutes)}
                          className="rounded-xl border border-cyan-300/10 bg-cyan-400/[0.06] px-3 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/[0.11] disabled:opacity-40"
                        >
                          <Clock3 className="mx-auto mb-1 h-4 w-4" />
                          {minutes === 30 ? "+30 min" : minutes === 300 ? "+5 h" : "+8 h"}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={busy !== "" || !selectedAccount}
                      onClick={scenarioJackpot}
                      className="mt-3 w-full rounded-xl border border-amber-300/15 bg-amber-500/[0.08] px-3 py-2.5 text-xs font-black text-amber-100 transition hover:bg-amber-500/[0.14] disabled:opacity-40"
                    >
                      🎰 Scénario JACKPOT
                    </button>
                  </div>
                )}

                <div className="mt-5 border-t border-white/[0.07] pt-5">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-300">
                    Badge de test
                  </p>
                  <input
                    value={badgeId}
                    onChange={(event) => setBadgeId(event.target.value)}
                    placeholder="ex: banger"
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold outline-none placeholder:text-white/20 focus:border-fuchsia-300/30"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy !== ""}
                      onClick={() => setBadge(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300/10 bg-emerald-500/[0.07] px-3 py-2.5 text-xs font-black text-emerald-100 disabled:opacity-40"
                    >
                      <UnlockKeyhole className="h-3.5 w-3.5" />
                      Débloquer
                    </button>
                    <button
                      type="button"
                      disabled={busy !== ""}
                      onClick={() => setBadge(false)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-black text-white/60 disabled:opacity-40"
                    >
                      <LockKeyhole className="h-3.5 w-3.5" />
                      Reverrouiller
                    </button>
                  </div>
                </div>
              </aside>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
                {!selectedParty ? (
                  <div className="grid min-h-[360px] place-items-center text-center">
                    <div>
                      <Zap className="mx-auto h-9 w-9 text-white/15" />
                      <p className="mt-3 font-black text-white/45">Sélectionne une soirée active.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[.17em] text-fuchsia-300">
                          Soirée {selectedParty.code}
                        </p>
                        <h2 className="mt-1 font-[family:var(--font-exo-2)] text-2xl font-black">
                          Simulateur de morceaux
                        </h2>
                      </div>
                      <div className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs font-black text-white/45">
                        {selectedParty.songs.length} morceaux
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {selectedParty.songs.length === 0 ? (
                        <div className="rounded-2xl border border-white/5 bg-black/15 p-8 text-center text-sm text-white/35">
                          Ajoute au moins un morceau à la soirée pour lancer les tests.
                        </div>
                      ) : (
                        selectedParty.songs.map((song) => (
                          <article
                            key={`${selectedParty.code}-${song.index}-${song.videoId}`}
                            className="rounded-[22px] border border-white/[0.07] bg-black/15 p-4"
                          >
                            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white/35">
                                    #{song.index + 1}
                                  </span>
                                  {song.played && (
                                    <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">
                                      JOUÉ
                                    </span>
                                  )}
                                </div>
                                <p className="mt-2 truncate font-black">{song.title}</p>
                                <p className="mt-1 truncate text-xs text-white/35">
                                  {song.artistName || "Artiste inconnu"} · ajouté par {song.addedBy}
                                </p>
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/10 bg-fuchsia-500/[0.06] px-2.5 py-1 text-xs font-black text-fuchsia-100">
                                  <Vote className="h-3.5 w-3.5" />
                                  {song.votes} votes
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {[1, 5, 10, 25].map((delta) => (
                                  <button
                                    key={delta}
                                    type="button"
                                    disabled={busy !== ""}
                                    onClick={() => simulateVotes(song, delta)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-300/10 bg-emerald-500/[0.06] px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-500/[0.11] disabled:opacity-40"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    {delta}
                                  </button>
                                ))}

                                {[1, 5, 10].map((delta) => (
                                  <button
                                    key={`minus-${delta}`}
                                    type="button"
                                    disabled={busy !== ""}
                                    onClick={() => simulateVotes(song, -delta)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-red-300/10 bg-red-500/[0.05] px-3 py-2 text-xs font-black text-red-100 hover:bg-red-500/[0.10] disabled:opacity-40"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                    {delta}
                                  </button>
                                ))}

                                <button
                                  type="button"
                                  disabled={busy !== ""}
                                  onClick={() => scenarioComeback(song)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300/10 bg-violet-500/[0.06] px-3 py-2 text-xs font-black text-violet-100 hover:bg-violet-500/[0.11] disabled:opacity-40"
                                >
                                  ⚡ COMEBACK
                                </button>

                                <button
                                  type="button"
                                  disabled={busy !== ""}
                                  onClick={() => simulateOutcome(song, "completed")}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/10 bg-cyan-500/[0.06] px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-500/[0.11] disabled:opacity-40"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  Joué
                                </button>

                                <button
                                  type="button"
                                  disabled={busy !== ""}
                                  onClick={() => simulateOutcome(song, "skipped")}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/10 bg-amber-500/[0.06] px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-500/[0.11] disabled:opacity-40"
                                >
                                  <SkipForward className="h-3.5 w-3.5" />
                                  Skip
                                </button>
                              </div>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </>
                )}
              </section>
            </section>

            <section className="mt-5 rounded-[24px] border border-white/[0.07] bg-black/15 p-4 text-xs leading-5 text-white/35">
              <div className="flex items-center gap-2 font-black text-white/55">
                <BadgeCheck className="h-4 w-4 text-emerald-300" />
                Sécurité
              </div>
              <p className="mt-2">
                Les autorisations sont contrôlées par l'API. Connaître l'URL /admin ne suffit pas.
                Les actions de test sont écrites dans <span className="font-mono text-white/55">admin-audit.jsonl</span>.
                Les votes Admin ne sont pas envoyés à PartyBrain.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
