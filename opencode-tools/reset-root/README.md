# reset-root — cambiar root de un Silver Knight desplegado

**Archivo ÚNICO autocontenido** que cambia el **username** y/o el **PIN** del usuario
root (`role='root'`) de un sistema Silver Knight desplegado. Lleva **bcrypt incrustado**,
así que **no requiere instalar nada** (`npm install`) en la maquina destino: basta Node.js.

Edita la tabla `"User"` directamente en PostgreSQL vía `docker exec silverknight-db psql ...`
(el root es inmutable por API).

## Uso

```bash
node reset-root.js                     # aplica las credenciales por defecto
```

### Credenciales por defecto
Editalas al inicio del archivo (variables `USERNAME_POR_DEFECTO` y `PIN_POR_DEFECTO`):

```js
const USERNAME_POR_DEFECTO = "admin";
const PIN_POR_DEFECTO      = "admin1234";
```

### Flags

| Flag | Descripcion |
|------|-------------|
| `--user <v>` | Nuevo username del root (default: `admin`) |
| `--pin <v>` | Nuevo PIN (default: `admin1234`) |
| `--user-only` | Cambia solo el username (deja el PIN) |
| `--pin-only` | Cambia solo el PIN (deja el username) |
| `--dry-run` | Muestra el SQL y el hash, no ejecuta |
| `--print-hash` | Solo imprime el hash bcrypt del PIN y sale |
| `--quiet` | No imprime el PIN en la confirmacion |
| `--container <n>` | Contenedor Postgres (default `silverknight-db`) |
| `--db-user <u>` | Usuario BD en el contenedor (default `silverknight`) |
| `--db-name <d>` | Base de datos (default `silverknight`) |

### Ejemplos

```bash
node reset-root.js                     # default: admin / admin1234
node reset-root.js --user admin2       # solo username -> admin2
node reset-root.js --pin 567890        # solo PIN -> 567890
node reset-root.js --user a --pin b    # ambos
node reset-root.js --dry-run           # ver SQL/hash sin tocar nada
```

## Requisitos

- Node.js (>= 18) en la maquina desplegada.
- Docker con el contenedor `silverknight-db` corriendo (el de `docker-compose.yml`).

## Verificacion posterior

```bash
docker exec silverknight-db psql -U silverknight -d silverknight -c "SELECT username, role FROM \"User\" WHERE role='root';"
```

## IMPORTANTE sobre el .env de la app

Este script cambia la **base de datos**. En la app empaquetada, el `.env` de la app vive
en `%APPDATA%\silver-knight\config\.env`. Para que el proximo arranque (`autoAdmin`) y el
wizard sigan consistentes, actualiza ahi `ROOT_USERNAME` y `ROOT_PIN` con los mismos valores
si quieres persistirlos. El script no toca ese archivo.

## Nota Windows/PowerShell

Al pasar PIN o hash con `$` por consola, escapalos o usalos con comillas simples
(`--pin 'Mi$Pin'`); los `$` los interpreta PowerShell.

## Licencia del codigo incrustado

El bloque de bcrypt embebido es una copia de **bcryptjs** (MIT) para hacer el script
autocontenido y sin dependencias externas.
