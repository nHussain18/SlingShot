import { Group, Skia } from "@shopify/react-native-skia";
import React from "react";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";
import { Rock, RockUI } from "./Rock";

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

interface RockProjectileProps {
  pullX: SharedValue<number>;
  pullY: SharedValue<number>;
  projectiles: SharedValue<ProjectileData[]>;
  rockLoadingOpacity: SharedValue<number>; // Received here
}

export const RockProjectile: React.FC<RockProjectileProps> = ({
  pullX,
  pullY,
  projectiles,
  rockLoadingOpacity,
}) => {

  return (
    <>
      {/* 1. FLIGHT PROJECTILE INSTANCE RENDER POOL */}
      {projectiles.value.map((_, i) => (
        <Rock key={i} index={i} projectiles={projectiles} />
      ))}

      {/* 2. STAGING CHAMBER ROCK (Fades out when launched, scales/fades back in upon reload timer completion) */}
      <Group
        opacity={rockLoadingOpacity}
        matrix={useDerivedValue(() => {
          const matrix = Skia.Matrix();
          matrix.translate(pullX.value, pullY.value);
          // Scale down slightly if opacity drops to enhance loading weight aesthetics
          const scaleFactor = 0.4 + (rockLoadingOpacity.value * 0.6);
          matrix.scale(scaleFactor, scaleFactor);
          matrix.rotate((pullX.value - 200) * 0.002);
          return matrix;
        })}
      >
        <RockUI />
      </Group>
    </>
  );
};