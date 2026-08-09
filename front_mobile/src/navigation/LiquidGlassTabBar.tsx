import type { ComponentType } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, fonts } from '../theme';
import { HomeIcon, ListIcon, MessageIcon } from '../components/icons';

interface IconProps {
  size?: number;
  color?: string;
}

// Onglets rendus dans la barre flottante (Profil en est exclu -- accessible
// via le bouton burger des headers, voir BurgerButton.tsx) -- inspirée de la
// barre "liquid glass" de Telegram (voir liquid_glass.jpg fourni par
// l'utilisateur) : pilule sombre translucide, coins arrondis, flottante.
const TAB_CONFIG: Record<string, { label: string; Icon: ComponentType<IconProps> }> = {
  Accueil: { label: 'Accueil', Icon: HomeIcon },
  MesTrajetsPassager: { label: 'Trajets', Icon: ListIcon },
  MessagesHub: { label: 'Messages', Icon: MessageIcon },
};

const ACTIVE_COLOR = colors.accent;
const INACTIVE_COLOR = 'rgba(243,242,242,0.6)';

export function LiquidGlassTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const routes = state.routes.filter((route) => route.name in TAB_CONFIG);

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 12 }]}>
      <BlurView
        intensity={70}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={styles.pill}
      >
        {routes.map((route) => {
          const index = state.routes.findIndex((r) => r.key === route.key);
          const focused = state.index === index;
          const { label, Icon } = TAB_CONFIG[route.name];
          const color = focused ? ACTIVE_COLOR : INACTIVE_COLOR;

          function onPress() {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          return (
            <TouchableOpacity key={route.key} style={styles.item} onPress={onPress}>
              <Icon color={color} size={20} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  pill: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 32,
    overflow: 'hidden',
    paddingVertical: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 10,
  },
});
