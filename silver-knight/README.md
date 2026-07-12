# Silver Knight

Sistema POS y facturacion fiscal para Venezuela. Dual currency (USD/VES), cumplimiento SENIAT, offline-first.

## Stack

| Capa | Tecnologia |
|------|-----------|
| Desktop | Electron 43 |
| Frontend | React 19 + TypeScript 5.9 + TailwindCSS 3.4 |
| Backend | Express 5 (embebido en Electron o standalone via Docker) |
| Base de datos | SQLite via Prisma 6.19 + better-sqlite3 |
| Auth | JWT + bcryptjs (PIN) |
| Validacion | Zod 4 |
| Hardware | serialport (terminal POS), ESC/POS (impresora termica) |
| Testing | Vitest 4 + supertest 7 |
| Build | electron-vite 5 + Vite 7 |

## Replicar el entorno de desarrollo

### Prerequisitos

- **Node.js >= 20.x**
- **npm >= 9.x**
- **Linux**: `python3`, `make`, `g++` (para compilar `better-sqlite3` y `serialport`)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: Python 3 + Visual Studio Build Tools (C++ workload)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/Angel-java/silver-knight-fiscal-pos.git
cd silver-knight-fiscal-pos/silver-knight

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Instalar dependencias
npm install

# 4. Generar cliente Prisma
npx prisma generate

# 5. Ejecutar migraciones (crea la base de datos)
npx prisma migrate dev

# 6. Iniciar en modo desarrollo
npm run dev
```

El servidor Express arranca en `http://localhost:3001`. La app Electron abre automaticamente.

### Variables de entorno

Ver `.env.example` para todas las opciones. Las disponibles son:

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | Ruta de la base SQLite |
| `JWT_SECRET` | auto-generado | Secreto para firmar tokens JWT |
| `PORT` | `3001` | Puerto del servidor Express |
| `LOG_LEVEL` | `info` | Nivel de logs (`debug`, `info`, `warn`, `error`) |
| `CORS_ORIGIN` | `*` | Origen permitido para CORS |

### Scripts disponibles

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Typecheck + build de produccion |
| `npm run start` | Preview del build de produccion |
| `npm test` | Ejecutar tests (Vitest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run lint` | Linting con ESLint |
| `npm run format` | Formatear con Prettier |
| `npm run typecheck` | Verificar tipos (node + web) |
| `npm run build:win` | Empaquetar para Windows |
| `npm run build:mac` | Empaquetar para macOS |
| `npm run build:linux` | Empaquetar para Linux (AppImage, snap, deb) |

## Modo Docker (server standalone)

Corre el servidor Express sin Electron, ideal para servidores o CI.

```bash
# Construir imagen
docker build -t silver-knight .

# Ejecutar
docker run -p 3001:3001 silver-knight
```

El servidor queda disponible en `http://localhost:3001/api`.

## Estructura del proyecto

```
silver-knight/
├── prisma/
│   ├── schema.prisma          # Schema de la base de datos (12 modelos)
│   ├── migrations/            # Migraciones de SQLite
│   └── dev.db                 # Base de datos local (gitignored)
├── src/
│   ├── main/                  # Proceso principal de Electron
│   │   ├── index.ts           # Entry point (Electron + Express)
│   │   ├── database/          # Cliente Prisma singleton
│   │   └── server/            # Servidor Express
│   │       ├── index.ts       # App factory + todas las rutas
│   │       ├── standalone.ts  # Entry point para Docker
│   │       ├── scheduler.ts   # Auto-fetch BCV (cron)
│   │       ├── syncService.ts # Sincronizacion cloud
│   │       ├── printer.ts     # Impresora termica ESC/POS
│   │       ├── puntoVenta.ts  # Terminal POS serial
│   │       ├── middleware/    # Auth, error handler, validation
│   │       ├── routes/        # 16 modulos de rutas
│   │       └── validation/    # Esquemas Zod
│   ├── preload/               # Scripts de preload de Electron
│   └── renderer/              # Frontend React
│       └── src/
│           ├── App.tsx        # Router + rutas protegidas
│           ├── lib/api.ts     # Cliente HTTP (688 lineas)
│           ├── contexts/      # Auth context
│           ├── pages/         # 15 paginas
│           └── components/    # Componentes POS
├── resources/                 # Iconos de la app
├── Dockerfile                 # Modo server standalone
└── electron-builder.yml       # Config de empaquetado
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

## Hardware (opcional)

- **Impresora termica**: Requiere CUPS configurado (`lp` command)
- **Terminal POS**: Requiere dispositivo fisico via puerto serial

## Licencia

Privado.
