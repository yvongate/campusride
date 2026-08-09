import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDemandeConducteurDto {
  @IsString()
  @IsNotEmpty({ message: 'Le numero de matricule est requis' })
  matriculeVehicule: string;

  @IsOptional()
  @IsString()
  motBienvenue?: string;
}
