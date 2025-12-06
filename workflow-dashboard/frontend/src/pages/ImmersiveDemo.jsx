import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { PopScene } from '../components/Immersive/PopScene';
import { GlassCard, MagneticButton, ThemeToggle } from '../components/Immersive/UIComponents';
import { ArrowRight, Star, Zap, Heart } from 'lucide-react';

const ImmersiveDemo = () => {
  const [isDark, setIsDark] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Toggle Dark Mode
  const toggleTheme = () => setIsDark(!isDark);

  // Mouse tracking for parallax/cursor effects
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className={`w-full min-h-screen transition-colors duration-500 overflow-hidden relative font-sans
      ${isDark ? 'bg-[#1a1a2e] text-white' : 'bg-[#f0f0f0] text-gray-900'}`}>
      
      {/* Background 3D Scene Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Canvas shadows camera={{ position: [0, 0, 10], fov: 45 }}>
          <PopScene isDark={isDark} mousePos={mousePos} />
        </Canvas>
      </div>

      {/* Foreground UI Layer */}
      <div className="relative z-10 w-full min-h-screen overflow-y-auto">
        
        {/* Navigation / Header */}
        <nav className="w-full p-6 flex justify-between items-center">
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-2xl font-black tracking-tighter"
          >
            <span className="text-[#FF3366]">NEON</span>
            <span className={isDark ? 'text-[#00CCFF]' : 'text-gray-800'}>TOYBOX</span>
          </motion.div>
          
          <div className="flex items-center gap-4">
             <ThemeToggle isDark={isDark} toggle={toggleTheme} />
             <MagneticButton isDark={isDark}>Menu</MagneticButton>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="container mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
            className="mb-6 relative"
          >
            <h1 className="text-7xl md:text-9xl font-black leading-tight tracking-tight mix-blend-difference text-transparent bg-clip-text bg-gradient-to-r from-[#FF3366] via-[#FFFF00] to-[#00CCFF]"
                style={{ WebkitTextStroke: isDark ? '2px rgba(255,255,255,0.1)' : 'none' }}>
              POP <br/> CULTURE
            </h1>
            {/* Decorative Elements */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -top-12 -right-12 text-[#FFFF00]"
            >
              <Star size={64} fill="currentColor" />
            </motion.div>
          </motion.div>

          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`text-xl md:text-2xl max-w-2xl mb-10 font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
          >
            限界を超えた没入体験へようこそ。<br/>
            エネルギー溢れる3D空間と、弾けるインタラクション。
          </motion.p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex gap-4"
          >
             <MagneticButton primary size="lg">
               Get Started <ArrowRight className="ml-2 w-5 h-5" />
             </MagneticButton>
             <MagneticButton size="lg" isDark={isDark}>
               View Gallery
             </MagneticButton>
          </motion.div>
        </header>

        {/* Content Section - Glassmorphism Cards */}
        <section className="container mx-auto px-6 py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GlassCard delay={0.1} isDark={isDark} title="Energetic" icon={<Zap size={32} color="#FF3366" />}>
              視覚的な楽しさを最優先。すべてのインタラクションに弾性のある物理挙動を。
            </GlassCard>
            <GlassCard delay={0.2} isDark={isDark} title="Immersive" icon={<Star size={32} color="#FFFF00" />}>
              React Three Fiberを使用した3D要素が、あなたの操作に合わせて踊り出します。
            </GlassCard>
            <GlassCard delay={0.3} isDark={isDark} title="Playful" icon={<Heart size={32} color="#00CCFF" />}>
              グラスモーフィズムと鮮やかなカラーパレットで、退屈なWebから解放されましょう。
            </GlassCard>
          </div>
        </section>

         {/* Interactive Footer Area */}
         <section className="h-screen flex items-center justify-center relative overflow-hidden">
             <motion.div 
               whileInView={{ scale: [0.9, 1.1, 1] }}
               transition={{ duration: 0.8 }}
               className="text-center z-10"
             >
                <h2 className="text-5xl font-bold mb-8">Ready to Pop?</h2>
                <MagneticButton primary size="xl">Start Project</MagneticButton>
             </motion.div>
         </section>

      </div>
    </div>
  );
};

export default ImmersiveDemo;


