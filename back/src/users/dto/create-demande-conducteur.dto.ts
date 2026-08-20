import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDemandeConducteurDto {
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de matricule est obligatoire.' })
  matriculeVehicule: string;

  @IsOptional()
  @IsString()
  motBienvenue?: string;
}
