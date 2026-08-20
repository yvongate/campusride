import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreerMessageSupportDto {
  // Minimum volontairement bas mais non nul : un message vide ou "aide" ne
  // permet a personne de traiter le dossier. Le maximum evite qu'un envoi
  // accidentel (copier-coller) ne remplisse la base.
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'Explique ta situation en quelques mots (10 caractères minimum).',
  })
  @MaxLength(2000, { message: 'Ton message ne peut pas dépasser 2000 caractères.' })
  contenu: string;
}
