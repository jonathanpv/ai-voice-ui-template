'use client';

import React, { useRef } from 'react';


const testimonials = [
  {
    quote: "This AI has completely revolutionized how I manage my inbox.",
    author: "Sarah Chen",
    title: "Product Manager",
    company: "TechCorp",
    avatar: "https://i.pravatar.cc/400?img=1"
  },
  {
    quote: "The smart categorization feature is incredible. My emails are automatically organized.",
    author: "Michael Rodriguez",
    title: "CEO",
    company: "StartupXYZ",
    avatar: "https://i.pravatar.cc/400?img=2"
  },
  {
    quote: "As someone who receives 200+ emails daily, this tool has been a game-changer for my productivity.",
    author: "Emily Watson",
    title: "Marketing Director",
    company: "Global Inc",
    avatar: "https://i.pravatar.cc/400?img=3"
  },
  {
    quote: "The AI summaries are so accurate, I can quickly understand long email threads without reading everything.",
    author: "David Park",
    title: "Engineer",
    company: "DevTools",
    avatar: "https://i.pravatar.cc/400?img=4"
  },
  {
    quote: "Finally, an email tool that actually understands context and helps me prioritize what matters most.",
    author: "Jennifer Liu",
    title: "Consultant",
    company: "Strategy Co",
    avatar: "https://i.pravatar.cc/400?img=5"
  },
  {
    quote: "The command center feature lets me process emails with simple commands.",
    author: "Robert Thompson",
    title: "VP Sales",
    company: "SaaS Plus",
    avatar: "https://i.pravatar.cc/400?img=6"
  },
  {
    quote: "I've tried many email tools, but this is the first one that actually learns and adapts to my workflow.",
    author: "Amanda Foster",
    title: "Operations Lead",
    company: "FinTech Pro",
    avatar: "https://i.pravatar.cc/400?img=7"
  },
  {
    quote: "The time I save on email management now goes into actual work.",
    author: "James Martinez",
    title: "Team Lead",
    company: "Design Studio",
    avatar: "https://i.pravatar.cc/400?img=8"
  }
];

export function TestimonialsSection() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <section className="w-full min-h-screen pt-36 pb-24">
      <style jsx>{`
        .testimonial-scroll-container {
          display: flex;
          overflow-x: auto;
          overflow-y: visible;
          gap: 24px;
          padding: 24px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          scroll-padding-left: calc(360px * 0.7);
          overscroll-behavior-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .testimonial-scroll-container::-webkit-scrollbar { 
          display: none; 
        }
        .testimonial-card {
          flex: 0 0 360px;
          height: 250px;
          scroll-snap-align: start;
        }
        @media (max-width: 768px) {
          .testimonial-card {
            flex: 0 0 280px;
            height: 360px;
          }
          .testimonial-scroll-container {
            gap: 16px;
            padding: 16px;
          }
        }
      `}</style>

      {/* Section Header */}
      <div className="flex flex-col items-center text-center mb-12 px-4">
        <h2 className="text-4xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4">
          What Our Users Say
        </h2>
        <p className="text-base sm:text-lg text-gray-600 max-w-3xs sm:max-w-xs md:max-w-md">
          Join thousands of professionals who&apos;ve transformed their email workflow
        </p>
      </div>

      {/* Testimonial Carousel */}
      <div className="relative w-full">
        <div 
          ref={scrollContainerRef}
          className="testimonial-scroll-container"
          aria-label="Testimonial carousel" 
          role="region"
        >
          {testimonials.map((testimonial, index) => (
            <div key={index} className="testimonial-card" tabIndex={0}>
              <div className="h-full border rounded-3xl overflow-hidden bg-white border-gray-200 shadow-sm p-5 flex flex-col">
                <div className="flex-1">
                  <p className="text-lg font-medium text-gray-900 leading-tight">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                </div>
                
                <div className="h-px bg-gray-100 my-5" />
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-300 overflow-hidden flex-shrink-0">
                    <img 
                      src={testimonial.avatar} 
                      alt={testimonial.author} 
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-semibold text-gray-900 leading-tight">
                      {testimonial.author}
                    </div>
                    <div className="text-base font-medium text-gray-500 leading-tight">
                      {testimonial.title} at <span className="font-semibold">{testimonial.company}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}