import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

export const MagneticButton = ({ children, primary = false, size = 'md', isDark = false, onClick }) => {
  const sizeClasses = {
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    xl: 'px-10 py-6 text-xl'
  };

  // Define button styles based on props
  const baseStyle = "relative overflow-hidden rounded-full font-bold transition-all duration-300 flex items-center justify-center cursor-pointer z-20";
  
  const primaryStyle = "bg-[#FF3366] text-white hover:bg-[#ff1f59] shadow-[0_10px_20px_rgba(255,51,102,0.4)] hover:shadow-[0_15px_30px_rgba(255,51,102,0.6)]";
  
  // Secondary style changes based on Dark/Light mode
  const secondaryLight = "bg-white text-gray-900 border-2 border-gray-200 hover:border-[#00CCFF] hover:text-[#00CCFF] shadow-[0_5px_15px_rgba(0,0,0,0.05)]";
  const secondaryDark = "bg-transparent text-white border-2 border-white/20 hover:border-[#4DDBFF] hover:text-[#4DDBFF] hover:bg-white/5";

  const style = primary ? primaryStyle : (isDark ? secondaryDark : secondaryLight);

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`${baseStyle} ${sizeClasses[size]} ${style}`}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
};

export const GlassCard = ({ children, title, icon, delay = 0, isDark = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, type: "spring" }}
      viewport={{ once: true }}
      whileHover={{ y: -10 }}
      className={`
        p-8 rounded-3xl backdrop-blur-xl border transition-colors duration-500
        ${isDark 
          ? 'bg-white/5 border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] text-gray-200' 
          : 'bg-white/60 border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] text-gray-600'}
      `}
    >
      <div className="mb-6 p-4 bg-white/10 rounded-2xl w-fit backdrop-blur-md border border-white/20">
        {icon}
      </div>
      <h3 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>{title}</h3>
      <p className="leading-relaxed">
        {children}
      </p>
    </motion.div>
  );
};

export const ThemeToggle = ({ isDark, toggle }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.8, rotate: 180 }}
      onClick={toggle}
      className={`
        p-3 rounded-full backdrop-blur-md border transition-colors duration-300
        ${isDark 
          ? 'bg-white/10 border-white/20 text-yellow-300 hover:bg-white/20' 
          : 'bg-black/5 border-black/10 text-gray-800 hover:bg-black/10'}
      `}
    >
      {isDark ? <Sun size={24} /> : <Moon size={24} />}
    </motion.button>
  );
};






