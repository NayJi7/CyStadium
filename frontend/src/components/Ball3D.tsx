"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  Center,
  Sparkles,
  Trail,
  useTexture,
} from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════════
   Ball3D — "Stadium Bounce"
   Ballon qui rebondit dans un mini-stade : ground + tribunes en anneaux
   concentriques, spots stade qui se croisent, ombre projetée dynamique,
   squash & stretch à l'impact, trail trainant et burst de particules.
   ═══════════════════════════════════════════════════════════════════════════ */

const BOUNCE_PERIOD = 1.55; // secondes (rebond complet)
const MAX_HEIGHT = 1.4;     // hauteur max du saut (unités three)
const FLOOR_Y = -1.45;      // y du sol

/* ─── Petit easing "physique" : on monte vite, on descend en accélérant
   (paraboles non-symétriques pour donner le feeling de la gravité) */
function bounceCurve(phase: number): number {
  // phase 0..1
  // on remappe pour que le rebond paraisse plus rapide vers le bas
  const p = phase;
  // arc parabolique de base
  return 1 - Math.pow(2 * p - 1, 2);
}

function BounceBase() {
  // Base de rebond minimaliste : un anneau cyan + un halo doux centré
  // au pied du ballon. Pas de sol, pas de tribunes, pas de réflexion.
  return (
    <group position={[0, FLOOR_Y + 0.002, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.05, 96]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[1.05, 1.18, 96]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function GroundShadow({ heightRef }: { heightRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!meshRef.current) return;
    const h = heightRef.current; // 0..1 (1 = top)
    const s = 1 + 1.05 * (1 - h); // grand au sol, petit en l'air
    meshRef.current.scale.set(s, s, s);
    const m = meshRef.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.55 - 0.42 * h;
  });
  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, FLOOR_Y + 0.005, 0]}
    >
      <circleGeometry args={[0.85, 48]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.5} />
    </mesh>
  );
}

function ImpactBurst({
  impactRef,
}: {
  impactRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!groupRef.current || !matRef.current) return;
    const i = impactRef.current; // 0..1
    groupRef.current.scale.setScalar(0.0001 + i * 1.4);
    matRef.current.opacity = 0.6 * i;
  });
  return (
    <group ref={groupRef} position={[0, FLOOR_Y + 0.01, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.0, 64]} />
        <meshBasicMaterial
          ref={matRef}
          color="#22d3ee"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function BouncingBall({ spinSpeed = 1.1 }: { spinSpeed?: number }) {
  const ballRoot = useRef<THREE.Group>(null);
  const spinGroup = useRef<THREE.Group>(null);
  const trailTarget = useRef<THREE.Mesh>(null);
  const heightRef = useRef(0);
  const impactRef = useRef(0);

  useFrame((state, delta) => {
    if (!ballRoot.current || !spinGroup.current) return;

    const t = state.clock.elapsedTime;
    const phase = (t % BOUNCE_PERIOD) / BOUNCE_PERIOD;
    const arc = bounceCurve(phase); // 0..1
    const y = FLOOR_Y + 0.95 + arc * MAX_HEIGHT;

    ballRoot.current.position.y = y;
    heightRef.current = arc;

    // Squash & stretch — uniquement au contact du sol
    // Détection : phase proche de 0 ou 1 (bord du cycle = impact sol)
    const nearImpact = Math.max(
      0,
      1 - Math.min(phase, 1 - phase) * 12, // 0 sauf à ~8% des extrémités
    );
    impactRef.current = nearImpact;
    const squashY = 1 - nearImpact * 0.28;
    const squashXZ = 1 + nearImpact * 0.18;
    ballRoot.current.scale.set(squashXZ, squashY, squashXZ);

    // Spin multi-axes (donne le feeling caméra trajet)
    spinGroup.current.rotation.x += delta * spinSpeed * 0.45;
    spinGroup.current.rotation.y += delta * spinSpeed * 0.95;
    spinGroup.current.rotation.z += delta * spinSpeed * 0.25;
  });

  return (
    <>
      <GroundShadow heightRef={heightRef} />
      <ImpactBurst impactRef={impactRef} />

      <group ref={ballRoot}>
        {/* Trail derrière la balle */}
        <Trail
          width={1.2}
          length={4}
          color={new THREE.Color("#22d3ee")}
          attenuation={(t) => t * t}
        >
          <mesh ref={trailTarget} visible={false}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial />
          </mesh>
        </Trail>

        {/* Aura locale très diffuse, blanc neutre — pas de teinte */}
        <pointLight intensity={0.4} distance={3.5} color="#ffffff" />

        <group ref={spinGroup}>
          <BallMesh />
        </group>
      </group>
    </>
  );
}

function BallMesh() {
  const obj = useLoader(OBJLoader, "/models/trionda/model_0.obj");
  const [colorMap, normalMap, metallicMap, roughnessMap] = useTexture([
    "/models/trionda/color.png",
    "/models/trionda/normal.png",
    "/models/trionda/metallic.png",
    "/models/trionda/roughness.png",
  ]);

  // Texture officielle Adidas Trionda — pas de couleur appliquée par-dessus,
  // les textures portent toute l'identité visuelle du ballon.
  colorMap.colorSpace = THREE.SRGBColorSpace;

  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.material = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap,
        metalnessMap: metallicMap,
        roughnessMap: roughnessMap,
        metalness: 1.0,
        roughness: 1.0,
        envMapIntensity: 1.2,
      });
      o.castShadow = true;
    }
  });

  return (
    <Center>
      <primitive object={obj} scale={9} />
    </Center>
  );
}

export function Ball3D({
  className,
  spinSpeed = 1.1,
}: {
  className?: string;
  spinSpeed?: number;
}) {
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.6, 6.5], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ pointerEvents: "none" }}
      >
        {/* Éclairage doux : ambient dominant, key light modérée pour éviter
           les hot-spots blancs qui crameraient la texture du ballon. */}
        <ambientLight intensity={1.0} />
        <directionalLight
          position={[5, 9, 4]}
          intensity={0.8}
          color="#ffffff"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={20}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        <directionalLight position={[-4, 4, 3]} intensity={0.4} color="#ffffff" />
        {/* Rim warm gold derrière, très faible — accent stade */}
        <directionalLight
          position={[3, 2, -6]}
          intensity={0.25}
          color="#fbbf24"
        />
        {/* Rim cool cyan derrière, très faible */}
        <directionalLight
          position={[-3, 2, -6]}
          intensity={0.22}
          color="#22d3ee"
        />

        <Suspense fallback={null}>
          <BounceBase />
          <BouncingBall spinSpeed={spinSpeed} />

          {/* Sparkles cyan flottants — donnent de la vie au fond transparent */}
          <Sparkles
            count={120}
            scale={[5, 4, 4]}
            position={[0, 0.2, 0]}
            size={2.2}
            speed={0.45}
            color="#22d3ee"
            opacity={0.6}
            noise={[0.6, 0.6, 0.6]}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
