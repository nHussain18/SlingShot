import { Group, Path, Skia } from "@shopify/react-native-skia";
import React from "react";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

export interface BirdData {
  id: number; x: number; y: number; active: boolean; wingFlap: number; targetY: number; speed: number; phase: number;
}

interface BirdTargetsProps {
  birds: SharedValue<BirdData[]>;
}

interface SingleBirdProps {
  index: number;
  birds: SharedValue<BirdData[]>;
}

// 1. Separate sub-component to safely isolate Reanimated hooks per bird instance
const SingleBird: React.FC<SingleBirdProps> = ({ index, birds }) => {
  // Read specific state properties safely on the UI thread
  const isActive = useDerivedValue(() => birds.value[index]?.active ?? false);
  const flapValue = useDerivedValue(() => birds.value[index]?.wingFlap ?? 0);

  // Dynamic path calculation on the UI thread based on the flap value
  const birdPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const wingFlap = flapValue.value; // Oscillates between 0 and 1

    // Body and head
    path.moveTo(-3, -4);                // Head top
    path.quadTo(0, -6, 3, -4);          // Head rounded
    path.lineTo(4, -2);                 // Neck
    path.quadTo(5, 0, 4, 3);            // Back body curve
    path.lineTo(2, 4);                  // Tail base
    path.quadTo(-2, 5, -4, 3);          // Tail point
    path.lineTo(-4, 0);                 // Back to body

    // Left wing (flapping down with wingFlap value)
    path.moveTo(0, -1);                 // Wing base
    path.quadTo(-12, -8 - wingFlap * 6, -20, -4 - wingFlap * 3); // Wing sweep
    path.quadTo(-18, 0, -12, 3);        // Wing trailing edge
    path.quadTo(-4, 2, 0, -1);          // Back to body

    // Right wing (flapping down with wingFlap value)
    path.moveTo(0, -1);                 // Wing base
    path.quadTo(12, -8 - wingFlap * 6, 20, -4 - wingFlap * 3);  // Wing sweep
    path.quadTo(18, 0, 12, 3);          // Wing trailing edge
    path.quadTo(4, 2, 0, -1);           // Back to body

    // Beak
    path.moveTo(4, -3);
    path.lineTo(8, -3);
    path.lineTo(4, -1);

    return path;
  });

  return (
    <Group
      opacity={useDerivedValue(() => (isActive.value ? 1 : 0))}
      matrix={useDerivedValue(() => {
        const matrix = Skia.Matrix();
        const bird = birds.value[index];
        if (bird) {
          matrix.translate(bird.x, bird.y);
        }
        return matrix;
      })}
    >
      <Path
        path={birdPath}
        color="#F5F5F5" // Off-white seagull body
        style="fill"
      />
      <Path
        path={birdPath}
        color="#666666" // Gray outline for realism
        style="stroke"
        strokeWidth={0.5}
      />
    </Group>
  );
};

// 2. Main wrapper rendering the immutable instances pool
export const BirdTargets: React.FC<BirdTargetsProps> = ({ birds }) => {
  return (
    <>
      {birds.value.map((_, index) => (
        <SingleBird key={index} index={index} birds={birds} />
      ))}
    </>
  );
};