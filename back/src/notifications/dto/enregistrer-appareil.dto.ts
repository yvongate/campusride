import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class EnregistrerAppareilDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsIn(['android', 'ios'])
  plateforme: string;
}
