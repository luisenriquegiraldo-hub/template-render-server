import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

export const FPS = 30;

export const fabricaVideoSchema = z.object({
  scenes: z.array(
    z.object({
      imageUrl: z.string(),
      durationSeg: z.number(),
    }),
  ),
  voiceUrl: z.string(),
  musicUrl: z.string(),
  captions: z.array(
    z.object({
      text: z.string(),
      start: z.number(),
      end: z.number(),
    }),
  ),
  // Clip personal opcional (cierre con la cara real de Luis). Vacio = no hay.
  outroVideoUrl: z.string().default(""),
});

type FabricaVideoSchemaProps = z.infer<typeof fabricaVideoSchema>;

// outroDurationInFrames no lo manda n8n -- lo calcula calculateMetadata en
// Root.tsx (midiendo el archivo real de outroVideoUrl) y se lo inyecta al
// componente como prop derivada, para no medir el archivo dos veces.
type FabricaVideoProps = FabricaVideoSchemaProps & {
  outroDurationInFrames?: number;
};

// El guion estima segundos por escena, pero eso no garantiza que coincida con
// lo que tarda ElevenLabs en narrar el texto real. La duracion del video debe
// seguir el audio real (medido por Whisper via el ultimo caption), nunca ser
// mas corta que la narracion o el CTA final queda cortado.
export const computeTotalDurationSeg = (
  scenes: FabricaVideoSchemaProps["scenes"],
  captions: FabricaVideoSchemaProps["captions"],
): number => {
  const scenesSum = scenes.reduce((sum, scene) => sum + scene.durationSeg, 0);
  const captionsEnd = captions.reduce(
    (max, caption) => Math.max(max, caption.end),
    0,
  );

  return Math.max(scenesSum, captionsEnd);
};

const Scene: React.FC<{ imageUrl: string; durationInFrames: number }> = ({
  imageUrl,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  // Ligero zoom (Ken Burns) para que la imagen fija no se sienta estática.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b1120" }}>
      <Img
        src={imageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ text: string }> = ({ text }) => (
  <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
    <div
      style={{
        marginBottom: 320,
        maxWidth: "85%",
        padding: "16px 28px",
        borderRadius: 12,
        backgroundColor: "rgba(11, 17, 32, 0.72)",
        color: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 46,
        fontWeight: 700,
        textAlign: "center",
        lineHeight: 1.25,
      }}
    >
      {text}
    </div>
  </AbsoluteFill>
);

// Logo real "D" de la marca (Img/logo-d.png del repo del sitio), embebido
// como data URI -- evita depender de una URL externa (Supabase/CDN) que el
// servidor de render tenga que resolver en tiempo de renderizado.
const LOGO_D_BASE64 =
  "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";

const LOGO_D_DATA_URI = `data:image/png;base64,${LOGO_D_BASE64}`;

// Watermark de marca, visible todo el video (escenas + outro personal si lo
// hay). Logo real "D" (arriba) + digitrion.com sobre un fondo semi
// transparente para que se lea sobre cualquier imagen de fondo.
const Watermark: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-start" }}>
    <div
      style={{
        marginTop: 56,
        marginLeft: 40,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 18px 8px 8px",
        borderRadius: 999,
        backgroundColor: "rgba(10, 13, 16, 0.55)",
      }}
    >
      <Img
        src={LOGO_D_DATA_URI}
        style={{ width: 34, height: 34, objectFit: "contain" }}
      />
      <span
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 700,
          fontSize: 24,
          color: "#ffffff",
        }}
      >
        digitrion.com
      </span>
    </div>
  </AbsoluteFill>
);

export const FabricaVideo: React.FC<FabricaVideoProps> = ({
  scenes,
  voiceUrl,
  musicUrl,
  captions,
  outroVideoUrl,
  outroDurationInFrames = 0,
}) => {
  const { fps } = useVideoConfig();

  // Duracion de la parte generada por IA (escenas + narracion), sin contar
  // el outro personal -- calculada aqui de forma independiente en vez de leer
  // useVideoConfig().durationInFrames, porque ese total ya incluye el outro
  // cuando existe.
  const scenesSumSeg = scenes.reduce((sum, scene) => sum + scene.durationSeg, 0);
  const totalAiSeg = computeTotalDurationSeg(scenes, captions);
  const totalAiFrames = Math.max(1, Math.round(totalAiSeg * fps));

  // Si la narracion real dura mas que la suma de escenas del guion, el tiempo
  // extra se reparte PROPORCIONALMENTE entre todas las escenas (no solo la
  // ultima) -- estirar solo la ultima escena la deja casi congelada cuando la
  // diferencia es grande, porque el zoom sutil de Ken Burns se nota cada vez
  // menos mientras mas se alarga una sola escena.
  const stretchFactor = scenesSumSeg > 0 ? totalAiSeg / scenesSumSeg : 1;
  const sceneDurationsInFrames = scenes.map((scene) =>
    Math.max(1, Math.round(scene.durationSeg * stretchFactor * fps)),
  );
  // Corrige el redondeo (siempre menos de un frame por escena, nunca notable)
  // para que la suma coincida exactamente con la duracion real del audio.
  const roundingDiff =
    totalAiFrames - sceneDurationsInFrames.reduce((sum, d) => sum + d, 0);
  if (sceneDurationsInFrames.length > 0) {
    const lastIndex = sceneDurationsInFrames.length - 1;
    sceneDurationsInFrames[lastIndex] = Math.max(
      1,
      sceneDurationsInFrames[lastIndex] + roundingDiff,
    );
  }

  let elapsedFrames = 0;
  const sceneSequences = scenes.map((scene, index) => {
    const durationInFrames = sceneDurationsInFrames[index];
    const from = elapsedFrames;
    elapsedFrames += durationInFrames;

    return (
      <Sequence key={index} from={from} durationInFrames={durationInFrames}>
        <Scene imageUrl={scene.imageUrl} durationInFrames={durationInFrames} />
      </Sequence>
    );
  });

  const hasOutro = Boolean(outroVideoUrl) && outroDurationInFrames > 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {sceneSequences}

      {captions.map((caption, index) => {
        const from = Math.round(caption.start * fps);
        const durationInFrames = Math.max(
          1,
          Math.round((caption.end - caption.start) * fps),
        );

        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames}>
            <Caption text={caption.text} />
          </Sequence>
        );
      })}

      {/* Voz y musica solo suenan durante la parte generada por IA -- se
          cortan justo cuando entra el clip personal, para que la voz real
          de Luis se escuche limpia sin competir con la musica de fondo. */}
      {voiceUrl ? (
        <Sequence from={0} durationInFrames={totalAiFrames}>
          <Audio src={voiceUrl} />
        </Sequence>
      ) : null}
      {musicUrl ? (
        <Sequence from={0} durationInFrames={totalAiFrames}>
          <Audio src={musicUrl} volume={0.06} loop />
        </Sequence>
      ) : null}

      {/* Cierre personal: corte directo justo al terminar la ultima escena,
          sin transicion. Trae su propio audio (la voz real de Luis). */}
      {hasOutro ? (
        <Sequence from={totalAiFrames} durationInFrames={outroDurationInFrames}>
          <AbsoluteFill style={{ backgroundColor: "#000000" }}>
            <OffthreadVideo
              src={outroVideoUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        </Sequence>
      ) : null}

      <Watermark />
    </AbsoluteFill>
  );
};
