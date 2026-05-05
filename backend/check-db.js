const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categoriesCount = await prisma.category.count();
  const categories = await prisma.category.findMany({ where: { isActive: true } });
  console.log('Categories Count:', categoriesCount);
  console.log('Active Categories:', JSON.stringify(categories, null, 2));
  
  const professionalsCount = await prisma.professionalProfile.count();
  console.log('Professionals Count:', professionalsCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
