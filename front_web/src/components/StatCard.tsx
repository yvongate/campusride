// Carte statistique de UI_inspo (écran 19) : libellé h6 muted + gros chiffre
// Archivo 800, accent quand la valeur demande une action.
export default function StatCard({
  label,
  value,
  accent,
  last,
}: {
  label: string;
  value: number;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: 12,
        background: 'var(--color-bg)',
        borderRight: last ? undefined : '1px solid var(--color-divider)',
      }}
    >
      <h6
        style={{
          margin: '0 0 4px',
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: accent ? 'var(--color-accent-700)' : 'var(--color-text)',
        }}
      >
        {label}
      </h6>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          fontFamily: 'var(--font-heading)',
          color: accent ? 'var(--color-accent)' : 'var(--color-text)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
