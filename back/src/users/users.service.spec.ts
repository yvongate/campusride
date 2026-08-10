import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let findUniqueOrThrowMock: jest.Mock;
  let updateUtilisateurMock: jest.Mock;
  let findManyUtilisateurMock: jest.Mock;
  let findUniqueUtilisateurMock: jest.Mock;
  let findFirstConducteurMock: jest.Mock;
  let findManyConducteurMock: jest.Mock;
  let findUniqueConducteurMock: jest.Mock;
  let createConducteurMock: jest.Mock;
  let updateConducteurMock: jest.Mock;
  let findFirstVerificationMock: jest.Mock;
  let findManyVerificationMock: jest.Mock;
  let findUniqueVerificationMock: jest.Mock;
  let createVerificationMock: jest.Mock;
  let updateVerificationMock: jest.Mock;
  let transactionMock: jest.Mock;

  beforeEach(async () => {
    findUniqueOrThrowMock = jest.fn();
    updateUtilisateurMock = jest.fn();
    findManyUtilisateurMock = jest.fn();
    findUniqueUtilisateurMock = jest.fn();
    findFirstConducteurMock = jest.fn();
    findManyConducteurMock = jest.fn();
    findUniqueConducteurMock = jest.fn();
    createConducteurMock = jest.fn();
    updateConducteurMock = jest.fn();
    findFirstVerificationMock = jest.fn().mockResolvedValue({
      id: 'verif-1',
      userId: 'user-1',
      statut: 'valide',
      selfie: 'user-1-selfie-existing.jpg',
    });
    findManyVerificationMock = jest.fn();
    findUniqueVerificationMock = jest.fn();
    createVerificationMock = jest.fn();
    updateVerificationMock = jest.fn();
    transactionMock = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            utilisateur: {
              findUniqueOrThrow: findUniqueOrThrowMock,
              update: updateUtilisateurMock,
              findMany: findManyUtilisateurMock,
              findUnique: findUniqueUtilisateurMock,
            },
            documentsConducteur: {
              findFirst: findFirstConducteurMock,
              findMany: findManyConducteurMock,
              findUnique: findUniqueConducteurMock,
              create: createConducteurMock,
              update: updateConducteurMock,
            },
            verificationIdentite: {
              findFirst: findFirstVerificationMock,
              findMany: findManyVerificationMock,
              findUnique: findUniqueVerificationMock,
              create: createVerificationMock,
              update: updateVerificationMock,
            },
            $transaction: transactionMock,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('finds a user by id', async () => {
    findUniqueOrThrowMock.mockResolvedValueOnce({
      id: 'user-1',
      telephone: '+2250700000000',
    });

    const result = await service.findById('user-1');

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(result).toEqual({ id: 'user-1', telephone: '+2250700000000' });
  });

  describe('getConducteurStatus', () => {
    it('returns null when the user has no request', async () => {
      findFirstConducteurMock.mockResolvedValueOnce(null);

      const result = await service.getConducteurStatus('user-1');

      expect(result).toBeNull();
    });

    it('returns the status of the most recent request', async () => {
      findFirstConducteurMock.mockResolvedValueOnce({ statut: 'refuse' });

      const result = await service.getConducteurStatus('user-1');

      expect(findFirstConducteurMock).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe('refuse');
    });
  });

  describe('createDemandeConducteur', () => {
    it('creates the request when none is pending, reusing the validated verification selfie', async () => {
      findFirstConducteurMock.mockResolvedValueOnce(null);
      createConducteurMock.mockResolvedValueOnce({ id: 'doc-1' });

      await service.createDemandeConducteur(
        'user-1',
        { photoPermis: 'permis.jpg' },
        'CI-2847-AB',
      );

      expect(findFirstConducteurMock).toHaveBeenCalledWith({
        where: { userId: 'user-1', statut: 'en attente' },
      });
      expect(findFirstVerificationMock).toHaveBeenCalledWith({
        where: { userId: 'user-1', statut: 'valide' },
        orderBy: { createdAt: 'desc' },
      });
      expect(createConducteurMock).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          selfie: 'user-1-selfie-existing.jpg',
          photoPermis: 'permis.jpg',
          matriculeVehicule: 'CI-2847-AB',
        },
      });
    });

    it('persists photoVehicule and motBienvenue when provided', async () => {
      findFirstConducteurMock.mockResolvedValueOnce(null);
      createConducteurMock.mockResolvedValueOnce({ id: 'doc-2' });

      await service.createDemandeConducteur(
        'user-1',
        {
          photoPermis: 'permis.jpg',
          photoVehicule: 'vehicule.jpg',
        },
        'CI-2847-AB',
        'A bientot sur la route !',
      );

      expect(createConducteurMock).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          selfie: 'user-1-selfie-existing.jpg',
          photoPermis: 'permis.jpg',
          matriculeVehicule: 'CI-2847-AB',
          photoVehicule: 'vehicule.jpg',
          motBienvenue: 'A bientot sur la route !',
        },
      });
    });

    it('throws ConflictException when a request is already pending', async () => {
      findFirstConducteurMock.mockResolvedValueOnce({ id: 'doc-existing' });

      await expect(
        service.createDemandeConducteur(
          'user-1',
          { photoPermis: 'permis.jpg' },
          'CI-2847-AB',
        ),
      ).rejects.toThrow(ConflictException);
      expect(createConducteurMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when no validated identity verification exists', async () => {
      findFirstConducteurMock.mockResolvedValueOnce(null);
      findFirstVerificationMock.mockResolvedValueOnce(null);

      await expect(
        service.createDemandeConducteur(
          'user-1',
          { photoPermis: 'permis.jpg' },
          'CI-2847-AB',
        ),
      ).rejects.toThrow(ConflictException);
      expect(createConducteurMock).not.toHaveBeenCalled();
    });
  });

  describe('getVerificationStatus', () => {
    it('returns null when the user has no verification', async () => {
      findFirstVerificationMock.mockResolvedValueOnce(null);

      const result = await service.getVerificationStatus('user-1');

      expect(result).toBeNull();
    });

    it('returns the status of the most recent verification', async () => {
      findFirstVerificationMock.mockResolvedValueOnce({ statut: 'refuse' });

      const result = await service.getVerificationStatus('user-1');

      expect(findFirstVerificationMock).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe('refuse');
    });
  });

  describe('createVerificationIdentite', () => {
    it('creates the verification when none is pending', async () => {
      findFirstVerificationMock.mockResolvedValueOnce(null);
      createVerificationMock.mockResolvedValueOnce({ id: 'verif-1' });

      await service.createVerificationIdentite('user-1', {
        cni: 'cni.jpg',
        selfie: 'selfie.jpg',
      });

      expect(findFirstVerificationMock).toHaveBeenCalledWith({
        where: { userId: 'user-1', statut: 'en attente' },
      });
      expect(createVerificationMock).toHaveBeenCalledWith({
        data: { userId: 'user-1', cni: 'cni.jpg', selfie: 'selfie.jpg' },
      });
    });

    it('throws ConflictException when a verification is already pending', async () => {
      findFirstVerificationMock.mockResolvedValueOnce({ id: 'verif-existing' });

      await expect(
        service.createVerificationIdentite('user-1', {
          cni: 'cni.jpg',
          selfie: 'selfie.jpg',
        }),
      ).rejects.toThrow(ConflictException);
      expect(createVerificationMock).not.toHaveBeenCalled();
    });
  });

  describe('listVerificationsEnAttente', () => {
    it('lists pending verifications ordered by creation date, with the applicant included', async () => {
      findManyVerificationMock.mockResolvedValueOnce([{ id: 'verif-1' }]);

      const result = await service.listVerificationsEnAttente();

      expect(findManyVerificationMock).toHaveBeenCalledWith({
        where: { statut: 'en attente' },
        include: { utilisateur: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([{ id: 'verif-1' }]);
    });
  });

  describe('getVerificationDocumentAbsolutePath', () => {
    it('throws BadRequestException for an invalid document type', async () => {
      await expect(
        service.getVerificationDocumentAbsolutePath('verif-1', 'permis'),
      ).rejects.toThrow(BadRequestException);
      expect(findUniqueVerificationMock).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the verification does not exist', async () => {
      findUniqueVerificationMock.mockResolvedValueOnce(null);

      await expect(
        service.getVerificationDocumentAbsolutePath('verif-missing', 'cni'),
      ).rejects.toThrow(NotFoundException);
    });

    it('resolves the absolute path for the requested document type', async () => {
      findUniqueVerificationMock.mockResolvedValueOnce({
        cni: 'user-1-cni-123.jpg',
        selfie: 'user-1-selfie-123.jpg',
      });

      const path = await service.getVerificationDocumentAbsolutePath(
        'verif-1',
        'selfie',
      );

      expect(path.endsWith('user-1-selfie-123.jpg')).toBe(true);
    });
  });

  describe('validerVerificationIdentite', () => {
    it('throws NotFoundException when the verification does not exist', async () => {
      findUniqueVerificationMock.mockResolvedValueOnce(null);

      await expect(
        service.validerVerificationIdentite('verif-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(updateVerificationMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when already decided', async () => {
      findUniqueVerificationMock.mockResolvedValueOnce({
        id: 'verif-1',
        statut: 'valide',
      });

      await expect(
        service.validerVerificationIdentite('verif-1'),
      ).rejects.toThrow(ConflictException);
      expect(updateVerificationMock).not.toHaveBeenCalled();
    });

    it('sets the verification to valide', async () => {
      findUniqueVerificationMock.mockResolvedValueOnce({
        id: 'verif-1',
        statut: 'en attente',
      });
      updateVerificationMock.mockResolvedValueOnce({
        id: 'verif-1',
        statut: 'valide',
      });

      const result = await service.validerVerificationIdentite('verif-1');

      expect(updateVerificationMock).toHaveBeenCalledWith({
        where: { id: 'verif-1' },
        data: { statut: 'valide' },
      });
      expect(result).toEqual({ id: 'verif-1', statut: 'valide' });
    });
  });

  describe('refuserVerificationIdentite', () => {
    it('throws NotFoundException when the verification does not exist', async () => {
      findUniqueVerificationMock.mockResolvedValueOnce(null);

      await expect(
        service.refuserVerificationIdentite('verif-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(updateVerificationMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when already decided', async () => {
      findUniqueVerificationMock.mockResolvedValueOnce({
        id: 'verif-1',
        statut: 'refuse',
      });

      await expect(
        service.refuserVerificationIdentite('verif-1'),
      ).rejects.toThrow(ConflictException);
      expect(updateVerificationMock).not.toHaveBeenCalled();
    });

    it('sets the verification to refuse', async () => {
      findUniqueVerificationMock.mockResolvedValueOnce({
        id: 'verif-1',
        statut: 'en attente',
      });
      updateVerificationMock.mockResolvedValueOnce({
        id: 'verif-1',
        statut: 'refuse',
      });

      await service.refuserVerificationIdentite('verif-1');

      expect(updateVerificationMock).toHaveBeenCalledWith({
        where: { id: 'verif-1' },
        data: { statut: 'refuse' },
      });
    });
  });

  describe('listDemandesConducteurEnAttente', () => {
    it('lists pending requests ordered by creation date, with the applicant included', async () => {
      findManyConducteurMock.mockResolvedValueOnce([{ id: 'doc-1' }]);

      const result = await service.listDemandesConducteurEnAttente();

      expect(findManyConducteurMock).toHaveBeenCalledWith({
        where: { statut: 'en attente' },
        include: { utilisateur: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([{ id: 'doc-1' }]);
    });
  });

  describe('getDocumentAbsolutePath', () => {
    it('throws BadRequestException for an invalid document type', async () => {
      await expect(
        service.getDocumentAbsolutePath('doc-1', 'passeport'),
      ).rejects.toThrow(BadRequestException);
      expect(findUniqueConducteurMock).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the request does not exist', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce(null);

      await expect(
        service.getDocumentAbsolutePath('doc-missing', 'selfie'),
      ).rejects.toThrow(NotFoundException);
    });

    it('resolves the absolute path for the requested document type', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce({
        selfie: 'user-1-selfie-123.jpg',
        photoPermis: 'user-1-permis-123.jpg',
      });

      const path = await service.getDocumentAbsolutePath('doc-1', 'permis');

      expect(path.endsWith('user-1-permis-123.jpg')).toBe(true);
    });
  });

  describe('validerDemandeConducteur', () => {
    it('throws NotFoundException when the request does not exist', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce(null);

      await expect(
        service.validerDemandeConducteur('doc-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the request was already decided', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'user-1',
        statut: 'valide',
      });

      await expect(service.validerDemandeConducteur('doc-1')).rejects.toThrow(
        ConflictException,
      );
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('sets the request to valide and promotes the user role to "les deux"', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'user-1',
        statut: 'en attente',
      });
      updateConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        statut: 'valide',
      });
      updateUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        role: 'les deux',
      });

      const result = await service.validerDemandeConducteur('doc-1');

      expect(updateConducteurMock).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { statut: 'valide' },
      });
      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'les deux' },
      });
      expect(result).toEqual({ id: 'doc-1', statut: 'valide' });
    });
  });

  describe('refuserDemandeConducteur', () => {
    it('throws NotFoundException when the request does not exist', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce(null);

      await expect(
        service.refuserDemandeConducteur('doc-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(updateConducteurMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the request was already decided', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'user-1',
        statut: 'refuse',
      });

      await expect(service.refuserDemandeConducteur('doc-1')).rejects.toThrow(
        ConflictException,
      );
      expect(updateConducteurMock).not.toHaveBeenCalled();
    });

    it('sets the request to refuse without touching the user role', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'user-1',
        statut: 'en attente',
      });
      updateConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        statut: 'refuse',
      });

      await service.refuserDemandeConducteur('doc-1');

      expect(updateConducteurMock).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { statut: 'refuse' },
      });
      expect(updateUtilisateurMock).not.toHaveBeenCalled();
    });
  });

  describe('listerComptes', () => {
    it('excludes admin accounts', async () => {
      findManyUtilisateurMock.mockResolvedValueOnce([]);

      await service.listerComptes();

      expect(findManyUtilisateurMock).toHaveBeenCalledWith({
        where: { role: { not: 'admin' } },
        select: {
          id: true,
          nom: true,
          prenom: true,
          telephone: true,
          role: true,
          note: true,
          actif: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('desactiverCompte / reactiverCompte', () => {
    it('throws NotFoundException when the compte does not exist', async () => {
      findUniqueUtilisateurMock.mockResolvedValueOnce(null);

      await expect(service.desactiverCompte('user-missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(updateUtilisateurMock).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when targeting an admin account', async () => {
      findUniqueUtilisateurMock.mockResolvedValueOnce({
        id: 'admin-1',
        role: 'admin',
      });

      await expect(service.desactiverCompte('admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(updateUtilisateurMock).not.toHaveBeenCalled();
    });

    it('deactivates an etudiant/conducteur account', async () => {
      findUniqueUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        role: 'etudiant',
      });
      updateUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        actif: false,
      });

      const result = await service.desactiverCompte('user-1');

      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { actif: false },
      });
      expect(result).toEqual({ id: 'user-1', actif: false });
    });

    it('reactivates an etudiant/conducteur account', async () => {
      findUniqueUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        role: 'les deux',
      });
      updateUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        actif: true,
      });

      const result = await service.reactiverCompte('user-1');

      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { actif: true },
      });
      expect(result).toEqual({ id: 'user-1', actif: true });
    });
  });
});
