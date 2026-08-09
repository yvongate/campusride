import { useCallback, useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Select, Table } from 'antd';
import {
  createPointInteret,
  listPointsInteret,
  listQuartiers,
  type PointInteret,
  type PointInteretInput,
  type Quartier,
} from '../api/client';

export default function PointsInteretPage() {
  const [pointsInteret, setPointsInteret] = useState<PointInteret[]>([]);
  const [quartiers, setQuartiers] = useState<Quartier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PointInteretInput>();
  const { message } = App.useApp();

  const loadData = useCallback(async () => {
    try {
      const [poiData, quartiersData] = await Promise.all([
        listPointsInteret(),
        listQuartiers(),
      ]);
      setPointsInteret(poiData);
      setQuartiers(quartiersData);
    } catch {
      message.error('Impossible de charger les Points d\'Interet');
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

  function openCreateModal() {
    form.resetFields();
    setModalOpen(true);
  }

  async function handleSubmit(values: PointInteretInput) {
    setSubmitting(true);
    try {
      await createPointInteret(values);
      setModalOpen(false);
      await loadData();
    } catch {
      message.error('Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h3 style={{ margin: 0 }}>Points d'intérêt</h3>
        <Button
          type="primary"
          onClick={openCreateModal}
          disabled={quartiers.length === 0}
        >
          Nouveau point d'intérêt
        </Button>
      </div>

      <Table<PointInteret>
        rowKey="id"
        loading={loading}
        dataSource={pointsInteret}
        pagination={false}
        columns={[
          { title: 'Nom', dataIndex: 'nom' },
          { title: 'Type', dataIndex: 'type' },
          { title: 'Quartier', render: (_, record) => record.quartier.nom },
          {
            title: 'Commune',
            render: (_, record) => record.quartier.commune.nom,
          },
          { title: 'Latitude', dataIndex: 'latitude' },
          { title: 'Longitude', dataIndex: 'longitude' },
        ]}
      />

      <Modal
        title="Nouveau point d'intérêt"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
      >
        <Form<PointInteretInput>
          form={form}
          layout="vertical"
          onFinish={(values) => void handleSubmit(values)}
        >
          <Form.Item label="Nom" name="nom" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Type" name="type" rules={[{ required: true }]}>
            <Input placeholder="carrefour, station-service, marche..." />
          </Form.Item>
          <Form.Item
            label="Quartier"
            name="quartierId"
            rules={[{ required: true, message: 'Le quartier est requis' }]}
          >
            <Select
              options={quartiers.map((quartier) => ({
                value: quartier.id,
                label: `${quartier.nom} (${quartier.commune.nom})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="Latitude"
            name="latitude"
            rules={[{ required: true, type: 'number', min: -90, max: 90 }]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Longitude"
            name="longitude"
            rules={[{ required: true, type: 'number', min: -180, max: 180 }]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
