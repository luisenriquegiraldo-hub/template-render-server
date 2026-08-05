import { Composition } from "remotion";
import { FabricaVideo, fabricaVideoSchema, FPS } from "./FabricaVideo";

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
        // calculateMetadata lo recalcula en cada render segun la suma de escenas.
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
        }}
        calculateMetadata={async ({ props }) => {
          const totalSeg = props.scenes.reduce(
            (sum, scene) => sum + scene.durationSeg,
            0,
          );

          return {
            durationInFrames: Math.max(1, Math.round(totalSeg * FPS)),
          };
        }}
      />
    </>
  );
};
