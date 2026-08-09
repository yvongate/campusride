import { useEffect, useState } from 'react';
import { App } from 'antd';
import DemandesConducteurTable from '../components/DemandesConducteurTable';
import StatCard from '../components/StatCard';
import { getStatistiques, type Statistiques } from '../api/client';

export default function DashboardPage() {
  const [stats, setStats] = useState<Statistiques | null>(null);
  const { message } = App.useApp();

  useEffect(() => {
    getStatistiques()
      .then(setStats)
      .catch(() => message.error('Impossible de charger les statistiques'));
  }, [message]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: 0 }}>Tableau de bord</h3>
      </div>

      <div
        style={{
          display: 'flex',
          border: '1px solid var(--color-divider)',
          marginBottom: 28,
        }}
      >
        <StatCard label="Trajets aujourd'hui" value={stats?.trajetsAujourdhui ?? 0} />
        <StatCard label="Demandes en attente" value={stats?.demandesEnAttente ?? 0} />
        <StatCard
          label="Conducteurs à valider"
          value={stats?.conducteursAValider ?? 0}
          accent
        />
        <StatCard
          label="Signalements ouverts"
          value={stats?.signalementsOuverts ?? 0}
          accent
          last
        />
      </div>

      <h5>Demandes de compte conducteur en attente</h5>
      <DemandesConducteurTable />
    </div>
  );
}
