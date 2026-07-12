// Tests de la boucle quotidienne (state.ts v6) : bonus journalier + streak,
// quêtes du jour, repos hors-ligne, compteur de duels d'arène.
// Usage : npx tsx daily.smoke.ts (depuis src/game)
import { freshState, ensureDaily, claimDaily, canClaimDaily, bumpQuest, applyOfflineRest, todayKey, hasDailyClaimable, arenaWinsToday } from "./state";
import { makeCharacter } from "./engine/progression";

let ok = 0, ko = 0;
const t = (name: string, cond: boolean) => { cond ? ok++ : (ko++, console.log("✗", name)); };

let s = ensureDaily({ ...freshState(), started: true, team: [makeCharacter("poofowl")] });
t("quêtes du jour créées", s.quests?.day === todayKey() && s.quests.list.length === 3);
t("bonus réclamable", canClaimDaily(s) && hasDailyClaimable(s));

const c1 = claimDaily(s);
t("streak jour 1", c1.reward.streak === 1 && c1.state.gold === c1.reward.gold);
t("plus réclamable", !canClaimDaily(c1.state));
s = c1.state;

// streak consécutif
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return todayKey(d); })();
const c2 = claimDaily({ ...s, dailyDay: yesterday, dailyStreak: 2 });
t("streak continue → 3 + potion", c2.reward.streak === 3 && c2.reward.potions === 1);
const c3 = claimDaily({ ...s, dailyDay: "2026-07-01", dailyStreak: 9 });
t("streak cassé → 1", c3.reward.streak === 1);

// quêtes (auto-réclamées à la complétion)
const goldBefore = s.gold;
let b = bumpQuest(s, "win"); b = bumpQuest(b.state, "win");
t("quête wins pas encore finie", b.completed.length === 0 && b.state.gold === goldBefore);
b = bumpQuest(b.state, "win");
t("quête wins complétée", b.completed.some(d => d.id === "q_wins"));
t("récompense auto-créditée", b.state.gold === goldBefore + 30 && b.state.quests!.list.find(q=>q.id==="q_wins")!.claimed);
const again = bumpQuest(b.state, "win");
t("pas de double récompense", again.completed.length === 0 && again.state.gold === b.state.gold);
t("quête non concernée intacte", b.state.quests!.list.find(q=>q.id==="q_care")!.claimed === false);

// repos hors-ligne
const hurt = { ...s.team[0], life: 10, mood: 30 };
const r = applyOfflineRest({ ...s, team: [hurt], lastSeen: Date.now() - 3 * 3600e3 });
t("repos: PV régénérés", r.state.team[0].life > 10 && r.report.healedHp > 0);
t("repos: humeur remonte (cap 60)", (r.state.team[0].mood ?? 0) > 30 && (r.state.team[0].mood ?? 0) <= 60);
const r2 = applyOfflineRest({ ...s, team: [hurt], lastSeen: Date.now() - 5 * 60e3 });
t("absence courte: rien", r2.report.healedHp === 0);

// arène
t("0 duel au départ", arenaWinsToday(s) === 0);
t("duels d'hier ignorés", arenaWinsToday({ ...s, duels: { day: "2026-07-11", wins: 3 } }) === 0);

console.log(`Résultat : ${ok} ok, ${ko} échec(s)`);
if (ko > 0) throw new Error(`${ko} échec(s)`);
