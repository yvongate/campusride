import { useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { Button } from './Button';
import { H5, MutedText } from './Typography';

// Carte OpenStreetMap (Leaflet, via WebView) pour affiner une position --
// gratuit et identique iOS/Android, contrairement a react-native-maps qui
// exige une cle Google Maps payante cote Android. WebView est inclus dans
// Expo Go, aucun build natif custom necessaire (voir AGENTS.md -- verifie
// sur la doc Expo SDK 54 avant integration).
function buildMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map').setView([${lat}, ${lng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
  function send(latlng) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lng: latlng.lng }));
  }
  marker.on('dragend', function (e) { send(e.target.getLatLng()); });
</script>
</body>
</html>`;
}

export function MapPinPicker({
  visible,
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  initialLat: number;
  initialLng: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });
  const html = useMemo(
    () => buildMapHtml(initialLat, initialLng),
    [initialLat, initialLng],
  );

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        lat: number;
        lng: number;
      };
      setPosition(data);
    } catch {
      // message inattendu -- on ignore, la position confirmee reste la derniere valide
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <H5>Affine ta position</H5>
          <MutedText style={styles.hint}>
            Fais glisser l'épingle à l'endroit exact où tu seras.
          </MutedText>
        </View>

        <WebView
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          style={styles.webview}
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Button
            title="Valider cette position"
            block
            onPress={() => onConfirm(position.lat, position.lng)}
          />
          <Button title="Annuler" variant="ghost" block onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  hint: {
    marginTop: 4,
  },
  webview: {
    flex: 1,
  },
  footer: {
    padding: 20,
    gap: 4,
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.divider,
  },
});
