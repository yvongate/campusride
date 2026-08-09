import { IsNotEmpty, IsString } from 'class-validator';

export class CreateQuartierDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  communeId: string;
}
