import { useCallback, useEffect, useState } from 'react';
import { App, Button, Form, Input, Select, Table } from 'antd';
import {
  createCommune,
  createQuartier,
  listCommunes,
  listQuartiers,
  type Commune,
  type CommuneInput,
  type Quartier,
  type QuartierInput,
} from '../api/client';

export default function CommunesQuartiersPage() {
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [quartiers, setQuartiers] = useState<Quartier[]>([]);
  const [loading, setLoading] = useState(true);
  const [communeSubmitting, setCommuneSubmitting] = useState(false);
  const [quartierSubmitting, setQuartierSubmitting] = useState(false);
  const [communeForm] = Form.useForm<CommuneInput>();
  const [quartierForm] = Form.useForm<QuartierInput>();
  const { message } = App.useApp();

  const loadData = useCallback(async () => {
    try {
      const [communesData, quartiersData] = await Promise.all([
        listCommunes(),
        listQuartiers(),
      ]);
      setCommunes(communesData);
      setQuartiers(quartiersData);
    } catch {
      message.error('Impossible de charger les communes/quartiers');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    // Chargement classique au montage (cf. react.dev/learn/you-might-not-need-an-effect) --
    // pas de boucle de re-render, un seul fetch initial, pas de framework a chargeurs ici.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleCreateCommune(values: CommuneInput) {
    setCommuneSubmitting(true);
    try {
      await createCommune(values);
      communeForm.resetFields();
      communeForm.setFieldsValue({ ville: 'Abidjan' });
      await loadData();
    } catch {
      message.error('Erreur lors de la creation de la commune');
    } finally {
      setCommuneSubmitting(false);
    }
  }

  async function handleCreateQuartier(values: QuartierInput) {
    setQuartierSubmitting(true);
    try {
      await createQuartier(values);
      quartierForm.resetFields();
      await loadData();
    } catch {
      message.error('Erreur lors de la creation du quartier');
    } finally {
      setQuartierSubmitting(false);
    }
  }

  return (
    <div>
      <h3>Communes et quartiers</h3>

      <h5>Communes</h5>
      <Form<CommuneInput>
        form={communeForm}
        layout="inline"
        initialValues={{ ville: 'Abidjan' }}
        onFinish={(values) => void handleCreateCommune(values)}
        style={{ marginBottom: 16 }}
      >
        <Form.Item label="Nom" name="nom" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Ville" name="ville" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={communeSubmitting}>
            Ajouter la commune
          </Button>
        </Form.Item>
      </Form>
      <Table<Commune>
        rowKey="id"
        loading={loading}
        dataSource={communes}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: 'Nom', dataIndex: 'nom' },
          { title: 'Ville', dataIndex: 'ville' },
        ]}
        style={{ marginBottom: 32 }}
      />

      <h5>Quartiers</h5>
      <Form<QuartierInput>
        form={quartierForm}
        layout="inline"
        onFinish={(values) => void handleCreateQuartier(values)}
        style={{ marginBottom: 16 }}
      >
        <Form.Item label="Nom" name="nom" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="Commune"
          name="communeId"
          rules={[{ required: true, message: 'La commune est requise' }]}
        >
          <Select
            style={{ width: 200 }}
            options={communes.map((commune) => ({
              value: commune.id,
              label: `${commune.nom} (${commune.ville})`,
            }))}
          />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={quartierSubmitting}
            disabled={communes.length === 0}
          >
            Ajouter le quartier
          </Button>
        </Form.Item>
      </Form>
      <Table<Quartier>
        rowKey="id"
        loading={loading}
        dataSource={quartiers}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: 'Nom', dataIndex: 'nom' },
          {
            title: 'Commune',
            render: (_, record) => record.commune.nom,
          },
        ]}
      />
    </div>
  );
}
