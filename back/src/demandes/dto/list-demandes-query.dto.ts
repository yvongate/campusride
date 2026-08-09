import { IsNotEmpty, IsString } from 'class-validator';

export class ListDemandesQueryDto {
  @IsString()
  @IsNotEmpty()
  universiteId: string;

  @IsString()
  @IsNotEmpty()
  communeId: string;
}
