import { StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';
import { MenuIcon } from './icons';

// Accès au profil depuis le header des 3 écrans onglets restants (Accueil,
// Trajets, Messages) -- le profil est sorti de la barre du bas au profit
// d'un menu burger, voir MainTabs.tsx (barre flottante "liquid glass").
export function BurgerButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} hitSlop={8}>
      <MenuIcon color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
