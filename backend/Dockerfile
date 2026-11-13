# Imagen del backend (NestJS + Prisma), en dos etapas.
#
# - `build`: instala todas las dependencias, genera el cliente de Prisma y compila. docker-compose.yml también usa esta
#   etapa para el servicio `migraciones`, porque tiene el CLI de Prisma (dependencia de desarrollo).
# - `runtime`: solo lo necesario para correr: dist/, dependencias de producción y el cliente de Prisma ya generado.
#
# Prisma necesita OpenSSL en Alpine para elegir y ejecutar su motor de consultas.

FROM node:24-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build


FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# `--ignore-scripts`: el cliente de Prisma no se regenera acá, se copia el que generó la etapa de build.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
