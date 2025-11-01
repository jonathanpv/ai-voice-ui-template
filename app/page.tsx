import { HeroSection } from '@/components/VoiceLandingPage/HeroSection';
import { FeatureSection } from '@/components/VoiceLandingPage/FeatureSection';
import { TestimonialsSection } from '@/components/VoiceLandingPage/TestimonialsSection';

import NavHeader from '@/components/NavHeader';

export default function VoiceLandingPage() {
  return (
    <main className="bg-white w-full h-full flex flex-col justify-center items-center">
      <NavHeader/>
      <HeroSection />
      
      <FeatureSection 
        title="Intelligent Email Management"
        description="Watch how our AI transforms your inbox into a productivity powerhouse"
        videoSrc="/demo-video.mp4"
        posterSrc="/placeholder-video.jpg"
        gradient="bg-gradient-to-br from-purple-100 to-blue-100"
      />
      
      <FeatureSection 
        title="Smart Categorization"
        description="Automatically organize your emails with AI-powered categorization and smart filters"
        videoSrc="/demo-video-2.mp4"
        posterSrc="/placeholder-video-2.jpg"
        gradient="bg-gradient-to-br from-green-100 to-teal-100"
        reverse={true}
      />
      
      <TestimonialsSection />
      
      <section className="container max-w-6xl min-h-screen pt-36">
        <div className="flex flex-col gap-8 md:gap-12 items-center px-12">
          <div className="flex flex-col gap-4 text-center px-12 sm:px-16 md:px-0">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
              Seamless Integration
            </h2>
            <p className="text-base sm:text-lg text-gray-600">
              Connect with your favorite tools and streamline your entire workflow
            </p>
          </div>
          
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl md:rounded-3xl">
            <video 
              autoPlay 
              loop 
              muted 
              playsInline 
              preload="auto"
              className="absolute inset-0 w-full h-full object-cover bg-gradient-to-br from-orange-100 to-pink-100"
              poster="/placeholder-video-3.jpg">
              <source src="/demo-video-3.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>
      
      <section className="container max-w-6xl min-h-screen pt-36">
        <div className="flex flex-col gap-8 md:gap-12 items-center px-12">
          <div className="flex flex-col gap-4 text-center px-12 sm:px-16 md:px-0">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
              Advanced Analytics
            </h2>
            <p className="text-base sm:text-lg text-gray-600">
              Gain insights into your communication patterns and optimize your productivity
            </p>
          </div>
          
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl md:rounded-3xl">
            <video 
              autoPlay 
              loop 
              muted 
              playsInline 
              preload="auto"
              className="absolute inset-0 w-full h-full object-cover bg-gradient-to-br from-cyan-100 to-indigo-100"
              poster="/placeholder-video-4.jpg">
              <source src="/demo-video-4.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>
    </main>
  );
}