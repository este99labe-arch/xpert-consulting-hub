# XpertConsulting — Desarrollo local con Docker

## docker-compose.yml

Crea este archivo en la raíz de tu proyecto para desarrollo local:

```yaml
version: "3.8"

services:
  # Supabase local (usa Supabase CLI)
  # Asegúrate de tener instalado: npm install -g supabase
  # Inicializa con: supabase init && supabase start

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - VITE_SUPABASE_URL=http://localhost:54321
      - VITE_SUPABASE_PUBLISHABLE_KEY=your-local-anon-key
    depends_on:
      - supabase-db

  supabase-db:
    image: supabase/postgres:15.1.0.147
    ports:
      - "54322:5432"
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    volumes:
      - supabase-db-data:/var/lib/postgresql/data

volumes:
  supabase-db-data:
```

## Dockerfile.dev

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

## Instrucciones

### 1. Instalar Supabase CLI
```bash
npm install -g supabase
```

### 2. Inicializar Supabase local
```bash
supabase init
supabase start
```

Esto levanta todos los servicios de Supabase localmente (PostgreSQL, Auth, Storage, Edge Functions, etc.)

### 3. Obtener credenciales locales
```bash
supabase status
```

Copia `API URL` y `anon key` y úsalos en tu `.env.local`:
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<tu-anon-key-local>
```

### 4. Ejecutar migraciones
```bash
supabase db push
```

### 5. Levantar frontend
```bash
npm run dev
```

O con Docker:
```bash
docker-compose up
```

### 6. Crear usuario MASTER_ADMIN inicial

Accede a Supabase Studio local en `http://localhost:54323` y:

1. Crea un usuario en Auth → Users
2. Crea una cuenta tipo MASTER en la tabla `accounts`
3. Vincula el usuario con rol MASTER_ADMIN en `user_accounts`

### 7. Desplegar Edge Functions localmente
```bash
supabase functions serve create_client_account --no-verify-jwt
```
