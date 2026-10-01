# Inicializar y Levantar el Proyecto — FitZone Sports

Guía rápida para levantar el backend de FitZone Sports de forma correcta.

---

## Pasos para Iniciar

### 1. Entrar a la carpeta del backend
```bash
cd backend
```

### 2. Variables de Entorno (solo la primera vez)
Verifica que exista el archivo `.env`. Si no existe, créalo desde la plantilla:
```bash
cp .env.example .env
```
> Asegúrate de que `DATABASE_URL` contenga la cadena de conexión a PostgreSQL (Supabase).

### 3. Instalar Dependencias (solo la primera vez o si cambian paquetes)
```bash
npm install
```

### 4. Generar el Cliente de Prisma (solo tras instalar o cambiar esquema)
```bash
npx prisma generate
```

### 5. Levantar el Servidor en Desarrollo
```bash
npm run start:dev
```

---

## 🌐 Verificación
Una vez levantado:
- **API Base:** http://localhost:3000/api/v1
- **Swagger Docs:** http://localhost:3000/docs

---

## 📋 ¿Qué comandos son necesarios y cuáles no?

### Necesarios en el día a día
- **`npm run start:dev`**: **Obligatorio siempre** para arrancar en desarrollo con recarga automática (*watch mode*).

### Necesarios solo puntualmente
- **`npm install`**: Solo la primera vez al clonar el proyecto o si se agregan paquetes al `package.json`.
- **`npx prisma generate`**: Solo tras un `npm install` o si se modifica `prisma/schema.prisma`.
- **`npx prisma migrate deploy`**: Es el **único** comando de migración que se puede correr contra la base compartida de Supabase, y solo si hay migraciones nuevas pendientes.

  > **Nunca `npx prisma migrate dev` contra esa base.** Necesita crear una shadow database (el usuario del pooler no tiene permiso) y, si pudiera, propondría resetear la base. Peor: Prisma 6.19.3 no modela la constraint de exclusión `exq_reserva_turno` ni el índice parcial `ingreso_usuario_abierto_unq` — los dos están en la base pero no en `schema.prisma` — así que los detecta como drift y los borra. Con `deploy` no hay drift que interpretar: solo aplica lo que falta.
  >
  > Para crear una migración nueva contra un Postgres efímero de pruebas, ahí sí `migrate dev` es lo correcto.

### NO necesarios para levantar el proyecto
- **`npm run build`**: No es necesario para desarrollo; `start:dev` compila directamente en caliente. Solo se usa para compilar en producción a la carpeta `dist/`.
- **`docker compose`**: No es necesario para levantar la app. El backend se conecta directamente a Supabase mediante `DATABASE_URL`. El archivo `docker-compose.test.yml` es únicamente para levantar un Postgres efímero para tests e2e aislados.
- **`npx prisma studio`**: No es necesario; es solo una herramienta visual optativa para inspeccionar datos de la BD en el navegador.
