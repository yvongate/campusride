import { Matches } from 'class-validator';

export class VerifyOtpDto {
  @Matches(/^\+225\d{10}$/, {
    message:
      'Le numero de telephone doit etre au format +225 suivi de 10 chiffres',
  })
  phone: string;

  @Matches(/^\d{6}$/, {
    message: 'Le code doit contenir exactement 6 chiffres',
  })
  code: string;
}
