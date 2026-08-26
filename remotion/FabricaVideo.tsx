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
        marginBottom: 180,
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
    </AbsoluteFill>
  );
};
