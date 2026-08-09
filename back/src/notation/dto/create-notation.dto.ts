import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateNotationDto {
  @IsString()
  @IsNotEmpty()
  destinataireId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  etoiles: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  commentaire?: string;
}
