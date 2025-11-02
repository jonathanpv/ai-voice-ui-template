import React, { useEffect, useRef, useMemo, SVGProps } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

// Define the component props, including the 'speaking' state
type VoiceBarProps = SVGProps<SVGSVGElement> & {
  state?: 'idle' | 'listening' | 'speaking';
  numBars?: number;
  totalWidth?: number;
  strokeWidth?: number;
};

interface BarProps {
  index: number;
  x: number;
  baseHeight: number;
  centerY: number;
  state: 'idle' | 'listening' | 'speaking';
  strokeWidth: number;
  maxHeight: number;
}

const Bar: React.FC<BarProps> = ({ x, baseHeight, centerY, state, strokeWidth, maxHeight }) => {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 250, damping: 25 });
  const y1 = useTransform(spring, h => centerY - h / 2);
  const y2 = useTransform(spring, h => centerY + h / 2);

  const animationIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    const stopAnimations = () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    stopAnimations();

    if (state === 'idle') {
      // Show bars at their base height in idle
      mv.set(baseHeight);
    } else if (state === 'listening') {
      const updatePulse = (time: number) => {
        const pulseFactor = 1 + Math.sin(time / 500) * 0.15;
        const newHeight = Math.min(baseHeight * pulseFactor, maxHeight);
        mv.set(newHeight);
        animationFrameRef.current = requestAnimationFrame(updatePulse);
      };
      animationFrameRef.current = requestAnimationFrame(updatePulse);
    } else if (state === 'speaking') {
      animationIntervalRef.current = setInterval(() => {
        // Random variation around the base height
        const randomVariation = (Math.random() - 0.5) * 20;
        const newHeight = Math.min(Math.max(baseHeight + randomVariation, 4), maxHeight);
        mv.set(newHeight);
      }, 120);
    }

    return stopAnimations;
  }, [state, baseHeight, mv, maxHeight]);

  return (
    <motion.line
      x1={x}
      x2={x}
      y1={y1}
      y2={y2}
      stroke="black"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  );
};

export const VoiceBar = ({ state = 'idle', numBars = 4, totalWidth = 120, strokeWidth = 30, ...props }: VoiceBarProps) => {
    const viewBoxHeight = 90;
    const centerY = viewBoxHeight / 2; 
    const maxHeight = viewBoxHeight - 4; // Leave 2px padding on top/bottom
    const margin = totalWidth / 16;
    const effectiveWidth = totalWidth - 2 * margin;
    const spacing = numBars > 1 ? effectiveWidth / (numBars - 1) : 0;
  
    const xs = useMemo(
      () => Array.from({ length: numBars }, (_, i) => margin + i * spacing),
      [numBars, margin, spacing]
    );
  
    // Adjusted heights to fit within viewBox
    const baseHeights = useMemo(
      () => [9, 18, 35, 14],
      []
    );
    
  
    return (
      <svg
        width="inherit"
        height="inherit"
        viewBox={`0 0 ${totalWidth} ${viewBoxHeight}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        {xs.map((x, i) => (
          <Bar
            key={i}
            index={i}
            x={x}
            baseHeight={baseHeights[i]}
            centerY={centerY}
            state={state}
            strokeWidth={strokeWidth}
            maxHeight={maxHeight}
          />
        ))}
      </svg>
    );
  };