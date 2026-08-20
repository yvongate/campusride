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

  // Declaration "je suis chauffeur, pas etudiant" a l'onboarding (voir
  // ChoisirUniversiteScreen) -- jamais false explicitement, uniquement
  // absent ou true (voir UsersService.updateProfil).
  @IsOptional()
  @IsBoolean()
  estChauffeur?: boolean;
}
