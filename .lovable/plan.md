

# Rediseño de Documentación HR — Sistema de Carpetas por Empleado

## Concepto

Reemplazar la vista plana actual (tabla con filtro) por un explorador de archivos con estructura de carpetas:

```text
📁 Juan García (employee)
   📁 Contratos
   📁 Nóminas
   📁 Certificados
   📁 Identificación
   📁 Otros
📁 María López (employee)
   📁 Contratos
   📁 Nóminas
   ...
```

- **Manager/Admin**: ve todas las carpetas de todos los empleados, puede crear carpetas personalizadas y gestionar archivos.
- **Employee**: ve solo su propia carpeta y su contenido (solo lectura, no puede subir ni eliminar).

## Cambios en Base de Datos

**Nueva tabla `document_folders`**:
- `id`, `account_id`, `user_id` (empleado al que pertenece), `name`, `is_default` (para las predefinidas), `created_by`, `created_at`
- RLS: managers ven todas del account, employees ven solo las suyas.

**Modificar `employee_documents`**:
- Añadir columna `folder_id uuid REFERENCES document_folders(id)` (nullable para compatibilidad con docs existentes).

**Carpetas predefinidas**: Al crear un empleado (o la primera vez que se carga), se auto-crean: Contratos, Nóminas, Certificados, Identificación, Otros.

## UI — Explorador de Archivos

Reescribir `DocumentsTab.tsx` completamente:

1. **Panel izquierdo**: Lista de empleados (solo Manager los ve todos; Employee ve solo su nombre). Al seleccionar un empleado se expanden sus carpetas.
2. **Panel derecho**: Contenido de la carpeta seleccionada — lista de archivos con acciones (descargar, eliminar para managers).
3. **Acciones Manager**: Botón "Nueva Carpeta" dentro de un empleado, botón "Subir Archivo" dentro de una carpeta, eliminar carpeta (solo si está vacía y no es predefinida).
4. **Employee view**: Navegación read-only por sus carpetas y descarga de archivos.

## Archivos a Crear/Modificar

**Crear:**
- Migración SQL: tabla `document_folders`, columna `folder_id` en `employee_documents`, función para auto-crear carpetas predefinidas.

**Modificar:**
- `src/components/hr/DocumentsTab.tsx` — reescritura completa con explorador de carpetas.

## Implementación

1. Migración DB: crear `document_folders`, añadir `folder_id` a `employee_documents`, RLS policies.
2. Reescribir DocumentsTab con navegación por carpetas: sidebar de empleados → carpetas → archivos.
3. Auto-crear carpetas predefinidas cuando se accede a un empleado que no las tiene (upsert on load, o trigger en DB).

