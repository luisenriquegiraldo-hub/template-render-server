import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
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
});

type FabricaVideoProps = z.infer<typeof fabricaVideoSchema>;

// El guion estima segundos por escena, pero eso no garantiza que coincida con
// lo que tarda ElevenLabs en narrar el texto real. La duracion del video debe
// seguir el audio real (medido por Whisper via el ultimo caption), nunca ser
// mas corta que la narracion o el CTA final queda cortado.
export const computeTotalDurationSeg = (
  scenes: FabricaVideoProps["scenes"],
  captions: FabricaVideoProps["captions"],
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
}) => {
  const { fps, durationInFrames: totalDurationInFrames } = useVideoConfig();

  // La ultima escena se extiende para cubrir cualquier segundo de narracion
  // que sobre despues de sumar las duraciones estimadas del guion, para que
  // el CTA final nunca se corte antes de que termine el audio.
  const scenesSumFrames = scenes.reduce(
    (sum, scene) => sum + Math.max(1, Math.round(scene.durationSeg * fps)),
    0,
  );
  const extraFrames = Math.max(0, totalDurationInFrames - scenesSumFrames);

  let elapsedFrames = 0;
  const sceneSequences = scenes.map((scene, index) => {
    const isLast = index === scenes.length - 1;
    const durationInFrames =
      Math.max(1, Math.round(scene.durationSeg * fps)) +
      (isLast ? extraFrames : 0);
    const from = elapsedFrames;
    elapsedFrames += durationInFrames;

    return (
      <Sequence key={index} from={from} durationInFrames={durationInFrames}>
        <Scene imageUrl={scene.imageUrl} durationInFrames={durationInFrames} />
      </Sequence>
    );
  });

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

      {voiceUrl ? <Audio src={voiceUrl} /> : null}
      {musicUrl ? <Audio src={musicUrl} volume={0.12} loop /> : null}
    </AbsoluteFill>
  );
};
