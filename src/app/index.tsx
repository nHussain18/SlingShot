import { RockProjectile } from "@/components/RockProjectile";
import { SlingshotRigging } from "@/components/SlingshotRigging";
import { Canvas, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useDerivedValue, useFrameCallback, useSharedValue, withSpring } from "react-native-reanimated";

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

const RESET_SPRING_CONFIG = { damping: 20, stiffness: 120, mass: 1 };
const SNAP_SPRING_CONFIG = { damping: 6, stiffness: 450, mass: 0.35 };

export default function Index() {
  const { width: canvasWidth, height: canvasHeight } = useWindowDimensions();

  const anchorY = canvasHeight * 0.6;
  const leftAnchorX = canvasWidth / 2 - ANCHOR_INSET;
  const rightAnchorX = canvasWidth / 2 + ANCHOR_INSET;
  const restX = canvasWidth / 2;
  const restY = anchorY + DEFAULT_SAG;

  const pullX = useSharedValue(restX);
  const pullY = useSharedValue(restY);
  const projX = useSharedValue(restX);
  const projY = useSharedValue(restY);
  const projVx = useSharedValue(0);
  const projVy = useSharedValue(0);
  const projRotation = useSharedValue(0);
  const angularVelocity = useSharedValue(0);

  const isLaunched = useSharedValue(false);
  const isDraggingStone = useSharedValue(false);
  const launchThresholdReached = useSharedValue(false);

  const triggerSelectionHaptic = () => Haptics.selectionAsync();
  const triggerImpactHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const triggerSuccessHaptic = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  const resetProjectile = () => {
    "worklet";
    projX.value = restX; projY.value = restY;
    pullX.value = restX; pullY.value = restY;
    projVx.value = 0; projVy.value = 0;
    projRotation.value = 0; angularVelocity.value = 0;
    isLaunched.value = false; isDraggingStone.value = false;
  };

  useFrameCallback((frameInfo) => {
    if (!isLaunched.value) return;
    const dt = Math.min((frameInfo.timeSincePreviousFrame ?? 16.6) / 1000, 0.03);
    const speed = Math.hypot(projVx.value, projVy.value);

    if (speed > 0.1) {
      projVx.value -= DRAG_COEFFICIENT * speed * projVx.value * dt;
      projVy.value -= DRAG_COEFFICIENT * speed * projVy.value * dt;
    }
    projVy.value += GRAVITY * dt;
    projX.value += projVx.value * dt;
    projY.value += projVy.value * dt;
    projRotation.value += angularVelocity.value * dt;

    if (
      projY.value > canvasHeight + PROJECTILE_RADIUS * 2 ||
      projX.value < -PROJECTILE_RADIUS * 2 ||
      projX.value > canvasWidth + PROJECTILE_RADIUS * 2
    ) {
      resetProjectile();
    }
  });

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      if (isLaunched.value) return;
      if (Math.hypot(e.x - projX.value, e.y - projY.value) <= 55) {
        isDraggingStone.value = true;
        runOnJS(triggerSelectionHaptic)();
      }
    })
    .onUpdate((e) => {
      if (isLaunched.value || !isDraggingStone.value) return;

      let dx = e.translationX;
      let dy = e.translationY;

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
      projX.value = restX + dx; projY.value = restY + dy;
    })
    .onEnd(() => {
      if (isLaunched.value || !isDraggingStone.value) return;
      const dx = restX - pullX.value; const dy = restY - pullY.value;
      const pullDistance = Math.hypot(dx, dy);
      launchThresholdReached.value = false;

      if (pullDistance > 28) {
        pullX.value = withSpring(restX, SNAP_SPRING_CONFIG);
        pullY.value = withSpring(restY, SNAP_SPRING_CONFIG);

        const velocityMultiplier = pullDistance / 14;
        projVx.value = dx * velocityMultiplier;
        projVy.value = dy * velocityMultiplier;
        angularVelocity.value = (dx >= 0 ? 1 : -1) * (pullDistance * 0.07);
        isLaunched.value = true;
        runOnJS(triggerSuccessHaptic)();
      } else {
        pullX.value = withSpring(restX, RESET_SPRING_CONFIG);
        pullY.value = withSpring(restY, RESET_SPRING_CONFIG);
        projX.value = withSpring(restX, RESET_SPRING_CONFIG);
        projY.value = withSpring(restY, RESET_SPRING_CONFIG);
        isDraggingStone.value = false;
        runOnJS(triggerSelectionHaptic)();
      }
    });

  const projectileBlur = useDerivedValue(() => {
    if (!isLaunched.value) return 0;
    const speed = Math.hypot(projVx.value, projVy.value);
    return speed < 300 ? 0 : Math.min((speed - 300) / 800, 1) * 6;
  });

  // ── BACKGROUND PRINITIVES ──────────────────────────────────────────────────
  const skyBackgroundPath = Skia.Path.Make().addRect(Skia.XYWHRect(0, 0, canvasWidth, canvasHeight));

  // Distant Soft Mountain Range Path
  const mountainsPath = React.useMemo(() => {
    const path = Skia.Path.Make();
    const midY = canvasHeight * 0.62;
    path.moveTo(0, canvasHeight);
    path.lineTo(0, midY);
    path.lineTo(canvasWidth * 0.25, midY - 40);
    path.lineTo(canvasWidth * 0.5, midY + 10);
    path.lineTo(canvasWidth * 0.75, midY - 60);
    path.lineTo(canvasWidth, midY - 10);
    path.lineTo(canvasWidth, canvasHeight);
    path.close();
    return path;
  }, [canvasWidth, canvasHeight]);

  // Closer Ground Hill Path sitting right under the base of the stick
  const groundPath = React.useMemo(() => {
    const path = Skia.Path.Make();
    const groundY = anchorY + FORK_HEIGHT - 5;
    path.moveTo(0, canvasHeight);
    path.lineTo(0, groundY + 15);
    path.quadTo(canvasWidth / 2, groundY - 10, canvasWidth, groundY + 20);
    path.lineTo(canvasWidth, canvasHeight);
    path.close();
    return path;
  }, [canvasWidth, canvasHeight, anchorY]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.canvasWrapper}>
          <Canvas style={styles.canvas}>
            {/* 1. SKY GRADIENT */}
            <Path path={skyBackgroundPath} style="fill">
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, canvasHeight)}
                colors={["#7BB6E7", "#B9E0FF", "#E8F0FE"]} // Deep blue down to horizon morning atmospheric glow
              />
            </Path>

            {/* 2. DISTANT SILHOUETTE MOUNTAINS */}
            <Path path={mountainsPath} color="#A2BCE0" style="fill" opacity={0.65} />

            {/* 3. EARTH SURFACE HILL LAYER */}
            <Path path={groundPath} style="fill">
              <LinearGradient
                start={vec(0, anchorY)}
                end={vec(0, canvasHeight)}
                colors={["#93A287", "#738268"]} // Muted grass green down to mossy forest ground tones
              />
            </Path>

            {/* 4. ACTIVE GAMEPLAY OVERLAYS */}
            <SlingshotRigging

              pullX={pullX} pullY={pullY}
              leftAnchorX={leftAnchorX} rightAnchorX={rightAnchorX} restY={anchorY}
              canvasWidth={canvasWidth} anchorY={anchorY} forkHeight={FORK_HEIGHT}
              baseWidth={BASE_WIDTH} pouchWidth={POUCH_WIDTH} pouchHeight={POUCH_HEIGHT}
            />
            <RockProjectile
              projX={projX} projY={projY}
              projRotation={projRotation}
              projectileBlur={projectileBlur}
            />
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#B9E0FF" },
  canvasWrapper: { flex: 1 },
  canvas: { flex: 1 },
});