'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, animate } from 'motion/react';
import { RealtimeAPI } from './RealtimeAPI';
import { ActionDialog } from './ActionDialog';
import { VoiceBar } from '../VoiceBar';

const phrases = [
  "Ciao!",
  "Bonjour!",
  "안녕하세요!",
  "Guten Tag!",
  "こんにちは",
  "Szia!",
  "¡Hola!"
];

export function HeroSection() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [typewriterText, setTypewriterText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionContent, setActionContent] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const realtimeAPIRef = useRef<RealtimeAPI | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);

  // Derive VoiceBar state
  const voiceBarState = React.useMemo(() => {
    if (!isListening) return 'idle' as const;
    if (isSpeaking || isAISpeaking) return 'speaking' as const;
    return 'listening' as const;
  }, [isListening, isSpeaking, isAISpeaking]);

  // Audio analysis for speech-responsive scaling (user speaking only)
  const setupAudioAnalysis = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    
    audioAnalyserRef.current = analyser;
    startAudioLevelMonitoring();
  };

  const startAudioLevelMonitoring = () => {
    console.log('🔊 startAudioLevelMonitoring called');
    if (!audioAnalyserRef.current) return;
    
    const analyser = audioAnalyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateAudioLevel = () => {
      if (!analyser) return;
      
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average amplitude across frequency bins
      const sum = dataArray.reduce((acc, value) => acc + value, 0);
      const average = sum / dataArray.length;
      
      // Normalize to 0-1 range with higher sensitivity
      const normalizedLevel = Math.min(average / 64, 1); // More sensitive (was 128)
      setAudioLevel(normalizedLevel);
      
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };
    
    updateAudioLevel();
  };

  const stopAudioLevelMonitoring = () => {
    console.log('🔇 stopAudioLevelMonitoring called');
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
  };

  // Typewriter animation
  useEffect(() => {
    const typePhrase = async () => {
      const phrase = phrases[currentPhraseIndex];
      
      // Type out
      await animate(0, phrase.length, {
        duration: phrase.length * 0.05,
        ease: "linear",
        onUpdate: (latest) => {
          setTypewriterText(phrase.slice(0, Math.ceil(latest)));
        },
      });
      
      // Wait
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Erase
      await animate(phrase.length, 0, {
        duration: phrase.length * 0.03,
        ease: "linear",
        onUpdate: (latest) => {
          setTypewriterText(phrase.slice(0, Math.ceil(latest)));
        },
      });
      
      // Next phrase
      setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
    };

    typePhrase();
  }, [currentPhraseIndex]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Speech animation control with scaling
  const startUserSpeechAnimation = () => {
    console.log('🎤 startUserSpeechAnimation called - isSpeaking will be set to true');
    setIsSpeaking(true);
    setIsAISpeaking(false);
    
    // Restart audio monitoring if it's not already running
    if (!animationFrameRef.current && audioAnalyserRef.current) {
      console.log('🔄 Restarting audio monitoring for user speech');
      startAudioLevelMonitoring();
    }
  };

  const stopUserSpeechAnimation = () => {
    console.log('🛑 stopUserSpeechAnimation called - isSpeaking will be set to false');
    setIsSpeaking(false);
    stopAudioLevelMonitoring();
  };

  const startAISpeechAnimation = () => {
    console.log('🤖 startAISpeechAnimation called - isAISpeaking will be set to true');
    setIsAISpeaking(true);
  };

  const stopAISpeechAnimation = () => {
    console.log('🤖 stopAISpeechAnimation called - isAISpeaking will be set to false');
    setIsAISpeaking(false);
  };

  const handleStartCall = async () => {
    try {
      setError(null);
      
      const api = new RealtimeAPI({
        onUserStartSpeaking: () => {
          console.log('🎤 Animation trigger: User Start Speaking');
          startUserSpeechAnimation();
        },
        onUserStopSpeaking: () => {
          console.log('🎤 Animation trigger: User Stop Speaking');
          stopUserSpeechAnimation();
        },
        onAudioPlaybackStart: () => {
          console.log('🎤 Animation trigger: AI Audio Started');
          startAISpeechAnimation();
        },
        onAudioPlaybackEnd: () => {
          console.log('🎤 Animation trigger: AI Audio Ended');
          stopAISpeechAnimation();
        },
        onError: (message) => setError(message)
      });

      await api.connect();
      realtimeAPIRef.current = api;
      setIsListening(true);
      
      // Setup audio analysis for user microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setupAudioAnalysis(stream);
      } catch (audioError) {
        console.warn('Could not setup audio analysis:', audioError);
      }
      
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleEndCall = () => {
    setIsListening(false);
    stopUserSpeechAnimation();
    stopAISpeechAnimation();
    
    if (realtimeAPIRef.current) {
      realtimeAPIRef.current.disconnect();
      realtimeAPIRef.current = null;
    }
  };

  return (
    <section className="w-screen h-screen flex flex-col justify-center items-center relative">
      
      <div className="w-[320px] md:w-full flex justify-center items-center text-center font-geist text-4xl md:text-7xl font-bold overflow-clip tracking-tighter text-nowrap">
        <span className=" text-black">Meet Slashy</span>
      </div>
      <div className="flex w-full overflow-x-clip max-w-xl flex-col justify-center items-center gap-[43px] bg-white relative">
        {/* Voice animation */}
        <div className="flex flex-col items-center justify-center w-full">
          <div className="relative bg-white rounded-3xl p-8 max-w-xl w-full">
            {/* VoiceBar Container with Speech-Responsive Scaling */}
            <div className="relative flex justify-center items-center w-full h-[200px] overflow-hidden rounded-2xl mb-4">
              <motion.div
                animate={{
                  scale: isSpeaking 
                    ? 1 + Math.max(audioLevel * 0.2, 0.03) // User speaking: reduced audio-responsive scaling
                    : 1,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  mass: 0.6
                }}
                className="w-full h-full flex justify-center items-center"
              >
                <VoiceBar state={voiceBarState} />
              </motion.div>
            </div>
            
            {/* Typewriter Section */}
            <div className="w-full max-w-[360px] lg:max-w-[500px] mx-auto h-12 flex justify-center items-center mb-6">
              <h2 className="relative inline-flex items-center">
                <span className="text-3xl text-black tracking-tight font-geist font-semibold">
                  {typewriterText}
                </span>
                <motion.div
                  className="absolute right-[-12px] top-1/2 -translate-y-1/2 bg-black w-[4px] h-[80%]"
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    times: [0, 0.5, 0.5, 1],
                  }}
                />
              </h2>
            </div>
            
            <div className="flex flex-col sm:flex-row w-full gap-4 justify-center items-center">
              <button 
                onClick={isListening ? handleEndCall : handleStartCall}
                className={`w-[200px] py-4 px-4 font-sf-rounded text-white text-2xl font-semibold rounded-full transition-all duration-300 hover:scale-105 transform  ${
                  isListening 
                    ? 'bg-white border-4 hover:bg-gray-50 !text-black' 
                    : 'bg-black hover:bg-gray-950'
                }`}
              >
                {isListening ? 'End Call' : 'Call Slashy'}
              </button>
              <button className="w-[200px] py-4 px-4 font-sf-rounded bg-gray-700 text-white text-2xl font-semibold rounded-full transition-all duration-300 hover:scale-105 transform  ">
                Learn More
              </button>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="mt-4 text-sm text-red-600 font-medium text-center">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Dialog */}
      <ActionDialog 
        isOpen={showActionDialog}
        onClose={() => setShowActionDialog(false)}
        content={actionContent}
      />
    </section>
  );
}