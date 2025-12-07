import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Environment, ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';

export const MinimalScene = ({ mousePos }) => {
  const group = useRef();

  useFrame((state) => {
    if (!group.current) return;
    // Elegant, slow rotation
    group.current.rotation.y += 0.002;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, mousePos.y * 0.05, 0.05);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, mousePos.x * 0.05 + state.clock.elapsedTime * 0.05, 0.05);
  });

  // Elegant Material: Dark polished look with rim light
  const materialProps = {
    color: "#1a1a1a",
    roughness: 0.1,
    metalness: 0.8,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  };

  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 5, 20]} />

      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#fff" />
      <spotLight position={[-10, 10, 5]} intensity={2} angle={0.2} penumbra={1} color="#d4af37" />

      <Environment preset="lobby" />

      <group ref={group}>
        {/* Central Monolith */}
        <Float speed={1} rotationIntensity={0.2} floatIntensity={0.5}>
          <mesh position={[0, 0, 0]}>
            <octahedronGeometry args={[1.5, 0]} />
            <meshPhysicalMaterial {...materialProps} />
            {/* Gold edges */}
            <lineSegments>
              <edgesGeometry args={[new THREE.OctahedronGeometry(1.5, 0)]} />
              <lineBasicMaterial color="#d4af37" linewidth={1} opacity={0.5} transparent />
            </lineSegments>
          </mesh>
        </Float>

        {/* Orbiting elements */}
        <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1}>
           <mesh position={[3, 1, -2]} scale={0.5}>
             <icosahedronGeometry args={[1, 0]} />
             <meshStandardMaterial color="#333" roughness={0.2} metalness={1} />
           </mesh>
        </Float>
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.8}>
           <mesh position={[-3, -1, 1]} scale={0.3}>
             <torusGeometry args={[2, 0.2, 16, 100]} />
             <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={1} />
           </mesh>
        </Float>
      </group>

      {/* Typography in 3D space */}
      <Text
        position={[0, 0, -5]}
        fontSize={3}
        color="#202020"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/raleway/v14/1Ptrg8zYS_SKggPNwK4vaqI.woff"
      >
        ESSENCE
      </Text>

      <ContactShadows resolution={1024} scale={20} blur={2} opacity={0.5} far={10} color="#000" />
    </>
  );
};



