// Set d'icônes SVG line épurées — remplace les emojis "chrome" (stats, monnaie,
// navigation, actions). currentColor : la couleur suit le texte du parent.
// Les emojis de CONTENU (PNJ, personnalité, zones de la carte) sont conservés
// ailleurs : ils portent du sens narratif que des glyphes génériques perdraient.

import type { SVGProps } from "react";

export type IconName =
  | "hp" | "atk" | "def" | "spd"
  | "gold" | "potion"
  | "map" | "arena" | "shop" | "journal" | "bestiary" | "team"
  | "heal" | "pause" | "play" | "flee"
  | "back" | "close" | "menu" | "power" | "reset"
  | "lock" | "warn" | "star" | "levelup" | "boss" | "check" | "gift"
  | "plus" | "return" | "chat" | "home";

type P = { d?: string; el?: React.ReactNode };

// Chaque icône : viewBox 24, tracé stroke (round). Quelques-unes sont pleines
// (cœur, pièce) pour rester lisibles en très petit.
const PATHS: Record<IconName, React.ReactNode> = {
  hp: <path d="M12 20.5S3.5 14.8 3.5 9.2C3.5 6.4 5.7 4.5 8.2 4.5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2 2.5 0 4.7 1.9 4.7 4.7 0 5.6-8.5 11.3-8.5 11.3z" fill="currentColor" stroke="none" />,
  atk: <g><path d="M14.5 4.5 20 4l-.5 5.5-9 9" /><path d="M4 15l4 4" /><path d="M3.5 20.5 7 17" /><path d="m10.5 12.5 1 1" /></g>,
  def: <path d="M12 3.5 5 6v5.5c0 4.3 3 7.5 7 9 4-1.5 7-4.7 7-9V6l-7-2.5z" />,
  spd: <g><path d="M3 8h11" /><path d="M3 12h15" /><path d="M3 16h9" /><path d="M15.5 6.5A3 3 0 1 1 18 8" /><path d="M13 17.5A3 3 0 1 0 15 20" /></g>,
  gold: <g><circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="5.6" fill="none" stroke="var(--surface,#fff)" strokeWidth="1.6" /></g>,
  potion: <g><path d="M10 3h4" /><path d="M10.5 3v4.2L6.6 15a3.4 3.4 0 0 0 3 5h4.8a3.4 3.4 0 0 0 3-5l-3.9-7.8V3" /><path d="M7.7 13h8.6" /></g>,
  map: <g><path d="m9 5-5 2v12l5-2 6 2 5-2V5l-5 2-6-2z" /><path d="M9 5v12" /><path d="M15 7v12" /></g>,
  arena: <g><path d="M14.5 4.5 20 4l-.5 5.5-8 8" /><path d="M9.5 4.5 4 4l.5 5.5 8 8" /><path d="M4 15l3.5 3.5" /><path d="M20 15l-3.5 3.5" /></g>,
  shop: <g><path d="M4 8h16l-1 4.5a3 3 0 0 1-3 2.4H8a3 3 0 0 1-3-2.4L4 8z" /><path d="M4 8 6 4h12l2 4" /><path d="M9 8v-.5a3 3 0 0 1 6 0V8" /><path d="M7 15v4.5h10V15" /></g>,
  journal: <g><rect x="4" y="5" width="16" height="16" rx="2.5" /><path d="M4 9h16" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M8.5 13h3" /><path d="M8.5 17h7" /></g>,
  bestiary: <g><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5v-15z" /><path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v3H7.5A2.5 2.5 0 0 1 5 20.5z" /><circle cx="12" cy="9.5" r="2.2" /></g>,
  team: <g><circle cx="8.5" cy="8" r="3" /><circle cx="16.5" cy="9.5" r="2.3" /><path d="M3.5 19.5c0-2.8 2.2-5 5-5s5 2.2 5 5" /><path d="M15 15c2.4 0 4.5 1.9 4.5 4.5" /></g>,
  heal: <g><path d="M12 20.5S4 15 4 9.4A4.4 4.4 0 0 1 12 6.8 4.4 4.4 0 0 1 20 9.4c0 5.6-8 11.1-8 11.1z" /><path d="M12 9.5v5" /><path d="M9.5 12h5" /></g>,
  pause: <g><rect x="6.5" y="5" width="4" height="14" rx="1.3" /><rect x="13.5" y="5" width="4" height="14" rx="1.3" /></g>,
  play: <path d="M7 4.5v15l13-7.5-13-7.5z" fill="currentColor" stroke="none" />,
  flee: <g><path d="M6 21V4" /><path d="M6 5h11l-2 3.5L17 12H6" /></g>,
  back: <path d="M15 5l-7 7 7 7" />,
  close: <g><path d="M6 6l12 12" /><path d="M18 6 6 18" /></g>,
  menu: <g><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></g>,
  power: <g><path d="M12 3v9" /><path d="M6.5 7.5a8 8 0 1 0 11 0" /></g>,
  reset: <g><path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3" /><path d="M4.5 19v-4.5H9" /></g>,
  lock: <g><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></g>,
  warn: <g><path d="M12 4 2.8 20h18.4L12 4z" /><path d="M12 10v4.5" /><path d="M12 17.4h.01" /></g>,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.9 6.8 20.6l1-5.8L3.5 9.7l5.9-.9L12 3.5z" />,
  levelup: <g><path d="M6 14l6-6 6 6" /><path d="M6 19l6-6 6 6" /></g>,
  boss: <g><path d="M5 11a7 7 0 0 1 14 0v3.5l-1.5 1v2.5h-11V15.5L5 14.5V11z" /><circle cx="9.2" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="14.8" cy="12" r="1.3" fill="currentColor" stroke="none" /><path d="M8 20v-2M12 20v-2M16 20v-2" /></g>,
  check: <path d="M5 12.5 10 17.5 19 6.5" />,
  gift: <g><rect x="4.5" y="9.5" width="15" height="10.5" rx="1.5" /><path d="M3.5 9.5h17V13h-17z" /><path d="M12 6v14" /><path d="M12 6C11 3.5 7 3.5 8 6.5c.6 1.7 4 0 4 0zM12 6c1-2.5 5-2.5 4 .5-.6 1.7-4 0-4 0z" /></g>,
  plus: <g><path d="M12 5v14" /><path d="M5 12h14" /></g>,
  return: <g><path d="M9 7 4 12l5 5" /><path d="M4 12h11a5 5 0 0 1 0 10h-2" /></g>,
  chat: <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16H9l-4 3.5V6.5A1.5 1.5 0 0 1 6.5 5z" />,
  home: <g><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9.5h12V10" /></g>,
};

export function Icon({
  name,
  size = 18,
  className = "",
  ...rest
}: { name: IconName; size?: number | string; className?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      className={`ico ico-${name} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

export default Icon;
