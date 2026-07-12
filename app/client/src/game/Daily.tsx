// Journal du jour — le rituel quotidien : bonus de connexion (avec streak)
// + 3 quêtes du jour à réclamer. Ouvert depuis le header (📅) ; s'ouvre seul
// la première fois de la journée.

import {
  GameState,
  QUEST_DEFS,
  canClaimDaily,
  dailyRewardFor,
  questDef,
  todayKey,
} from "./state";
import { Icon } from "./icons";

export default function DailyJournal({
  gs,
  onClaimDaily,
  onClose,
}: {
  gs: GameState;
  onClaimDaily: () => void;
  onClose: () => void;
}) {
  const day = todayKey();
  const claimable = canClaimDaily(gs, day);
  // Streak affiché : celui qu'on obtient en réclamant maintenant (ou l'actuel).
  const streakShown = claimable ? (gs.dailyDay === prevDay(day) ? gs.dailyStreak + 1 : 1) : gs.dailyStreak;
  const reward = dailyRewardFor(Math.max(1, streakShown));
  const quests = gs.quests?.day === day ? gs.quests.list : [];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal daily-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="chip-ico"><Icon name="journal" size={18} /> Aujourd'hui</h3>
          <button className="ghost sm" onClick={onClose} aria-label="Fermer"><Icon name="close" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className={`daily-bonus ${claimable ? "" : "done"}`}>
            <div className="daily-bonus-meta">
              <div className="daily-bonus-title">
                {claimable ? "Bonus du jour" : "Bonus réclamé ✓"}
              </div>
              <div className="daily-streak">
                🔥 {streakShown} jour{streakShown > 1 ? "s" : ""} d'affilée
              </div>
            </div>
            {claimable ? (
              <button className="primary chip-ico" onClick={onClaimDaily}>
                <Icon name="gold" size={14} /> +{reward.gold}{reward.potions > 0 && <><Icon name="potion" size={14} /> +{reward.potions}</>}
              </button>
            ) : (
              <span className="daily-claimed-chip">à demain !</span>
            )}
          </div>

          <div className="daily-quests">
            <div className="daily-quests-title">Quêtes du jour</div>
            {quests.map((q) => {
              const def = questDef(q.id);
              const done = q.progress >= def.target;
              return (
                <div key={q.id} className={`quest-row ${q.claimed ? "claimed" : done ? "done" : ""}`}>
                  <span className="quest-icon">{def.icon}</span>
                  <div className="quest-meta">
                    <div className="quest-label">{def.label}</div>
                    <div className="quest-bar">
                      <div className="quest-fill" style={{ width: `${(q.progress / def.target) * 100}%` }} />
                    </div>
                  </div>
                  <div className="quest-right">
                    {q.claimed || done ? (
                      <span className="quest-check chip-ico"><Icon name="check" size={14} /> +{def.gold}<Icon name="gold" size={12} />{def.potions > 0 && <>+{def.potions}<Icon name="potion" size={12} /></>}</span>
                    ) : (
                      <span className="quest-count">{q.progress}/{def.target}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {quests.length === 0 && QUEST_DEFS.map((def) => (
              <div key={def.id} className="quest-row">
                <span className="quest-icon">{def.icon}</span>
                <div className="quest-meta"><div className="quest-label">{def.label}</div></div>
                <span className="quest-count">0/{def.target}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function prevDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
