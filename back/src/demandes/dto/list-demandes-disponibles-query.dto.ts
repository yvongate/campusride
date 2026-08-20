import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ListDemandesDisponiblesQueryDto {
  // Optionnel : un conducteur "chauffeur" (compte non-etudiant, voir
  // Utilisateur.role) n'a pas d'universite de rattachement et doit pouvoir
  // parcourir les demandes de toutes les universites d'une commune -- un
  // conducteur "les deux" (etudiant + conducteur) garde le filtre habituel
  // sur sa propre universite.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  universiteId?: string;

  @IsString()
  @IsNotEmpty()
  communeId: string;
}
