import DemandesConducteurTable from '../components/DemandesConducteurTable';

export default function ConducteursPage() {
  return (
    <div>
      <h3>Conducteurs</h3>
      <p style={{ color: 'var(--color-text)', opacity: 0.6, marginBottom: 20 }}>
        Demandes de compte conducteur en attente de validation.
      </p>
      <DemandesConducteurTable />
    </div>
  );
}
