import { useCallback, useEffect, useState } from 'react';
import { App, Button, Image, Modal, Space, Table } from 'antd';
import {
  getDocumentVerificationBlobUrl,
  listVerificationsIdentite,
  refuserVerificationIdentite,
  validerVerificationIdentite,
  type VerificationIdentite,
} from '../api/client';
import { getDisplayName } from '../utils/displayName';

// Table "Vérifications d'identité en attente" -- meme structure que
// DemandesConducteurTable (documents CNI + selfie au lieu de selfie +
// permis).
export default function VerificationsIdentiteTable() {
  const [verifications, setVerifications] = useState<VerificationIdentite[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [docsVerificationId, setDocsVerificationId] = useState<string | null>(
    null,
  );
  const [docsUrls, setDocsUrls] = useState<{ cni: string; selfie: string } | null>(
    null,
  );
  const [docsLoading, setDocsLoading] = useState(false);
  const { message } = App.useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVerifications(await listVerificationsIdentite());
    } catch {
      message.error("Impossible de charger les vérifications d'identité");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (docsUrls) {
        URL.revokeObjectURL(docsUrls.cni);
        URL.revokeObjectURL(docsUrls.selfie);
      }
    };
  }, [docsUrls]);

  async function handleVoirDocuments(verificationId: string) {
    setDocsVerificationId(verificationId);
    setDocsLoading(true);
    try {
      const [cni, selfie] = await Promise.all([
        getDocumentVerificationBlobUrl(verificationId, 'cni'),
        getDocumentVerificationBlobUrl(verificationId, 'selfie'),
      ]);
      setDocsUrls({ cni, selfie });
    } catch {
      message.error('Impossible de charger les documents');
      setDocsVerificationId(null);
    } finally {
      setDocsLoading(false);
    }
  }

  async function handleValider(id: string) {
    setPendingId(id);
    try {
      await validerVerificationIdentite(id);
      message.success('Vérification validée');
      await load();
    } catch {
      message.error('Impossible de valider cette vérification');
    } finally {
      setPendingId(null);
    }
  }

  async function handleRefuser(id: string) {
    setPendingId(id);
    try {
      await refuserVerificationIdentite(id);
      message.success('Vérification refusée');
      await load();
    } catch {
      message.error('Impossible de refuser cette vérification');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <Table<VerificationIdentite>
        rowKey="id"
        loading={loading}
        dataSource={verifications}
        pagination={false}
        columns={[
          {
            title: 'Utilisateur',
            render: (_, record) =>
              getDisplayName(record.nom, record.prenom, record.telephone),
          },
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
        open={docsVerificationId !== null}
        onCancel={() => {
          setDocsVerificationId(null);
          setDocsUrls(null);
        }}
        footer={null}
      >
        {docsLoading ? (
          'Chargement…'
        ) : docsUrls ? (
          <Space size="large">
            <div>
              <p>CNI</p>
              <Image src={docsUrls.cni} width={180} />
            </div>
            <div>
              <p>Selfie</p>
              <Image src={docsUrls.selfie} width={180} />
            </div>
          </Space>
        ) : null}
      </Modal>
    </>
  );
}
