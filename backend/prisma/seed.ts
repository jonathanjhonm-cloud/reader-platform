import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const developmentUser = {
  email: 'leitor@lumen.dev',
  name: 'Leitor de teste',
  password: 'Lumen@123456',
};

async function main() {
  const passwordHash = await argon2.hash(developmentUser.password);

  const user = await prisma.user.upsert({
    where: { email: developmentUser.email },
    update: {
      name: developmentUser.name,
      passwordHash,
    },
    create: {
      email: developmentUser.email,
      name: developmentUser.name,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  console.log('Usuário de desenvolvimento criado ou atualizado:', user);
}

main()
  .catch((error: unknown) => {
    console.error('Não foi possível executar a seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
