# Integración VERI*FACTU

Modalidad implementada: **Veri*Factu** (remisión de los registros de facturación a la
AEAT en tiempo real, con encadenamiento por huella SHA-256). No requiere firma XAdES
de cada registro.

## Arquitectura

| Pieza | Ubicación | Función |
|-------|-----------|---------|
| Migración BD | `supabase/migrations/20260622120000_verifactu_phase3.sql` | Columnas Veri*Factu en `invoices`, config en `account_settings`, tabla `verifactu_events`, triggers de inmutabilidad |
| Edge function | `supabase/functions/verifactu_submit/index.ts` | Calcula huella encadenada, construye el XML `RegistroAlta` + SOAP y lo envía a la AEAT por TLS mutuo |
| Cliente | `src/lib/verifactu.service.ts` | Invoca la edge function desde el frontend |
| QR | `src/lib/verifactu.ts`, `src/components/invoices/QRTributario.tsx` | URL del QR tributario (cotejo) |
| Ajustes | `src/components/settings/VerifactuSettingsTab.tsx` | Activación, entorno y NIF del emisor |
| Acciones | `InvoiceActionsMenu`, `InvoicePreviewDialog`, `AppInvoices` | Botón "Registrar en AEAT" + indicadores de estado |

## Estados de una factura (`invoices.verifactu_status`)

- `NONE` — aún no procesada.
- `PREPARED` — XML y huella generados y encadenados, pero **no enviados** (típicamente porque
  falta el certificado). Lista para enviarse en cuanto se configure.
- `SENT` — registrada en la AEAT (se guarda el CSV en `verifactu_csv`).
- `ERROR` — la AEAT rechazó el registro o hubo un error de conexión.

Una vez `SENT`, los triggers `trg_verifactu_immutability` / `trg_verifactu_protect_lines`
impiden modificar los datos fiscales o eliminar la factura (los pagos siguen permitidos).

## Puesta en marcha (entorno de pruebas)

1. **Aplicar la migración** (Lovable/Supabase la ejecuta al sincronizar, o `supabase db push`).
2. **Desplegar la función**: `supabase functions deploy verifactu_submit`.
3. **Activar en la app**: Ajustes → VERI*FACTU → activar, entorno *Pruebas*, NIF del emisor.
4. **Cargar el certificado** (ver abajo). Sin él, "Registrar en AEAT" deja la factura en
   `PREPARED`: la huella ya queda calculada y encadenada correctamente.

## Certificado de cliente (mTLS)

El envío real a la AEAT exige un **certificado digital** (empresa, representante o sello)
válido para el entorno seleccionado. Para pre-producción:

- Sirve un certificado de la FNMT/AEAT instalado a nombre del obligado tributario, o el
  certificado de pruebas que facilita la AEAT para el entorno de pre-producción.
- Conviértelo a PEM (clave + certificado):
  ```bash
  openssl pkcs12 -in certificado.pfx -clcerts -nokeys -out cert.pem
  openssl pkcs12 -in certificado.pfx -nocerts -nodes -out key.pem
  ```
- Cárgalo como **secrets** de la edge function:
  ```bash
  supabase secrets set VERIFACTU_CERT="$(cat cert.pem)"
  supabase secrets set VERIFACTU_KEY="$(cat key.pem)"
  ```

La función detecta automáticamente la presencia de estos secrets: si existen, envía por
mTLS; si no, deja la factura `PREPARED`.

## Pendiente / a validar antes de producción

- **Esquema XML**: el `RegistroAlta` está construido conforme a la estructura documentada de
  Veri*Factu, pero conviene validarlo contra los XSD oficiales (`SuministroLR.xsd` /
  `SuministroInformacion.xsd`) y ajustar campos (claves de régimen, calificación, etc.)
  según el caso de uso real.
- **`SistemaInformatico`**: rellenar los datos definitivos del SIF registrado (NIF del
  productor, versión, nº de instalación) en `verifactu_submit/index.ts`.
- **QR con huella**: la especificación contempla incorporar la huella al QR; actualmente el
  QR usa NIF + nº de serie + fecha + importe.
- **Anulaciones** (`RegistroAnulacion`): no implementado (sólo altas).
- **Entorno de producción**: cambiar a *Producción* en Ajustes sólo tras validar en pruebas.
