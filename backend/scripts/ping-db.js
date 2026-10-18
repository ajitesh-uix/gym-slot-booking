require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.$queryRaw`SELECT 1 AS ok`
  .then(() => {
    console.log('DB_OK');
    return p.$disconnect();
  })
  .catch((e) => {
    console.log('DB_FAIL:', e.message);
    return p.$disconnect().finally(() => process.exit(1));
  });
