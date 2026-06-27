// Boucle de jeu : adoption → carte → combat → récompenses/soins → boss → capture.
// 1v1 pour l'instant, structure prête pour des équipes.

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import CombatView from "./renderer/CombatView";
import {
  SPECIES,
  STARTERS,
  RARE_REWARD,
  MAP_STEPS,
  POTION_HEAL,
  FULL_HEAL_COST,
  type MapStep,
} from "./engine/data";
import { runCombat } from "./engine/combat";
import {
  makeCharacter,
  makeEnemy,
  addXp,
  xpForNext,
  applyPack,
  applyTalentTier,
  STAT_PACKS,
  talentTierOptions,
  type PendingLevel,
  type TalentTierOption,
} from "./engine/progression";
import { TALENTS, talentName } from "./engine/talents";
import type { Character, CombatResult } from "./engine/types";
import { freshState, GameState, isMapComplete } from "./state";
import "./game.css";

type Screen = "loading" | "adoption" | "map" | "combat" | "reward" | "capture" | "complete";

type CombatCtx = { step: MapStep; result: CombatResult; enemy: Character };
type Outcome = "win" | "lose" | "draw";

export default function GamePage() {
  const { logout, user } = useAuth();
  const [gs, setGs] = useState<GameState>(freshState());
  const [screen, setScreen] = useState<Screen>("loading");
  const [speed, setSpeed] = useState(1);
  const [ctx, setCtx] = useState<CombatCtx | null>(null);

  // chargement initial
  useEffect(() => {
    (async () => {
      try {
        const { state } = await api.getGameState<GameState>();
        if (state && state.started) {
          setGs(state);
          setScreen(isMapComplete(state) ? "complete" : "map");
        } else {
          setScreen("adoption");
        }
      } catch {
        setScreen("adoption");
      }
    })();
  }, []);

  async function persist(next: GameState) {
    setGs(next);
    try {
      await api.saveGameState(next);
    } catch {
      /* hors-ligne : l'état reste en mémoire */
    }
  }

  // ── Adoption ──────────────────────────────────────────────────────────────
  function adopt(speciesId: string) {
    const c = makeCharacter(speciesId);
    persist({ ...freshState(), started: true, team: [c], gold: 30, potions: 1 });
    setScreen("map");
  }

  // ── Soins ───────────────────────────────────────────────────────────────
  function healPotion(i: number) {
    const team = gs.team.map((c) => ({ ...c }));
    const c = team[i];
    if (gs.potions <= 0 || c.life >= c.stats.hp) return;
    c.life = Math.min(c.stats.hp, c.life + Math.round(c.stats.hp * POTION_HEAL));
    persist({ ...gs, team, potions: gs.potions - 1 });
  }
  function healFull(i: number) {
    const team = gs.team.map((c) => ({ ...c }));
    const c = team[i];
    if (gs.gold < FULL_HEAL_COST || c.life >= c.stats.hp) return;
    c.life = c.stats.hp;
    persist({ ...gs, team, gold: gs.gold - FULL_HEAL_COST });
  }

  // ── Lancement d'un combat ─────────────────────────────────────────────────
  function startCombat() {
    const step = MAP_STEPS[gs.stepIndex];
    const player = { ...gs.team[gs.active] };
    if (player.life <= 0) return; // doit être soigné d'abord
    const enemy = makeEnemy(step);
    if (step.isBoss && gs.bossLife != null) enemy.life = gs.bossLife;
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const result = runCombat({
      seed,
      teamA: [player],
      teamB: [enemy],
      rules: step.maxTurns ? { maxTurns: step.maxTurns } : undefined,
    });
    setCtx({ step, result, enemy });
    setScreen("combat");
  }

  // ── Fin du combat (appelée par le renderer) ───────────────────────────────
  function onCombatFinish(winner: 0 | 1 | null) {
    if (!ctx) return;
    const { step, result } = ctx;
    const pStat = result.stats.find((s) => s.side === 0)!;
    const eStat = result.stats.find((s) => s.side === 1)!;

    const team = gs.team.map((c) => ({ ...c }));
    const player = team[gs.active];
    player.life = Math.max(0, pStat.lifeLeft);

    const outcome: Outcome = winner === 0 ? "win" : winner === 1 ? "lose" : "draw";

    // PV du boss persistés (chip sur plusieurs parties)
    let bossLife = gs.bossLife;
    if (step.isBoss) bossLife = Math.max(0, eStat.lifeLeft);
    const bossDefeated = step.isBoss && bossLife === 0;

    if (outcome === "win" || bossDefeated) {
      // loot + xp + level-ups
      const xpRes = addXp(player, step.xp);
      team[gs.active] = xpRes.character;
      const next: GameState = {
        ...gs,
        team,
        gold: gs.gold + step.gold,
        potions: gs.potions + step.potions,
        stepIndex: gs.stepIndex + 1,
        bossLife: step.isBoss ? null : gs.bossLife,
      };
      persist(next);
      setReward({ outcome: "win", step, pStat, eStat, pending: xpRes.pending, gained: step.xp });
      setScreen("reward");
    } else {
      // défaite ou égalité : on garde les PV (et ceux du boss), retour soin/retry
      let penaltyGold = gs.gold;
      if (outcome === "lose") {
        penaltyGold = Math.floor(gs.gold * 0.75); // pénalité légère (GDD 5.2)
        if (player.life <= 0) player.life = Math.max(1, Math.round(player.stats.hp * 0.3));
      }
      const next: GameState = { ...gs, team, gold: penaltyGold, bossLife: step.isBoss ? bossLife : gs.bossLife };
      persist(next);
      setReward({ outcome, step, pStat, eStat, pending: [], gained: 0 });
      setScreen("reward");
    }
  }

  // ── Récompense / résolution des niveaux ────────────────────────────────────
  const [reward, setReward] = useState<{
    outcome: Outcome;
    step: MapStep;
    pStat: any;
    eStat: any;
    pending: PendingLevel[];
    gained: number;
  } | null>(null);
  const [levelStep, setLevelStep] = useState(0);

  useEffect(() => {
    if (screen === "reward") setLevelStep(0);
  }, [screen, reward]);

  function choosePack(packId: string) {
    if (!reward) return;
    const team = gs.team.map((c) => ({ ...c }));
    team[gs.active] = applyPack(team[gs.active], packId);
    persist({ ...gs, team });
    advanceLevel();
  }
  function chooseTalent(opt: TalentTierOption) {
    if (!reward) return;
    const team = gs.team.map((c) => ({ ...c }));
    team[gs.active] = applyTalentTier(team[gs.active], opt);
    persist({ ...gs, team });
    advanceLevel();
  }
  function advanceLevel() {
    if (!reward) return;
    if (levelStep + 1 < reward.pending.length) setLevelStep(levelStep + 1);
    else finishReward();
  }
  function finishReward() {
    const wonBoss = !!reward && reward.step.isBoss && reward.outcome === "win";
    setReward(null);
    if (wonBoss && !gs.capturedRare) setScreen("capture");
    else if (isMapComplete(gs)) setScreen("complete");
    else setScreen("map");
  }

  // ── Capture du second AM rare ─────────────────────────────────────────────
  function captureRare() {
    const rare = makeCharacter(RARE_REWARD);
    persist({ ...gs, team: [...gs.team, rare], capturedRare: true });
    setScreen("complete");
  }

  async function resetGame() {
    try {
      await api.resetGameState();
    } catch {
      /* ignore */
    }
    setGs(freshState());
    setReward(null);
    setCtx(null);
    setScreen("adoption");
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="game-shell">
      <header className="game-top">
        <div className="brand">⚔️ AutoMonster</div>
        <div className="top-right">
          {gs.started && screen !== "combat" && (
            <span className="purse">
              💰 {gs.gold} &nbsp;·&nbsp; 🧪 {gs.potions}
            </span>
          )}
          <button className="ghost" onClick={() => logout()}>
            {user?.displayName || "Déconnexion"} ⏻
          </button>
        </div>
      </header>

      {screen === "loading" && <div className="center pad">Chargement…</div>}
      {screen === "adoption" && <Adoption onPick={adopt} />}
      {screen === "map" && (
        <MapScreen gs={gs} onFight={startCombat} onHealPotion={healPotion} onHealFull={healFull} onSetActive={(i) => persist({ ...gs, active: i })} />
      )}
      {screen === "combat" && ctx && (
        <div className="combat-wrap">
          <div className="combat-head">
            <span>{ctx.step.name}</span>
            <div className="speedctl">
              {[1, 2, 4].map((sp) => (
                <button key={sp} className={speed === sp ? "on" : ""} onClick={() => setSpeed(sp)}>
                  ×{sp}
                </button>
              ))}
            </div>
          </div>
          <CombatView log={ctx.result.log} speed={speed} onFinish={onCombatFinish} />
        </div>
      )}
      {screen === "reward" && reward && (
        <RewardScreen
          reward={reward}
          levelStep={levelStep}
          char={gs.team[gs.active]}
          onPack={choosePack}
          onTalent={chooseTalent}
          onContinue={finishReward}
        />
      )}
      {screen === "capture" && <Capture onCapture={captureRare} />}
      {screen === "complete" && <Complete gs={gs} onReset={resetGame} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Écrans
// ═══════════════════════════════════════════════════════════════════════════

function StatRow({ c }: { c: Character }) {
  const s = c.stats;
  return (
    <div className="statgrid">
      <span>❤️ {s.hp}</span>
      <span>⚔️ {s.atk}</span>
      <span>🛡️ {s.def}</span>
      <span>💨 {s.spd}</span>
      <span>⚡ {s.sta}</span>
    </div>
  );
}

function Adoption({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="screen adoption">
      <h1>Choisis ton premier Auto Monster</h1>
      <p className="muted">Ce compagnon se battra automatiquement. Choisis bien : chaque espèce a un talent inné.</p>
      <div className="cards3">
        {STARTERS.map((id) => {
          const sp = SPECIES[id];
          const c = makeCharacter(id);
          return (
            <div key={id} className="amcard pick" onClick={() => onPick(id)}>
              <div className="amcard-art" style={{ background: `radial-gradient(circle at 50% 40%, ${sp.tint}33, transparent 70%)` }}>
                <img src={`/sprites/${sp.gfx}.png`} alt={sp.name} />
              </div>
              <h3>{sp.name}</h3>
              <StatRow c={c} />
              {sp.innate && (
                <div className="talent-chip">
                  ✨ {talentName(sp.innate)} — <span className="muted">{TALENTS[sp.innate]?.desc}</span>
                </div>
              )}
              <button className="primary">Adopter</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MapScreen({
  gs,
  onFight,
  onHealPotion,
  onHealFull,
  onSetActive,
}: {
  gs: GameState;
  onFight: () => void;
  onHealPotion: (i: number) => void;
  onHealFull: (i: number) => void;
  onSetActive: (i: number) => void;
}) {
  const done = isMapComplete(gs);
  const step = done ? null : MAP_STEPS[gs.stepIndex];
  const active = gs.team[gs.active];
  const needHeal = active && active.life < active.stats.hp;
  const ko = active && active.life <= 0;

  return (
    <div className="screen map">
      <div className="map-track">
        {MAP_STEPS.map((s, i) => (
          <div key={i} className={`map-node ${i < gs.stepIndex ? "done" : ""} ${i === gs.stepIndex ? "cur" : ""} ${s.isBoss ? "boss" : ""}`}>
            <div className="node-dot">{i < gs.stepIndex ? "✓" : s.isBoss ? "☠" : i + 1}</div>
            <div className="node-name">{s.name}</div>
          </div>
        ))}
      </div>

      <div className="map-cols">
        {/* Équipe + soins */}
        <div className="panel team-panel">
          <h3>Mon équipe</h3>
          {gs.team.map((c, i) => {
            const sp = SPECIES[c.speciesId];
            const pct = Math.round((c.life / c.stats.hp) * 100);
            const xpNext = xpForNext(c.level);
            return (
              <div key={c.id} className={`team-row ${i === gs.active ? "active" : ""}`} onClick={() => onSetActive(i)}>
                <img className="mini" src={`/sprites/${sp.gfx}.png`} alt={c.name} />
                <div className="team-meta">
                  <div className="team-name">
                    {c.name} <span className="lvl">N.{c.level}</span>
                    {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
                    {i === gs.active && <span className="active-tag">actif</span>}
                  </div>
                  <div className="hpbar sm">
                    <div className="hpbar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="xpbar">
                    <div className="xpbar-fill" style={{ width: `${Math.min(100, (c.xp / xpNext) * 100)}%` }} />
                  </div>
                  <StatRow c={c} />
                  {(sp.innate || c.talents.length > 0) && (
                    <div className="talents-line">
                      {[sp.innate, ...c.talents].filter(Boolean).map((t) => (
                        <span key={t} className="talent-mini">{talentName(t as string)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div className="heal-row">
            <button disabled={gs.potions <= 0 || !needHeal} onClick={() => onHealPotion(gs.active)}>
              🧪 Potion ({gs.potions})
            </button>
            <button disabled={gs.gold < FULL_HEAL_COST || !needHeal} onClick={() => onHealFull(gs.active)}>
              💰 Soin complet ({FULL_HEAL_COST})
            </button>
          </div>
        </div>

        {/* Étape courante */}
        <div className="panel step-panel">
          {done ? (
            <div className="center">
              <h3>🏆 Zone nettoyée !</h3>
              <p className="muted">Tu as vaincu Gravelmaw et capturé un AM rare.</p>
            </div>
          ) : (
            <>
              <h3>
                Étape {gs.stepIndex + 1}/{MAP_STEPS.length} — {step!.name}
              </h3>
              <p className="muted blurb">{step!.blurb}</p>
              <div className="enemy-preview">
                <img src={`/sprites/${SPECIES[step!.enemySpecies].gfx}.png`} alt="ennemi" style={{ transform: `scale(${SPECIES[step!.enemySpecies].size / 100})` }} />
                <div>
                  <div className="enemy-name">
                    {SPECIES[step!.enemySpecies].name} <span className="lvl">N.{step!.enemyLevel}</span>
                    {step!.isBoss && <span className="boss-tag">BOSS</span>}
                  </div>
                  {step!.isBoss && gs.bossLife != null && (
                    <div className="boss-chip">PV restants du boss : {gs.bossLife}</div>
                  )}
                  <div className="loot-line">Butin : 💰 {step!.gold} · 🧪 {step!.potions} · ⭐ {step!.xp} XP</div>
                </div>
              </div>
              {step!.isBoss && (
                <p className="hint">⚠️ Combat coriace. S'il s'éternise, il s'arrête sur une égalité — soigne-toi et reviens : les PV du boss sont conservés.</p>
              )}
              {ko ? (
                <p className="warn">Ton AM est K.O. — soigne-le avant de combattre.</p>
              ) : (
                <button className="primary big" onClick={onFight}>
                  ⚔️ Combattre
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RewardScreen({
  reward,
  levelStep,
  char,
  onPack,
  onTalent,
  onContinue,
}: {
  reward: { outcome: Outcome; step: MapStep; pStat: any; eStat: any; pending: PendingLevel[]; gained: number };
  levelStep: number;
  char: Character;
  onPack: (id: string) => void;
  onTalent: (opt: TalentTierOption) => void;
  onContinue: () => void;
}) {
  const { outcome, step, pStat, gained, pending } = reward;
  const cur = pending[levelStep];
  const showLevel = outcome === "win" && cur;

  if (showLevel && cur.kind === "pack") {
    return (
      <div className="screen reward">
        <h2>🆙 Niveau {cur.level} !</h2>
        <p className="muted">Choisis un pack de stats pour {char.name}.</p>
        <div className="cards3 small">
          {STAT_PACKS.map((p) => (
            <div key={p.id} className="amcard pick" onClick={() => onPack(p.id)}>
              <h3>{p.name}</h3>
              <p className="pack-desc">{p.desc}</p>
              <button className="primary">Choisir</button>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (showLevel && cur.kind === "talent") {
    const opts = talentTierOptions(char);
    return (
      <div className="screen reward">
        <h2>⭐ Palier de talent — Niveau {cur.level} !</h2>
        <p className="muted">Une seule option.</p>
        <div className="cards3 small">
          {opts.map((o) => (
            <div key={o.id} className="amcard pick" onClick={() => onTalent(o)}>
              <h3>{o.name}</h3>
              <p className="pack-desc">{o.desc}</p>
              <button className="primary">Choisir</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // résumé d'issue
  const title =
    outcome === "win" ? "🎉 Victoire !" : outcome === "draw" ? "⏳ Égalité" : "💀 Défaite";
  return (
    <div className="screen reward center">
      <h1>{title}</h1>
      {outcome === "win" && (
        <div className="loot-box">
          <p>+ 💰 {step.gold} or · 🧪 {step.potions} potion(s) · ⭐ {gained} XP</p>
        </div>
      )}
      {outcome === "draw" && step.isBoss && (
        <p className="muted">Le combat s'est éternisé. Mais tu as entamé le boss — ses PV sont conservés. Soigne-toi et retente !</p>
      )}
      {outcome === "draw" && !step.isBoss && <p className="muted">Match nul. Réessaie.</p>}
      {outcome === "lose" && <p className="muted">Ton AM a été vaincu. Petite pénalité d'or. Soigne-toi et retente.</p>}
      <div className="stat-summary muted">
        Dégâts infligés : {pStat.damageDealt} · reçus : {pStat.damageTaken}
      </div>
      <button className="primary big" onClick={onContinue}>
        Continuer
      </button>
    </div>
  );
}

function Capture({ onCapture }: { onCapture: () => void }) {
  const sp = SPECIES[RARE_REWARD];
  return (
    <div className="screen capture center">
      <h1>✨ Un Auto Monster rare apparaît !</h1>
      <div className="amcard reveal">
        <div className="amcard-art" style={{ background: `radial-gradient(circle at 50% 40%, ${sp.tint}55, transparent 70%)` }}>
          <img src={`/sprites/${sp.gfx}.png`} alt={sp.name} />
        </div>
        <h3>
          {sp.name} <span className="rare-tag">RARE</span>
        </h3>
        <StatRow c={makeCharacter(RARE_REWARD)} />
        {sp.innate && <div className="talent-chip">✨ {talentName(sp.innate)}</div>}
      </div>
      <button className="primary big" onClick={onCapture}>
        Capturer
      </button>
    </div>
  );
}

function Complete({ gs, onReset }: { gs: GameState; onReset: () => void }) {
  return (
    <div className="screen complete center">
      <h1>🏆 Première zone terminée !</h1>
      <p className="muted">Tu as bouclé la boucle de jeu : adoption, 5 combats, boss, capture.</p>
      <div className="team-final">
        {gs.team.map((c) => {
          const sp = SPECIES[c.speciesId];
          return (
            <div key={c.id} className="amcard mini-card">
              <img src={`/sprites/${sp.gfx}.png`} alt={c.name} />
              <div>
                {c.name} <span className="lvl">N.{c.level}</span>
                {sp.rarity === "rare" && <span className="rare-tag">RARE</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted small">La suite (nouvelles zones, équipes 2v2+) se branchera ici.</p>
      <button className="ghost" onClick={onReset}>
        Recommencer
      </button>
    </div>
  );
}
