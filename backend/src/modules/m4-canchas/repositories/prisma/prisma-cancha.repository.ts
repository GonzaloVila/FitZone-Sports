// ADAPTADOR Prisma - M4 Canchas
// Implementa CanchaRepository usando PrismaService (Data Mapper).
// create() corre en transaccion: si hay violacion de unique index (RN-02), solo un INSERT gana.