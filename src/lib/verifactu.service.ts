/**
 * VERI*FACTU — Servicio de envío de registros de facturación a la AEAT
 *
 * ⚠️ MÓDULO PREPARADO PERO NO ACTIVO ⚠️
 *
 * Este archivo contiene los puntos de integración para cuando se complete
 * la implementación real con los sistemas de la AEAT (firma electrónica +
 * envío del registro de facturación + cadena de huellas).
 *
 * Estado actual: SOLO QR TRIBUTARIO (visual). El envío del registro a la AEAT
 * está deshabilitado y debe activarse cuando se cumplan los requisitos legales
 * y técnicos (certificado electrónico, endpoint productivo, etc.).
 */

import { VERIFACTU_ENV, type VerifactuEnv } from "./verifactu";

// ─── Endpoints AEAT ────────────────────────────────────────
// TODO: confirmar endpoints definitivos cuando la AEAT publique la URL
// estable del servicio SOAP/REST de alta de registros de facturación.
const VERIFACTU_REGISTRO_ENDPOINTS: Record<VerifactuEnv, string> = {
  sandbox: "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
  prod: "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
};

export interface VerifactuRegistroAlta {
  nif: string;
  numserie: string;        // TODO: incluir huella/hash de la cadena
  fecha: string;           // dd-mm-yyyy
  importe: string;         // 0.00
  tipoFactura: string;     // F1, F2, R1...
  descripcion: string;
  destinatario?: { nif: string; nombre: string };
  // TODO: añadir todos los campos del registro de facturación AEAT
  huellaAnterior?: string; // huella/hash del registro anterior (encadenamiento)
  huella?: string;         // huella/hash de este registro
}

/**
 * Envía un registro de alta de facturación a la AEAT.
 *
 * 🚫 NO IMPLEMENTADO: requiere certificado electrónico válido, firma XAdES
 *    y construcción del payload SOAP/JSON conforme al esquema oficial.
 */
export async function enviarRegistroAlta(
  _registro: VerifactuRegistroAlta,
  _env: VerifactuEnv = VERIFACTU_ENV
): Promise<{ ok: boolean; codigoRespuesta?: string; mensaje?: string }> {
  // TODO: 1. Cargar certificado electrónico del emisor (almacén seguro)
  // TODO: 2. Construir XML del registro de facturación según esquema AEAT
  // TODO: 3. Firmar con XAdES-BES utilizando el certificado
  // TODO: 4. Calcular huella SHA-256 y encadenar con huellaAnterior
  // TODO: 5. POST al endpoint VERIFACTU_REGISTRO_ENDPOINTS[env]
  // TODO: 6. Parsear respuesta y mapear códigos de error AEAT
  // TODO: 7. Persistir huella resultante para encadenar la siguiente factura

  console.warn(
    "[VERI*FACTU] enviarRegistroAlta() no está implementado. " +
      `Endpoint que se utilizará: ${VERIFACTU_REGISTRO_ENDPOINTS[_env]}`
  );

  return {
    ok: false,
    codigoRespuesta: "NOT_IMPLEMENTED",
    mensaje: "Integración con AEAT pendiente de activación.",
  };
}

/**
 * Calcula la huella (hash SHA-256) de un registro de facturación, requerida
 * para construir la cadena VERI*FACTU. La huella anterior debe pasarse
 * concatenada al payload antes de hashear.
 *
 * TODO: implementar según el esquema oficial cuando se active la integración.
 */
export async function calcularHuellaRegistro(
  _registro: VerifactuRegistroAlta,
  _huellaAnterior?: string
): Promise<string> {
  // TODO: serializar campos en el orden exacto definido por la AEAT,
  //       concatenar con huellaAnterior y aplicar SHA-256.
  return "";
}
