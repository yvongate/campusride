import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class CreateTrajetDto {
  @IsString()
  @IsNotEmpty()
  universiteId: string;

  @IsString()
  @IsNotEmpty()
  pointDeRdvId: string;

  @IsISO8601()
  heure: string;

  @IsInt()
  @Min(1)
  places: number;

  @IsNumber()
  @Min(1)
  prixTotal: number;
}
