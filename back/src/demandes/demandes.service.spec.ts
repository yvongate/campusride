import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DemandesService } from './demandes.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrajetsService } from '../trajets/trajets.service';

describe('DemandesService', () => {
  let service: DemandesService;
  let universiteFindUniqueMock: jest.Mock;
  let communeFindUniqueMock: jest.Mock;
  let poiFindUniqueMock: jest.Mock;
  let demandeCreateMock: jest.Mock;
  let demandeFindManyMock: jest.Mock;
  let demandeFindFirstMock: jest.Mock;
  let demandeFindUniqueMock: jest.Mock;
  let demandeUpdateMock: jest.Mock;
  let participationCreateMock: jest.Mock;
  let participationFindFirstMock: jest.Mock;
  let participationCountMock: jest.Mock;
  let participationFindManyMock: jest.Mock;
  let poiFindManyMock: jest.Mock;
  let trajetCreateMock: jest.Mock;
  let trajetFindUniqueMock: jest.Mock;
  let trajetFindFirstMock: jest.Mock;
  let reservationCreateManyMock: jest.Mock;
  let verifierConducteurEtChevauchementMock: jest.Mock;
  let utilisateurFindUniqueMock: jest.Mock;
  let documentsConducteurFindFirstMock: jest.Mock;
  let verificationIdentiteFindFirstMock: jest.Mock;

  const baseDto = {
    universiteId: 'univ-1',
    communeId: 'commune-1',
    heure: '2026-09-01T07:00:00.000Z',
    placesRecherchees: 4,
    cotisation: 500,
  };

  beforeEach(async () => {
    universiteFindUniqueMock = jest.fn();
    communeFindUniqueMock = jest.fn();
    poiFindUniqueMock = jest.fn();
    demandeCreateMock = jest.fn();
    demandeFindManyMock = jest.fn();
    demandeFindFirstMock = jest.fn().mockResolvedValue(null);
    demandeFindUniqueMock = jest.fn();
    demandeUpdateMock = jest.fn();
    participationCreateMock = jest.fn();
    participationFindFirstMock = jest.fn();
    participationCountMock = jest.fn();
    participationFindManyMock = jest.fn().mockResolvedValue([]);
    poiFindManyMock = jest.fn().mockResolvedValue([]);
    trajetCreateMock = jest.fn();
    trajetFindUniqueMock = jest.fn();
    trajetFindFirstMock = jest.fn().mockResolvedValue(null);
    reservationCreateManyMock = jest.fn();
    verifierConducteurEtChevauchementMock = jest
      .fn()
      .mockResolvedValue(undefined);
    utilisateurFindUniqueMock = jest.fn();
    documentsConducteurFindFirstMock = jest.fn();
    verificationIdentiteFindFirstMock = jest
      .fn()
      .mockResolvedValue({ id: 'verif-1', userId: 'user-1', statut: 'valide' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        DemandesService,
        {
          provide: TrajetsService,
          useValue: {
            verifierConducteurEtChevauchement:
              verifierConducteurEtChevauchementMock,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            universite: { findUnique: universiteFindUniqueMock },
            commune: { findUnique: communeFindUniqueMock },
            pointInteret: {
              findUnique: poiFindUniqueMock,
              findMany: poiFindManyMock,
            },
            demande: {
              create: demandeCreateMock,
              findMany: demandeFindManyMock,
              findFirst: demandeFindFirstMock,
              findUnique: demandeFindUniqueMock,
              update: demandeUpdateMock,
            },
            participation: {
              create: participationCreateMock,
              findFirst: participationFindFirstMock,
              count: participationCountMock,
              findMany: participationFindManyMock,
            },
            trajet: { findUnique: trajetFindUniqueMock, findFirst: trajetFindFirstMock },
            utilisateur: { findUnique: utilisateurFindUniqueMock },
            documentsConducteur: {
              findFirst: documentsConducteurFindFirstMock,
            },
            verificationIdentite: {
              findFirst: verificationIdentiteFindFirstMock,
            },
            $transaction: jest.fn(
              (
                fn: (tx: {
                  demande: { create: jest.Mock; update: jest.Mock };
                  participation: { create: jest.Mock };
                  trajet: { create: jest.Mock };
                  reservation: { createMany: jest.Mock };
                }) => Promise<unknown>,
              ) =>
                fn({
                  demande: {
                    create: demandeCreateMock,
                    update: demandeUpdateMock,
                  },
                  participation: { create: participationCreateMock },
                  trajet: { create: trajetCreateMock },
                  reservation: { createMany: reservationCreateManyMock },
                }),
            ),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DemandesService);
  });

  describe('creerDemande', () => {
    it('creates a Demande and a Participation with GPS position when chezMoi is true', async () => {
      universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
      communeFindUniqueMock.mockResolvedValueOnce({ id: 'commune-1' });
      demandeCreateMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'ouverte',
      });

      const result = await service.creerDemande('createur-1', {
        ...baseDto,
        chezMoi: true,
        lat: 5.36,
        lng: -3.98,
      });

      expect(poiFindUniqueMock).not.toHaveBeenCalled();
      expect(demandeCreateMock).toHaveBeenCalledWith({
        data: {
          createurId: 'createur-1',
          universiteId: 'univ-1',
          communeId: 'commune-1',
          quartierId: undefined,
          poiId: undefined,
          heure: new Date(baseDto.heure),
          placesRecherchees: 4,
          cotisation: 500,
          statut: 'ouverte',
        },
      });
      expect(participationCreateMock).toHaveBeenCalledWith({
        data: {
          demandeId: 'demande-1',
          userId: 'createur-1',
          positionLat: 5.36,
          positionLng: -3.98,
          statut: 'confirmee',
        },
      });
      expect(result).toEqual({ id: 'demande-1', statut: 'ouverte' });
    });

    it('creates a Participation using the POI coordinates when chezMoi is false', async () => {
      universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
      communeFindUniqueMock.mockResolvedValueOnce({ id: 'commune-1' });
      poiFindUniqueMock.mockResolvedValueOnce({
        id: 'poi-1',
        latitude: 5.4,
        longitude: -4.0,
      });
      demandeCreateMock.mockResolvedValueOnce({
        id: 'demande-2',
        statut: 'ouverte',
      });

      await service.creerDemande('createur-1', {
        ...baseDto,
        chezMoi: false,
        poiId: 'poi-1',
      });

      expect(demandeCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ poiId: 'poi-1' }) as unknown,
      });
      expect(participationCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          positionLat: 5.4,
          positionLng: -4.0,
        }) as unknown,
      });
    });

    it('creates a Participation using the refined lat/lng instead of the POI coordinates when both are provided', async () => {
      universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
      communeFindUniqueMock.mockResolvedValueOnce({ id: 'commune-1' });
      poiFindUniqueMock.mockResolvedValueOnce({
        id: 'poi-1',
        latitude: 5.4,
        longitude: -4.0,
      });
      demandeCreateMock.mockResolvedValueOnce({
        id: 'demande-3',
        statut: 'ouverte',
      });

      await service.creerDemande('createur-1', {
        ...baseDto,
        chezMoi: false,
        poiId: 'poi-1',
        lat: 5.401,
        lng: -4.001,
      });

      expect(demandeCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ poiId: 'poi-1' }) as unknown,
      });
      expect(participationCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          positionLat: 5.401,
          positionLng: -4.001,
        }) as unknown,
      });
    });

    it('throws ConflictException when the createur already has an active demande', async () => {
      universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
      communeFindUniqueMock.mockResolvedValueOnce({ id: 'commune-1' });
      demandeFindFirstMock.mockResolvedValueOnce({
        id: 'demande-active',
        statut: 'quota_atteint',
      });

      await expect(
        service.creerDemande('createur-1', {
          ...baseDto,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        }),
      ).rejects.toThrow(ConflictException);
      expect(demandeFindFirstMock).toHaveBeenCalledWith({
        where: {
          createurId: 'createur-1',
          statut: { in: ['ouverte', 'quota_atteint', 'acceptee'] },
        },
      });
      expect(demandeCreateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the createur has no validated identity verification', async () => {
      verificationIdentiteFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.creerDemande('createur-1', {
          ...baseDto,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        }),
      ).rejects.toThrow(ConflictException);
      expect(universiteFindUniqueMock).not.toHaveBeenCalled();
      expect(demandeCreateMock).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the universite does not exist', async () => {
      universiteFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.creerDemande('createur-1', {
          ...baseDto,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(demandeCreateMock).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the commune does not exist', async () => {
      universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
      communeFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.creerDemande('createur-1', {
          ...baseDto,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(demandeCreateMock).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when chezMoi is false and the POI does not exist', async () => {
      universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
      communeFindUniqueMock.mockResolvedValueOnce({ id: 'commune-1' });
      poiFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.creerDemande('createur-1', {
          ...baseDto,
          chezMoi: false,
          poiId: 'poi-missing',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(demandeCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('listerDemandes', () => {
    it('filters by universiteId, communeId and statut "ouverte"', async () => {
      demandeFindManyMock.mockResolvedValueOnce([]);

      await service.listerDemandes('univ-1', 'commune-1', 'user-1');

      expect(demandeFindManyMock).toHaveBeenCalledWith({
        where: {
          universiteId: 'univ-1',
          communeId: 'commune-1',
          statut: 'ouverte',
        },
        include: {
          createur: {
            select: { id: true, nom: true, prenom: true, note: true },
          },
        },
        orderBy: { heure: 'asc' },
      });
    });

    it('computes placesRestantes from the confirmed participation count', async () => {
      demandeFindManyMock.mockResolvedValueOnce([
        { id: 'demande-1', placesRecherchees: 4 },
      ]);
      participationCountMock.mockResolvedValueOnce(3);

      const result = await service.listerDemandes('univ-1', 'commune-1', 'user-1');

      expect(participationCountMock).toHaveBeenCalledWith({
        where: { demandeId: 'demande-1', statut: 'confirmee' },
      });
      expect(result[0].placesRestantes).toBe(1);
    });

    it('flags dejaRejoint true when the requesting user already has a confirmed participation', async () => {
      demandeFindManyMock.mockResolvedValueOnce([
        { id: 'demande-1', placesRecherchees: 4 },
      ]);
      participationFindManyMock.mockResolvedValueOnce([
        { demandeId: 'demande-1' },
      ]);

      const result = await service.listerDemandes('univ-1', 'commune-1', 'user-1');

      expect(participationFindManyMock).toHaveBeenCalledWith({
        where: { userId: 'user-1', statut: 'confirmee' },
        select: { demandeId: true },
      });
      expect(result[0].dejaRejoint).toBe(true);
    });

    it('flags dejaRejoint false when the requesting user has no participation', async () => {
      demandeFindManyMock.mockResolvedValueOnce([
        { id: 'demande-1', placesRecherchees: 4 },
      ]);

      const result = await service.listerDemandes('univ-1', 'commune-1', 'user-1');

      expect(result[0].dejaRejoint).toBe(false);
    });
  });

  describe('listerMesDemandes', () => {
    it('filters by demandes where the user has a confirmed participation', async () => {
      demandeFindManyMock.mockResolvedValueOnce([]);

      await service.listerMesDemandes('user-1');

      expect(demandeFindManyMock).toHaveBeenCalledWith({
        where: { participations: { some: { userId: 'user-1', statut: 'confirmee' } } },
        include: {
          universite: true,
          commune: true,
          poi: true,
        },
        orderBy: { heure: 'desc' },
      });
    });

    it('computes placesConfirmees from the confirmed participation count', async () => {
      demandeFindManyMock.mockResolvedValueOnce([
        { id: 'demande-1', placesRecherchees: 4 },
      ]);
      participationCountMock.mockResolvedValueOnce(2);

      const result = await service.listerMesDemandes('user-1');

      expect(participationCountMock).toHaveBeenCalledWith({
        where: { demandeId: 'demande-1', statut: 'confirmee' },
      });
      expect(result[0].placesConfirmees).toBe(2);
    });
  });

  describe('rejoindreDemande', () => {
    const joinDto = { lat: 5.36, lng: -3.98 };

    it('throws ConflictException when the user has no validated identity verification', async () => {
      verificationIdentiteFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.rejoindreDemande('user-1', 'demande-1', joinDto),
      ).rejects.toThrow(ConflictException);
      expect(demandeFindUniqueMock).not.toHaveBeenCalled();
      expect(participationCreateMock).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the demande does not exist', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.rejoindreDemande('user-1', 'demande-missing', joinDto),
      ).rejects.toThrow(NotFoundException);
      expect(participationCreateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the demande is not "ouverte"', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'expiree',
        placesRecherchees: 4,
      });

      await expect(
        service.rejoindreDemande('user-1', 'demande-1', joinDto),
      ).rejects.toThrow(ConflictException);
      expect(participationCreateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the user already has a confirmed participation', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'ouverte',
        placesRecherchees: 4,
      });
      participationFindFirstMock.mockResolvedValueOnce({
        id: 'participation-1',
      });

      await expect(
        service.rejoindreDemande('user-1', 'demande-1', joinDto),
      ).rejects.toThrow(ConflictException);
      expect(participationCreateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the quota is already reached', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'ouverte',
        placesRecherchees: 2,
      });
      participationFindFirstMock.mockResolvedValueOnce(null);
      participationCountMock.mockResolvedValueOnce(2);

      await expect(
        service.rejoindreDemande('user-1', 'demande-1', joinDto),
      ).rejects.toThrow(ConflictException);
      expect(participationCreateMock).not.toHaveBeenCalled();
    });

    it('creates the Participation with the given GPS position when eligible', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'ouverte',
        placesRecherchees: 4,
      });
      participationFindFirstMock.mockResolvedValueOnce(null);
      participationCountMock.mockResolvedValueOnce(1);
      participationCreateMock.mockResolvedValueOnce({ id: 'participation-2' });

      const result = await service.rejoindreDemande(
        'user-1',
        'demande-1',
        joinDto,
      );

      expect(participationCreateMock).toHaveBeenCalledWith({
        data: {
          demandeId: 'demande-1',
          userId: 'user-1',
          positionLat: 5.36,
          positionLng: -3.98,
          statut: 'confirmee',
        },
      });
      expect(result).toEqual({ id: 'participation-2' });
    });

    it('reaches quota, suggests the nearest POI and updates the Demande', async () => {
      demandeFindUniqueMock
        .mockResolvedValueOnce({
          id: 'demande-1',
          statut: 'ouverte',
          placesRecherchees: 2,
        })
        .mockResolvedValueOnce({
          id: 'demande-1',
          statut: 'ouverte',
          placesRecherchees: 2,
          communeId: 'commune-1',
        });
      participationFindFirstMock.mockResolvedValueOnce(null);
      participationCountMock.mockResolvedValueOnce(1);
      participationCreateMock.mockResolvedValueOnce({ id: 'participation-2' });
      participationFindManyMock.mockResolvedValueOnce([
        { userId: 'createur-1', positionLat: 5.36, positionLng: -3.98 },
        { userId: 'user-1', positionLat: 5.37, positionLng: -3.97 },
      ]);
      poiFindManyMock.mockResolvedValueOnce([
        { id: 'poi-loin', nom: 'POI loin', latitude: 6.0, longitude: -5.0 },
        {
          id: 'poi-proche',
          nom: 'POI proche',
          latitude: 5.365,
          longitude: -3.975,
        },
      ]);
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.rejoindreDemande('user-1', 'demande-1', joinDto);

      expect(demandeUpdateMock).toHaveBeenCalledWith({
        where: { id: 'demande-1' },
        data: { statut: 'quota_atteint', poiId: 'poi-proche' },
      });
      expect(loggerSpy).toHaveBeenCalledTimes(2);
    });

    it('reaches quota and still suggests the nearest POI even when it is far from the centroid', async () => {
      demandeFindUniqueMock
        .mockResolvedValueOnce({
          id: 'demande-1',
          statut: 'ouverte',
          placesRecherchees: 2,
        })
        .mockResolvedValueOnce({
          id: 'demande-1',
          statut: 'ouverte',
          placesRecherchees: 2,
          communeId: 'commune-1',
        });
      participationFindFirstMock.mockResolvedValueOnce(null);
      participationCountMock.mockResolvedValueOnce(1);
      participationCreateMock.mockResolvedValueOnce({ id: 'participation-2' });
      participationFindManyMock.mockResolvedValueOnce([
        { userId: 'createur-1', positionLat: 5.36, positionLng: -3.98 },
        { userId: 'user-1', positionLat: 5.37, positionLng: -3.97 },
      ]);
      poiFindManyMock.mockResolvedValueOnce([
        { id: 'poi-loin', nom: 'POI loin', latitude: 6.0, longitude: -5.0 },
      ]);

      await service.rejoindreDemande('user-1', 'demande-1', joinDto);

      expect(demandeUpdateMock).toHaveBeenCalledWith({
        where: { id: 'demande-1' },
        data: { statut: 'quota_atteint', poiId: 'poi-loin' },
      });
    });

    it('reaches quota but reports no point when the commune has no POI at all', async () => {
      demandeFindUniqueMock
        .mockResolvedValueOnce({
          id: 'demande-1',
          statut: 'ouverte',
          placesRecherchees: 2,
        })
        .mockResolvedValueOnce({
          id: 'demande-1',
          statut: 'ouverte',
          placesRecherchees: 2,
          communeId: 'commune-1',
        });
      participationFindFirstMock.mockResolvedValueOnce(null);
      participationCountMock.mockResolvedValueOnce(1);
      participationCreateMock.mockResolvedValueOnce({ id: 'participation-2' });
      participationFindManyMock.mockResolvedValueOnce([
        { userId: 'createur-1', positionLat: 5.36, positionLng: -3.98 },
        { userId: 'user-1', positionLat: 5.37, positionLng: -3.97 },
      ]);
      poiFindManyMock.mockResolvedValueOnce([]);

      await service.rejoindreDemande('user-1', 'demande-1', joinDto);

      expect(demandeUpdateMock).toHaveBeenCalledWith({
        where: { id: 'demande-1' },
        data: { statut: 'quota_atteint' },
      });
    });

    it('does nothing when the quota is not yet reached', async () => {
      demandeFindUniqueMock
        .mockResolvedValueOnce({
          id: 'demande-1',
          statut: 'ouverte',
          placesRecherchees: 4,
        })
        .mockResolvedValueOnce({
          id: 'demande-1',
          statut: 'ouverte',
          placesRecherchees: 4,
          communeId: 'commune-1',
        });
      participationFindFirstMock.mockResolvedValueOnce(null);
      participationCountMock.mockResolvedValueOnce(1);
      participationCreateMock.mockResolvedValueOnce({ id: 'participation-2' });
      participationFindManyMock.mockResolvedValueOnce([
        { userId: 'createur-1', positionLat: 5.36, positionLng: -3.98 },
        { userId: 'user-1', positionLat: 5.37, positionLng: -3.97 },
      ]);

      await service.rejoindreDemande('user-1', 'demande-1', joinDto);

      expect(demandeUpdateMock).not.toHaveBeenCalled();
      expect(poiFindManyMock).not.toHaveBeenCalled();
    });
  });

  describe('expirerDemandesEnRetard', () => {
    it('expires an "ouverte" demande within 2h and notifies every confirmed participant', async () => {
      demandeFindManyMock.mockResolvedValueOnce([
        {
          id: 'demande-1',
          participations: [{ userId: 'createur-1' }, { userId: 'user-1' }],
        },
      ]);
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.expirerDemandesEnRetard();

      expect(demandeFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ statut: 'ouverte' }) as object,
        }),
      );
      expect(demandeUpdateMock).toHaveBeenCalledWith({
        where: { id: 'demande-1' },
        data: { statut: 'expiree' },
      });
      expect(loggerSpy).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no demande is eligible', async () => {
      demandeFindManyMock.mockResolvedValueOnce([]);

      await service.expirerDemandesEnRetard();

      expect(demandeUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('listerDemandesDisponibles', () => {
    it('filters by universiteId, communeId, statut "quota_atteint" and poiId not null', async () => {
      demandeFindManyMock.mockResolvedValueOnce([]);

      await service.listerDemandesDisponibles('univ-1', 'commune-1');

      expect(demandeFindManyMock).toHaveBeenCalledWith({
        where: {
          universiteId: 'univ-1',
          communeId: 'commune-1',
          statut: 'quota_atteint',
          poiId: { not: null },
        },
        include: {
          createur: {
            select: { id: true, nom: true, prenom: true, note: true },
          },
          poi: true,
        },
        orderBy: { heure: 'asc' },
      });
    });
  });

  describe('accepterDemande', () => {
    it('throws NotFoundException when the demande does not exist', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.accepterDemande('conducteur-1', 'demande-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(trajetCreateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the demande has not reached its quota', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'ouverte',
        poiId: null,
      });

      await expect(
        service.accepterDemande('conducteur-1', 'demande-1'),
      ).rejects.toThrow(ConflictException);
      expect(trajetCreateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the demande has no suggested poiId', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'quota_atteint',
        poiId: null,
      });

      await expect(
        service.accepterDemande('conducteur-1', 'demande-1'),
      ).rejects.toThrow(ConflictException);
      expect(trajetCreateMock).not.toHaveBeenCalled();
    });

    it('propagates the ForbiddenException from TrajetsService when the conducteur is invalid', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'quota_atteint',
        poiId: 'poi-1',
        heure: new Date('2026-09-01T07:00:00.000Z'),
      });
      verifierConducteurEtChevauchementMock.mockRejectedValueOnce(
        new ForbiddenException('Compte conducteur non valide'),
      );

      await expect(
        service.accepterDemande('conducteur-1', 'demande-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(trajetCreateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the conducteur already has an active trajet', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'quota_atteint',
        poiId: 'poi-1',
        heure: new Date('2026-09-01T07:00:00.000Z'),
      });
      trajetFindFirstMock.mockResolvedValueOnce({
        id: 'trajet-actif',
        statut: 'ouvert',
      });

      await expect(
        service.accepterDemande('conducteur-1', 'demande-1'),
      ).rejects.toThrow(ConflictException);
      expect(trajetFindFirstMock).toHaveBeenCalledWith({
        where: { conducteurId: 'conducteur-1', statut: { in: ['ouvert', 'commence'] } },
      });
      expect(trajetCreateMock).not.toHaveBeenCalled();
    });

    it('creates a Trajet mode "A" with a Reservation per confirmed Participation', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'quota_atteint',
        poiId: 'poi-1',
        universiteId: 'univ-1',
        heure: new Date('2026-09-01T07:00:00.000Z'),
        placesRecherchees: 3,
        cotisation: 500,
      });
      participationFindManyMock.mockResolvedValueOnce([
        { userId: 'createur-1' },
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      trajetCreateMock.mockResolvedValueOnce({ id: 'trajet-1' });
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      const result = await service.accepterDemande('conducteur-1', 'demande-1');

      expect(verifierConducteurEtChevauchementMock).toHaveBeenCalledWith(
        'conducteur-1',
        new Date('2026-09-01T07:00:00.000Z'),
      );
      expect(trajetCreateMock).toHaveBeenCalledWith({
        data: {
          conducteurId: 'conducteur-1',
          universiteId: 'univ-1',
          pointDeRdvId: 'poi-1',
          heure: new Date('2026-09-01T07:00:00.000Z'),
          places: 3,
          prixTotal: 1500,
          mode: 'A',
          statut: 'ouvert',
        },
      });
      expect(reservationCreateManyMock).toHaveBeenCalledWith({
        data: [
          {
            trajetId: 'trajet-1',
            passagerId: 'createur-1',
            prixParPersonne: 500,
            statut: 'confirmee',
          },
          {
            trajetId: 'trajet-1',
            passagerId: 'user-1',
            prixParPersonne: 500,
            statut: 'confirmee',
          },
          {
            trajetId: 'trajet-1',
            passagerId: 'user-2',
            prixParPersonne: 500,
            statut: 'confirmee',
          },
        ],
      });
      expect(demandeUpdateMock).toHaveBeenCalledWith({
        where: { id: 'demande-1' },
        data: { statut: 'acceptee', trajetId: 'trajet-1' },
      });
      expect(loggerSpy).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ id: 'trajet-1' });
    });
  });

  describe('getDemandeDetail', () => {
    it('throws NotFoundException when the demande does not exist', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.getDemandeDetail('user-1', 'demande-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns estParticipant false when the caller has not joined (preview from Accueil)', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'quota_atteint',
        trajetId: null,
        placesRecherchees: 4,
      });
      participationFindFirstMock.mockResolvedValueOnce(null);
      participationCountMock.mockResolvedValueOnce(2);

      const result = await service.getDemandeDetail('user-1', 'demande-1');

      expect(result.estParticipant).toBe(false);
    });

    it('returns the demande with placesConfirmees, estParticipant true and no conducteur before acceptance', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'quota_atteint',
        trajetId: null,
        placesRecherchees: 4,
      });
      participationFindFirstMock.mockResolvedValueOnce({
        id: 'participation-1',
      });
      participationCountMock.mockResolvedValueOnce(4);

      const result = await service.getDemandeDetail('user-1', 'demande-1');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'demande-1',
          placesConfirmees: 4,
          conducteur: null,
          estParticipant: true,
        }),
      );
      expect(trajetFindUniqueMock).not.toHaveBeenCalled();
    });

    it('returns the accepted conducteur when the demande has a linked trajet', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'acceptee',
        trajetId: 'trajet-1',
        placesRecherchees: 4,
      });
      participationFindFirstMock.mockResolvedValueOnce({
        id: 'participation-1',
      });
      participationCountMock.mockResolvedValueOnce(4);
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        nom: 'Kone',
        prenom: 'Dramane',
        note: 4.8,
      });
      documentsConducteurFindFirstMock.mockResolvedValueOnce({
        matriculeVehicule: 'CI-2847-AB',
      });

      const result = await service.getDemandeDetail('user-1', 'demande-1');

      expect(result.conducteur).toEqual({
        nom: 'Kone',
        prenom: 'Dramane',
        note: 4.8,
        matriculeVehicule: 'CI-2847-AB',
      });
    });
  });

  describe('annulerDemande', () => {
    it('throws NotFoundException when the demande does not exist', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.annulerDemande('user-1', 'demande-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the createur', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        createurId: 'createur-1',
        statut: 'ouverte',
      });

      await expect(
        service.annulerDemande('someone-else', 'demande-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(demandeUpdateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the demande is already acceptee', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        createurId: 'createur-1',
        statut: 'acceptee',
      });

      await expect(
        service.annulerDemande('createur-1', 'demande-1'),
      ).rejects.toThrow(ConflictException);
      expect(demandeUpdateMock).not.toHaveBeenCalled();
    });

    it('sets statut to annulee when the createur cancels an open demande', async () => {
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        createurId: 'createur-1',
        statut: 'ouverte',
      });

      await service.annulerDemande('createur-1', 'demande-1');

      expect(demandeUpdateMock).toHaveBeenCalledWith({
        where: { id: 'demande-1' },
        data: { statut: 'annulee' },
      });
    });
  });
});
