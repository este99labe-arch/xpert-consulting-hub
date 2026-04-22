import { QRCodeSVG } from "qrcode.react";
import { tryBuildVerifactuQRUrl, type VerifactuLang } from "@/lib/verifactu";

interface QRTributarioProps {
  nif: string;
  numserie: string;
  fecha: string | Date;
  importe: number | string;
  idioma?: VerifactuLang;
  /** Tamaño en pixeles (preview). En PDF el tamaño se fija en 40×40 mm. */
  size?: number;
}

/**
 * QR tributario VERI*FACTU.
 *
 * Renderiza el código QR con corrección de errores nivel "M" según
 * especificación AEAT, junto con los textos explicativos requeridos.
 *
 * En el PDF generado el QR se imprime a 40×40 mm con margen blanco de 6 mm.
 */
export function QRTributario({ nif, numserie, fecha, importe, idioma, size = 120 }: QRTributarioProps) {
  const { url, error } = tryBuildVerifactuQRUrl({ nif, numserie, fecha, importe, idioma });

  if (error || !url) {
    return (
      <div className="flex flex-col items-center gap-1 p-2 border border-destructive/40 rounded-md bg-destructive/5 text-destructive text-[10px] max-w-[160px]">
        <span className="font-semibold uppercase tracking-wide">QR tributario</span>
        <span className="text-center leading-tight">
          {error?.code ? `Error ${error.code}: ` : ""}
          {error?.message || "No se pudo generar el QR."}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        QR tributario:
      </span>
      <div className="p-1.5 bg-white border border-border rounded-sm">
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      <span className="text-[8.5px] text-muted-foreground text-center max-w-[160px] leading-tight">
        Factura verificable en la sede electrónica de la AEAT
      </span>
    </div>
  );
}

export default QRTributario;
