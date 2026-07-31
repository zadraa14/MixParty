import rawMixMates from "./mixmates-data.json";

export type MixMatePreference = "any" | "masculine" | "feminine";
export type MixMateRarity = "common" | "rare" | "epic" | "legendary" | "event";

export type MixMate = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  image: string;
  presentation: MixMatePreference;
  rarity: MixMateRarity;
  starter: boolean;
  event: boolean;
};

export type MixPartyProfile = {
  id: string;
  firstName: string;
  preference: MixMatePreference;
  activeMixMateId: string;
  unlockedMixMateIds: string[];
  crystals: number;
  createdAt: number;
};

export const MIXMATES = rawMixMates as MixMate[];
export const PROFILE_STORAGE_KEY = "mixparty.profile.v1";

export function getMixMate(id?: string | null) {
  return MIXMATES.find((mate) => mate.id === id) ?? MIXMATES[0];
}

export function pickStarter(preference: MixMatePreference) {
  const compatible = MIXMATES.filter(
    (mate) => mate.starter && (preference === "any" || mate.presentation === preference || mate.presentation === "any")
  );
  return compatible[Math.floor(Math.random() * compatible.length)] ?? MIXMATES.find((mate) => mate.starter) ?? MIXMATES[0];
}

export function createProfile(firstName: string, preference: MixMatePreference): MixPartyProfile {
  const starter = pickStarter(preference);
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`,
    firstName: firstName.trim(),
    preference,
    activeMixMateId: starter.id,
    unlockedMixMateIds: [starter.id],
    crystals: 0,
    createdAt: Date.now(),
  };
}

export function pickCrystalReward(profile: MixPartyProfile) {
  const locked = MIXMATES.filter((mate) => !mate.event && !profile.unlockedMixMateIds.includes(mate.id));
  if (!locked.length) return null;
  const roll = Math.random();
  const target: MixMateRarity = roll < 0.68 ? "common" : roll < 0.9 ? "rare" : roll < 0.98 ? "epic" : "legendary";
  const pool = locked.filter((mate) => mate.rarity === target);
  return (pool.length ? pool : locked)[Math.floor(Math.random() * (pool.length || locked.length))];
}
