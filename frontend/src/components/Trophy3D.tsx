"use client";

import { Suspense, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Environment, Center, ContactShadows, Sparkles } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

type Props = {
  className?: string;
  /** Vitesse de base (rad/s) si `spinSpeedRef` absent. */
  spinSpeed?: number;
  /** Ref pilotée par le parent (ex: scroll velocity) qui override `spinSpeed`. */
  spinSpeedRef?: MutableRefObject<number>;
  /** Cible d'inclinaison sur X (pitch, avant/arrière), en rad. Lissée par lerp. */
  tiltRef?: MutableRefObject<number>;
  /** Cible d'inclinaison sur Z (roll, gauche/droite), en rad. Lissée par lerp. */
  rollRef?: MutableRefObject<number>;
  /** Progression globale du scroll (0-1), pilotée par GSAP ScrollTrigger.
   *  Quand fourni, les keyframes de position/rotation/scale sont pilotés
   *  par cette valeur plutôt que par le système zone/anchorY d'origine. */
  scrollProgressRef?: MutableRefObject<number>;
};

/* ─── Keyframes scroll-driven ───────────────────────────────────────────
   Chaque keyframe définit l'état du trophée à un point de scroll progress.
   L'interpolation entre keyframes utilise un smoothStep (Hermite) pour
   créer des transitions douces avec des paliers naturels.

   rotY = rotation continue du spin du trophée (additive, pas absolu)
   pitch/roll = inclinaisons 3D pilotées par la vélocité du scroll
   x, y = position dans le canvas Three.js (unités Three.js, pas vw/px)
   scale = scale uniforme
*/
type Keyframe = {
  at: number; // scroll progress 0-1
  x: number;
  y: number;
  z: number;
  scale: number;
  baseRotY: number; // rotation Y de base à cette keyframe (les "pauses")
  baseRotZ: number; // TILT gauche/droite
  baseRotX: number; // TILT avant/arrière
};

/* ─── Espace visible dans le canvas ────────────────────────────────────
   Caméra : position (0, 0.3, 5.2), fov 32°
   À z=0 (plan du modèle), dist caméra ≈ 5.2
   Demi-hauteur visible = 5.2 × tan(16°) ≈ 1.49
   Ratio 16:9 → demi-largeur ≈ 1.49 × 1.78 ≈ 2.65
   Centre optique y ≈ 0.3 (légèrement décalé vers le haut)

   Les keyframes x restent dans [-2.2, 2.2] et y dans [-1.1, 1.4]
   pour garantir que le trophée est toujours visible.
*/
const KEYFRAMES: Keyframe[] = [
  // Hero : à droite du titre, penchée esthétiquement
  { at: 0.0,  x:  1.3, y: -0.1, z: 0.0, scale: 0.70, baseRotY: 0,             baseRotZ: -0.25, baseRotX: 0.1 },
  // Transition vers Exp : revient avec un léger mouvement
  { at: 0.18, x:  0.0, y:  0.1, z: 0.4, scale: 0.65, baseRotY: Math.PI * 0.3, baseRotZ:  0.0,  baseRotX: 0.05 },
  // Exp : à gauche du contenu, inclinée vers la gauche
  { at: 0.32, x: -1.3, y: -0.1, z: 0.2, scale: 0.60, baseRotY: Math.PI * 0.5, baseRotZ:  0.25, baseRotX: 0.1 },
  // Transition Stats : remonte au centre
  { at: 0.48, x:  0.0, y:  0.6, z: 0.8, scale: 0.45, baseRotY: Math.PI * 0.8, baseRotZ:  0.0,  baseRotX: 0.15 },
  // Stats : discrète, face écran
  { at: 0.58, x:  0.0, y:  0.7, z: 0.6, scale: 0.40, baseRotY: Math.PI,       baseRotZ:  0.0,  baseRotX: 0.2 },
  // Transition Stade : repousse à droite
  { at: 0.72, x:  1.4, y: -0.3, z: -0.3, scale: 0.55, baseRotY: Math.PI * 1.5, baseRotZ: -0.2,  baseRotX: 0.05 },
  // Stade : à droite, visible
  { at: 0.85, x:  1.3, y:  0.0, z: -0.2, scale: 0.55, baseRotY: Math.PI * 1.8, baseRotZ: -0.25, baseRotX: 0.1 },
  // CTA : revient au centre, droite et héroïque
  { at: 1.0,  x:  0.0, y: -0.2, z: 0.3, scale: 0.80, baseRotY: Math.PI * 2,   baseRotZ:  0.0,  baseRotX: -0.05 },
];

/* Smooth step (Hermite interpolation), transition douce entre keyframes */
function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/* Interpole les keyframes pour un progress donné */
function interpolateKeyframes(progress: number) {
  // Trouver les deux keyframes encadrantes
  let lower = KEYFRAMES[0];
  let upper = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (progress >= KEYFRAMES[i].at && progress <= KEYFRAMES[i + 1].at) {
      lower = KEYFRAMES[i];
      upper = KEYFRAMES[i + 1];
      break;
    }
  }

  const range = upper.at - lower.at;
  const localProgress = range === 0 ? 0 : (progress - lower.at) / range;
  // Easing premium : smoothStep pour les paliers naturels
  const t = smoothStep(0, 1, localProgress);

  return {
    x: lower.x + (upper.x - lower.x) * t,
    y: lower.y + (upper.y - lower.y) * t,
    z: lower.z + (upper.z - lower.z) * t,
    scale: lower.scale + (upper.scale - lower.scale) * t,
    baseRotY: lower.baseRotY + (upper.baseRotY - lower.baseRotY) * t,
    baseRotZ: lower.baseRotZ + (upper.baseRotZ - lower.baseRotZ) * t,
    baseRotX: lower.baseRotX + (upper.baseRotX - lower.baseRotX) * t,
  };
}

function SpinningTrophy({
  spinSpeed = 0.15,
  spinSpeedRef,
  tiltRef,
  rollRef,
  scrollProgressRef,
}: {
  spinSpeed?: number;
  spinSpeedRef?: MutableRefObject<number>;
  tiltRef?: MutableRefObject<number>;
  rollRef?: MutableRefObject<number>;
  scrollProgressRef?: MutableRefObject<number>;
}) {
  const rootGroup = useRef<THREE.Group>(null);
  const spinGroup = useRef<THREE.Group>(null);
  // État lissé pour le dampening premium
  const smooth = useRef({ x: 1.3, y: -0.1, z: 0.0, scale: 0.7, baseRotY: 0, baseRotZ: -0.25, baseRotX: 0.1 });

  useFrame((_, delta) => {
    if (!rootGroup.current || !spinGroup.current) return;

    // Spin continu (toujours actif) avec boost de scroll
    const s = spinSpeedRef?.current ?? spinSpeed;

    if (scrollProgressRef?.current !== undefined) {
      const target = interpolateKeyframes(scrollProgressRef.current);
      // Lerp avec dampening premium (0.04 = très fluide, lag décontracté)
      const lf = 1 - Math.pow(0.001, delta); // ~0.08/frame à 60fps
      smooth.current.x += (target.x - smooth.current.x) * lf * 3;
      smooth.current.y += (target.y - smooth.current.y) * lf * 3;
      smooth.current.z += (target.z - smooth.current.z) * lf * 3;
      smooth.current.scale += (target.scale - smooth.current.scale) * lf * 2;
      smooth.current.baseRotY += (target.baseRotY - smooth.current.baseRotY) * lf * 2;
      smooth.current.baseRotZ += (target.baseRotZ - smooth.current.baseRotZ) * lf * 2;
      smooth.current.baseRotX += (target.baseRotX - smooth.current.baseRotX) * lf * 2;

      rootGroup.current.position.x = smooth.current.x;
      rootGroup.current.position.y = smooth.current.y;
      rootGroup.current.position.z = smooth.current.z;
      rootGroup.current.scale.setScalar(smooth.current.scale);

      // Rotation Y uniquement sur le sous-groupe du modèle.
      // Cela évite l'effet d'orbite et garde une rotation sur soi-même.
      spinGroup.current.rotation.y += delta * s;
    } else {
      // Fallback : comportement original sans scroll progress
      spinGroup.current.rotation.y += delta * s;
    }

    // Tilt (pitch) et roll : toujours pilotés par velocity + inclinaison naturelle via la position (keyframes)
    const targetPitch = (tiltRef?.current || 0) + smooth.current.baseRotX;
    rootGroup.current.rotation.x += (targetPitch - rootGroup.current.rotation.x) * 0.06;

    const targetRoll = (rollRef?.current || 0) + smooth.current.baseRotZ;
    rootGroup.current.rotation.z += (targetRoll - rootGroup.current.rotation.z) * 0.08;
  });

  return (
    <group ref={rootGroup}>
      <TrophyAura />
      <group ref={spinGroup}>
        <TrophyMesh />
      </group>
    </group>
  );
}

function TrophyMesh() {
  const gltf = useLoader(
    GLTFLoader,
    "/models/trophy/FIFA_World_Cup_Trophy_-_2022.gltf"
  );

  gltf.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#E8B923"),
        metalness: 1,
        roughness: 0.22,
        envMapIntensity: 1.5,
      });
      const oldMat = obj.material as THREE.MeshStandardMaterial | undefined;
      if (oldMat?.normalMap) mat.normalMap = oldMat.normalMap;
      if (oldMat?.bumpMap)   mat.bumpMap   = oldMat.bumpMap;
      obj.material = mat;
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return (
    <Center>
      <primitive object={gltf.scene} scale={1.5} />
    </Center>
  );
}

function TrophyAura() {
  return (
    <group position={[0, 0.4, -0.6]}>
      <Sparkles
        count={150}
        scale={[3.0, 4.0, 2.0]}
        size={3.5}
        speed={0.6}
        color="#fbbf24"
        opacity={0.9}
        noise={[0.2, 0.2, 0.2]}
      />
      <pointLight distance={6} intensity={6.0} color="#fbbf24" />
    </group>
  );
}

export function Trophy3D({ className, spinSpeed, spinSpeedRef, tiltRef, rollRef, scrollProgressRef }: Props) {
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.3, 5.2], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[4, 5, 3]}
          intensity={1.9}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-4, 2, -3]} intensity={0.7} color="#22d3ee" />
        <pointLight position={[0, -2, 2]} intensity={0.9} color="#fbbf24" />

        <Suspense fallback={null}>
          <SpinningTrophy
            spinSpeed={spinSpeed}
            spinSpeedRef={spinSpeedRef}
            tiltRef={tiltRef}
            rollRef={rollRef}
            scrollProgressRef={scrollProgressRef}
          />
          <Environment preset="studio" />
          <ContactShadows
            position={[0, -1.8, 0]}
            opacity={0.5}
            scale={7}
            blur={2.6}
            far={3}
            color="#000000"
          />
        </ Suspense>
      </Canvas>
    </div>
  );
}