import { Test } from '@nestjs/testing';
import { StatistiquesService } from './statistiques.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StatistiquesService', () => {
  let service: StatistiquesService;
  let trajetCountMock: jest.Mock;
  let demandeCountMock: jest.Mock;
  let documentsConducteurCountMock: jest.Mock;
  let signalementCountMock: jest.Mock;

  beforeEach(async () => {
    trajetCountMock = jest.fn().mockResolvedValue(3);
    demandeCountMock = jest.fn().mockResolvedValue(2);
    documentsConducteurCountMock = jest.fn().mockResolvedValue(1);
    signalementCountMock = jest.fn().mockResolvedValue(4);

    const moduleRef = await Test.createTestingModule({
      providers: [
        StatistiquesService,
        {
          provide: PrismaService,
          useValue: {
            trajet: { count: trajetCountMock },
            demande: { count: demandeCountMock },
            documentsConducteur: { count: documentsConducteurCountMock },
            signalement: { count: signalementCountMock },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(StatistiquesService);
  });

  it('uses the correct filter for each counter', async () => {
    const result = await service.obtenirStatistiques();

    expect(trajetCountMock).toHaveBeenCalledWith({
      where: {
        heure: {
          gte: expect.any(Date) as Date,
          lte: expect.any(Date) as Date,
        },
      },
    });
    expect(demandeCountMock).toHaveBeenCalledWith({
      where: { statut: 'ouverte' },
    });
    expect(documentsConducteurCountMock).toHaveBeenCalledWith({
      where: { statut: 'en attente' },
    });
    expect(signalementCountMock).toHaveBeenCalledWith({
      where: { statut: 'ouvert' },
    });
    expect(result).toEqual({
      trajetsAujourdhui: 3,
      demandesEnAttente: 2,
      conducteursAValider: 1,
      signalementsOuverts: 4,
    });
  });
});
