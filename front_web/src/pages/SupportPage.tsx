import { useCallback, useEffect, useState } from 'react';
import { App, Button, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import {
  listMessagesSupport,
  reactiverCompte,
  repondreMessageSupport,
  type MessageSupport,
} from '../api/client';
import { getDisplayName } from '../utils/displayName';

const { Paragraph, Text } = Typography;

function estSuspendu(message: MessageSupport): boolean {
  const jusqua = message.utilisateur.suspenduJusqua;
  return jusqua !== null && new Date(jusqua) > new Date();
}

export default function SupportPage() {
  const [messages, setMessages] = useState<MessageSupport[]>([]);
  const [loading, setLoading] = useState(true);
  const [cible, setCible] = useState<MessageSupport | null>(null);
  const [reponse, setReponse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { message: notif } = App.useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMessages(await listMessagesSupport());
    } catch {
      notif.error('Impossible de charger les messages');
    } finally {
      setLoading(false);
    }
  }, [notif]);

  useEffect(() => {
    // Chargement classique au montage, comme les autres pages du back-office.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleRepondre() {
    if (!cible || reponse.trim().length === 0) return;
    setEnvoi(true);
    try {
      await repondreMessageSupport(cible.id, reponse.trim());
      notif.success("Réponse envoyée, l'utilisateur est notifié");
      setCible(null);
      setReponse('');
      await load();
    } catch {
      notif.error("Impossible d'envoyer la réponse");
    } finally {
      setEnvoi(false);
    }
  }

  // Levee de la sanction : c'est l'action attendue dans la majorite des
  // recours. La meme route que "Réactiver" dans Comptes, qui remet aussi
  // suspenduJusqua a null.
  async function handleLeverSuspension(message: MessageSupport) {
    setPendingId(message.id);
    try {
      await reactiverCompte(message.utilisateur.id);
      notif.success('Suspension levée');
      await load();
    } catch {
      notif.error('Impossible de lever la suspension');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <h3>Messages du support</h3>
      <Table<MessageSupport>
        rowKey="id"
        loading={loading}
        dataSource={messages}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record) => (
            <div>
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                {record.contenu}
              </Paragraph>
              {record.reponse ? (
                <Paragraph
                  type="secondary"
                  style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                >
                  <Text strong>Réponse : </Text>
                  {record.reponse}
                </Paragraph>
              ) : null}
            </div>
          ),
        }}
        columns={[
          {
            title: 'Auteur',
            render: (_, record) => (
              <Space direction="vertical" size={0}>
                <span>
                  {getDisplayName(
                    record.utilisateur.nom,
                    record.utilisateur.prenom,
                    null,
                  )}
                </span>
                <Text type="secondary">{record.utilisateur.telephone}</Text>
              </Space>
            ),
          },
          {
            title: 'Message',
            dataIndex: 'contenu',
            ellipsis: true,
          },
          {
            title: 'Compte',
            render: (_, record) =>
              !record.utilisateur.actif ? (
                <Tag color="red">Désactivé</Tag>
              ) : estSuspendu(record) ? (
                <Tag color="volcano">
                  Suspendu jusqu'au{' '}
                  {new Date(
                    record.utilisateur.suspenduJusqua as string,
                  ).toLocaleDateString()}
                </Tag>
              ) : (
                <Tag color="green">Actif</Tag>
              ),
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
                <Tag color="default">Répondu</Tag>
              ) : (
                <Tag color="orange">Ouvert</Tag>
              ),
          },
          {
            title: 'Action',
            render: (_, record) => (
              <Space>
                {record.statut === 'ouvert' ? (
                  <Button
                    type="primary"
                    onClick={() => {
                      setCible(record);
                      setReponse('');
                    }}
                  >
                    Répondre
                  </Button>
                ) : null}
                {estSuspendu(record) ? (
                  <Button
                    loading={pendingId === record.id}
                    onClick={() => void handleLeverSuspension(record)}
                  >
                    Lever la suspension
                  </Button>
                ) : null}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Répondre au message"
        open={cible !== null}
        onCancel={() => setCible(null)}
        onOk={() => void handleRepondre()}
        okText="Envoyer"
        cancelText="Annuler"
        confirmLoading={envoi}
        okButtonProps={{ disabled: reponse.trim().length === 0 }}
      >
        <Paragraph type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
          {cible?.contenu}
        </Paragraph>
        <Input.TextArea
          rows={5}
          maxLength={2000}
          showCount
          value={reponse}
          onChange={(e) => setReponse(e.target.value)}
          placeholder="Ta réponse, telle qu'elle s'affichera dans l'app…"
        />
      </Modal>
    </div>
  );
}
