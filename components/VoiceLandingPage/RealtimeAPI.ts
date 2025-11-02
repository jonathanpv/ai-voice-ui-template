// components/VoiceLandingPage/RealtimeAPI.ts
import {
  RealtimeAgent,
  RealtimeSession,
  type RealtimeItem,
  type RealtimeMessageItem,
  type TransportError,
  type TransportEvent, // Import TransportEvent to handle raw events
} from '@openai/agents/realtime';

// The interface for callbacks remains the same.
interface RealtimeAPIConfig {
  onAIStartSpeaking?: () => void;
  onAIStopSpeaking?: () => void;
  onUserStartSpeaking?: () => void;
  onUserStopSpeaking?: () => void;
  onError?: (message: string) => void;
  onAudioPlaybackStart?: () => void;
  onAudioPlaybackEnd?: () => void;
}

export class RealtimeAPI {
  private agent: RealtimeAgent | null = null;
  private session: RealtimeSession | null = null;
  private config: RealtimeAPIConfig;

  // State flags to manage UI animations and prevent duplicate events
  private isUserSpeaking = false;
  private isAIResponding = false;

  constructor(config: RealtimeAPIConfig = {}) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      const tokenResponse = await fetch('/api/realtime-session', {
        method: 'POST',
      });
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to get ephemeral key: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`);
      }
      const { client_secret: ephemeralKey } = await tokenResponse.json();
      if (!ephemeralKey) {
        throw new Error('Invalid response - missing ephemeral key');
      }
      this.agent = new RealtimeAgent({
        name: 'Helpful Assistant',
        instructions: `You are a helpful AI assistant. Be conversational, friendly, and respond naturally to user questions. Always respond when someone speaks to you. Keep your responses concise but helpful - just a few sentences max.`,
      });
      this.session = new RealtimeSession(this.agent, {
        model: 'gpt-4o-mini-realtime-preview',
        config: {
          voice: 'verse',
          // Use 'audio' modality to fix the previous API error.
          // Text transcripts are still provided via transport events.
          modalities: ['audio'],
          inputAudioFormat: 'pcm16',
          outputAudioFormat: 'pcm16',
          turnDetection: {
            type: 'server_vad',
            threshold: 0.3,
            prefixPaddingMs: 200,
            silenceDurationMs: 500,
            createResponse: true,
          },
        },
      });
      this.setupEventListeners();
      await this.session.connect({ apiKey: ephemeralKey });
      console.log('✅ [RealtimeAPI] Session connected using Agents SDK.');
    } catch (error) {
      console.error('Connection failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown connection error';
      this.config.onError?.(message);
      throw error;
    }
  }
  
  // --- KEY CHANGE: Switched to `transport_event` for low-level, real-time event handling ---
  private setupEventListeners(): void {
    if (!this.session) return;

    // This listener receives the raw events needed to drive the UI animations accurately,
    // just like the original WebRTC implementation.
    this.session.on('transport_event', (event: TransportEvent) => {
      this.handleServerEvent(event);
    });

    this.session.on('error', (error: TransportError) => {
      const errorMessage = error.error instanceof Error ? error.error.message : String(error.error);
      console.error('❌ Session error:', error.error);
      this.config.onError?.(`Session error: ${errorMessage}`);
      this.resetSpeakingStates();
    });
  }

  // --- NEW: This method processes the raw transport events to trigger UI callbacks ---
  private handleServerEvent(event: TransportEvent): void {
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        if (!this.isUserSpeaking) {
          this.isUserSpeaking = true;
          console.log('👤 User started speaking');
          this.config.onUserStartSpeaking?.();
        }
        break;
      
      case 'input_audio_buffer.speech_stopped':
        if (this.isUserSpeaking) {
          this.isUserSpeaking = false;
          console.log('👤 User stopped speaking');
          this.config.onUserStopSpeaking?.();
        }
        break;
      
      case 'response.created':
        if (!this.isAIResponding) {
          this.isAIResponding = true;
          console.log('🤖 AI response created');
          this.config.onAIStartSpeaking?.();
        }
        break;
      
      case 'output_audio_buffer.started':
        console.log('🔊 AI audio output started');
        this.config.onAudioPlaybackStart?.();
        break;
      
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared': // Handles interruptions
        console.log('🔇 AI audio output ended');
        this.config.onAudioPlaybackEnd?.();
        break;
      
      case 'response.done':
      case 'response.cancelled': // Handles interruptions
        console.log('✅ AI response complete');
        if (this.isAIResponding) {
          this.isAIResponding = false;
          this.config.onAIStopSpeaking?.();
        }
        break;
      
      case 'error':
        const errorMessage = (event.error as { message?: string })?.message || 'Unknown server error';
        this.config.onError?.(`Server error: ${errorMessage}`);
        this.resetSpeakingStates();
        break;
    }
  }

  private resetSpeakingStates(): void {
    if (this.isUserSpeaking) {
        this.isUserSpeaking = false;
        this.config.onUserStopSpeaking?.();
    }
    if (this.isAIResponding) {
        this.isAIResponding = false;
        this.config.onAIStopSpeaking?.();
        this.config.onAudioPlaybackEnd?.();
    }
  }

  disconnect(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
      this.agent = null;
      this.isUserSpeaking = false;
      this.isAIResponding = false;
      console.log('🔌 [RealtimeAPI] Session closed.');
    }
  }
}