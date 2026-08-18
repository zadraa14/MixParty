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
                  return [{
                    partyCode,
                    joinedAt: Number(entry.joinedAt || Date.now()),
                    lastSeenAt: Number(entry.lastSeenAt || entry.joinedAt || Date.now()),
                    role: entry.role === "host" ? "host" : "participant",
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

  function touchActiveTime(account: MixPartyAccount, partyCodeValue: unknown) {
    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    if (!partyCode) return;

    const now = Date.now();
    const previous = Number(account.progress.activePartyLastSeen[partyCode] || 0);

    if (previous > 0) {
      const elapsed = Math.max(0, Math.min(now - previous, 60_000));
      account.progress.activeMilliseconds += elapsed;
      account.stats.activeMinutes = Math.floor(account.progress.activeMilliseconds / 60_000);
    }

    account.progress.activePartyLastSeen[partyCode] = now;
  }

  function recordPresence(token: string, partyCodeValue: unknown) {
    const account = accountMutableFromToken(token);
    if (!account) return null;

    touchActiveTime(account, partyCodeValue);
    account.updatedAt = Date.now();
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
    const existing = account.history.find((entry) => entry.partyCode === partyCode);
    if (existing) { existing.lastSeenAt = now; }
    else {
      account.history.push({ partyCode, joinedAt: now, lastSeenAt: now, role: "participant" });
      account.stats.partiesJoined += 1;
      account.updatedAt = now;
    }
    if (account.history.length > 500) account.history = account.history.slice(-500);
    save();
    return publicAccount(account);
  }

  function recordPartyHosted(token: string, partyCodeValue: unknown) {
    const account = accountMutableFromToken(token);
    if (!account) return null;
    const partyCode = String(partyCodeValue || "").trim().toUpperCase();
    if (!partyCode) return publicAccount(account);
    const now = Date.now();
    const existing = account.history.find((entry) => entry.partyCode === partyCode);
    if (existing) {
      if (existing.role !== "host") { existing.role = "host"; account.stats.partiesHosted += 1; }
      existing.lastSeenAt = now;
    } else {
      account.history.push({ partyCode, joinedAt: now, lastSeenAt: now, role: "host" });
      account.stats.partiesJoined += 1;
      account.stats.partiesHosted += 1;
    }
    account.updatedAt = now;
    touchActiveTime(account, partyCode);
    syncSimpleBadges(account, partyCode);
    save();
    return publicAccount(account);
  }

  function recordSongAdded(token: string) {
    const account = accountMutableFromToken(token);
    if (!account) return null;
    account.stats.songsAdded += 1;
    account.updatedAt = Date.now();
    syncSimpleBadges(account, account.history[account.history.length - 1]?.partyCode);
    save();
    return publicAccount(account);
  }

  function recordVoteGiven(token: string, songOwnerAccountId?: string) {
    const account = accountMutableFromToken(token);
    if (!account) return null;
    account.stats.votesGiven += 1;
    account.updatedAt = Date.now();
    if (songOwnerAccountId && songOwnerAccountId !== account.id) {
      const owner = database.accounts.find((item) => item.id === songOwnerAccountId);
      if (owner) { owner.stats.votesReceived += 1; owner.updatedAt = Date.now(); }
    }
    save();
    return publicAccount(account);
  }

  function recordVoteRemoved(token: string, songOwnerAccountId?: string) {
    const account = accountMutableFromToken(token);
    if (!account) return null;
    account.stats.votesGiven = Math.max(0, account.stats.votesGiven - 1);
    account.updatedAt = Date.now();
    if (songOwnerAccountId && songOwnerAccountId !== account.id) {
      const owner = database.accounts.find((item) => item.id === songOwnerAccountId);
      if (owner) { owner.stats.votesReceived = Math.max(0, owner.stats.votesReceived - 1); owner.updatedAt = Date.now(); }
    }
    save();
    return publicAccount(account);
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
    logout,
  };
}
