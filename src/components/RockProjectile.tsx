import { BlurMask, Group, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import React from "react";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

interface RockProjectileProps {
  projX: SharedValue<number>;
  projY: SharedValue<number>;
  projRotation: SharedValue<number>; // New shared value tracking spin angle
  projectileBlur: SharedValue<number>;
}

export const RockProjectile: React.FC<RockProjectileProps> = ({
  projX, projY, projRotation, projectileBlur
}) => {

  // GEOMETRICAL HULL DRAWN AT LOCAL ORIGIN (0,0)
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

  // CONSTANT SPATIAL SHADER BOUNDS
  const globalSphereGradStart = vec(-5, -22);
  const globalSphereGradEnd = vec(5, 20);

  return (
    <Group matrix={useDerivedValue(() => {
      const matrix = Skia.Matrix();
      matrix.translate(projX.value, projY.value);
      matrix.rotate(projRotation.value); // Continuously rotates the rock details
      return matrix;
    })}>
      {/* LAYER 1: Drop Shadow Back Drop */}
      <Path path={baseStonePath} color="#8F8777" style="fill">
        <BlurMask blur={projectileBlur} style="normal" />
      </Path>

      {/* LAYER 2: Main Textured Sphere Body */}
      <Path path={baseStonePath} style="fill">
        <LinearGradient
          start={globalSphereGradStart}
          end={globalSphereGradEnd}
          colors={["#E3DACF", "#C2B8AA", "#91877A", "#5E564D"]}
        />
      </Path>

      {/* LAYER 3: Left Crater Indentation shadow */}
      <Path path={leftCraterFacet} color="rgba(94, 86, 77, 0.4)" style="fill" />
      <Path path={leftCraterFacet} color="rgba(255, 255, 255, 0.25)" style="stroke" strokeWidth={1} />

      {/* LAYER 4: Center-Right Fissures */}
      <Path path={centerCraterFacet} color="rgba(242, 235, 225, 0.3)" style="fill" />
      <Path path={centerCraterFacet} color="rgba(64, 57, 50, 0.35)" style="stroke" strokeWidth={1} />

      {/* LAYER 5: Micro Surface Pits */}
      <Path path={stonePitsPath} color="#615A50a9" style="stroke" strokeWidth={2} strokeCap="round" />

      {/* LAYER 6: Outer Contour Border Profile */}
      <Path path={baseStonePath} color="rgba(66, 60, 54, 0.65)" style="stroke" strokeWidth={1} strokeJoin="round" />
    </Group>
  );
};