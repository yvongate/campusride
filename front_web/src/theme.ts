import type { ThemeConfig } from 'antd';

// Reprend les tokens Modernist de UI_inspo (voir aussi front_mobile/src/theme.ts)
// pour que le dashboard admin partage le meme langage visuel que le mobile.
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#ec3013',
    colorLink: '#ec3013',
    colorBgBase: '#f3f2f2',
    colorBgLayout: '#f3f2f2',
    colorBgContainer: '#eae9e9',
    colorText: '#201e1d',
    colorTextSecondary: 'rgba(32,30,29,0.55)',
    colorBorder: 'rgba(32,30,29,0.4)',
    colorBorderSecondary: 'rgba(32,30,29,0.2)',
    borderRadius: 0,
    borderRadiusLG: 0,
    borderRadiusSM: 0,
    fontFamily: "'Archivo', system-ui, sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#eae9e9',
      headerBg: '#eae9e9',
      bodyBg: '#f3f2f2',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#ec3013',
      itemSelectedColor: '#f3f2f2',
      itemHoverBg: 'rgba(236,48,19,0.08)',
    },
    Table: {
      headerBg: '#eae9e9',
      borderColor: 'rgba(32,30,29,0.2)',
    },
    Card: {
      colorBgContainer: '#eae9e9',
    },
    Button: {
      primaryShadow: 'none',
    },
  },
};
