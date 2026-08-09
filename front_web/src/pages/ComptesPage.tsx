import { useCallback, useEffect, useState } from 'react';
import { App, Button, Tag, Table } from 'antd';
import { desactiverCompte, listComptes, reactiverCompte, type Compte } from '../api/client';
import { getDisplayName } from '../utils/displayName';

const ROLE_LABELS: Record<string, string> = {
  etudiant: 'Étudiant',
  'les deux': 'Conducteur',
};

export default function ComptesPage() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { message } = App.useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setComptes(await listComptes());
    } catch {
      message.error('Impossible de charger les comptes');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    // Chargement classique au montage (cf. react.dev/learn/you-might-not-need-an-effect) --
    // pas de boucle de re-render, un seul fetch initial, pas de framework a chargeurs ici.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleToggle(compte: Compte) {
    setPendingId(compte.id);
    try {
      if (compte.actif) {
        await desactiverCompte(compte.id);
        message.success('Compte désactivé');
      } else {
        await reactiverCompte(compte.id);
        message.success('Compte réactivé');
      }
      await load();
    } catch {
      message.error("Impossible de modifier ce compte");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <h3>Comptes</h3>
      <Table<Compte>
        rowKey="id"
        loading={loading}
        dataSource={comptes}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: 'Nom',
            render: (_, record) =>
              getDisplayName(record.nom, record.prenom, record.telephone),
          },
          { title: 'Téléphone', dataIndex: 'telephone' },
          {
            title: 'Rôle',
            dataIndex: 'role',
            render: (role: string) => ROLE_LABELS[role] ?? role,
          },
          {
            title: 'Note',
            dataIndex: 'note',
            render: (note: number | null) => (note !== null ? note.toFixed(1) : '—'),
          },
          {
            title: 'Statut',
            dataIndex: 'actif',
            render: (actif: boolean) =>
              actif ? <Tag color="green">Actif</Tag> : <Tag color="red">Désactivé</Tag>,
          },
          {
            title: 'Action',
            render: (_, record) => (
              <Button
                danger={record.actif}
                loading={pendingId === record.id}
                onClick={() => void handleToggle(record)}
              >
                {record.actif ? 'Désactiver' : 'Réactiver'}
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
