import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Noise, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

const ParticleField = ({ count = 2000 }) => {
  const mesh = useRef();
  const light = useRef();
  const { viewport, mouse } = useThree();

  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Generate random particle data
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const xFactor = -50 + Math.random() * 100;
      const yFactor = -50 + Math.random() * 100;
      const zFactor = -50 + Math.random() * 100;
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 });
    }
    return temp;
  }, [count]);

  useFrame((state) => {
    // Rotate the entire field slightly based on mouse
    if (mesh.current) {
        // Smooth mouse interpolation
        const targetX = (state.mouse.x * viewport.width) / 50;
        const targetY = (state.mouse.y * viewport.height) / 50;
        
        mesh.current.rotation.y = THREE.MathUtils.lerp(mesh.current.rotation.y, targetX, 0.05);
        mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, -targetY, 0.05);

        particles.forEach((particle, i) => {
            let { t, factor, speed, xFactor, yFactor, zFactor } = particle;
            
            // Update time
            t = particle.t += speed / 2;
            const a = Math.cos(t) + Math.sin(t * 1) / 10;
            const b = Math.sin(t) + Math.cos(t * 2) / 10;
            const s = Math.cos(t);

            // Update position
            dummy.position.set(
                (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
                (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
                (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
            );
            
            // Update scale (pulsing effect)
            const scale = (Math.cos(t) + 2) / 3; // Base scale
            dummy.scale.set(scale, scale, scale);
            
            // Update rotation
            dummy.rotation.set(s * 5, s * 5, s * 5);
            
            dummy.updateMatrix();
            mesh.current.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[null, null, count]}>
        <octahedronGeometry args={[0.1, 0]} /> {/* Cyber shape */}
        <meshBasicMaterial color="#00FFCC" wireframe transparent opacity={0.4} />
      </instancedMesh>
    </>
  );
};

const BackgroundGrid = () => {
    return (
        <gridHelper 
            args={[100, 100, 0xff0055, 0x222222]} 
            position={[0, -10, 0]} 
            rotation={[0, 0, 0]} 
        />
    );
}

export const CyberpunkBackground = () => {
  return (
    <>
      <color attach="background" args={['#050505']} />
      
      {/* Ambient Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#00FFCC" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#FF0055" />
      
      {/* Particles */}
      <ParticleField count={1500} />
      
      {/* Deep Grid */}
      <BackgroundGrid />
      
      {/* Post Processing Effects */}
      <EffectComposer disableNormalPass>
        {/* Glow */}
        <Bloom 
            luminanceThreshold={0} 
            mipmapBlur 
            intensity={1.5} 
            radius={0.6}
        />
        {/* Digital Noise */}
        <Noise opacity={0.15} />
        {/* RGB Shift at edges */}
        <ChromaticAberration 
            offset={[0.002, 0.002]}
            radialModulation={true}
            modulationOffset={0.5}
        />
        {/* Dark corners */}
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </>
  );
};




