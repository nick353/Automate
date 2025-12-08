import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

export const BentoGrid = ({ className, children }) => {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoItem = ({
  className,
  title,
  description,
  header,
  icon,
  onClick,
  span = 1,
  rowSpan = 1,
  children,
  disableHoverEffect = false,
}) => {
  return (
    <motion.div
      layoutId={title ? `card-${title}` : undefined}
      whileHover={!disableHoverEffect ? { 
        scale: 1.02,
        transition: { type: "spring", stiffness: 400, damping: 10 }
      } : undefined}
      whileTap={!disableHoverEffect && onClick ? { scale: 0.98 } : undefined}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 20
      }}
      className={cn(
        "row-span-1 rounded-sm group/bento transition duration-200 shadow-sm dark:shadow-none p-6 glass-card justify-between flex flex-col space-y-4 overflow-hidden",
        !disableHoverEffect && "hover:shadow-xl hover:border-primary/50",
        onClick ? "cursor-pointer" : "cursor-default",
        span === 2 ? "md:col-span-2" : "md:col-span-1",
        span === 3 ? "md:col-span-3" : "",
        rowSpan === 2 ? "row-span-2" : "",
        className
      )}
      onClick={onClick}
    >
      {header && (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-sm bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-900 dark:to-neutral-800 overflow-hidden relative">
            {header}
        </div>
      )}
      <div className={cn("transition duration-200", !disableHoverEffect && "group-hover/bento:translate-x-2")}>
        {icon && <div className="mb-2 text-2xl">{icon}</div>}
        {title && (
            <div className="font-bold text-neutral-600 dark:text-neutral-200 mb-2 mt-2">
            {title}
            </div>
        )}
        {description && (
            <div className="font-normal text-neutral-600 text-xs dark:text-neutral-300">
            {description}
            </div>
        )}
        {children}
      </div>
    </motion.div>
  );
};

