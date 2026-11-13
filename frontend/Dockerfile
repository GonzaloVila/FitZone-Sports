# Imagen del frontend: Vite compila la app y nginx sirve los archivos estáticos.
#
# La URL de la API queda fija en el build (Vite reemplaza import.meta.env.VITE_API_URL al compilar): se pasa como
# argumento de build desde docker-compose.yml.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:3000/api/v1
ENV VITE_API_URL=$VITE_API_URL
# Solo el build: el type-check y los tests corren en el pipeline de CI, no en la imagen.
RUN npm run build-only


FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
