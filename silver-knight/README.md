# Silver Knight

Sistema POS y facturacion fiscal para Venezuela. Dual currency (USD/VES), cumplimiento SENIAT, offline-first.

## Arquitectura

```
┌─────────────────────┐     HTTP      ┌─────────────────────────┐
│   Electron Client   │ ────────────> │   Docker Compose        │
│   (cliente thin)    │               │                         │
│                     │               │  ┌───────────────────┐  │
│  - Ventana          │               │  │  Express Server   │  │
│  - Auto-update      │               │  │  :3001            │  │
│  - React SPA        │               │  │  API REST         │  │
│  - API calls HTTP   │               │  │  serialport       │  │
│                     │               │  │  printer (CUPS)   │  │
│  Small: localhost   │               │  │  scheduler BCV    │  │
│  Medium: LAN IP     │               │  └───────────────────┘  │
│  Big: cloud URL     │               │  ┌───────────────────┐  │
│                     │               │  │  PostgreSQL 16    │  │
│                     │               │  │  :5432            │  │
│                     │               │  └───────────────────┘  │
└─────────────────────┘               └─────────────────────────┘
```

El backend corre siempre en Docker con PostgreSQL. El cliente Electron (o cualquier browser) se conecta via HTTP.

## Stack

| Capa | Tecnologia |
|------|-----------|
| Desktop | Electron 43 (cliente thin) |
| Frontend | React 19 + TypeScript 5.9 + TailwindCSS 3.4 |
| Backend | Express 5 (Docker) |
| Base de datos | PostgreSQL 16 via Prisma 6.19 |
| Auth | JWT + bcryptjs (PIN) |
| Validacion | Zod 4 |
| Hardware | serialport (terminal POS), ESC/POS (impresora termica) |
| Testing | Vitest 4 + supertest 7 |
| Build | electron-vite 5 + Vite 7 |
| Container | Docker Compose |

## Quick Start (Docker)

```bash
# 1. Clonar
git clone https://github.com/Angel-java/silver-knight-fiscal-pos.git
cd silver-knight-fiscal-pos/silver-knight

# 2. Configurar variables de entorno
cp .env.docker.example .env

# 3. Levantar backend (Express + PostgreSQL)
docker compose up -d

# 4. Verificar que el backend esta listo
curl http://localhost:3001/api/health

# 5. Abrir el cliente Electron
npm install
npm run dev
```

## Desarrollo Local

### Prerequisitos

- **Node.js >= 20.x**
- **Docker + Docker Compose**
- **Linux**: `python3`, `make`, `g++` (para compilar `serialport`)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: Python 3 + Visual Studio Build Tools (C++ workload)

### Backend (con Docker)

```bash
# Copiar variables de entorno
cp .env.docker.example .env

# Levantar PostgreSQL + Express
docker compose up -d

# Ver logs
docker compose logs -f server

# Ejecutar migraciones manualmente
docker compose exec server npx prisma migrate deploy

# Abrir Prisma Studio
npx prisma studio
```

### Frontend (Electron)

```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo (Electron + HMR)
npm run dev

# El cliente se conecta a http://localhost:3001/api por defecto
# Cambia la URL en Settings > Conexion al Servidor
```

### Variables de entorno

Ver `.env.example` (desarrollo local) o `.env.docker.example` (Docker).

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://...` | URL de conexion PostgreSQL |
| `JWT_SECRET` | auto-generado | Secreto para firmar tokens JWT |
| `PORT` | `3001` | Puerto del servidor Express |
| `LOG_LEVEL` | `info` | Nivel de logs |
| `CORS_ORIGIN` | `*` | Origenes permitidos para CORS |
| `POSTGRES_USER` | `silverknight` | Usuario PostgreSQL |
| `POSTGRES_PASSWORD` | `REDACTED_DB_PASS` | Password PostgreSQL |
| `POSTGRES_DB` | `silverknight` | Nombre de la DB |

### Scripts disponibles

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Cliente Electron con HMR |
| `npm run server:dev` | Backend Express standalone (sin Docker) |
| `npm run docker:up` | Levantar Docker Compose |
| `npm run docker:down` | Detener Docker Compose |
| `npm run docker:logs` | Ver logs del server |
| `npm run db:migrate` | Crear migracion Prisma |
| `npm run db:generate` | Generar cliente Prisma |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run build` | Typecheck + build produccion |
| `npm run start` | Preview build produccion |
| `npm test` | Ejecutar tests |
| `npm run lint` | Linting ESLint |
| `npm run format` | Formatear Prettier |
| `npm run build:win` | Empaquetar Windows |
| `npm run build:mac` | Empaquetar macOS |
| `npm run build:linux` | Empaquetar Linux |

## Estructura del proyecto

```
silver-knight/
├── prisma/
│   └── schema.prisma           # Schema PostgreSQL (14 modelos)
├── src/
│   ├── main/                   # Proceso principal de Electron (thin client)
│   │   └── index.ts            # Solo ventana + auto-update
│   ├── server/                 # Backend Express (corre en Docker)
│   │   ├── standalone.ts       # Entry point para Docker
│   │   ├── index.ts            # App factory + rutas
│   │   ├── config.ts           # Constantes
│   │   ├── scheduler.ts        # Auto-fetch BCV (cron)
│   │   ├── syncService.ts      # Sincronizacion cloud
│   │   ├── printer.ts          # Impresora termica ESC/POS
│   │   ├── puntoVenta.ts       # Terminal POS serial
│   │   ├── database/           # Cliente Prisma singleton
│   │   │   └── prisma.ts
│   │   ├── auth/               # Auto-admin
│   │   ├── middleware/         # Auth, error handler, validation
│   │   ├── routes/             # 17 modulos de rutas
│   │   ├── utils/              # Logger, payments, parsePermissions
│   │   └── validation/         # Esquemas Zod
│   ├── preload/                # Scripts de preload de Electron
│   └── renderer/               # Frontend React
│       └── src/
│           ├── App.tsx         # Router + rutas protegidas
│           ├── lib/api.ts      # Cliente HTTP configurable
│           ├── contexts/       # Auth context
│           ├── pages/          # 15 paginas
│           └── components/     # Componentes POS
├── docker-compose.yml          # Express + PostgreSQL
├── docker-entrypoint.sh        # Auto-migrate + start server
├── Dockerfile                  # Build del backend
├── resources/                  # Iconos de la app
├── electron-builder.yml        # Config de empaquetado
└── package.json
```

## API

El servidor expone rutas bajo `/api/`:

| Ruta | Auth | Descripcion |
|------|------|-------------|
| `GET /health` | No | Health check |
| `/auth` | Parcial | Login, wizard, empresa |
| `/categories` | Si | CRUD categorias |
| `/products` | Si | CRUD productos + stock |
| `/customers` | Si | CRUD clientes |
| `/suppliers` | Si | CRUD proveedores |
| `/invoices` | Si | Facturacion + numeracion fiscal |
| `/fiscal-control` | Si | Rangos SENIAT |
| `/iva` | Si | Libros IVA Ventas/Compras |
| `/reports` | Si | Reportes de ventas, inventario |
| `/dashboard` | Si | Resumen general |
| `/exchange-rates` | Si | Tasas BCV (manual + auto) |
| `/settings` | Si | Configuracion clave-valor |
| `/users` | Si | Multi-usuario con roles |
| `/inventory-entries` | Si | Movimientos de inventario |
| `/print` | Si | Impresion termica |
| `/punto-venta` | Si | Terminal POS serial |
| `/sync` | Si | Sincronizacion cloud |

## CI/CD

GitHub Actions ejecuta en cada push/PR a `main`:

```bash
npm ci
npx prisma generate
npm run lint
npm run typecheck
npm test
```

## Hardware (Docker)

Para usar hardware en el contenedor Docker, descomenta las secciones correspondientes en `docker-compose.yml`:

- **Terminal POS serial**: Agregar `devices: [/dev/ttyUSB0:/dev/ttyUSB0]`
- **Impresora termica**: Agregar `volumes: [/var/run/cups:/var/run/cups]`

## Licencia

Privado.
