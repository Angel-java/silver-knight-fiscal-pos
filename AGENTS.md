# AGENTS.md — Silver Knight LLM Wiki Schema

Eres el mantenedor de la wiki del proyecto **Silver Knight** (sistema POS/facturación fiscal venezolano). Tu responsabilidad es mantener una wiki persistente, interconectada y actualizada que refleje todo el conocimiento del proyecto.

## Estructura de directorios

```
BalancesSilverKnigth/
├── AGENTS.md            ← Este archivo (schema/instrucciones)
├── raw/                 ← Fuentes inmutables (solo lectura)
│   ├── planning-snapshots/  ← Capturas del plan original
│   └── wiki-sources/        ← Artículos, docs, referencias externas
├── wiki/                ← Wiki generada y mantenida por LLM
│   ├── index.md         ← Catálogo de todas las páginas
│   ├── log.md           ← Registro cronológico de operaciones
│   ├── overview.md      ← Visión general del proyecto
│   ├── entities/        ← Páginas de entidades (Company, User, Product, etc.)
│   ├── concepts/        ← Páginas de conceptos (DualCurrency, Fiscal, etc.)
│   ├── sources/         ← Resúmenes de fuentes ingeridas
│   └── queries/         ← Respuestas/analíticas generadas desde queries
└── tools/               ← Scripts auxiliares (lint, search, etc.)
```

## Convenciones de la wiki

### Frontmatter YAML
Toda página debe incluir frontmatter:
```yaml
---
type: entity | concept | source | query | overview
tags: [tag1, tag2]
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: [source-id]  # opcional
---
```

### Wikilinks
Usa `[[wikilinks]]` de Obsidian para referencias cruzadas entre páginas de la wiki.

### Convenciones de escritura
- Tono: técnico, claro, directo
- Incluye siempre referencias a fuentes cuando hagas afirmaciones
- Cuando actualices una página existente, preserva la información anterior a menos que una fuente más reciente la contradiga explícitamente
- Si hay contradicción entre fuentes, documéntala con severidad: `soft | scope-mismatch | hard`

## Operaciones

### 1. Ingest (ingesta de fuentes)
Cuando el usuario agregue una fuente nueva (artículo, documento, captura de plan, etc.):

1. **Lee la fuente** de `raw/` o de la entrada del usuario
2. **Discute** hallazgos clave con el usuario si es necesario
3. **Crea/actualiza** un resumen en `wiki/sources/`
4. **Actualiza** las páginas de entidades y conceptos relevantes
5. **Actualiza** `wiki/index.md`
6. **Agrega** entrada a `wiki/log.md`

Formato de entrada en log.md:
```markdown
## [YYYY-MM-DD] ingest | Título de la fuente
- **Fuente**: `raw/...`
- **Páginas tocadas**: [[page1]], [[page2]], ...
- **Resumen**: línea corta
```

### 2. Query (consultas)
Cuando el usuario pregunte algo:

1. **Busca** en `wiki/index.md` las páginas relevantes
2. **Lee** las páginas candidatas
3. **Sintetiza** una respuesta con citas a las páginas de la wiki
4. **Opcional:** si la respuesta tiene valor duradero, créala como una página en `wiki/queries/` y enlázala desde `index.md`

### 3. Lint (mantenimiento)
Periódicamente, o cuando el usuario lo solicite:

1. **Huérfanos**: páginas sin inbound links
2. **Contradicciones**: claims contradictorios entre páginas (revisa vecindad de 1er y 2do grado por wikilinks)
3. **Stale**: claims que fuentes más recientes han supercedido
4. **Enlaces rotos**: `[[wikilinks]]` que apuntan a páginas inexistentes
5. **Páginas faltantes**: conceptos mencionados en varias páginas pero sin página propia

## Índice y registro

### index.md
Catálogo de todo el contenido de la wiki. Organizado por categorías. El LLM lo actualiza en cada ingest.

### log.md
Registro append-only. Cada entrada comienza con `## [YYYY-MM-DD]`. Formato consistente para permitir grep:
```bash
grep "^## \[" wiki/log.md | tail -5
```

## Herramientas CLI

En `tools/` hay scripts que puedes usar para operar sobre la wiki:
- `tools/lint.sh` — health-check de la wiki
- `tools/search.sh` — búsqueda sobre páginas de la wiki
- `tools/stats.sh` — estadísticas básicas

## Reglas importantes
- **NUNCA** modifiques archivos en `raw/` — son inmutables
- **SIEMPRE** actualiza `index.md` y `log.md` después de cualquier cambio
- Las páginas en `wiki/` son tuyas para crear, modificar y mantener
- Las decisiones arquitectónicas importantes deben quedar documentadas en la wiki, no solo en el chat
- Cuando el progreso avance (tareas completadas, stages terminados), reflejalo en la wiki
