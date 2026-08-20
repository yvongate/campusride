import { useCallback, useEffect, useState } from 'react';
import { App, Button, Form, InputNumber, Input, Modal, Table } from 'antd';
import {
  createUniversite,
  listUniversites,
  updateUniversite,
  type Universite,
  type UniversiteInput,
} from '../api/client';

export default function UniversitesPage() {
  const [universites, setUniversites] = useState<Universite[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Universite | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<UniversiteInput>();
  const { message } = App.useApp();

  const loadUniversites = useCallback(async () => {
    try {
      setUniversites(await listUniversites());
    } catch {
      message.error('Impossible de charger les universites');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    // Chargement classique au montage (cf. react.dev/learn/you-might-not-need-an-effect) --
    // pas de boucle de re-render, un seul fetch initial, pas de framework a chargeurs ici.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUniversites();
  }, [loadUniversites]);

  function openCreateModal() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEditModal(universite: Universite) {
    setEditing(universite);
    form.setFieldsValue(universite);
    setModalOpen(true);
  }

  async function handleSubmit(values: UniversiteInput) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateUniversite(editing.id, values);
      } else {
        await createUniversite(values);
      }
      setModalOpen(false);
      await loadUniversites();
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
        <h3 style={{ margin: 0 }}>Universités</h3>
        <Button type="primary" onClick={openCreateModal}>
          Nouvelle université
        </Button>
      </div>

      <Table<Universite>
        rowKey="id"
        loading={loading}
        dataSource={universites}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: 'Nom', dataIndex: 'nom' },
          { title: 'Commune', dataIndex: 'commune' },
          { title: 'Latitude', dataIndex: 'latitude' },
          { title: 'Longitude', dataIndex: 'longitude' },
          {
            title: 'Actions',
            render: (_, record) => (
              <Button onClick={() => openEditModal(record)}>Modifier</Button>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Modifier l\'universite' : 'Nouvelle universite'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
      >
        <Form<UniversiteInput>
          form={form}
          layout="vertical"
          onFinish={(values) => void handleSubmit(values)}
        >
          <Form.Item label="Nom" name="nom" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Commune" name="commune" rules={[{ required: true }]}>
            <Input />
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
