// Tokens repris de UI_inspo/_ds/modernist-.../styles.css (design system
// "Modernist" des maquettes) -- source de verite unique pour ces valeurs,
// voir UI_inspo/CampusRide App.dc.html pour les compositions d'ecran.
export const colors = {
  background: '#f3f2f2',
  surface: '#eae9e9',
  text: '#201e1d',
  textMuted: 'rgba(32,30,29,0.55)',
  accent: '#ec3013',
  accentPressed: '#dd2b0f',
  divider: 'rgba(32,30,29,0.4)',

  neutral100: '#f8f4f4',
  neutral200: '#eae7e7',
  neutral300: '#d7d3d3',
  neutral400: '#bab6b6',
  neutral500: '#9b9797',
  neutral600: '#7d7979',
  neutral700: '#605d5d',
  neutral800: '#444141',
  neutral900: '#2d2b2b',

  accent100: '#fff2ef',
  accent200: '#ffe0d9',
  accent300: '#ffc4b8',
  accent400: '#ff9783',
  accent500: '#ff563c',
  accent600: '#dd2b0f',
  accent700: '#ae1800',
  accent800: '#7c1405',
  accent900: '#4d170e',
};

export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s6: 24,
  s8: 32,
};

// Design plat -- radius 0 partout dans la maquette (--radius-sm/md/lg: 0px).
export const radius = 0;

export const fonts = {
  heading: 'Archivo_800ExtraBold',
  headingSemiBold: 'Archivo_600SemiBold',
  body: 'Archivo_400Regular',
};

export const fontSizes = {
  h1: 42,
  h2: 32,
  h3: 25,
  h4: 20,
  h5: 16,
  h6: 13,
  body: 15,
};

export const shadows = {
  sm: {
    shadowColor: colors.neutral900,
    shadowOpacity: 0.14,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: colors.neutral900,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
};
