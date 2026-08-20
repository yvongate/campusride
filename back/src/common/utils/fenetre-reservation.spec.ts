import { BadRequestException } from '@nestjs/common';
import { verifierFenetreReservation } from './fenetre-reservation';

describe('verifierFenetreReservation', () => {
  it('throws BadRequestException when the heure is in the past', () => {
    expect(() =>
      verifierFenetreReservation(new Date(Date.now() - 1000)),
    ).toThrow(BadRequestException);
  });

  it('accepts an heure a few hours from now (today)', () => {
    expect(() =>
      verifierFenetreReservation(new Date(Date.now() + 3 * 60 * 60 * 1000)),
    ).not.toThrow();
  });

  it('throws BadRequestException when the departure is less than 1h15 away', () => {
    // Sans ce garde-fou, la demande naissait deja dans la zone d'expiration
    // et le cron la supprimait dans la minute suivant sa creation.
    expect(() =>
      verifierFenetreReservation(new Date(Date.now() + 45 * 60 * 1000)),
    ).toThrow(BadRequestException);
  });

  it('accepts an heure just beyond the 1h15 minimum', () => {
    expect(() =>
      verifierFenetreReservation(new Date(Date.now() + 80 * 60 * 1000)),
    ).not.toThrow();
  });

  it('accepts an heure tomorrow at noon UTC', () => {
    const demain = new Date();
    demain.setUTCDate(demain.getUTCDate() + 1);
    demain.setUTCHours(12, 0, 0, 0);

    expect(() => verifierFenetreReservation(demain)).not.toThrow();
  });

  it('throws BadRequestException for an heure the day after tomorrow', () => {
    const apresDemain = new Date();
    apresDemain.setUTCDate(apresDemain.getUTCDate() + 2);
    apresDemain.setUTCHours(0, 0, 0, 0);

    expect(() => verifierFenetreReservation(apresDemain)).toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException for an heure several days from now', () => {
    expect(() =>
      verifierFenetreReservation(
        new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      ),
    ).toThrow(BadRequestException);
  });
});
