import type { ReactNode } from 'react';
import { Layout, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import logoMark from '../assets/logo-mark.png';

const { Sider, Content } = Layout;

const NAV_ITEMS = [
  { key: '/dashboard', label: 'Tableau de bord' },
  { key: '/conducteurs', label: 'Conducteurs' },
  { key: '/universites', label: 'Universités' },
  { key: '/communes-quartiers', label: 'Communes / Quartiers' },
  { key: '/points-interet', label: "Points d'intérêt" },
  { key: '/signalements', label: 'Signalements' },
  { key: '/comptes', label: 'Comptes' },
  { key: '/support', label: 'Support' },
];

// Sidebar de UI_inspo (écran 19 -- Tableau de bord administrateur) :
// bloc marque + liste de sections, item actif en fond accent.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('accessToken');
    navigate('/login');
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={{
          borderRight: '2px solid var(--color-divider)',
          padding: '20px 16px',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          <img src={logoMark} alt="" style={{ width: 24, height: 24 }} />
          CampusRide
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', background: 'transparent' }}
          items={NAV_ITEMS.map((item) => ({ key: item.key, label: item.label }))}
        />
        <div style={{ position: 'absolute', bottom: 20, left: 16, right: 16 }}>
          <Menu
            mode="inline"
            selectable={false}
            style={{ border: 'none', background: 'transparent' }}
            onClick={handleLogout}
            items={[{ key: 'logout', label: 'Déconnexion' }]}
          />
        </div>
      </Sider>
      <Layout>
        <Content style={{ padding: '28px 32px', overflow: 'auto' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
