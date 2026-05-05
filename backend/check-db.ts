import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Check ---');
  
  const categoriesCount = await prisma.categorie.count();
  console.log(`Total categories: ${categoriesCount}`);
  
  const activeCategoriesCount = await prisma.categorie.count({
    where: { estActive: true }
  });
  console.log(`Active categories: ${activeCategoriesCount}`);
  
  if (activeCategoriesCount === 0 && categoriesCount > 0) {
    console.log('Activating all categories...');
    await prisma.categorie.updateMany({
      data: { estActive: true }
    });
    console.log('All categories activated.');
  } else if (categoriesCount === 0) {
    console.log('No categories found. Creating default categories...');
    await prisma.categorie.createMany({
      data: [
        { nom: 'Bricolage', urlIcone: 'hammer', ordreTri: 1, estActive: true },
        { nom: 'Ménage', urlIcone: 'brush', ordreTri: 2, estActive: true },
        { nom: 'Jardinage', urlIcone: 'leaf', ordreTri: 3, estActive: true },
        { nom: 'Mécanique', urlIcone: 'tool', ordreTri: 4, estActive: true },
        { nom: 'Plomberie', urlIcone: 'droplet', ordreTri: 5, estActive: true }
      ]
    });
    console.log('Default categories created.');
  }

  // Also check professionals
  const professionalsCount = await prisma.profilProfessionnel.count();
  console.log(`Total professionals: ${professionalsCount}`);
  
  if (professionalsCount === 0) {
     console.log('No professionals found. Please register some users as PRESTATAIRE.');
  }

  console.log('--- Check Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
