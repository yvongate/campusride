import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateProfilDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Le nom ne peut pas etre vide' })
  nom?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "L'universite ne peut pas etre vide" })
  universiteId?: string;
}
