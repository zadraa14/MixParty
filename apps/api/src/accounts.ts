import fs from "fs";
import path from "path";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "crypto";

export type MixPartyPlan = "free" | "premium";

export type MixPartyAccountStats = {
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

export type MixPartyAccountHistoryEntry = {
  partyCode: string;
  joinedAt: number;
  lastSeenAt: number;
  role: "participant" | "host";
  hostStartedAt?: number;
  participationCounted: boolean;
  hostCounted: boolean;
  participationQualifiedAt?: number;
  hostQualifiedAt?: number;
  endedAt?: number;
  durationCreditedMs: number;
};

export type MixPartyBadgeUnlock = {
  badgeId: string;
  unlockedAt: number;
  partyCode?: string;
};

export type MixPartyAccount = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatar?: string;
  createdAt: number;
  updatedAt: number;
  plan: MixPartyPlan;
  premiumTrialStartedAt?: number;
  premiumTrialEndsAt?: number;
  stats: MixPartyAccountStats;
  badges: string[];
  badgeUnlocks: MixPartyBadgeUnlock[];
  history: MixPartyAccountHistoryEntry[];
  progress: {
    playedSongKeys: string[];
    fiveVoteSongKeys: string[];
    activePartyLastSeen: Record<string, number>;
    activeMilliseconds: number;
    songAddedEvents: Array<{
      partyCode: string;
      songKey: string;
      artistKey?: string;
      addedAt: number;
    }>;
    completedSongStreak: number;
    lastCompletedSongPartyCode?: string;
  };
  customization: {
    avatarFrame?: string;
    profileTheme?: string;
    joinEffect?: string;
  };
};

type AccountSession = {
  tokenHash: string;
  accountId: string;
  createdAt: number;
  expiresAt: number;
};

type AccountsDatabase = {
  version: 1;
  updatedAt: number;
  accounts: MixPartyAccount[];
  sessions: AccountSession[];
};

export type PublicMixPartyAccount = Omit<MixPartyAccount, "passwordHash">;

const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000;
const PARTY_QUALIFICATION_MS = 30 * 60 * 1000;

const SIMPLE_BADGES = [
  {
    id: "premiere-soiree",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesJoined >= 1,
  },
  {
    id: "premier-son",
    isUnlocked: (stats: MixPartyAccountStats) => stats.songsAdded >= 1,
  },
  {
    id: "premier-vote",
    isUnlocked: (stats: MixPartyAccountStats) => stats.votesGiven >= 1,
  },
  {
    id: "premier-vote-recu",
    isUnlocked: (stats: MixPartyAccountStats) => stats.votesReceived >= 1,
  },
  {
    id: "premier-host",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesHosted >= 1,
  },
  {
    id: "habitue",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesJoined >= 5,
  },
  {
    id: "fetard",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesJoined >= 10,
  },
  {
    id: "pilier-de-soiree",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesJoined >= 25,
  },
  {
    id: "veteran-mixparty",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesJoined >= 50,
  },
  {
    id: "centurion",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesJoined >= 100,
  },
  {
    id: "supporter",
    isUnlocked: (stats: MixPartyAccountStats) => stats.votesGiven >= 50,
  },
  {
    id: "super-votant",
    isUnlocked: (stats: MixPartyAccountStats) => stats.votesGiven >= 250,
  },
  {
    id: "aimant-a-votes",
    isUnlocked: (stats: MixPartyAccountStats) => stats.votesReceived >= 100,
  },
  {
    id: "chouchou-du-public",
    isUnlocked: (stats: MixPartyAccountStats) => stats.votesReceived >= 500,
  },
  {
    id: "hitmaker",
    isUnlocked: (stats: MixPartyAccountStats) => stats.songsWith5Votes >= 10,
  },
  {
    id: "hitmaker-ii",
    isUnlocked: (stats: MixPartyAccountStats) => stats.songsWith5Votes >= 50,
  },
  {
    id: "hitmaker-iii",
    isUnlocked: (stats: MixPartyAccountStats) => stats.songsWith5Votes >= 100,
  },
  {
    id: "maitre-de-ceremonie",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesHosted >= 5,
  },
  {
    id: "maison-de-la-fete",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesHosted >= 25,
  },
  {
    id: "host-legendaire",
    isUnlocked: (stats: MixPartyAccountStats) => stats.partiesHosted >= 50,
  },
] as const;

function createDefaultStats(): MixPartyAccountStats {
  return {
    partiesJoined: 0,
    partiesHosted: 0,
    wins: 0,
    podiums: 0,
    votesGiven: 0,
    votesReceived: 0,
    songsAdded: 0,
    songsPlayed: 0,
    songsWith5Votes: 0,
    activeMinutes: 0,
  };
}

function createEmptyDatabase(): AccountsDatabase {
  return {
    version: 1,
    updatedAt: Date.now(),
    accounts: [],
    sessions: [],
  };
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function passwordMatches(password: string, stored: string) {
  try {
    const [scheme, salt, expectedHex] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !expectedHex) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicAccount(account: MixPartyAccount): PublicMixPartyAccount {
  const { passwordHash: _passwordHash, ...safe } = account;
  return safe;
}

export function createAccountsStore(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let database: AccountsDatabase = createEmptyDatabase();

  function sanitizeDatabase(value: any): AccountsDatabase {
    const accounts: MixPartyAccount[] = Array.isArray(value?.accounts)
      ? value.accounts.flatMap((raw: any) => {
          const email = normalizeEmail(raw?.email);
          const name = normalizeName(raw?.name);
          if (!raw?.id || !email || !name || !raw?.passwordHash) return [];

          return [{
            id: String(raw.id),
            email,
            passwordHash: String(raw.passwordHash),
            name,
            avatar: typeof raw.avatar === "string" && raw.avatar ? raw.avatar : undefined,
            createdAt: Number(raw.createdAt || Date.now()),
            updatedAt: Number(raw.updatedAt || raw.createdAt || Date.now()),
            plan: raw.plan === "premium" ? "premium" : "free",
            premiumTrialStartedAt: Number(raw.premiumTrialStartedAt || 0) || undefined,
            premiumTrialEndsAt: Number(raw.premiumTrialEndsAt || 0) || undefined,
            stats: {
              ...createDefaultStats(),
              ...(raw.stats && typeof raw.stats === "object" ? raw.stats : {}),
            },
            badges: Array.isArray(raw.badges) ? raw.badges.map(String) : [],
            badgeUnlocks: Array.isArray(raw.badgeUnlocks)
              ? raw.badgeUnlocks.flatMap((unlock: any) => {
                  const badgeId = String(unlock?.badgeId || "").trim();
                  if (!badgeId) return [];
                  return [{
                    badgeId,
                    unlockedAt: Number(unlock.unlockedAt || Date.now()),
                    partyCode: String(unlock.partyCode || "").trim().toUpperCase() || undefined,
                  }];
                })
              : [],
            history: Array.isArray(raw.history)
              ? raw.history.flatMap((entry: any) => {
                  const partyCode = String(entry?.partyCode || "").trim().toUpperCase();
                  if (!partyCode) return [];

                  const joinedAt = Number(entry.joinedAt || Date.now());
                  const lastSeenAt = Number(entry.lastSeenAt || joinedAt);
                  const role = entry.role === "host" ? "host" : "participant";

                  // Legacy entries were already counted immediately in older builds.
                  // Mark them as counted so the migration never awards the same soirée twice.
                  const participationCounted =
                    entry.participationCounted === undefined
                      ? true
                      : Boolean(entry.participationCounted);
                  const hostCounted =
                    entry.hostCounted === undefined
                      ? role === "host"
                      : Boolean(entry.hostCounted);

                  return [{
                    partyCode,
                    joinedAt,
                    lastSeenAt,
                    role,
                    hostStartedAt:
                      Number(entry.hostStartedAt || 0) ||
                      (role === "host" ? joinedAt : undefined),
                    participationCounted,
                    hostCounted,
                    participationQualifiedAt:
                      Number(entry.participationQualifiedAt || 0) || undefined,
                    hostQualifiedAt:
                      Number(entry.hostQualifiedAt || 0) || undefined,
                    endedAt: Number(entry.endedAt || 0) || undefined,
                    durationCreditedMs:
                      entry.durationCreditedMs === undefined
                        ? Math.max(0, lastSeenAt - joinedAt)
                        : Math.max(0, Number(entry.durationCreditedMs || 0)),
                  }];
                }).slice(-500)
              : [],
            progress: {
              playedSongKeys: Array.isArray(raw.progress?.playedSongKeys)
                ? raw.progress.playedSongKeys.map(String).slice(-2000)
                : [],
              fiveVoteSongKeys: Array.isArray(raw.progress?.fiveVoteSongKeys)
                ? raw.progress.fiveVoteSongKeys.map(String).slice(-2000)
                : [],
              activePartyLastSeen:
                raw.progress?.activePartyLastSeen && typeof raw.progress.activePartyLastSeen === "object"
                  ? raw.progress.activePartyLastSeen
                  : {},
              activeMilliseconds: Math.max(0, Number(raw.progress?.activeMilliseconds || 0)),
              songAddedEvents: Array.isArray(raw.progress?.songAddedEvents)
                ? raw.progress.songAddedEvents.flatMap((event: any) => {
                    const partyCode = String(event?.partyCode || "").trim().toUpperCase();
                    const songKey = String(event?.songKey || "").trim();
                    if (!partyCode || !songKey) return [];
                    return [{
                      partyCode,
                      songKey,
                      artistKey: String(event?.artistKey || "").trim() || undefined,
                      addedAt: Number(event?.addedAt || Date.now()),
                    }];
                  }).slice(-2000)
                : [],
              completedSongStreak: Math.max(0, Number(raw.progress?.completedSongStreak || 0)),
              lastCompletedSongPartyCode:
                String(raw.progress?.lastCompletedSongPartyCode || "").trim().toUpperCase() || undefined,
            },
            customization: {
              ...(raw.customization && typeof raw.customization === "object"
                ? raw.customization
                : {}),
            },
          }];
        })
      : [];

    const accountIds = new Set(accounts.map((account) => account.id));
    const sessions: AccountSession[] = Array.isArray(value?.sessions)
      ? value.sessions.flatMap((raw: any) => {
          const expiresAt = Number(raw?.expiresAt || 0);
          if (
            !raw?.tokenHash ||
            !raw?.accountId ||
            !accountIds.has(String(raw.accountId)) ||
            expiresAt <= Date.now()
          ) {
            return [];
          }

          return [{
            tokenHash: String(raw.tokenHash),
            accountId: String(raw.accountId),
            createdAt: Number(raw.createdAt || Date.now()),
            expiresAt,
          }];
        })
      : [];

    return {
      version: 1,
      updatedAt: Date.now(),
      accounts,
      sessions,
    };
  }

  function unlockBadge(account: MixPartyAccount, badgeId: string, partyCode?: string) {
    if (account.badges.includes(badgeId)) return false;
    account.badges.push(badgeId);
    account.badgeUnlocks.push({
      badgeId,
      unlockedAt: Date.now(),
      partyCode: String(partyCode || "").trim().toUpperCase() || undefined,
    });
    account.updatedAt = Date.now();
    return true;
  }

  function syncSimpleBadges(account: MixPartyAccount, partyCode?: string) {
    const known = new Set(account.badges);
    let changed = false;

    for (const badge of SIMPLE_BADGES) {
      if (known.has(badge.id) || !badge.isUnlocked(account.stats)) continue;

      account.badges.push(badge.id);
      account.badgeUnlocks.push({
        badgeId: badge.id,
        unlockedAt: Date.now(),
        partyCode: String(partyCode || "").trim().toUpperCase() || undefined,
      });
      known.add(badge.id);
      changed = true;
    }

    if (changed) account.updatedAt = Date.now();
  }

  function save() {
    database.updatedAt = Date.now();
    database.sessions = database.sessions.filter(
      (session) => session.expiresAt > Date.now(),
    );

    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(database, null, 2), "utf8");
    fs.renameSync(tempPath, filePath);
  }

  function load() {
    if (!fs.existsSync(filePath)) {
      database = createEmptyDatabase();
      save();
      return;
    }

    try {
      database = sanitizeDatabase(
        JSON.parse(fs.readFileSync(filePath, "utf8")),
      );
      for (const account of database.accounts) {
        syncSimpleBadges(account);
      }
      save();
    } catch (error) {
      console.error("MixParty Accounts: impossible de lire accounts.json", error);
      database = createEmptyDatabase();
      save();
    }
  }

  function createSession(accountId: string) {
    const token = randomBytes(32).toString("base64url");
    const now = Date.now();

    database.sessions.push({
      tokenHash: hashToken(token),
      accountId,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    });

    save();
    return token;
  }

  function accountFromToken(token: string) {
    const tokenHash = hashToken(token);
    const session = database.sessions.find(
      (item) => item.tokenHash === tokenHash && item.expiresAt > Date.now(),
    );
    if (!session) return null;

    const account = database.accounts.find(
      (item) => item.id === session.accountId,
    );
    return account || null;
  }

  function register(input: {
    email: unknown;
    password: unknown;
    name: unknown;
    avatar?: unknown;
  }) {
    const email = normalizeEmail(input.email);
    const name = normalizeName(input.name);
    const password = String(input.password || "");

    if (!validateEmail(email)) {
      throw new Error("EMAIL_INVALID");
    }

    if (password.length < 8 || password.length > 200) {
      throw new Error("PASSWORD_INVALID");
    }

    if (name.length < 2) {
      throw new Error("NAME_INVALID");
    }

    if (database.accounts.some((account) => account.email === email)) {
      throw new Error("EMAIL_ALREADY_USED");
    }

    const now = Date.now();
    const account: MixPartyAccount = {
      id: randomUUID(),
      email,
      passwordHash: hashPassword(password),
      name,
      avatar:
        typeof input.avatar === "string" && input.avatar.length <= 1_500_000
          ? input.avatar
          : undefined,
      createdAt: now,
      updatedAt: now,
      plan: "free",
      stats: createDefaultStats(),
      badges: [],
      badgeUnlocks: [],
      history: [],
      progress: {
        playedSongKeys: [],
        fiveVoteSongKeys: [],
        activePartyLastSeen: {},
        activeMilliseconds: 0,
        songAddedEvents: [],
        completedSongStreak: 0,
      },
      customization: {},
    };

    database.accounts.push(account);
    save();

    return {
      account: publicAccount(account),
      token: createSession(account.id),
    };
  }

  function login(input: { email: unknown; password: unknown }) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || "");
    const account = database.accounts.find((item) => item.email === email);

    if (!account || !passwordMatches(password, account.passwordHash)) {
      throw new Error("INVALID_CREDENTIALS");
    }

    return {
      account: publicAccount(account),
      token: createSession(account.id),
    };
  }

  function authenticate(token: string) {
    const account = accountFromToken(token);
    return account ? publicAccount(account) : null;
  }

  function updateProfile(
    token: string,
    input: { name?: unknown; avatar?: unknown },
  ) {
    const account = accountFromToken(token);
    if (!account) throw new Error("UNAUTHORIZED");

    if (input.name !== undefined) {
      const name = normalizeName(input.name);
      if (name.length < 2) throw new Error("NAME_INVALID");
      account.name = name;
    }

    if (input.avatar !== undefined) {
      const avatar = String(input.avatar || "");
      if (avatar.length > 1_500_000) throw new Error("AVATAR_TOO_LARGE");
      account.avatar = avatar || undefined;
    }

    account.updatedAt = Date.now();
    save();
    return publicAccount(account);
  }

  function accountMutableFromToken(token: string) {
    return accountFromToken(token);
  }

  function creditPartyElapsedTime(
    account: MixPartyAccount,
    entry: MixPartyAccountHistoryEntry,
    effectiveNowValue: unknown,
  ) {
    const effectiveNow = Math.max(
      entry.joinedAt,
      Number(effectiveNowValue || Date.now()),
    );
    const elapsedMs = Math.max(0, effectiveNow - entry.joinedAt);
    const deltaMs = Math.max(0, elapsedMs - entry.durationCreditedMs);

    if (deltaMs > 0) {
      account.progress.activeMilliseconds += deltaMs;
      entry.durationCreditedMs = elapsedMs;
      account.stats.activeMinutes = Math.floor(
        account.progress.activeMilliseconds / 60_000,
      );
    }
  }

  function qualifyPartyEntry(
    account: MixPartyAccount,
    entry: MixPartyAccountHistoryEntry,
    effectiveNowValue: unknown,
  ) {
    const effectiveNow = Math.max(
      entry.joinedAt,
      Number(effectiveNowValue || Date.now()),
    );

    creditPartyElapsedTime(account, entry, effectiveNow);

    if (
      !entry.participationCounted &&
      effectiveNow - entry.joinedAt >= PARTY_QUALIFICATION_MS
    ) {
      entry.participationCounted = true;
      entry.participationQualifiedAt = entry.joinedAt + PARTY_QUALIFICATION_MS;
      account.stats.partiesJoined += 1;
      syncSimpleBadges(account, entry.partyCode);
    }

    const hostStartedAt = Number(entry.hostStartedAt || 0);
    if (
      entry.role === "host" &&
      hostStartedAt > 0 &&
      !entry.hostCounted &&
      effectiveNow - hostStartedAt >= PARTY_QUALIFICATION_MS
    ) {
      entry.hostCounted = true;
      entry.hostQualifiedAt = hostStartedAt + PARTY_QUALIFICATION_MS;
      account.stats.partiesHosted += 1;
      syncSimpleBadges(account, entry.partyCode);
    }

    account.updatedAt = Date.now();
  }

  function recordPresence(token: string, partyCodeValue: unknown) {
    const account = accountMutableFromToken(token);
    if (!account) return null;

    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    if (!partyCode) return publicAccount(account);

    const now = Date.now();
    let entry = account.history.find((item) => item.partyCode === partyCode);

    if (!entry) {
      entry = {
        partyCode,
        joinedAt: now,
        lastSeenAt: now,
        role: "participant",
        participationCounted: false,
        hostCounted: false,
        durationCreditedMs: 0,
      };
      account.history.push(entry);
    }

    entry.lastSeenAt = now;
    qualifyPartyEntry(account, entry, now);

    if (account.history.length > 500) {
      account.history = account.history.slice(-500);
    }

    save();
    return publicAccount(account);
  }

  function recordSongPlayedByAccountId(
    accountId: string | undefined,
    partyCodeValue: unknown,
    songKeyValue: unknown,
    votesValue: unknown,
  ) {
    if (!accountId) return null;
    const account = database.accounts.find((item) => item.id === accountId);
    if (!account) return null;

    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    const rawSongKey = String(songKeyValue || "").trim();
    if (!partyCode || !rawSongKey) return publicAccount(account);

    const songKey = `${partyCode}:${rawSongKey}`;

    if (!account.progress.playedSongKeys.includes(songKey)) {
      account.progress.playedSongKeys.push(songKey);
      account.progress.playedSongKeys = account.progress.playedSongKeys.slice(-2000);
      account.stats.songsPlayed += 1;
    }

    if (Number(votesValue || 0) >= 5 && !account.progress.fiveVoteSongKeys.includes(songKey)) {
      account.progress.fiveVoteSongKeys.push(songKey);
      account.progress.fiveVoteSongKeys = account.progress.fiveVoteSongKeys.slice(-2000);
      account.stats.songsWith5Votes += 1;
    }

    account.updatedAt = Date.now();
    save();
    return publicAccount(account);
  }

  function recordSongReachedFiveVotesByAccountId(
    accountId: string | undefined,
    partyCodeValue: unknown,
    songKeyValue: unknown,
  ) {
    if (!accountId) return null;
    const account = database.accounts.find((item) => item.id === accountId);
    if (!account) return null;

    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    const rawSongKey = String(songKeyValue || "").trim();
    if (!partyCode || !rawSongKey) return publicAccount(account);

    const songKey = `${partyCode}:${rawSongKey}`;
    if (!account.progress.fiveVoteSongKeys.includes(songKey)) {
      account.progress.fiveVoteSongKeys.push(songKey);
      account.progress.fiveVoteSongKeys = account.progress.fiveVoteSongKeys.slice(-2000);
      account.stats.songsWith5Votes += 1;
      account.updatedAt = Date.now();
      save();
    }

    return publicAccount(account);
  }

  function recordPartyJoined(token: string, partyCodeValue: unknown) {
    const account = accountMutableFromToken(token);
    if (!account) return null;

    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    if (!partyCode) return publicAccount(account);

    const now = Date.now();
    let entry = account.history.find((item) => item.partyCode === partyCode);

    if (!entry) {
      entry = {
        partyCode,
        joinedAt: now,
        lastSeenAt: now,
        role: "participant",
        participationCounted: false,
        hostCounted: false,
        durationCreditedMs: 0,
      };
      account.history.push(entry);
    } else {
      entry.lastSeenAt = now;
    }

    qualifyPartyEntry(account, entry, now);

    if (account.history.length > 500) {
      account.history = account.history.slice(-500);
    }

    save();
    return publicAccount(account);
  }

  function recordPartyHosted(token: string, partyCodeValue: unknown) {
    const account = accountMutableFromToken(token);
    if (!account) return null;

    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    if (!partyCode) return publicAccount(account);

    const now = Date.now();
    let entry = account.history.find((item) => item.partyCode === partyCode);

    if (!entry) {
      entry = {
        partyCode,
        joinedAt: now,
        lastSeenAt: now,
        role: "host",
        hostStartedAt: now,
        participationCounted: false,
        hostCounted: false,
        durationCreditedMs: 0,
      };
      account.history.push(entry);
    } else {
      entry.lastSeenAt = now;
      if (entry.role !== "host") {
        entry.role = "host";
        entry.hostStartedAt = now;
        entry.hostCounted = false;
        entry.hostQualifiedAt = undefined;
      } else if (!entry.hostStartedAt) {
        entry.hostStartedAt = entry.joinedAt;
      }
    }

    qualifyPartyEntry(account, entry, now);

    if (account.history.length > 500) {
      account.history = account.history.slice(-500);
    }

    save();
    return publicAccount(account);
  }

  function recordSongAdded(
    token: string,
    partyCodeValue?: unknown,
    songKeyValue?: unknown,
    artistNameValue?: unknown,
    addedAtValue?: unknown,
  ) {
    const account = accountMutableFromToken(token);
    if (!account) return null;

    account.stats.songsAdded += 1;
    account.updatedAt = Date.now();

    const partyCode = String(
      partyCodeValue || account.history[account.history.length - 1]?.partyCode || "",
    ).trim().toUpperCase();
    const songKey = String(songKeyValue || "").trim();
    const artistKey = String(artistNameValue || "")
      .trim()
      .toLocaleLowerCase("fr-FR")
      .replace(/\s+/g, " ");
    const addedAt = Number(addedAtValue || Date.now());

    if (partyCode && songKey) {
      const exists = account.progress.songAddedEvents.some(
        (event) => event.partyCode === partyCode && event.songKey === songKey,
      );

      if (!exists) {
        account.progress.songAddedEvents.push({
          partyCode,
          songKey,
          artistKey: artistKey || undefined,
          addedAt,
        });
        account.progress.songAddedEvents = account.progress.songAddedEvents.slice(-2000);
      }

      if (artistKey) {
        const recent = account.progress.songAddedEvents.filter(
          (event) =>
            event.partyCode === partyCode &&
            event.artistKey === artistKey &&
            addedAt - event.addedAt >= 0 &&
            addedAt - event.addedAt <= 10 * 60 * 1000,
        );

        if (new Set(recent.map((event) => event.songKey)).size >= 3) {
          unlockBadge(account, "encore-lui", partyCode);
        }
      }
    }

    syncSimpleBadges(account, partyCode);
    save();
    return publicAccount(account);
  }

  function recordVoteGiven(token: string, songOwnerAccountId?: string) {
    const account = accountMutableFromToken(token);
    if (!account) return null;
    account.stats.votesGiven += 1;
    account.updatedAt = Date.now();
    save();
    return publicAccount(account);
  }

  function recordVoteRemoved(token: string, songOwnerAccountId?: string) {
    const account = accountMutableFromToken(token);
    if (!account) return null;
    account.stats.votesGiven = Math.max(0, account.stats.votesGiven - 1);
    account.updatedAt = Date.now();
    save();
    return publicAccount(account);
  }

  function finalizePartyParticipation(
    partyCodeValue: unknown,
    endedAtValue: unknown,
  ) {
    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    if (!partyCode) return;

    const endedAt = Number(endedAtValue || Date.now());
    let changed = false;

    for (const account of database.accounts) {
      const entry = account.history.find((item) => item.partyCode === partyCode);
      if (!entry || entry.endedAt) continue;

      const effectiveEnd = Math.max(entry.joinedAt, endedAt);
      entry.lastSeenAt = Math.max(entry.lastSeenAt, effectiveEnd);
      entry.endedAt = effectiveEnd;
      qualifyPartyEntry(account, entry, effectiveEnd);
      changed = true;
    }

    if (changed) save();
  }

  function recordSongVoteMilestoneByAccountId(
    accountId: string | undefined,
    partyCodeValue: unknown,
    songKeyValue: unknown,
    votesValue: unknown,
    addedAtValue: unknown,
    firstVoteAtValue?: unknown,
  ) {
    if (!accountId) return null;
    const account = database.accounts.find((item) => item.id === accountId);
    if (!account) return null;

    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    const rawSongKey = String(songKeyValue || "").trim();
    const votes = Math.max(0, Number(votesValue || 0));
    const addedAt = Number(addedAtValue || 0);
    const firstVoteAt = Number(firstVoteAtValue || 0);

    if (votes >= 10) unlockBadge(account, "banger", partyCode);
    if (votes >= 25) unlockBadge(account, "banger-nucleaire", partyCode);

    if (votes >= 10 && addedAt > 0 && firstVoteAt > 0 && firstVoteAt - addedAt >= 30 * 60 * 1000) {
      unlockBadge(account, "secret-comeback", partyCode);
    }

    if (partyCode && rawSongKey && votes >= 5) {
      const qualified = new Set(
        account.progress.fiveVoteSongKeys
          .filter((key) => key.startsWith(`${partyCode}:`))
          .map((key) => key.slice(partyCode.length + 1)),
      );
      const owned = new Set(
        account.progress.songAddedEvents
          .filter((event) => event.partyCode === partyCode)
          .map((event) => event.songKey),
      );
      if ([...qualified].filter((key) => owned.has(key)).length >= 5) {
        unlockBadge(account, "secret-jackpot", partyCode);
      }
    }

    account.updatedAt = Date.now();
    save();
    return publicAccount(account);
  }

  function recordSongPlaybackOutcomeByAccountId(
    accountId: string | undefined,
    partyCodeValue: unknown,
    completedValue: unknown,
  ) {
    if (!accountId) return null;
    const account = database.accounts.find((item) => item.id === accountId);
    if (!account) return null;

    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    const completed = Boolean(completedValue);

    if (completed) {
      if (account.progress.lastCompletedSongPartyCode !== partyCode) {
        account.progress.completedSongStreak = 0;
      }
      account.progress.completedSongStreak += 1;
      account.progress.lastCompletedSongPartyCode = partyCode;

      if (account.progress.completedSongStreak >= 5) {
        unlockBadge(account, "dans-le-mille", partyCode);
      }
    } else {
      account.progress.completedSongStreak = 0;
      account.progress.lastCompletedSongPartyCode = partyCode || undefined;
    }

    account.updatedAt = Date.now();
    save();
    return publicAccount(account);
  }

  function recordVoteReceivedByAccountId(accountId: string | undefined) {
    if (!accountId) return null;
    const owner = database.accounts.find((item) => item.id === accountId);
    if (!owner) return null;

    owner.stats.votesReceived += 1;
    owner.updatedAt = Date.now();
    save();
    return publicAccount(owner);
  }

  function recordVoteReceivedRemovedByAccountId(accountId: string | undefined) {
    if (!accountId) return null;
    const owner = database.accounts.find((item) => item.id === accountId);
    if (!owner) return null;

    owner.stats.votesReceived = Math.max(0, owner.stats.votesReceived - 1);
    owner.updatedAt = Date.now();
    save();
    return publicAccount(owner);
  }

  function logout(token: string) {
    const tokenHash = hashToken(token);
    const previousLength = database.sessions.length;
    database.sessions = database.sessions.filter(
      (session) => session.tokenHash !== tokenHash,
    );
    if (database.sessions.length !== previousLength) save();
  }

  load();

  return {
    register,
    login,
    authenticate,
    updateProfile,
    recordPartyJoined,
    recordPartyHosted,
    recordPresence,
    recordSongPlayedByAccountId,
    recordSongReachedFiveVotesByAccountId,
    recordSongAdded,
    recordVoteGiven,
    recordVoteRemoved,
    recordSongVoteMilestoneByAccountId,
    recordSongPlaybackOutcomeByAccountId,
    finalizePartyParticipation,
    recordVoteReceivedByAccountId,
    recordVoteReceivedRemovedByAccountId,
    logout,
  };
}
