import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateProfilDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  nom: string;
}
