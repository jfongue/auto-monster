// Footer permanent affichant le dernier commit (auteur + date/heure approx),
// injecté au build via vite.config.ts (define). Permet de savoir sur quelle
// version on est en prod.
export default function BuildFooter() {
  const author = __COMMIT_AUTHOR__;
  const iso = __COMMIT_DATE__;
  const hash = __COMMIT_HASH__;

  let when = "";
  if (iso) {
    const d = new Date(iso);
    when = d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const label = [hash, author, when].filter(Boolean).join(" · ");
  if (!label) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        zIndex: 9999,
        padding: "2px 6px",
        fontSize: 10,
        lineHeight: 1.4,
        fontFamily: "monospace",
        color: "rgba(255,255,255,0.55)",
        background: "rgba(0,0,0,0.35)",
        borderTopLeftRadius: 4,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {label}
    </div>
  );
}
