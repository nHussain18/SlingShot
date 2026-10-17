import { BirdTargets } from "@/components/BirdTargets";
import { RockProjectile } from "@/components/RockProjectile";
import { SlingshotRigging } from "@/components/SlingshotRigging";
import { Canvas, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useFrameCallback, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

const ANCHOR_INSET = 60;
const FORK_HEIGHT = 120;
const BASE_WIDTH = 80;
const PROJECTILE_RADIUS = 18;
const POUCH_WIDTH = 40;
const POUCH_HEIGHT = 20;

const GRAVITY = 950;
const DRAG_COEFFICIENT = 0.0004;
const MAX_PULL = 250;
const DEFAULT_SAG = 25;
const MAX_CONCURRENT_ROCKS = 8;
const MAX_BIRDS = 4;
const RELOAD_DELAY_MS = 1000; // 1.5 seconds gun-style reload delay

const RESET_SPRING_CONFIG = { damping: 20, stiffness: 120, mass: 1 };
const SNAP_SPRING_CONFIG = { damping: 6, stiffness: 450, mass: 0.35 };

interface ProjectileData {
  id: number; x: number; y: number; rot: number; vx: number; vy: number; active: boolean; av: number;
}
interface BirdData {
  id: number; x: number; y: number; active: boolean; wingFlap: number; targetY: number; speed: number; phase: number;
}

const Catapult: React.FC = () => {
  const { width: canvasWidth, height: canvasHeight } = useWindowDimensions();

  const anchorY = canvasHeight * 0.6;
  const leftAnchorX = canvasWidth / 2 - ANCHOR_INSET;
  const rightAnchorX = canvasWidth / 2 + ANCHOR_INSET;
  const restX = canvasWidth / 2;
  const restY = anchorY + DEFAULT_SAG;

  const pullX = useSharedValue(restX);
  const pullY = useSharedValue(restY);

  const projectiles = useSharedValue<ProjectileData[]>(
    Array.from({ length: MAX_CONCURRENT_ROCKS }, (_, i) => ({
      id: i, x: 0, y: 0, rot: 0, vx: 0, vy: 0, av: 0, active: false
    }))
  );

  const birds = useSharedValue<BirdData[]>(
    Array.from({ length: MAX_BIRDS }, (_, i) => ({
      id: i,
      x: -200, // Spawn safely off-screen initially
      y: 0,
      targetY: 120 + i * 45,
      speed: 110 + Math.random() * 60,
      phase: Math.random() * 100,
      wingFlap: 0,
      active: false,
    }))
  );

  const isDraggingStone = useSharedValue(false);
  const launchThresholdReached = useSharedValue(false);

  // ── RELOADING CORE MECHANICS ──────────────────────────────────────────────
  const isReloading = useSharedValue(false);
  const rockLoadingOpacity = useSharedValue(1);
  const reloadProgress = useSharedValue(0);

  const triggerSelectionHaptic = () => Haptics.selectionAsync();
  const triggerImpactHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const triggerSuccessHaptic = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  // Safely transitions states on the main JS execution loop
  const executeReloadSequence = () => {
    reloadProgress.value = 0;
    reloadProgress.value = withTiming(1, { duration: RELOAD_DELAY_MS });
    setTimeout(() => {
      // Snappy fade-in effect when bullet chamber resets
      rockLoadingOpacity.value = withTiming(1, { duration: 250 });
      isReloading.value = false;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // Double crisp mechanical reloaded feel click
    }, RELOAD_DELAY_MS);
  };

  const respawnBird = (bird: BirdData, width: number): BirdData => {
    "worklet"; // <-- CRITICAL: Tells Reanimated this can run on the UI thread
    return {
      ...bird,
      x: width + 50 + Math.random() * 150, // Staggered entry right offscreen
      targetY: 80 + Math.random() * 140,   // Random cruising altitude
      speed: 120 + Math.random() * 70,     // Speed variance
      active: true,
    };
  };

  useFrameCallback((frameInfo) => {
    try{
    // CRITICAL LAYOUT GUARD: Skip frame if dimensions aren't measured yet
    if (canvasWidth === 0 || canvasHeight === 0) return;

    const dt = Math.min((frameInfo.timeSincePreviousFrame ?? 16.6) / 1000, 0.03);
    const elapsed = frameInfo.timeSinceFirstFrame / 1000;

    const updatedPool = projectiles.value.map((rock) => {
      if (!rock.active) return rock;
      let vx = rock.vx; let vy = rock.vy;
      const speed = Math.hypot(vx, vy);
      if (speed > 0.1) {
        vx -= DRAG_COEFFICIENT * speed * vx * dt;
        vy -= DRAG_COEFFICIENT * speed * vy * dt;
      }
      vy += GRAVITY * dt;
      const nextX = rock.x + vx * dt;
      const nextY = rock.y + vy * dt;
      if (nextY > canvasHeight + 100 || nextX < -100 || nextX > canvasWidth + 100) {
        return { ...rock, active: false };
      }
      return { ...rock, x: nextX, y: nextY, vx, vy, rot: rock.rot + rock.av * dt };
    });

    const updatedBirds = birds.value.map((bird) => {
      // If game just started or bird flew off-screen left, respawn it on the right
      if (!bird.active && bird.x < -100) {
        return respawnBird(bird, canvasWidth);
      }
      if (!bird.active) return bird;

      const nextX = bird.x - bird.speed * dt;
      // Elegant wavy cosine arc math relative to its unique cruising altitude phase
      const nextY = bird.targetY + Math.cos(nextX * 0.015 + bird.phase) * 35;
      const flap = Math.sin(elapsed * 18 + bird.id); // Fast fluttering rhythm

      if (nextX < -60) {
        return { ...bird, x: -200, active: false }; // Set up for respawn flag
      }
      return { ...bird, x: nextX, y: nextY, wingFlap: flap };
    });

    // --- C. CRITICAL: Circle-to-Circle Collision Check ---
    updatedPool.forEach((rock) => {
      if (!rock.active) return;

      updatedBirds.forEach((bird) => {
        if (!bird.active) return;

        // Distance formula from center of rock to center of bird
        const distance = Math.hypot(rock.x - bird.x, rock.y - bird.y);
        // Rock radius (18) + Bird bounding thickness box (~16)
        if (distance < 34) {
          bird.active = false;
          bird.x = -200; // Force layout boundary to schedule immediate respawn
          rock.active = false; // Destroy rock on kinetic impact

          // Trigger a crisp, synchronous structural haptic report on the core loop
          runOnJS(triggerSuccessHaptic)();
        }
      });
    });

    projectiles.value = updatedPool;
    birds.value = updatedBirds;
  }
  catch (error) {
    console.error("Error in frame callback:", error);
  }
  });

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      if (isReloading.value) return;

      if (Math.hypot(e.x - pullX.value, e.y - pullY.value) <= 55) {
        isDraggingStone.value = true;
        runOnJS(triggerSelectionHaptic)();
      }
    })
    .onUpdate((e) => {
      if (!isDraggingStone.value || isReloading.value) return;

      let dx = e.translationX; let dy = e.translationY;
      const currentPullDist = Math.hypot(dx, dy);

      if (currentPullDist > MAX_PULL) {
        const angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * MAX_PULL;
        dy = Math.sin(angle) * MAX_PULL;
      }

      if (currentPullDist >= 100 && !launchThresholdReached.value) {
        launchThresholdReached.value = true;
        runOnJS(triggerImpactHaptic)();
      } else if (currentPullDist < 100 && launchThresholdReached.value) {
        launchThresholdReached.value = false;
      }

      pullX.value = restX + dx; pullY.value = restY + dy;
    })
    .onEnd(() => {
      if (!isDraggingStone.value || isReloading.value) return;
      const dx = restX - pullX.value; const dy = restY - pullY.value;
      const pullDistance = Math.hypot(dx, dy);
      launchThresholdReached.value = false;

      if (pullDistance > 28) {
        const velocityMultiplier = pullDistance / 14;
        const poolCopy = [...projectiles.value];
        const freeSlotIndex = poolCopy.findIndex((r) => !r.active);

        if (freeSlotIndex !== -1) {
          poolCopy[freeSlotIndex] = {
            id: freeSlotIndex,
            x: pullX.value,
            y: pullY.value,
            vx: dx * velocityMultiplier,
            vy: dy * velocityMultiplier,
            rot: 0,
            av: (dx >= 0 ? 1 : -1) * (pullDistance * 0.07),
            active: true,
          };
          projectiles.value = poolCopy;
        }

        isReloading.value = true;
        rockLoadingOpacity.value = 0;
        runOnJS(executeReloadSequence)();

        pullX.value = withSpring(restX, SNAP_SPRING_CONFIG);
        pullY.value = withSpring(restY, SNAP_SPRING_CONFIG);
        isDraggingStone.value = false;
        runOnJS(triggerSuccessHaptic)();
      } else {
        pullX.value = withSpring(restX, RESET_SPRING_CONFIG);
        pullY.value = withSpring(restY, RESET_SPRING_CONFIG);
        isDraggingStone.value = false;
        runOnJS(triggerSelectionHaptic)();
      }
    });

  const skyBackgroundPath = Skia.Path.Make().addRect(Skia.XYWHRect(0, 0, canvasWidth, canvasHeight));
  const mountainsPath = React.useMemo(() => {
    if (canvasWidth === 0) return Skia.Path.Make();
    const path = Skia.Path.Make(); const midY = canvasHeight * 0.62;
    path.moveTo(0, canvasHeight).lineTo(0, midY).lineTo(canvasWidth * 0.25, midY - 40).lineTo(canvasWidth * 0.5, midY + 10);
    path.lineTo(canvasWidth * 0.75, midY - 60).lineTo(canvasWidth, midY - 10).lineTo(canvasWidth, canvasHeight);
    path.close(); return path;
  }, [canvasWidth, canvasHeight]);

  const groundPath = React.useMemo(() => {
    if (canvasWidth === 0) return Skia.Path.Make();
    const path = Skia.Path.Make(); const groundY = anchorY + FORK_HEIGHT - 5;
    path.moveTo(0, canvasHeight).lineTo(0, groundY + 15);
    path.quadTo(canvasWidth / 2, groundY - 10, canvasWidth, groundY + 20).lineTo(canvasWidth, canvasHeight);
    path.close(); return path;
  }, [canvasWidth, canvasHeight, anchorY]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.canvasWrapper}>
          <Canvas style={styles.canvas}>
            <Path path={skyBackgroundPath} style="fill">
              <LinearGradient start={vec(0, 0)} end={vec(0, canvasHeight)} colors={["#7BB6E7", "#B9E0FF", "#E8F0FE"]} />
            </Path>
            <Path path={mountainsPath} color="#A2BCE0" style="fill" opacity={0.65} />
            <BirdTargets birds={birds} />
            <Path path={groundPath} style="fill">
              <LinearGradient start={vec(0, anchorY)} end={vec(0, canvasHeight)} colors={["#93A287", "#738268"]} />
            </Path>

            <SlingshotRigging
              pullX={pullX} pullY={pullY}
              leftAnchorX={leftAnchorX} rightAnchorX={rightAnchorX} restY={anchorY}
              canvasWidth={canvasWidth} anchorY={anchorY} forkHeight={FORK_HEIGHT}
              baseWidth={BASE_WIDTH} pouchWidth={POUCH_WIDTH} pouchHeight={POUCH_HEIGHT}
              reloadProgress={reloadProgress}
              isReloading={isReloading}
            />

            <RockProjectile
              pullX={pullX} pullY={pullY}
              projectiles={projectiles}
              rockLoadingOpacity={rockLoadingOpacity}
            />
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#B9E0FF" },
  canvasWrapper: { flex: 1 },
  canvas: { flex: 1 },
});

export default Catapult;