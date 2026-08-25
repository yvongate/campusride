import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RefuserDemandeConducteurDto {
  // Le refus doit etre motive : sans explication, le demandeur resoumet le
  // meme dossier defaillant et l'administrateur traite deux fois le meme cas.
  @IsString()
  @IsNotEmpty({ message: 'Le motif du refus est obligatoire.' })
  @MinLength(10, {
    message:
      'Le motif doit compter au moins 10 caracteres pour etre exploitable par le demandeur.',
  })
  @MaxLength(500, { message: 'Le motif ne peut pas depasser 500 caracteres.' })
  motif!: string;
}
