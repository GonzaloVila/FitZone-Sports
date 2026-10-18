-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "familia" UUID NOT NULL,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "usado_en" TIMESTAMPTZ(3),
    "revocado_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_hash_key" ON "RefreshToken"("token_hash");

-- CreateIndex
CREATE INDEX "RefreshToken_usuario_id_idx" ON "RefreshToken"("usuario_id");

-- CreateIndex
CREATE INDEX "RefreshToken_familia_idx" ON "RefreshToken"("familia");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

