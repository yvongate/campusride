import { Text, TextProps } from 'react-native';
import { colors, fonts, fontSizes } from '../theme';

// h1-h6 : memes tailles/poids que --font-heading (Archivo 800) de la
// maquette (voir UI_inspo/_ds/.../styles.css, regles h1..h6).
export function H3({ style, ...props }: TextProps) {
  return (
    <Text
      style={[
        { fontFamily: fonts.heading, fontSize: fontSizes.h3, color: colors.text },
        style,
      ]}
      {...props}
    />
  );
}

export function H4({ style, ...props }: TextProps) {
  return (
    <Text
      style={[
        { fontFamily: fonts.heading, fontSize: fontSizes.h4, color: colors.text },
        style,
      ]}
      {...props}
    />
  );
}

export function H5({ style, ...props }: TextProps) {
  return (
    <Text
      style={[
        { fontFamily: fonts.heading, fontSize: fontSizes.h5, color: colors.text },
        style,
      ]}
      {...props}
    />
  );
}

// h6 : uppercase + letter-spacing dans la maquette (kicker de section).
export function H6({ style, ...props }: TextProps) {
  return (
    <Text
      style={[
        {
          fontFamily: fonts.heading,
          fontSize: fontSizes.h6,
          color: colors.text,
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function BodyText({ style, ...props }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: fonts.body, fontSize: 14, color: colors.text }, style]}
      {...props}
    />
  );
}

export function MutedText({ style, ...props }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted }, style]}
      {...props}
    />
  );
}
