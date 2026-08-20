import { IsNotEmpty, IsString } from 'class-validator';

export class SupprimerAppareilDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
