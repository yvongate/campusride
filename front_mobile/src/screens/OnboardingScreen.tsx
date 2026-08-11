import { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { Button } from '../components/Button';
import { H3, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    illustration: require('../../assets/onboarding/slide1.jpg') as number,
    title: 'Regroupe-toi avec des étudiants de ton quartier',
    subtitle:
      "Crée ou rejoins un trajet vers ton université et partage les frais avec d'autres étudiants.",
  },
  {
    illustration: require('../../assets/onboarding/slide2.jpg') as number,
    title: 'On trouve le meilleur point de rendez-vous pour tout le monde',
    subtitle:
      'Dès que ton groupe est complet, on calcule automatiquement l’endroit le plus pratique pour se retrouver avant de rejoindre le campus ensemble.',
  },
  {
    illustration: require('../../assets/onboarding/slide3.jpg') as number,
    title: 'Voyage en confiance',
    subtitle:
      'Conducteurs vérifiés, notation après chaque trajet, paiement en espèces directement avec ton chauffeur.',
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  function goToSlide(next: number) {
    scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    setIndex(next);
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(next);
  }

  function handleSuivant() {
    if (isLast) {
      navigation.navigate('Localisation');
    } else {
      goToSlide(index + 1);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.skip, { paddingTop: insets.top + 16 }]}
        onPress={() => navigation.navigate('Localisation')}
      >
        <MutedText style={styles.skipText}>Passer</MutedText>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.content, { width: SCREEN_WIDTH }]}>
            <Image
              source={slide.illustration}
              style={styles.illustration}
              resizeMode="cover"
            />
            <H3 style={styles.title}>{slide.title}</H3>
            <MutedText style={styles.subtitle}>{slide.subtitle}</MutedText>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((slide, i) => (
          <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.buttonWrap, { paddingBottom: insets.bottom + 24 }]}>
        <Button title={isLast ? 'Commencer' : 'Suivant'} block onPress={handleSuivant} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  illustration: {
    width: '100%',
    height: 220,
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 20,
  },
  dot: {
    width: 18,
    height: 4,
    backgroundColor: colors.neutral300,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  buttonWrap: {
    paddingHorizontal: 20,
  },
});
