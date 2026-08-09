import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps a decoded payload to { userId, role }', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(config);

    const result = strategy.validate({ sub: 'user-1', role: 'etudiant' });

    expect(result).toEqual({ userId: 'user-1', role: 'etudiant' });
  });
});
