import { BlurMask, Group, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

interface ProjectileData {
  id: number;
  x: number;
  y: number;
  rot: number;
  vx: number;
  vy: number;
  av: number;
  active: boolean;
}

interface RockProps {
  index: number;
  projectiles: SharedValue<ProjectileData[]>;
}
interface RockUIProps {
  blur?: number;
}

export const Rock: React.FC<RockProps> = ({ index, projectiles }) => {
  // Read specific active state safely on the UI thread
  const isActive = useDerivedValue(() => projectiles.value[index]?.active ?? false);

  const blurRadius = useMemo(() => {
    const p = projectiles.value[index];
    if (!p) return 0;
    const speed = Math.hypot(p.vx, p.vy);
    return speed < 300 ? 0 : Math.min((speed - 300) / 800, 1) * 6;
  }, [projectiles, index]);

  return (
    <Group opacity={useDerivedValue(() => (isActive.value ? 1 : 0))}>
      <Group
        matrix={useDerivedValue(() => {
          const matrix = Skia.Matrix();
          const p = projectiles.value[index];
          if (p) {
            matrix.translate(p.x, p.y);
            matrix.rotate(p.rot);
          }
          return matrix;
        })}
      >
        <RockUI blur={blurRadius} />
      </Group>
    </Group>
  );
};

export const RockUI: React.FC<RockUIProps> = ({ blur = 0 }) => {
  // Read specific active state safely on the UI thread

  const baseStonePath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.moveTo(-18, -6);
    path.cubicTo(-22, -16, -6, -22, 4, -21);
    path.cubicTo(16, -20, 22, -10, 21, 2);
    path.cubicTo(19, 14, 11, 21, -2, 19);
    path.cubicTo(-15, 18, -21, 8, -18, -6);
    path.close();
    return path;
  });

  const leftCraterFacet = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.moveTo(-18, -6);
    path.cubicTo(-12, -10, -2, 2, -4, 10);
    path.cubicTo(-6, 14, -15, 12, -17, 4);
    path.close();
    return path;
  });

  const centerCraterFacet = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.moveTo(6, -12);
    path.cubicTo(12, -10, 12, -7, 11, -3);
    path.cubicTo(10, 4, 7, 2, 4, 0);
    path.cubicTo(3, -3, 3, -7, 6, -12);
    path.close();
    return path;
  });

  const stonePitsPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.moveTo(2, 12); path.lineTo(5, 11);
    path.addOval({ x: -10, y: 5, width: 1.5, height: 2.5, });
    path.addOval({ x: 13, y: 2, width: 2, height: 4.5, });
    path.addOval({ x: -2, y: -14, width: 3, height: 1.8, });
    return path;
  });
  const blurRadius = useDerivedValue(() => blur);
  const globalSphereGradStart = vec(-5, -22);
  const globalSphereGradEnd = vec(5, 20);

  return (
    <>
      <Path path={baseStonePath} color="#8F8777" style="fill">
        <BlurMask blur={blurRadius} style="normal" />
      </Path>
      <Path path={baseStonePath} style="fill">
        <LinearGradient
          start={globalSphereGradStart}
          end={globalSphereGradEnd}
          colors={["#E3DACF", "#C2B8AA", "#91877A", "#5E564D"]}
        />
      </Path>
      <Path path={leftCraterFacet} color="rgba(94, 86, 77, 0.4)" style="fill" />
      <Path path={leftCraterFacet} color="rgba(255, 255, 255, 0.25)" style="stroke" strokeWidth={1} />
      <Path path={centerCraterFacet} color="rgba(242, 235, 225, 0.3)" style="fill" />
      <Path path={centerCraterFacet} color="rgba(64, 57, 50, 0.35)" style="stroke" strokeWidth={1} />
      <Path path={stonePitsPath} color="#615A50a9" style="stroke" strokeWidth={2} strokeCap="round" />
      <Path path={baseStonePath} color="rgba(66, 60, 54, 0.65)" style="stroke" strokeWidth={1} strokeJoin="round" />
    </>
  );
};