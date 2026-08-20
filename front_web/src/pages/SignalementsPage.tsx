import { useCallback, useEffect, useState } from 'react';
import { App, Button, Tag, Table } from 'antd';
import {
  listSignalements,
  traiterSignalement,
  type Signalement,
} from '../api/client';
import { getDisplayName } from '../utils/displayName';

const TYPE_LABELS: Record<string, string> = {
  no_show_conducteur: 'No-show conducteur',
  no_show_passager: 'No-show passager',
};

export default function SignalementsPage() {
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { message } = App.useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSignalements(await listSignalements());
    } catch {
      message.error('Impossible de charger les signalements');
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

  async function handleTraiter(id: string) {
    setPendingId(id);
    try {
      await traiterSignalement(id);
      message.success('Signalement marqué comme traité');
      await load();
    } catch {
      message.error("Impossible de traiter ce signalement");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <h3>Signalements</h3>
      <Table<Signalement>
        rowKey="id"
        loading={loading}
        dataSource={signalements}
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: 'Type',
            dataIndex: 'type',
            render: (type: string) => TYPE_LABELS[type] ?? type,
          },
          {
            title: 'Concerné',
            render: (_, record) =>
              getDisplayName(record.concerne.nom, record.concerne.prenom, null),
          },
          {
            title: 'Signalé par',
            render: (_, record) =>
              getDisplayName(
                record.signalePar.nom,
                record.signalePar.prenom,
                null,
              ),
          },
          {
            title: 'Trajet',
            render: (_, record) =>
              new Date(record.trajet.heure).toLocaleString(),
          },
          {
            title: 'Date',
            render: (_, record) => new Date(record.createdAt).toLocaleString(),
          },
          {
            title: 'Statut',
            dataIndex: 'statut',
            render: (statut: string) =>
              statut === 'traite' ? (
                <Tag color="default">Traité</Tag>
              ) : (
                <Tag color="orange">Ouvert</Tag>
              ),
          },
          {
            title: 'Action',
            render: (_, record) =>
              record.statut === 'ouvert' ? (
                <Button
                  loading={pendingId === record.id}
                  onClick={() => void handleTraiter(record.id)}
                >
                  Marquer comme traité
                </Button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
