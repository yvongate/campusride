import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { COTISATION_MAX, PLACES_MAX } from '../../common/limites';

export class CreateDemandeDto {
  @IsString()
  @IsNotEmpty()
  universiteId: string;

  @IsString()
  @IsNotEmpty()
  communeId: string;

  @IsISO8601()
  heure: string;

  // Total attendu dans la voiture, createur compris (le mobile envoie donc
  // "personnes recherchees + 1"). Borne haute indispensable : sans @Max, un
  // appel direct pouvait creer une demande dont le quota etait hors
  // d'atteinte, condamnee a expirer sans jamais aboutir.
  @IsInt()
  @Min(1)
  @Max(PLACES_MAX)
  placesRecherchees: number;

  // Montant du par CHAQUE participant (jamais recalcule ensuite, §6.1).
  @IsNumber()
  @Min(1)
  @Max(COTISATION_MAX)
  cotisation: number;

  @IsBoolean()
  chezMoi: boolean;

  // Requis quand chezMoi=true (position GPS) ; optionnel sinon -- permet
  // d'affiner la position d'un point de repere choisi (epingle deplacee sur
  // la carte cote front_mobile), voir DemandesService.creerDemande.
  @ValidateIf(
    (dto: CreateDemandeDto) => dto.chezMoi === true || dto.lat !== undefined,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ValidateIf(
    (dto: CreateDemandeDto) => dto.chezMoi === true || dto.lng !== undefined,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ValidateIf((dto: CreateDemandeDto) => dto.chezMoi === false)
  @IsString()
  @IsNotEmpty()
  poiId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  quartierId?: string;
}
