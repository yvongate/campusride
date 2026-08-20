import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RepondreMessageSupportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reponse: string;
}
