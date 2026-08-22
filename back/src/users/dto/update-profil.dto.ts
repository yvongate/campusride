import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateProfilDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Le nom ne peut pas être vide.' })
  nom?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "L'université ne peut pas être vide." })
  universiteId?: string;

  // Declaration "je rejoins en tant que conducteur" a l'onboarding (voir
  // ChoisirProfilScreen) -- jamais false explicitement, uniquement
  // absent ou true (voir UsersService.updateProfil).
  @IsOptional()
  @IsBoolean()
  estChauffeur?: boolean;
}
