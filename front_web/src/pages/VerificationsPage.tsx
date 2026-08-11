import VerificationsIdentiteTable from '../components/VerificationsIdentiteTable';

export default function VerificationsPage() {
  return (
    <div>
      <h3>Vérifications d'identité</h3>
      <p style={{ color: 'var(--color-text)', opacity: 0.6, marginBottom: 20 }}>
        CNI + selfie en attente de validation (requis avant de créer/rejoindre
        un trajet, réutilisé pour devenir conducteur).
      </p>
      <VerificationsIdentiteTable />
    </div>
  );
}
