interface RealtimeAPIConfig {
  onAIStartSpeaking?: () => void;
  onAIStopSpeaking?: () => void;
  onUserStartSpeaking?: () => void;
  onUserStopSpeaking?: () => void;
  onAction?: (content: string) => void;
  onError?: (message: string) => void;
  onAudioPlaybackStart?: () => void;
  onAudioPlaybackEnd?: () => void;
}

export class RealtimeAPI {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private isConnected = false;
  private currentTextBuffer = '';
  private config: RealtimeAPIConfig;
  private audioElement: HTMLAudioElement | null = null;

  constructor(config: RealtimeAPIConfig = {}) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      // Get ephemeral token from our server
      const tokenResponse = await fetch('/api/realtime-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token Error:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          body: errorText
        });
        throw new Error(`Failed to get session token: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`);
      }

      const sessionData = await tokenResponse.json();
      console.log('✅ [RealtimeAPI] Session data received:', sessionData);
      console.log('🔍 [RealtimeAPI] Session data keys:', Object.keys(sessionData));
      console.log('🔍 [RealtimeAPI] Session data url property:', sessionData.url);
      console.log('🔍 [RealtimeAPI] Session data client_secret:', sessionData.client_secret);
      
      // The new sessions endpoint returns different structure
      const ephemeralKey = sessionData.client_secret?.value;
      if (!ephemeralKey) {
        console.error('❌ [RealtimeAPI] No ephemeral key in session data:', sessionData);
        throw new Error('Invalid session response - missing client_secret.value');
      }
      console.log('✅ [RealtimeAPI] Ephemeral key extracted, length:', ephemeralKey.length);

      await this.initializeWebRTC(ephemeralKey, sessionData);
    } catch (error) {
      console.error('Connection failed:', error);
      throw error;
    }
  }

  private async initializeWebRTC(ephemeralKey: string, sessionData?: any): Promise<void> {
    // Create a peer connection
    this.pc = new RTCPeerConnection();

    // Set up to play remote audio from the model (following official docs)
    this.audioElement = document.createElement('audio');
    this.audioElement.autoplay = true;
    
    this.pc.ontrack = (e) => {
      console.log('📡 WebRTC track received');
      this.audioElement!.srcObject = e.streams[0];
    };

    // Add local audio track for microphone input
    const ms = await navigator.mediaDevices.getUserMedia({
      audio: true
    });
    this.pc.addTrack(ms.getTracks()[0]);

    // Set up data channel for sending and receiving events
    this.dataChannel = this.pc.createDataChannel('oai-events');
    this.dataChannel.addEventListener('message', (e) => {
      // Realtime server events appear here
      const event = JSON.parse(e.data);
      this.handleServerEvent(event);
    });

    // Handle data channel open
    this.dataChannel.addEventListener('open', () => {
      console.log('✅ [RealtimeAPI] Data channel opened - ready for communication');
      this.isConnected = true;
      
      // Only configure session if we don't have pre-configured session data
      if (!sessionData) {
        console.log('🔧 [RealtimeAPI] No session data provided, configuring manually...');
        this.configureSession();
      } else {
        console.log('✅ [RealtimeAPI] Using pre-configured session from sessions endpoint');
      }
    });

    // Handle data channel close
    this.dataChannel.addEventListener('close', () => {
      console.log('❌ [RealtimeAPI] Data channel closed');
      this.isConnected = false;
    });

    // Start the session using the Session Description Protocol (SDP)
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Use session URL if available, otherwise fall back to direct model connection
    let sdpUrl;
    if (sessionData?.url) {
      sdpUrl = sessionData.url;
      console.log('🚀 [RealtimeAPI] Using session URL from sessions endpoint:', sdpUrl);
    } else {
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      sdpUrl = `${baseUrl}?model=${model}`;
      console.log('🚀 [RealtimeAPI] Using direct model URL:', sdpUrl);
    }
    
    console.log('📡 [RealtimeAPI] Sending SDP offer to:', sdpUrl);
    const sdpResponse = await fetch(sdpUrl, {
      method: 'POST',
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        'Content-Type': 'application/sdp'
      },
    });

    if (!sdpResponse.ok) {
      const errorText = await sdpResponse.text();
      console.error('WebRTC SDP Error:', {
        status: sdpResponse.status,
        statusText: sdpResponse.statusText,
        body: errorText
      });
      throw new Error(`Failed to establish WebRTC connection: ${sdpResponse.status} ${sdpResponse.statusText} - ${errorText}`);
    }

    const answer = {
      type: 'answer' as RTCSdpType,
      sdp: await sdpResponse.text(),
    };
    await this.pc.setRemoteDescription(answer);
  }

  private configureSession(): void {
    console.log('⚙️ [RealtimeAPI] Configuring session...');
    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: 'verse',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.3,
          prefix_padding_ms: 200,
          silence_duration_ms: 500,
          create_response: true
        },
        instructions: `You are a helpful AI assistant. Be conversational, friendly, and respond naturally to user questions. Always respond when someone speaks to you. Keep your responses concise but helpful.`
      }
    };

    console.log('📤 [RealtimeAPI] Sending session configuration:', JSON.stringify(sessionUpdate, null, 2));
    this.sendEvent(sessionUpdate);
    console.log('✅ [RealtimeAPI] Session configuration sent');
    
    // Send a test event to verify connection is working
    setTimeout(() => {
      console.log('🧪 [RealtimeAPI] Sending test session query...');
      this.sendEvent({ type: 'session.get' });
    }, 1000);
  }

  private sendEvent(event: Record<string, unknown>): void {
    console.log(`📤 [RealtimeAPI] Attempting to send event: ${event.type}`);
    
    if (!this.dataChannel) {
      console.error('❌ [RealtimeAPI] No data channel available');
      return;
    }
    
    console.log(`🔍 [RealtimeAPI] Data channel state: ${this.dataChannel.readyState}`);
    
    if (this.dataChannel.readyState === 'open') {
      try {
        const eventStr = JSON.stringify(event);
        console.log(`📡 [RealtimeAPI] Sending event data (${eventStr.length} bytes):`, eventStr);
        this.dataChannel.send(eventStr);
        console.log(`✅ [RealtimeAPI] Event sent successfully: ${event.type}`);
      } catch (error) {
        console.error(`❌ [RealtimeAPI] Failed to send event ${event.type}:`, error);
      }
    } else {
      console.warn(`⚠️ [RealtimeAPI] Cannot send event ${event.type}: data channel state is '${this.dataChannel.readyState}', expected 'open'`);
    }
  }

  private handleServerEvent(event: Record<string, unknown>): void {
    console.log('🎯 [RealtimeAPI] ===== SERVER EVENT RECEIVED =====');
    console.log('📨 [RealtimeAPI] Event type:', event.type);
    console.log('📨 [RealtimeAPI] Full event data:', JSON.stringify(event, null, 2));

    switch (event.type) {
      case 'response.created':
        console.log('🤖 AI response created');
        this.config.onAIStartSpeaking?.();
        break;
        
      case 'output_audio_buffer.started':
        console.log('🔊 AI audio output started');
        this.config.onAudioPlaybackStart?.();
        break;
        
      case 'response.text.delta':
        this.handleTextDelta(event.delta as string);
        break;
        
      case 'output_audio_buffer.stopped':
        console.log('🔇 AI audio output stopped');
        this.config.onAudioPlaybackEnd?.();
        break;
        
      case 'output_audio_buffer.cleared':
        console.log('🔇 AI audio output cleared (interrupted)');
        this.config.onAudioPlaybackEnd?.();
        break;
        
      case 'response.done':
        console.log('✅ AI response completed on server');
        
        if (this.currentTextBuffer.trim()) {
          this.processResponseForActions(this.currentTextBuffer);
          this.currentTextBuffer = '';
        }
        this.config.onAIStopSpeaking?.();
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('👤 User started speaking');
        this.config.onUserStartSpeaking?.();
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('👤 User stopped speaking');
        this.config.onUserStopSpeaking?.();
        break;
        
      case 'error':
        console.error('❌ Server error:', event.error);
        const errorMessage = (event.error as { message?: string })?.message || 'Unknown error';
        this.config.onError?.(`Server error: ${errorMessage}`);
        this.config.onAudioPlaybackEnd?.(); // Stop animation on error
        break;
      default:
        console.log(`🔍 [RealtimeAPI] Unhandled event type: ${event.type}`);
        break;
    }
    
    console.log('🎯 [RealtimeAPI] ===== EVENT HANDLING COMPLETE =====');
  }

  private handleTextDelta(deltaText: string): void {
    this.currentTextBuffer += deltaText;
  }

  private processResponseForActions(text: string): void {
    const actionRegex = /<showAction>(.*?)<\/showAction>/g;
    let match;
    
    while ((match = actionRegex.exec(text)) !== null) {
      const actionContent = match[1];
      this.config.onAction?.(actionContent);
    }
  }

  disconnect(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    
    if (this.pc) {
      this.pc.close();
    }
    
    this.dataChannel = null;
    this.pc = null;
    this.isConnected = false;
  }
}