import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL이 필요합니다.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main(): Promise<void> {
  const worldCup = await prisma.worldCup.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      title: '첫 번째 월드컵',
      description: '새 데이터베이스의 개발용 예시 데이터입니다.',
      visibleType: 'PUBLIC',
    },
  });

  await prisma.candidate.createMany({
    data: [
      {
        worldCupId: worldCup.id,
        name: '후보 A',
        sortOrder: 1,
        visibleType: 'PUBLIC',
      },
      {
        worldCupId: worldCup.id,
        name: '후보 B',
        sortOrder: 2,
        visibleType: 'PUBLIC',
      },
      {
        worldCupId: worldCup.id,
        name: '후보 C',
        sortOrder: 3,
        visibleType: 'PUBLIC',
      },
      {
        worldCupId: worldCup.id,
        name: '후보 D',
        sortOrder: 4,
        visibleType: 'PUBLIC',
      },
    ],
    skipDuplicates: true,
  });
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
