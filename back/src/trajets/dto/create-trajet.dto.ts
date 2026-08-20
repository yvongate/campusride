import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { COTISATION_MAX, PLACES_MAX } from '../../common/limites';

export class CreateTrajetDto {
  @IsString()
  @IsNotEmpty()
  universiteId: string;

  @IsString()
  @IsNotEmpty()
  pointDeRdvId: string;

  @IsISO8601()
  heure: string;

  // Bornes hautes indispensables cote API : le mobile plafonne deja a
  // PLACES_MAX, mais sans @Max un appel direct pouvait creer un trajet a 100
  // places (jamais remplissable) ou une cotisation absurde.
  @IsInt()
  @Min(1)
  @Max(PLACES_MAX)
  places: number;

  // Montant fixe du par CHAQUE passager (plus de division dynamique d'un
  // prix total, voir cahier des charges §6) -- meme semantique que
  // CreateDemandeDto.cotisation.
  @IsNumber()
  @Min(1)
  @Max(COTISATION_MAX)
  cotisation: number;
}
