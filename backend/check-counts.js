const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.utilisateur.count({ where: { role: 'PRESTATAIRE' } });
  console.log('Professionals count:', users);
  
  const services = await prisma.service.count();
  console.log('Services count:', services);
}

main().catch(console.error).finally(() => prisma.$disconnect());
