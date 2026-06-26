import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@ultron.ai';
  const password = 'admin123';

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingUser) {
    const hashedPassword = await hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Admin',
        password: hashedPassword,
      },
    });
    console.log('Created admin user:', user.email);
  } else {
    console.log('Admin user already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
