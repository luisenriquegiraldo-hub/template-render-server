import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { z } from "zod";

// El servidor corre en Linux sin "Segoe UI"/Arial instaladas -- se carga
// Inter explicitamente (mismo tipo de gotcha ya visto con las captions del
// video, resuelto de raiz aqui en vez de depender de una fuente del sistema).
const { fontFamily } = loadFont();

export const carouselSlideSchema = z.object({
  role: z.enum(["portada", "contenido", "cierre"]),
  eyebrow: z.string().default(""),
  hook: z.string().default(""),
  titulo: z.string().default(""),
  texto: z.string().default(""),
  ctaText: z.string().default(""),
  photoUrl: z.string().default(""),
  backgroundUrl: z.string(),
  logoUrl: z.string(),
});

export type CarouselSlideProps = z.infer<typeof carouselSlideSchema>;

// Paleta real de digitrion.com (--accent / --accent-2) -- el verde queda
// reservado solo para el boton de CTA que apunta a WhatsApp, igual que en el
// sitio real. El logo "D" es lime green por separado (color propio del
// isotipo, viene ya asi en logoUrl, no se toca aqui).
const ACCENT = "#0AB8E8";
const ACCENT_2 = "#19C9C0";
const WHATSAPP_GREEN = "#25D366";
const BG_FALLBACK = "#0A0D10";

export const CarouselSlide: React.FC<CarouselSlideProps> = ({
  role,
  eyebrow,
  hook,
  titulo,
  texto,
  ctaText,
  photoUrl,
  backgroundUrl,
  logoUrl,
}) => {
  const hasPhoto = Boolean(photoUrl);

  return (
    <AbsoluteFill style={{ backgroundColor: BG_FALLBACK, fontFamily }}>
      <Img
        src={backgroundUrl}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      <Img
        src={logoUrl}
        style={{
          position: "absolute",
          top: 64,
          left: 64,
          width: 220,
          height: 220,
          objectFit: "contain",
          objectPosition: "left top",
        }}
      />

      {hasPhoto ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 160,
            width: 560,
            height: 760,
            overflow: "hidden",
            // Borde difuminado: la foto se desvanece hacia la izquierda en
            // vez de cortar seco contra el fondo (mismo efecto que el
            // prototipo hacia con canvas destination-in, via CSS mask aqui).
            WebkitMaskImage:
              "linear-gradient(to left, black 60%, transparent 100%)",
            maskImage:
              "linear-gradient(to left, black 60%, transparent 100%)",
          }}
        >
          <Img
            src={photoUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      ) : null}

      {role === "portada" ? (
        <AbsoluteFill style={{ justifyContent: "center", padding: "0 100px" }}>
          {eyebrow ? (
            <div
              style={{
                color: ACCENT_2,
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 24,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div
            style={{
              color: "#ffffff",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.15,
              maxWidth: 820,
            }}
          >
            {hook}
          </div>
        </AbsoluteFill>
      ) : null}

      {role === "contenido" ? (
        <AbsoluteFill style={{ justifyContent: "center", padding: "0 100px" }}>
          {eyebrow ? (
            <div
              style={{
                color: ACCENT,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div
            style={{
              color: "#ffffff",
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.2,
              maxWidth: hasPhoto ? 560 : 820,
              marginBottom: 28,
            }}
          >
            {titulo}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 34,
              fontWeight: 400,
              lineHeight: 1.4,
              maxWidth: hasPhoto ? 560 : 780,
            }}
          >
            {texto}
          </div>
        </AbsoluteFill>
      ) : null}

      {role === "cierre" ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: "0 100px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: 62,
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: 24,
            }}
          >
            {titulo}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 32,
              lineHeight: 1.4,
              marginBottom: 48,
              maxWidth: 760,
            }}
          >
            {texto}
          </div>
          {ctaText ? (
            <div
              style={{
                backgroundColor: WHATSAPP_GREEN,
                color: "#ffffff",
                fontSize: 32,
                fontWeight: 700,
                padding: "24px 56px",
                borderRadius: 999,
              }}
            >
              {ctaText}
            </div>
          ) : null}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
