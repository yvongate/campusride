import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('UsersService', () => {
  let service: UsersService;
  let findUniqueOrThrowMock: jest.Mock;
  let updateUtilisateurMock: jest.Mock;
  let findManyUtilisateurMock: jest.Mock;
  let findUniqueUtilisateurMock: jest.Mock;
  let countUtilisateurMock: jest.Mock;
  let findUniqueUniversiteMock: jest.Mock;
  let findFirstConducteurMock: jest.Mock;
  let findManyConducteurMock: jest.Mock;
  let findUniqueConducteurMock: jest.Mock;
  let createConducteurMock: jest.Mock;
  let updateConducteurMock: jest.Mock;
  let transactionMock: jest.Mock;

  // Effet de bord : les tests verifient le comportement metier, pas l'envoi.
  const notificationsMock = { envoyer: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    notificationsMock.envoyer.mockClear();
    findUniqueOrThrowMock = jest.fn().mockResolvedValue({ role: 'etudiant' });
    updateUtilisateurMock = jest.fn();
    findManyUtilisateurMock = jest.fn();
    findUniqueUtilisateurMock = jest.fn();
    countUtilisateurMock = jest.fn().mockResolvedValue(0);
    findUniqueUniversiteMock = jest.fn();
    findFirstConducteurMock = jest.fn();
    findManyConducteurMock = jest.fn();
    findUniqueConducteurMock = jest.fn();
    createConducteurMock = jest.fn();
    updateConducteurMock = jest.fn();
    transactionMock = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: NotificationsService, useValue: notificationsMock },
        {
          provide: PrismaService,
          useValue: {
            utilisateur: {
              findUniqueOrThrow: findUniqueOrThrowMock,
              update: updateUtilisateurMock,
              findMany: findManyUtilisateurMock,
              findUnique: findUniqueUtilisateurMock,
              count: countUtilisateurMock,
            },
            universite: {
              findUnique: findUniqueUniversiteMock,
            },
            documentsConducteur: {
              findFirst: findFirstConducteurMock,
              findMany: findManyConducteurMock,
              findUnique: findUniqueConducteurMock,
              create: createConducteurMock,
              update: updateConducteurMock,
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

  describe('updateProfil', () => {
    it('updates the nom of the given user', async () => {
      updateUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        nom: 'Kouassi',
      });

      const result = await service.updateProfil('user-1', { nom: 'Kouassi' });

      expect(findUniqueUniversiteMock).not.toHaveBeenCalled();
      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { nom: 'Kouassi' },
      });
      expect(result).toEqual({ id: 'user-1', nom: 'Kouassi' });
    });

    it('updates the universiteId when the universite exists', async () => {
      findUniqueUniversiteMock.mockResolvedValueOnce({ id: 'univ-1' });
      updateUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        universiteId: 'univ-1',
      });

      const result = await service.updateProfil('user-1', {
        universiteId: 'univ-1',
      });

      expect(findUniqueUniversiteMock).toHaveBeenCalledWith({
        where: { id: 'univ-1' },
      });
      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { universiteId: 'univ-1' },
      });
      expect(result).toEqual({ id: 'user-1', universiteId: 'univ-1' });
    });

    it('throws BadRequestException when the universiteId does not exist', async () => {
      findUniqueUniversiteMock.mockResolvedValueOnce(null);

      await expect(
        service.updateProfil('user-1', { universiteId: 'univ-missing' }),
      ).rejects.toThrow(BadRequestException);
      expect(updateUtilisateurMock).not.toHaveBeenCalled();
    });

    it('updates both nom and universiteId together', async () => {
      findUniqueUniversiteMock.mockResolvedValueOnce({ id: 'univ-1' });
      updateUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        nom: 'Kouassi',
        universiteId: 'univ-1',
      });

      await service.updateProfil('user-1', {
        nom: 'Kouassi',
        universiteId: 'univ-1',
      });

      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { nom: 'Kouassi', universiteId: 'univ-1' },
      });
    });

    it('sets role to "chauffeur" when estChauffeur is true and the account is still "etudiant"', async () => {
      findUniqueOrThrowMock.mockResolvedValueOnce({ role: 'etudiant' });
      updateUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        role: 'chauffeur',
      });

      await service.updateProfil('user-1', { estChauffeur: true });

      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'chauffeur' },
      });
    });

    it('does not downgrade an already-"les deux" account when estChauffeur is true', async () => {
      findUniqueOrThrowMock.mockResolvedValueOnce({ role: 'les deux' });
      updateUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        role: 'les deux',
      });

      await service.updateProfil('user-1', { estChauffeur: true });

      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {},
      });
    });

    // Retour arriere. Sans lui, "je ne suis pas etudiant" etait definitif :
    // un seul appui de trop et le compte n'avait plus jamais de feed.
    it("repasse un chauffeur non valide en etudiant s'il declare une universite", async () => {
      findUniqueUniversiteMock.mockResolvedValueOnce({ id: 'univ-1' });
      findUniqueOrThrowMock.mockResolvedValueOnce({ role: 'chauffeur' });
      findFirstConducteurMock.mockResolvedValueOnce(null);
      updateUtilisateurMock.mockResolvedValueOnce({ id: 'user-1' });

      await service.updateProfil('user-1', { universiteId: 'univ-1' });

      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { universiteId: 'univ-1', role: 'etudiant' },
      });
    });

    // Un chauffeur deja valide ne doit pas perdre son droit de publier en
    // declarant qu'il est aussi etudiant : il devient "les deux".
    it("fait passer un chauffeur deja valide a les deux, sans lui retirer le droit de publier", async () => {
      findUniqueUniversiteMock.mockResolvedValueOnce({ id: 'univ-1' });
      findUniqueOrThrowMock.mockResolvedValueOnce({ role: 'chauffeur' });
      findFirstConducteurMock.mockResolvedValueOnce({ id: 'doc-1' });
      updateUtilisateurMock.mockResolvedValueOnce({ id: 'user-1' });

      await service.updateProfil('user-1', { universiteId: 'univ-1' });

      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { universiteId: 'univ-1', role: 'les deux' },
      });
    });

    it("ne touche pas au role d'un etudiant qui change d'universite", async () => {
      findUniqueUniversiteMock.mockResolvedValueOnce({ id: 'univ-1' });
      findUniqueOrThrowMock.mockResolvedValueOnce({ role: 'etudiant' });
      updateUtilisateurMock.mockResolvedValueOnce({ id: 'user-1' });

      await service.updateProfil('user-1', { universiteId: 'univ-1' });

      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { universiteId: 'univ-1' },
      });
    });
  });

  describe('findByIdAvecUniversite', () => {
    it('includes the universite relation', async () => {
      findUniqueOrThrowMock.mockResolvedValueOnce({
        id: 'user-1',
        universite: { id: 'univ-1', nom: 'FHB Cocody' },
      });

      const result = await service.findByIdAvecUniversite('user-1');

      expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { universite: true },
      });
      expect(result.universite).toEqual({ id: 'univ-1', nom: 'FHB Cocody' });
    });
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
    it('creates the request when none is pending', async () => {
      findFirstConducteurMock.mockResolvedValueOnce(null);
      createConducteurMock.mockResolvedValueOnce({ id: 'doc-1' });

      await service.createDemandeConducteur(
        'user-1',
        { selfie: 'selfie.jpg', photoPermis: 'permis.jpg' },
        'CI-2847-AB',
      );

      expect(findFirstConducteurMock).toHaveBeenCalledWith({
        where: { userId: 'user-1', statut: 'en attente' },
      });
      expect(createConducteurMock).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          selfie: 'selfie.jpg',
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
          selfie: 'selfie.jpg',
          photoPermis: 'permis.jpg',
          photoVehicule: 'vehicule.jpg',
        },
        'CI-2847-AB',
        'A bientot sur la route !',
      );

      expect(createConducteurMock).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          selfie: 'selfie.jpg',
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
          { selfie: 'selfie.jpg', photoPermis: 'permis.jpg' },
          'CI-2847-AB',
        ),
      ).rejects.toThrow(ConflictException);
      expect(createConducteurMock).not.toHaveBeenCalled();
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

    it('sets the request to valide and promotes an "etudiant" user role to "les deux"', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'user-1',
        statut: 'en attente',
      });
      findUniqueOrThrowMock.mockResolvedValueOnce({ role: 'etudiant' });
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

    it('previent le conducteur que son compte est valide', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'user-1',
        statut: 'en attente',
      });
      findUniqueOrThrowMock.mockResolvedValueOnce({ role: 'etudiant' });
      updateConducteurMock.mockResolvedValueOnce({ id: 'doc-1' });
      updateUtilisateurMock.mockResolvedValueOnce({ id: 'user-1' });

      await service.validerDemandeConducteur('doc-1');

      expect(notificationsMock.envoyer).toHaveBeenCalledWith(
        ['user-1'],
        'Compte conducteur validé',
        expect.any(String) as unknown as string,
        { type: 'compte' },
      );
    });

    it('keeps the role "chauffeur" as-is for a non-etudiant conducteur account', async () => {
      findUniqueConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        userId: 'user-1',
        statut: 'en attente',
      });
      findUniqueOrThrowMock.mockResolvedValueOnce({ role: 'chauffeur' });
      updateConducteurMock.mockResolvedValueOnce({
        id: 'doc-1',
        statut: 'valide',
      });
      updateUtilisateurMock.mockResolvedValueOnce({
        id: 'user-1',
        role: 'chauffeur',
      });

      await service.validerDemandeConducteur('doc-1');

      expect(updateUtilisateurMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'chauffeur' },
      });
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
    beforeEach(() => {
      countUtilisateurMock.mockResolvedValue(0);
      findManyUtilisateurMock.mockResolvedValue([]);
    });

    it('excludes admin accounts and paginates', async () => {
      await service.listerComptes({});

      expect(findManyUtilisateurMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: { not: 'admin' } },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('calcule le decalage a partir de la page demandee', async () => {
      await service.listerComptes({ page: 3, limit: 10 });

      expect(findManyUtilisateurMock).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('cherche sur le nom, le prenom et le telephone', async () => {
      await service.listerComptes({ recherche: '  Kouassi ' });

      expect(findManyUtilisateurMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { nom: { contains: 'Kouassi', mode: 'insensitive' } },
              { prenom: { contains: 'Kouassi', mode: 'insensitive' } },
              { telephone: { contains: 'Kouassi' } },
            ],
          }),
        }),
      );
    });

    // Le total doit porter sur le MEME filtre que la page, sinon la
    // pagination annonce un nombre de pages sans rapport avec la recherche.
    it('compte avec le meme filtre que la page', async () => {
      countUtilisateurMock.mockResolvedValueOnce(7);

      const resultat = await service.listerComptes({ recherche: 'Yao' });

      const filtreListe = findManyUtilisateurMock.mock.calls[0][0].where;
      expect(countUtilisateurMock).toHaveBeenCalledWith({ where: filtreListe });
      expect(resultat.total).toBe(7);
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
        data: { actif: true, suspenduJusqua: null },
      });
      expect(result).toEqual({ id: 'user-1', actif: true });
    });
  });
});
