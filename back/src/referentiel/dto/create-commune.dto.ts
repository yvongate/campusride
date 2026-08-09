import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCommuneDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  ville: string;
}
