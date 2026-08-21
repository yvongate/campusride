import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListComptesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // Plafonne a 100 : sans borne, un appel avec limit=100000 annulerait tout
  // l'interet de la pagination et pourrait saturer la reponse.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  // Recherche sur le nom, le prenom ou le telephone. Indispensable des lors
  // que la liste ne tient plus sur un ecran : sans elle, retrouver un compte
  // precis imposerait de parcourir les pages une par une.
  @IsOptional()
  @IsString()
  recherche?: string;
}
