const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // 1. Seed admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fitbook.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@fitbook.com',
      password: adminHash,
      role: 'ADMIN',
    },
  });
  console.log('Admin seeded:', admin.email);

  // 2. Seed test member
  const memberHash = await bcrypt.hash('member123', 10);
  const member = await prisma.user.upsert({
    where: { email: 'member@fitbook.com' },
    update: {},
    create: {
      name: 'Test Member',
      email: 'member@fitbook.com',
      password: memberHash,
      role: 'MEMBER',
    },
  });
  console.log('Member seeded:', member.email);

  // 3. Seed 15 gym sessions over the next 3 days
  const titles = ['Morning Yoga', 'HIIT Blast', 'Weight Training', 'Cardio Mix', 'CrossFit'];
  const hours = [7, 9, 11, 15, 18];

  for (let day = 1; day <= 3; day++) {
    for (let i = 0; i < titles.length; i++) {
      const start = new Date();
      start.setDate(start.getDate() + day);
      start.setHours(hours[i], 0, 0, 0);

      await prisma.session.upsert({
        where: { startTime: start },
        update: {},
        create: {
          title: titles[i],
          startTime: start,
          maxCapacity: 20,
          adminId: admin.id,
        },
      });
    }
  }
  console.log('Seeded 15 sessions across 3 days');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
