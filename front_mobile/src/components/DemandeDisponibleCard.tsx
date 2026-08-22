import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import type { DemandeDisponible } from '../api/client';
import { Button } from './Button';
import { Card } from './Card';
import { MutedText } from './Typography';

// Extrait de DemandesDisponiblesScreen pour etre reutilise tel quel sur
// l'accueil d'un conducteur, qui affiche desormais les demandes de sa commune
// directement plutot que de le renvoyer vers un autre ecran. Un composant
// partage plutot qu'une copie : deux rendus divergents du meme objet metier
// finissent toujours par afficher deux prix differents.
export function DemandeDisponibleCard({
  demande,
  pending,
  onAccepter,
}: {
  demande: DemandeDisponible;
  pending: boolean;
  onAccepter: () => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>
          {demande.poi.nom} → {demande.universite.nom}
        </Text>
        <Text style={styles.time}>
          {new Date(demande.heure).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <MutedText style={styles.cardBody}>
        {demande.placesRecherchees} passagers · point suggéré :{' '}
        {demande.poi.nom} ·{' '}
        <Text style={styles.total}>
          {demande.placesRecherchees * demande.cotisation} FCFA
        </Text>{' '}
        total
      </MutedText>
      <Button
        title={pending ? '...' : 'Voir & accepter'}
        block
        loading={pending}
        onPress={onAccepter}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  time: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.accent,
  },
  cardBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  total: {
    fontFamily: fonts.headingSemiBold,
    color: colors.text,
  },
});
