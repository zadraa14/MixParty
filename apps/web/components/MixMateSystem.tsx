"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Check, Gem, LockKeyhole, Shuffle, Sparkles, UserRound, X } from "lucide-react";
import {
  createProfile,
  getMixMate,
  MIXMATES,
  MixMatePreference,
  MixPartyProfile,
  pickCrystalReward,
  PROFILE_STORAGE_KEY,
} from "../lib/mixmates";

type ProfileContextValue = {
  profile: MixPartyProfile | null;
  activeMixMate: ReturnType<typeof getMixMate>;
  ready: boolean;
  saveProfile: (next: MixPartyProfile) => void;
  openCollection: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useMixPartyProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useMixPartyProfile doit être utilisé dans MixMateSystem");
  return value;
}

const rarityLabel = {
  common: "Commun",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  event: "Événementiel",
};

export default function MixMateSystem({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<MixPartyProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) setProfile(JSON.parse(saved));
    } catch {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  function saveProfile(next: MixPartyProfile) {
    setProfile(next);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem("playerName", next.firstName);
  }

  const activeMixMate = getMixMate(profile?.activeMixMateId);
  const value = useMemo(
    () => ({ profile, activeMixMate, ready, saveProfile, openCollection: () => setCollectionOpen(true) }),
    [profile, activeMixMate, ready]
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
      {ready && !profile && <ProfileOnboarding onComplete={saveProfile} />}
      {ready && profile && (
        <button className="mixmate-dock" onClick={() => setCollectionOpen(true)} aria-label="Ouvrir ma collection MixMates">
          <img src={activeMixMate.image} alt={activeMixMate.name} />
          <span><strong>{profile.firstName}</strong><small>{activeMixMate.name}</small></span>
          <Sparkles size={18} />
        </button>
      )}
      {collectionOpen && profile && (
        <CollectionModal profile={profile} saveProfile={saveProfile} onClose={() => setCollectionOpen(false)} />
      )}
    </ProfileContext.Provider>
  );
}

function ProfileOnboarding({ onComplete }: { onComplete: (profile: MixPartyProfile) => void }) {
  const [firstName, setFirstName] = useState("");
  const [preference, setPreference] = useState<MixMatePreference>("any");
  const [reveal, setReveal] = useState<ReturnType<typeof getMixMate> | null>(null);

  function submit() {
    if (!firstName.trim()) return;
    const created = createProfile(firstName, preference);
    const mate = getMixMate(created.activeMixMateId);
    setReveal(mate);
    window.setTimeout(() => onComplete(created), 2200);
  }

  return (
    <div className="mixmate-overlay">
      <div className="mixmate-onboarding">
        {!reveal ? (
          <>
            <div className="mixmate-kicker"><Sparkles size={16} /> PREMIER LANCEMENT</div>
            <h2>Crée ton profil MixParty</h2>
            <p>Ton premier MixMate sera attribué au hasard selon ta préférence. Aucun choix ne donne d’avantage.</p>
            <label>Ton prénom<input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={24} autoFocus placeholder="Ex. Alex" /></label>
            <div className="mixmate-preferences">
              {([
                ["any", Shuffle, "Peu importe"],
                ["masculine", UserRound, "Plutôt masculin"],
                ["feminine", UserRound, "Plutôt féminin"],
              ] as const).map(([value, Icon, label]) => (
                <button key={value} className={preference === value ? "active" : ""} onClick={() => setPreference(value)}>
                  <Icon size={22} /><span>{label}</span>{preference === value && <Check size={16} />}
                </button>
              ))}
            </div>
            <button className="mixmate-primary" disabled={!firstName.trim()} onClick={submit}><Sparkles size={19} /> Découvrir mon MixMate</button>
          </>
        ) : (
          <div className="mixmate-reveal">
            <div className="mixmate-crystal"><Gem size={72} /></div>
            <div className="mixmate-reveal-card"><img src={reveal.image} alt={reveal.name} /><small>TON PREMIER MIXMATE</small><h3>{reveal.name}</h3><p>{reveal.categoryLabel}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}

function CollectionModal({ profile, saveProfile, onClose }: { profile: MixPartyProfile; saveProfile: (p: MixPartyProfile) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"collection" | "challenges">("collection");
  const [reward, setReward] = useState<ReturnType<typeof getMixMate> | null>(null);
  const unlocked = new Set(profile.unlockedMixMateIds);

  function equip(id: string) { if (unlocked.has(id)) saveProfile({ ...profile, activeMixMateId: id }); }
  function openCrystal() {
    if (profile.crystals < 1) return;
    const next = pickCrystalReward(profile);
    if (!next) return;
    setReward(next);
    saveProfile({ ...profile, crystals: profile.crystals - 1, unlockedMixMateIds: [...profile.unlockedMixMateIds, next.id] });
  }

  return (
    <div className="mixmate-overlay">
      <div className="mixmate-collection-modal">
        <button className="mixmate-close" onClick={onClose}><X /></button>
        <div className="mixmate-collection-head"><div><span>COLLECTION OFFICIELLE</span><h2>Mes MixMates</h2><p>{profile.unlockedMixMateIds.length} débloqué sur {MIXMATES.length}</p></div><button className="mixmate-crystal-button" disabled={!profile.crystals} onClick={openCrystal}><Gem /> {profile.crystals} cristal{profile.crystals > 1 ? "s" : ""}</button></div>
        <div className="mixmate-tabs"><button className={tab === "collection" ? "active" : ""} onClick={() => setTab("collection")}>Collection</button><button className={tab === "challenges" ? "active" : ""} onClick={() => setTab("challenges")}>Défis & récompenses</button></div>
        {tab === "collection" ? (
          <div className="mixmate-grid">
            {MIXMATES.map((mate) => {
              const owned = unlocked.has(mate.id);
              return <button key={mate.id} className={`mixmate-card ${owned ? "owned" : "locked"} ${profile.activeMixMateId === mate.id ? "equipped" : ""}`} onClick={() => equip(mate.id)}>
                <div className="mixmate-card-image"><img src={mate.image} alt={owned ? mate.name : "MixMate verrouillé"} />{!owned && <span><LockKeyhole /></span>}</div>
                <strong>{owned ? mate.name : "À découvrir"}</strong><small>{rarityLabel[mate.rarity]} · {mate.categoryLabel}</small>{profile.activeMixMateId === mate.id && <em>ÉQUIPÉ</em>}
              </button>;
            })}
          </div>
        ) : <Challenges />}
        {reward && <div className="mixmate-reward"><div className="mixmate-crystal burst"><Gem /></div><div className="mixmate-reveal-card"><img src={reward.image} alt={reward.name}/><small>NOUVEAU MIXMATE</small><h3>{reward.name}</h3><p>{rarityLabel[reward.rarity]} · {reward.categoryLabel}</p><button className="mixmate-primary" onClick={() => { equip(reward.id); setReward(null); }}>Équiper maintenant</button></div></div>}
      </div>
    </div>
  );
}

function Challenges() {
  const challenges = [
    ["Organisateur", "Organiser 10 soirées", "0 / 10"],
    ["Jukebox vivant", "Faire écouter 100 chansons", "0 / 100"],
    ["Favori du public", "Recevoir 500 J’aime", "0 / 500"],
    ["Rassembleur", "Inviter 20 amis", "0 / 20"],
    ["Fidèle", "Cumuler 7 jours de connexion", "1 / 7"],
  ];
  return <div className="mixmate-challenges"><div className="mixmate-event-banner"><Sparkles /><div><strong>Les Cristaux MixMate arrivent avec les grands défis</strong><p>Événements, fidélité et cadeaux communautaires débloqueront des personnages rares sans avantage de jeu.</p></div></div>{challenges.map(([title, text, progress]) => <div className="mixmate-challenge" key={title}><div><strong>{title}</strong><p>{text}</p></div><span>{progress}</span><Gem /></div>)}</div>;
}
