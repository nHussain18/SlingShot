import { BlurMask, Circle, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import React from "react";
import type { SharedValue } from "react-native-reanimated";
import {
  useDerivedValue
} from "react-native-reanimated";

interface SlingshotRiggingProps {
  pullX: SharedValue<number>;
  pullY: SharedValue<number>;
  leftAnchorX: number;
  rightAnchorX: number;
  restY: number;
  canvasWidth: number;
  anchorY: number;
  forkHeight: number;
  baseWidth: number;
  pouchWidth: number;
  pouchHeight: number;
}

export const SlingshotRigging: React.FC<SlingshotRiggingProps> = ({
  pullX, pullY, leftAnchorX, rightAnchorX, restY, canvasWidth, anchorY, forkHeight, baseWidth, pouchWidth, pouchHeight
}) => {
  const restX = canvasWidth / 2;
  const DEFAULT_REST_Y = restY + 25;

  // DYNAMIC SLACK & TENSION CALCULATION
  const slackSettings = useDerivedValue(() => {
    const dx = pullX.value - restX;
    const dy = pullY.value - DEFAULT_REST_Y;
    const currentPullDist = Math.hypot(dx, dy);
    const isOvershootingUpward = pullY.value < restY;

    let sagAmount = 0;
    let strokeWidth = 7.5;
    let pouchCupFactor = 0;

    if (isOvershootingUpward) {
      sagAmount = (restY - pullY.value) * -0.65;
      strokeWidth = 8.5;
      pouchCupFactor = 2;
    } else if (currentPullDist < 60) {
      sagAmount = (1 - currentPullDist / 60) * 18;
      strokeWidth = 7.5;
      pouchCupFactor = 4;
    } else {
      sagAmount = 0;
      strokeWidth = Math.max(4, 7.5 - (currentPullDist / 50));
      pouchCupFactor = Math.min(14, 4 + (currentPullDist / 15));
    }

    return { sagAmount, strokeWidth, pouchCupFactor };
  });

  // ELASTIC BAND & LEATHER POUCH PATHS
  const leftBandPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const targetX = pullX.value - pouchWidth / 2;
    const targetY = pullY.value;
    path.moveTo(leftAnchorX, restY);
    const ctrlX = (leftAnchorX + targetX) / 2;
    const ctrlY = (restY + targetY) / 2 + slackSettings.value.sagAmount;
    path.quadTo(ctrlX, ctrlY, targetX, targetY);
    return path;
  });

  const rightBandPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const startX = pullX.value + pouchWidth / 2;
    const startY = pullY.value;
    path.moveTo(startX, startY);
    const ctrlX = (startX + rightAnchorX) / 2;
    const ctrlY = (startY + restY) / 2 + slackSettings.value.sagAmount;
    path.quadTo(ctrlX, ctrlY, rightAnchorX, restY);
    return path;
  });

  const dynamicPouchPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const halfW = pouchWidth / 2; const halfH = pouchHeight / 2;
    const cup = slackSettings.value.pouchCupFactor;
    const leftX = pullX.value - halfW; const rightX = pullX.value + halfW;
    const topY = pullY.value - halfH; const bottomY = pullY.value + halfH;

    path.moveTo(leftX, topY);
    path.quadTo(pullX.value, topY + cup, rightX, topY);
    path.lineTo(rightX, bottomY);
    path.quadTo(pullX.value, bottomY + cup, leftX, bottomY);
    path.close();
    return path;
  });

  const pouchInnerShadowPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const halfW = pouchWidth / 2; const halfH = pouchHeight / 2;
    const cup = slackSettings.value.pouchCupFactor;
    path.moveTo(pullX.value - halfW, pullY.value - halfH);
    path.quadTo(pullX.value, pullY.value - halfH + cup, pullX.value + halfW, pullY.value - halfH);
    path.quadTo(pullX.value, pullY.value + cup * 0.3, pullX.value - halfW, pullY.value - halfH);
    path.close();
    return path;
  });

  // RAW ROUGH STICK ENGINE
  const rawBranchPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const baseBottom = anchorY + forkHeight;
    const baseCenterX = canvasWidth / 2;
    const jointY = anchorY + 70;

    // LEFT PRONG: Segmented with crooked offsets
    path.moveTo(leftAnchorX, restY);
    path.lineTo(leftAnchorX + 3, restY + 12);
    path.lineTo(baseCenterX - 12, jointY - 10);
    path.lineTo(baseCenterX, jointY);

    // RIGHT PRONG: Crooked path down to joint
    path.moveTo(rightAnchorX, restY);
    path.lineTo(rightAnchorX - 4, restY + 15);
    path.lineTo(baseCenterX + 10, jointY - 12);
    path.lineTo(baseCenterX, jointY);

    // MAIN TRUNK: Jagged texture down to base
    path.moveTo(baseCenterX, jointY);
    path.lineTo(baseCenterX - 3, jointY + 25); // Slight twist in wood
    path.lineTo(baseCenterX + 1, jointY + 55);
    path.lineTo(baseCenterX, baseBottom);

    // BASE END: Jagged rough broken foot
    path.moveTo(baseCenterX - baseWidth / 2, baseBottom + 1);
    path.lineTo(baseCenterX - baseWidth / 4, baseBottom + 3);
    path.lineTo(baseCenterX + baseWidth / 4, baseBottom - 1);
    path.lineTo(baseCenterX + baseWidth / 2, baseBottom + 2);

    return path;
  });

  const barkTextureLines = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const baseCenterX = canvasWidth / 2;
    const jointY = anchorY + 70;

    path.moveTo(baseCenterX - 2, jointY + 20);
    path.cubicTo(baseCenterX - 6, jointY + 24, baseCenterX - 4, jointY + 30, baseCenterX - 1, jointY + 26);

    path.moveTo(leftAnchorX + 4, restY + 15);
    path.lineTo(baseCenterX - 6, jointY - 5);

    return path;
  });

  // Muted organic bark environment lighting vector parameters
  const woodGradStart = vec(canvasWidth / 2, anchorY);
  const woodGradEnd = vec(canvasWidth / 2, anchorY + forkHeight);

  return (
    <>
      {/* LAYER A: Ambient Frame Drop Shadow */}
      <Path
        path={rawBranchPath}
        color="rgba(10, 8, 6, 0.35)"
        style="stroke"
        strokeWidth={17}
        strokeCap="round"
        strokeJoin="round"
      >
        <BlurMask blur={5} style="normal" />
      </Path>

      {/* LAYER B: Raw Branch Core Base (Earthy, desaturated forest bark profile) */}
      <Path
        path={rawBranchPath}
        style="stroke"
        strokeWidth={13}
        strokeCap="round"
        strokeJoin="round"
      >
        <LinearGradient
          start={woodGradStart}
          end={woodGradEnd}
          colors={["#695E53", "#52473D", "#3B3229"]} // Muted ash-brown, dry soil, deep bark shadow
        />
      </Path>

      {/* LAYER C: Volumetric Shadow Overlay (Enhances organic branch contouring) */}
      <Path
        path={rawBranchPath}
        color="rgba(28, 22, 17, 0.3)"
        style="stroke"
        strokeWidth={13}
        strokeCap="round"
        strokeJoin="round"
      />

      {/* LAYER D: Rough Bark Fibers & Trunk Knots */}
      <Path
        path={barkTextureLines}
        color="#241E19"
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
      />
      {/* LAYER E: Dark Rough Frame Silhouettes */}
      <Path
        path={rawBranchPath}
        color="rgba(43, 36, 30, 0.8)"
        style="stroke"
        strokeWidth={13}
        strokeCap="round"
        strokeJoin="round"
      />

      <Circle cx={leftAnchorX} cy={restY} r={7.5} color="#4A301A" style="fill" />
      <Circle cx={rightAnchorX} cy={restY} r={7.5} color="#4A301A" style="fill" />

      {/* ── Left band ── */}
      <Path
        path={leftBandPath}
        color="#A31D1D"
        style="stroke"
        strokeWidth={useDerivedValue(() => slackSettings.value.strokeWidth)}
        strokeCap="round"
        strokeJoin="round"
      />

      {/* ── right band ── */}
      <Path
        path={rightBandPath}
        color="#B82525"
        style="stroke"
        strokeWidth={useDerivedValue(() => slackSettings.value.strokeWidth)}
        strokeCap="round"
        strokeJoin="round"
      />
      <Pouch
        dynamicPouchPath={dynamicPouchPath}
        pouchInnerShadowPath={pouchInnerShadowPath}
        pullX={pullX}
        pullY={pullY}
        pouchWidth={pouchWidth}
      />
    </>
  );
};

const Pouch = ({ dynamicPouchPath, pouchInnerShadowPath, pullX, pullY, pouchWidth }: { dynamicPouchPath: any; pouchInnerShadowPath: any; pullX: any; pullY: any; pouchWidth: number }) => {
  return (
    <>
      <Path path={dynamicPouchPath} color="#613B1B" style="fill" />
      <Path path={pouchInnerShadowPath} color="rgba(38, 22, 9, 0.5)" style="fill" />
      <Path path={dynamicPouchPath} color="#3B230F" style="stroke" strokeWidth={1.5} strokeJoin="round" />
      <Path path={pouchInnerShadowPath} color="rgba(255, 255, 255, 0.15)" style="stroke" strokeWidth={1} strokeJoin="round" />

      <Circle cx={useDerivedValue(() => pullX.value - pouchWidth / 2 + 3)} cy={pullY} r={2.5} color="#9E9E9E" />
      <Circle cx={useDerivedValue(() => pullX.value + pouchWidth / 2 - 3)} cy={pullY} r={2.5} color="#9E9E9E" />
    </>
  )
}