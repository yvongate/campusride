import { PointInteret } from '../api/client';
import { distanceKm } from './haversine';

// Devine la commune de depart la plus probable depuis une position GPS, en
// cherchant le point de repere connu le plus proche et en lisant sa commune
// -- pas de geocodage inverse (Commune n'a pas de coordonnees en base, voir
// schema.prisma), juste une distance a vol d'oiseau sur les POI deja
// charges. Approximatif pres d'une frontiere entre deux communes, mais
// largement suffisant pour pre-remplir un champ que l'utilisateur peut
// toujours corriger.
export function nearestCommune(
  lat: number,
  lng: number,
  pois: PointInteret[],
): { id: string; nom: string } | null {
  let closest: PointInteret | null = null;
  let closestDist = Infinity;

  for (const poi of pois) {
    const d = distanceKm(lat, lng, poi.latitude, poi.longitude);
    if (d < closestDist) {
      closestDist = d;
      closest = poi;
    }
  }

  return closest ? closest.quartier.commune : null;
}
