import prisma from '../src/db';

async function main() {
  const users = await prisma.user.findMany({ orderBy: { email: 'asc' } });
  console.table(users.map(u => ({
    name: u.name,
    email: u.email,
    address: u.address,
    maxGuests: u.maxGuests,
    diet: u.diet,
    isGuest: u.isGuest,
  })));
  await prisma.$disconnect();
}

main().catch(console.error);