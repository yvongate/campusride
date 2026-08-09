import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // DIRECT_DATABASE_URL (local dev via `prisma dev`) prend le pas sur DATABASE_URL :
    // le driver adapter parle le protocole Postgres brut, pas le proxy "prisma+postgres"
    // qu'utilise le CLI. En production (Railway), DATABASE_URL est deja une URL postgresql://
    // standard et DIRECT_DATABASE_URL est absente -- ce fallback couvre les deux cas.
    const connectionString =
      process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
