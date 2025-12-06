import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float, ContactShadows, Environment, Torus, Sphere, Box, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

const FloatingShape = ({ position, color, type, speed = 1, scale = 1, mousePos }) => {
  const mesh = useRef();
  const [hovered, setHover] = useState(false);
  
  useFrame((state) => {
    if (!mesh.current) return;
    
    // Basic rotation
    mesh.current.rotation.x += 0.01 * speed;
    mesh.current.rotation.y += 0.015 * speed;

    // Mouse interaction parallax (subtle)
    const targetX = position[0] + mousePos.x * 2;
    const targetY = position[1] + mousePos.y * 2;
    
    mesh.current.position.x = THREE.MathUtils.lerp(mesh.current.position.x, targetX, 0.1);
    mesh.current.position.y = THREE.MathUtils.lerp(mesh.current.position.y, targetY, 0.1);

    // Scale on hover with springiness
    const targetScale = hovered ? scale * 1.2 : scale;
    mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, targetScale, 0.1));
  });

  const Material = <MeshDistortMaterial 
    color={color} 
    envMapIntensity={1} 
    clearcoat={1} 
    clearcoatRoughness={0.1} 
    metalness={0.1} 
    distort={0.3} 
    speed={2} 
  />;

  return (
    <Float speed={2 * speed} rotationIntensity={1} floatIntensity={2}>
      <mesh 
        ref={mesh} 
        position={position} 
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onClick={() => {
            // Simple "pop" effect logic could go here
            mesh.current.scale.setScalar(scale * 1.4);
        }}
      >
        {type === 'torus' && <torusGeometry args={[1, 0.4, 32, 64]} />}
        {type === 'sphere' && <sphereGeometry args={[1, 64, 64]} />}
        {type === 'box' && <boxGeometry args={[1.5, 1.5, 1.5]} />}
        {Material}
      </mesh>
    </Float>
  );
};

export const PopScene = ({ isDark, mousePos }) => {
  const { viewport } = useThree();

  // Colors based on theme
  const primary = isDark ? '#FF5C8D' : '#FF3366';
  const secondary = isDark ? '#4DDBFF' : '#00CCFF';
  const accent = isDark ? '#FFFF33' : '#FFFF00';

  return (
    <>
      <ambientLight intensity={isDark ? 0.4 : 0.7} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={1} color={secondary} />
      
      {/* Background Environment */}
      <Environment preset={isDark ? "city" : "studio"} />

      <group>
        {/* Main Hero Elements */}
        <FloatingShape 
          type="torus" 
          position={[3, 1, -2]} 
          color={primary} 
          scale={1.5} 
          speed={0.8} 
          mousePos={mousePos} 
        />
        <FloatingShape 
          type="sphere" 
          position={[-3, -1, -1]} 
          color={secondary} 
          scale={1.2} 
          speed={1.2} 
          mousePos={mousePos} 
        />
        <FloatingShape 
          type="box" 
          position={[4, -3, -5]} 
          color={accent} 
          scale={1} 
          speed={0.5} 
          mousePos={mousePos} 
        />

        {/* Distant floating particles/objects for depth */}
        {Array.from({ length: 8 }).map((_, i) => (
          <FloatingShape 
            key={i}
            type={i % 2 === 0 ? 'sphere' : 'box'}
            position={[
              (Math.random() - 0.5) * 20, 
              (Math.random() - 0.5) * 20, 
              -5 - Math.random() * 10
            ]}
            color={[primary, secondary, accent][i % 3]}
            scale={0.3 + Math.random() * 0.5}
            speed={0.5 + Math.random()}
            mousePos={mousePos}
          />
        ))}
      </group>

      <ContactShadows 
        resolution={1024} 
        scale={50} 
        blur={2} 
        opacity={0.2} 
        far={10} 
        color={isDark ? "#000000" : "#8a8a8a"} 
      />
    </>
  );
};


