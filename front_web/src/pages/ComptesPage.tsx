import { useCallback, useEffect, useState } from 'react';
import { App, Button, Input, Space, Tag, Table } from 'antd';
import { desactiverCompte, listComptes, reactiverCompte, type Compte } from '../api/client';
import { getDisplayName } from '../utils/displayName';

const ROLE_LABELS: Record<string, string> = {
  etudiant: 'Étudiant',
  'les deux': 'Étudiant + conducteur',
  chauffeur: 'Conducteur (non étudiant)',
};

const TAILLE_PAGE = 20;

export default function ComptesPage() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // Terme applique a la requete, distinct de la saisie en cours : sans ca,
  // chaque frappe declencherait un appel serveur.
  const [recherche, setRecherche] = useState('');
  const [saisie, setSaisie] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { message } = App.useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resultat = await listComptes({
        page,
        limit: TAILLE_PAGE,
        recherche: recherche || undefined,
      });
      setComptes(resultat.items);
      setTotal(resultat.total);
    } catch {
      message.error('Impossible de charger les comptes');
    } finally {
      setLoading(false);
    }
  }, [message, page, recherche]);

  useEffect(() => {
    // Rechargement a chaque changement de page ou de recherche.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function lancerRecherche() {
    // Retour a la premiere page : rester page 12 sur un nouveau filtre qui ne
    // compte que 3 resultats afficherait un tableau vide.
    setPage(1);
    setRecherche(saisie.trim());
  }

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
      <Space.Compact style={{ marginBottom: 16, width: 360, maxWidth: '100%' }}>
        <Input
          placeholder="Nom, prénom ou téléphone"
          value={saisie}
          allowClear
          onChange={(e) => setSaisie(e.target.value)}
          onPressEnter={lancerRecherche}
        />
        <Button type="primary" onClick={lancerRecherche}>
          Rechercher
        </Button>
      </Space.Compact>
      <Table<Compte>
        rowKey="id"
        loading={loading}
        dataSource={comptes}
        pagination={{
          current: page,
          pageSize: TAILLE_PAGE,
          total,
          showSizeChanger: false,
          showTotal: (nombre) => `${nombre} comptes`,
          onChange: setPage,
        }}
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
