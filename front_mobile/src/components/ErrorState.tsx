import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Button } from './Button';

// Affiche une erreur de chargement avec un bouton pour reessayer, a la place
// d'une liste vide ou d'un message muet -- utilise quand un ecran n'a pas pu
// charger ses donnees initiales.
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <Button title="Réessayer" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    paddingHorizontal: 24,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.text,
    textAlign: 'center',
  },
});
