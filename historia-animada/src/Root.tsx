// Composición de la plantilla: «Video» monta un plan.json anclado a la voz (src/historia/VideoTerra.tsx).
import React from "react";
import { Composition } from "remotion";
import { FPS } from "./estilo";
import { calcularVideoTerra, VideoTerra } from "./historia/VideoTerra";

export const Root: React.FC = () => (
  <>
    <Composition id="Video" component={VideoTerra} calculateMetadata={calcularVideoTerra} durationInFrames={300} fps={FPS} width={1920} height={1080} defaultProps={{ id: "historia-1", pista: "todo" as const }} />
  </>
);
