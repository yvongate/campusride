import { useCallback, useEffect, useState } from 'react';
import { App, Button, Image, Modal, Space, Table } from 'antd';
import {
  getDocumentConducteurBlobUrl,
  listDemandesConducteur,
  refuserDemandeConducteur,
  validerDemandeConducteur,
  type DemandeConducteur,
} from '../api/client';
import { getDisplayName } from '../utils/displayName';

// Table "Demandes de compte conducteur en attente" de UI_inspo (écran 19),
// réutilisée telle quelle par DashboardPage et ConducteursPage.
export default function DemandesConducteurTable() {
  const [demandes, setDemandes] = useState<DemandeConducteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [docsDemandeId, setDocsDemandeId] = useState<string | null>(null);
  const [docsUrls, setDocsUrls] = useState<{ selfie: string; permis: string } | null>(
    null,
  );
  const [docsLoading, setDocsLoading] = useState(false);
  const { message } = App.useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDemandes(await listDemandesConducteur());
    } catch {
      message.error('Impossible de charger les demandes conducteur');
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

  useEffect(() => {
    return () => {
      if (docsUrls) {
        URL.revokeObjectURL(docsUrls.selfie);
        URL.revokeObjectURL(docsUrls.permis);
      }
    };
  }, [docsUrls]);

  async function handleVoirDocuments(demandeId: string) {
    setDocsDemandeId(demandeId);
    setDocsLoading(true);
    try {
      const [selfie, permis] = await Promise.all([
        getDocumentConducteurBlobUrl(demandeId, 'selfie'),
        getDocumentConducteurBlobUrl(demandeId, 'permis'),
      ]);
      setDocsUrls({ selfie, permis });
    } catch {
      message.error('Impossible de charger les documents');
      setDocsDemandeId(null);
    } finally {
      setDocsLoading(false);
    }
  }

  async function handleValider(id: string) {
    setPendingId(id);
    try {
      await validerDemandeConducteur(id);
      message.success('Demande validée');
      await load();
    } catch {
      message.error('Impossible de valider cette demande');
    } finally {
      setPendingId(null);
    }
  }

  async function handleRefuser(id: string) {
    setPendingId(id);
    try {
      await refuserDemandeConducteur(id);
      message.success('Demande refusée');
      await load();
    } catch {
      message.error('Impossible de refuser cette demande');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <Table<DemandeConducteur>
        rowKey="id"
        loading={loading}
        dataSource={demandes}
        pagination={false}
        columns={[
          {
            title: 'Étudiant',
            render: (_, record) =>
              getDisplayName(record.nom, record.prenom, record.telephone),
          },
          { title: 'Matricule véhicule', dataIndex: 'matriculeVehicule' },
          {
            title: 'Documents',
            render: (_, record) => (
              <a onClick={() => void handleVoirDocuments(record.id)}>Voir (2)</a>
            ),
          },
          {
            title: 'Décision',
            render: (_, record) => (
              <Space>
                <Button
                  type="primary"
                  loading={pendingId === record.id}
                  onClick={() => void handleValider(record.id)}
                >
                  Valider
                </Button>
                <Button
                  loading={pendingId === record.id}
                  onClick={() => void handleRefuser(record.id)}
                >
                  Refuser
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Documents soumis"
        open={docsDemandeId !== null}
        onCancel={() => {
          setDocsDemandeId(null);
          setDocsUrls(null);
        }}
        footer={null}
      >
        {docsLoading ? (
          'Chargement…'
        ) : docsUrls ? (
          <Space size="large">
            <div>
              <p>Selfie</p>
              <Image src={docsUrls.selfie} width={180} />
            </div>
            <div>
              <p>Permis</p>
              <Image src={docsUrls.permis} width={180} />
            </div>
          </Space>
        ) : null}
      </Modal>
    </>
  );
}
