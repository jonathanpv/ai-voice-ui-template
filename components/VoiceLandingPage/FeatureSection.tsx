import React from 'react';

interface FeatureSectionProps {
  title: string;
  description: string;
  videoSrc?: string;
  posterSrc?: string;
  gradient: string;
  reverse?: boolean;
}

export function FeatureSection({ 
  title, 
  description, 
  videoSrc, 
  posterSrc, 
  gradient,
  reverse = false 
}: FeatureSectionProps) {
  return (
    <section className="container max-w-6xl min-h-screen pt-36">
      <div className={`flex flex-col md:grid md:grid-cols-2 gap-8 md:gap-12 items-center px-12 ${reverse ? '' : ''}`}>
        {/* Video container */}
        <div className={`relative w-full aspect-square overflow-hidden rounded-2xl md:rounded-3xl ${reverse ? 'md:order-2' : ''}`}>
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            preload="auto"
            className={`absolute inset-0 w-full h-full object-cover ${gradient}`}
            poster={posterSrc}>
            <source src={videoSrc} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
        
        {/* Text content */}
        <div className={`flex flex-col gap-4 text-center md:text-left px-12 sm:px-16 md:px-0 ${reverse ? 'md:order-1' : ''}`}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">{title}</h2>
          <p className="text-base sm:text-lg text-gray-600">{description}</p>
        </div>
      </div>
    </section>
  );
}