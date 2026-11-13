// Termina con código 0 si la base no tiene ninguna sede (recién creada) y con 1 si ya tiene datos. El servicio
// `migraciones` de docker-compose.yml lo usa para cargar el seed solo la primera vez: el seed vacía las tablas antes de
// insertar, así que correrlo sobre una base en uso borraría sus datos.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
try {
  const sedes = await prisma.sede.count()
  process.exit(sedes === 0 ? 0 : 1)
} finally {
  await prisma.$disconnect()
}
