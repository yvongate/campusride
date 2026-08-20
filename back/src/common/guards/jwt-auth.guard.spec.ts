import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

// super.canActivate() (passport) est hors sujet ici : on le neutralise pour
// tester uniquement la regle metier "que laisse-t-on passer quand le compte
// est suspendu ?".
function creerGuard(reflectorValue: boolean | undefined, authentifie = true) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(reflectorValue),
  } as unknown as Reflector;
  const guard = new JwtAuthGuard(reflector);
  jest
    .spyOn(
      Object.getPrototypeOf(Object.getPrototypeOf(guard)) as JwtAuthGuard,
      'canActivate',
    )
    .mockResolvedValue(authentifie);
  return guard;
}

function contexte(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('laisse passer un compte non suspendu', async () => {
    const guard = creerGuard(undefined);

    await expect(
      guard.canActivate(contexte({ userId: 'u1', role: 'etudiant', suspenduJusqua: null })),
    ).resolves.toBe(true);
  });

  it('laisse passer quand la suspension est terminee', async () => {
    const guard = creerGuard(undefined);

    await expect(
      guard.canActivate(
        contexte({
          userId: 'u1',
          role: 'etudiant',
          suspenduJusqua: new Date(Date.now() - 1000),
        }),
      ),
    ).resolves.toBe(true);
  });

  it('refuse un compte suspendu sur une route ordinaire', async () => {
    const guard = creerGuard(undefined);

    await expect(
      guard.canActivate(
        contexte({
          userId: 'u1',
          role: 'etudiant',
          suspenduJusqua: new Date(Date.now() + 1000),
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // Le coeur du recours : sans cette exemption, la sanction automatique
  // serait sans appel pour la personne qu'elle frappe.
  it('laisse passer un compte suspendu sur une route @AutoriseSiSuspendu', async () => {
    const guard = creerGuard(true);

    await expect(
      guard.canActivate(
        contexte({
          userId: 'u1',
          role: 'etudiant',
          suspenduJusqua: new Date(Date.now() + 1000),
        }),
      ),
    ).resolves.toBe(true);
  });

  it('expose la date de fin dans la reponse, pour que le mobile puisse l affiche', async () => {
    const guard = creerGuard(undefined);
    const suspenduJusqua = new Date(Date.now() + 1000);

    await expect(
      guard.canActivate(contexte({ userId: 'u1', role: 'etudiant', suspenduJusqua })),
    ).rejects.toMatchObject({
      response: {
        code: 'COMPTE_SUSPENDU',
        suspenduJusqua: suspenduJusqua.toISOString(),
      },
    });
  });

  it("n'evalue pas la suspension si l'authentification a echoue", async () => {
    const guard = creerGuard(undefined, false);

    await expect(guard.canActivate(contexte(undefined))).resolves.toBe(false);
  });
});
