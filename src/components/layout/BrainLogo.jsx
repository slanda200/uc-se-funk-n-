import React from 'react';

export default function BrainLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Brain shape with gradient */}
      <defs>
        <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      
      {/* Brain outline */}
      <path 
        d="M30,25 Q20,20 15,30 Q10,40 15,50 Q10,60 20,70 Q25,75 35,75 L65,75 Q75,75 80,70 Q90,60 85,50 Q90,40 85,30 Q80,20 70,25 Q60,15 50,15 Q40,15 30,25 Z" 
        fill="url(#brainGradient)"
        opacity="0.9"
      />
      
      {/* Czech Republic inspired lines - simplified map outline */}
      <g stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round">
        {/* Čechy region */}
        <path d="M35,35 L45,30 L55,35 L60,40 L55,48" opacity="0.8" />
        <path d="M45,40 L50,38 L55,40" opacity="0.7" />
        
        {/* Morava region */}
        <path d="M60,40 L65,35 L70,42 L68,52 L63,58" opacity="0.8" />
        <path d="M65,45 L68,48" opacity="0.7" />
        
        {/* Connection lines */}
        <path d="M50,45 L55,48 L60,48" opacity="0.7" />
        <path d="M40,50 L50,52 L60,50" opacity="0.6" />
        
        {/* Bottom region */}
        <path d="M35,55 L45,60 L55,58 L63,58" opacity="0.8" />
        <path d="M45,55 L50,58" opacity="0.6" />
      </g>
      
      {/* Brain details - neural connections */}
      <g stroke="white" strokeWidth="1" fill="none" opacity="0.5">
        <circle cx="40" cy="42" r="2" fill="white" />
        <circle cx="50" cy="45" r="2" fill="white" />
        <circle cx="60" cy="48" r="2" fill="white" />
      </g>
    </svg>
  );
}