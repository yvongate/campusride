import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferentielService } from './referentiel.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReferentielService', () => {
  let service: ReferentielService;
  let createMock: jest.Mock;
  let findManyMock: jest.Mock;
  let findUniqueMock: jest.Mock;
  let updateMock: jest.Mock;
  let communeCreateMock: jest.Mock;
  let communeFindManyMock: jest.Mock;
  let communeFindUniqueMock: jest.Mock;
  let quartierCreateMock: jest.Mock;
  let quartierFindManyMock: jest.Mock;
  let quartierFindUniqueMock: jest.Mock;
  let poiCreateMock: jest.Mock;
  let poiFindManyMock: jest.Mock;

  beforeEach(async () => {
    createMock = jest.fn();
    findManyMock = jest.fn();
    findUniqueMock = jest.fn();
    updateMock = jest.fn();
    communeCreateMock = jest.fn();
    communeFindManyMock = jest.fn();
    communeFindUniqueMock = jest.fn();
    quartierCreateMock = jest.fn();
    quartierFindManyMock = jest.fn();
    quartierFindUniqueMock = jest.fn();
    poiCreateMock = jest.fn();
    poiFindManyMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReferentielService,
        {
          provide: PrismaService,
          useValue: {
            universite: {
              create: createMock,
              findMany: findManyMock,
              findUnique: findUniqueMock,
              update: updateMock,
            },
            commune: {
              create: communeCreateMock,
              findMany: communeFindManyMock,
              findUnique: communeFindUniqueMock,
            },
            quartier: {
              create: quartierCreateMock,
              findMany: quartierFindManyMock,
              findUnique: quartierFindUniqueMock,
            },
            pointInteret: {
              create: poiCreateMock,
              findMany: poiFindManyMock,
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ReferentielService);
  });

  describe('createUniversite', () => {
    it('creates a universite with the given data', async () => {
      const dto = {
        nom: 'FHB Cocody',
        commune: 'Cocody',
        latitude: 5.34,
        longitude: -3.99,
      };
      createMock.mockResolvedValueOnce({ id: 'univ-1', ...dto });

      const result = await service.createUniversite(dto);

      expect(createMock).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual({ id: 'univ-1', ...dto });
    });
  });

  describe('listUniversites', () => {
    it('lists universites ordered by name', async () => {
      findManyMock.mockResolvedValueOnce([{ id: 'univ-1' }]);

      const result = await service.listUniversites();

      expect(findManyMock).toHaveBeenCalledWith({
        orderBy: { nom: 'asc' },
      });
      expect(result).toEqual([{ id: 'univ-1' }]);
    });
  });

  describe('updateUniversite', () => {
    it('throws NotFoundException when the universite does not exist', async () => {
      findUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.updateUniversite('univ-missing', { nom: 'Nouveau nom' }),
      ).rejects.toThrow(NotFoundException);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('updates the universite when it exists', async () => {
      findUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
      updateMock.mockResolvedValueOnce({ id: 'univ-1', nom: 'Nouveau nom' });

      const result = await service.updateUniversite('univ-1', {
        nom: 'Nouveau nom',
      });

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'univ-1' },
        data: { nom: 'Nouveau nom' },
      });
      expect(result).toEqual({ id: 'univ-1', nom: 'Nouveau nom' });
    });
  });

  describe('createCommune', () => {
    it('creates a commune with the given data', async () => {
      const dto = { nom: 'Cocody', ville: 'Abidjan' };
      communeCreateMock.mockResolvedValueOnce({ id: 'commune-1', ...dto });

      const result = await service.createCommune(dto);

      expect(communeCreateMock).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual({ id: 'commune-1', ...dto });
    });
  });

  describe('listCommunes', () => {
    it('lists communes ordered by name', async () => {
      communeFindManyMock.mockResolvedValueOnce([{ id: 'commune-1' }]);

      const result = await service.listCommunes();

      expect(communeFindManyMock).toHaveBeenCalledWith({
        orderBy: { nom: 'asc' },
      });
      expect(result).toEqual([{ id: 'commune-1' }]);
    });
  });

  describe('createQuartier', () => {
    it('throws BadRequestException when the commune does not exist', async () => {
      communeFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.createQuartier({ nom: 'Angre', communeId: 'commune-missing' }),
      ).rejects.toThrow(BadRequestException);
      expect(quartierCreateMock).not.toHaveBeenCalled();
    });

    it('creates the quartier when the commune exists', async () => {
      communeFindUniqueMock.mockResolvedValueOnce({ id: 'commune-1' });
      const dto = { nom: 'Angre', communeId: 'commune-1' };
      quartierCreateMock.mockResolvedValueOnce({ id: 'quartier-1', ...dto });

      const result = await service.createQuartier(dto);

      expect(quartierCreateMock).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual({ id: 'quartier-1', ...dto });
    });
  });

  describe('listQuartiers', () => {
    it('lists all quartiers when no communeId filter is given', async () => {
      quartierFindManyMock.mockResolvedValueOnce([{ id: 'quartier-1' }]);

      const result = await service.listQuartiers();

      expect(quartierFindManyMock).toHaveBeenCalledWith({
        where: undefined,
        include: { commune: true },
        orderBy: { nom: 'asc' },
      });
      expect(result).toEqual([{ id: 'quartier-1' }]);
    });

    it('filters quartiers by communeId when given', async () => {
      quartierFindManyMock.mockResolvedValueOnce([{ id: 'quartier-1' }]);

      await service.listQuartiers('commune-1');

      expect(quartierFindManyMock).toHaveBeenCalledWith({
        where: { communeId: 'commune-1' },
        include: { commune: true },
        orderBy: { nom: 'asc' },
      });
    });
  });

  describe('createPointInteret', () => {
    it('throws BadRequestException when the quartier does not exist', async () => {
      quartierFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.createPointInteret({
          nom: 'Carrefour Angre',
          type: 'carrefour',
          quartierId: 'quartier-missing',
          latitude: 5.36,
          longitude: -3.98,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(poiCreateMock).not.toHaveBeenCalled();
    });

    it('creates the point interet when the quartier exists', async () => {
      quartierFindUniqueMock.mockResolvedValueOnce({ id: 'quartier-1' });
      const dto = {
        nom: 'Carrefour Angre',
        type: 'carrefour',
        quartierId: 'quartier-1',
        latitude: 5.36,
        longitude: -3.98,
      };
      poiCreateMock.mockResolvedValueOnce({ id: 'poi-1', ...dto });

      const result = await service.createPointInteret(dto);

      expect(poiCreateMock).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual({ id: 'poi-1', ...dto });
    });
  });

  describe('listPointsInteret', () => {
    it('lists all points interet when no quartierId filter is given', async () => {
      poiFindManyMock.mockResolvedValueOnce([{ id: 'poi-1' }]);

      const result = await service.listPointsInteret();

      expect(poiFindManyMock).toHaveBeenCalledWith({
        where: undefined,
        include: { quartier: { include: { commune: true } } },
        orderBy: { nom: 'asc' },
      });
      expect(result).toEqual([{ id: 'poi-1' }]);
    });

    it('filters points interet by quartierId when given', async () => {
      poiFindManyMock.mockResolvedValueOnce([{ id: 'poi-1' }]);

      await service.listPointsInteret('quartier-1');

      expect(poiFindManyMock).toHaveBeenCalledWith({
        where: { quartierId: 'quartier-1' },
        include: { quartier: { include: { commune: true } } },
        orderBy: { nom: 'asc' },
      });
    });
  });
});
