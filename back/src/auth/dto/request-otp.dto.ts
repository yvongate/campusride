import { Matches } from 'class-validator';

export class RequestOtpDto {
  @Matches(/^\+225\d{10}$/, {
    message:
      'Le numéro de téléphone doit être au format +225 suivi de 10 chiffres.',
  })
  phone: string;
}
