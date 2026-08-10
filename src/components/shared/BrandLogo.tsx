import { useTheme } from "@/contexts/ThemeContext";
import logoWhite from "@/assets/brand/logo-horizontal-white.png";
import logoBlue from "@/assets/brand/logo-horizontal-blue.png";
import isoWhite from "@/assets/brand/iso-white.png";
import isoBlue from "@/assets/brand/iso-blue.png";
import { cn } from "@/lib/utils";

/**
 * Logotipo de marca según el tema.
 *
 * El negativo (blanco) solo vale sobre superficie oscura; en claro desaparece.
 * Centralizarlo aquí evita que cada pantalla tenga que acordarse de elegir la
 * versión correcta al cambiar de tema.
 */
export const useBrandLogo = () => {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return { horizontal: dark ? logoWhite : logoBlue, iso: dark ? isoWhite : isoBlue, isDark: dark };
};

const BrandLogo = ({
  variant = "horizontal", className, decorative,
}: { variant?: "horizontal" | "iso"; className?: string; decorative?: boolean }) => {
  const { horizontal, iso } = useBrandLogo();
  return (
    <img
      src={variant === "iso" ? iso : horizontal}
      alt={decorative ? "" : "XpertConsulting"}
      aria-hidden={decorative || undefined}
      className={cn("w-auto object-contain", className)}
    />
  );
};

export default BrandLogo;
