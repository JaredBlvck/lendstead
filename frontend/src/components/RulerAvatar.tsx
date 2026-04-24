import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Large luminous ruler presence - Sr or Jr as a visible deity. Drawn
// bigger than NPCs, with an emissive aura + orbiting particle ring.

interface Props {
  position: [number, number, number];
  lane: 'sr' | 'jr';
  energy: number; // 0..100
}

export function RulerAvatar({ position, lane, energy }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);

  const color = lane === 'sr' ? '#fb923c' : '#38bdf8';
  const glowColor = lane === 'sr' ? '#fcd34d' : '#7dd3fc';
  const energyNorm = Math.max(0, Math.min(1, energy / 100));

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      // Float above ground with slow bob
      groupRef.current.position.y = position[1] + 1.2 + Math.sin(clock.elapsedTime * 1.2) * 0.15;
    }
    if (auraRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.08;
      auraRef.current.scale.setScalar(s);
      const mat = auraRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + energyNorm * 2.5;
      mat.opacity = 0.22 + energyNorm * 0.25;
    }
    if (orbitRef.current) orbitRef.current.rotation.y += delta * (0.8 + energyNorm * 1.2);
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Inner luminous body - tall cylinder */}
      <mesh>
        <cylinderGeometry args={[0.35, 0.45, 2.2, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Head-orb */}
      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={3}
        />
      </mesh>
      {/* Aura sphere (translucent, scales with energy) */}
      <mesh ref={auraRef}>
        <sphereGeometry args={[1.4, 16, 16]} />
        <meshStandardMaterial
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={1.5}
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>
      {/* Orbiting ring of 6 particles */}
      <group ref={orbitRef}>
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(angle) * 1.8, 0, Math.sin(angle) * 1.8]}>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshStandardMaterial
                color={glowColor}
                emissive={glowColor}
                emissiveIntensity={3}
              />
            </mesh>
          );
        })}
      </group>
      {/* Ground glow decal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
        <circleGeometry args={[2.5, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6 * energyNorm}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
      {/* Strong point light */}
      <pointLight color={glowColor} intensity={1.5 + energyNorm * 1.5} distance={10} />
    </group>
  );
}
