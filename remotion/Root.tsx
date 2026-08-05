import { Composition } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";
import {
  FabricaVideo,
  computeTotalDurationSeg,
  fabricaVideoSchema,
  FPS,
} from "./FabricaVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FabricaVideo"
        component={FabricaVideo}
        fps={FPS}
        width={1080}
        height={1920}
        // durationInFrames es solo el valor por defecto en el Studio;
        // calculateMetadata lo recalcula en cada render segun la suma de escenas
        // (y la duracion real del clip personal, si viene uno).
        durationInFrames={150}
        schema={fabricaVideoSchema}
        defaultProps={{
          scenes: [
            {
              imageUrl:
                "https://placehold.co/1080x1920/0b1120/white?text=Fabrica+de+Contenido",
              durationSeg: 5,
            },
          ],
          voiceUrl: "",
          musicUrl: "",
          captions: [],
          outroVideoUrl: "",
        }}
        calculateMetadata={async ({ props }) => {
          const aiSeg = computeTotalDurationSeg(props.scenes, props.captions);
          const aiFrames = Math.max(1, Math.round(aiSeg * FPS));

          // Se mide el archivo real del clip personal (nunca se confia en un
          // numero de duracion escrito a mano) -- si el clip cambia de 10s a
          // 12s de un dia a otro, esto se ajusta solo, sin tocar nada mas.
          let outroDurationInFrames = 0;
          if (props.outroVideoUrl) {
            const metadata = await getVideoMetadata(props.outroVideoUrl);
            outroDurationInFrames = Math.max(
              1,
              Math.round(metadata.durationInSeconds * FPS),
            );
          }

          return {
            durationInFrames: aiFrames + outroDurationInFrames,
            props: {
              ...props,
              outroDurationInFrames,
            },
          };
        }}
      />
    </>
  );
};
