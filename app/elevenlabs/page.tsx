'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { RealtimeAPI } from '../../components/VoiceLandingPage/RealtimeAPI';

const VERTEX_SHADER = `#version 300 es
out vec4 out_position;
out vec2 out_uv;

const vec4 blitFullscreenTrianglePositions[6] = vec4[](
  vec4(-1.0, -1.0, 0.0, 1.0),
  vec4(3.0, -1.0, 0.0, 1.0),
  vec4(-1.0, 3.0, 0.0, 1.0),
  vec4(-1.0, -1.0, 0.0, 1.0),
  vec4(3.0, -1.0, 0.0, 1.0),
  vec4(-1.0, 3.0, 0.0, 1.0)
);

void main() {
  out_position = blitFullscreenTrianglePositions[gl_VertexID];
  out_uv = out_position.xy * 0.5 + 0.5;
  out_uv.y = 1.0 - out_uv.y;
  gl_Position = out_position;
}`;

// Fragment Shader - CD/Disc-based shiny aesthetic with audio responsiveness
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

#define PI (3.14159265358979323844)

in vec2 out_uv;
out vec4 fragColor;

// --- UNIFORMS ---
uniform float u_time;
uniform float u_stateTime;
uniform float u_micLevel;
uniform vec2 u_viewport;

// State uniforms
uniform float u_stateListen;
uniform float u_stateThink;
uniform float u_stateSpeak;
uniform float u_stateHalt;
uniform float u_isListening;

// Advanced effect uniforms
uniform sampler2D uTextureNoise;
uniform vec3 u_bloopColorMain;
uniform vec3 u_bloopColorLow;
uniform vec3 u_bloopColorMid;
uniform vec3 u_bloopColorHigh;

// Audio data uniforms
uniform vec4 u_avgMag;
uniform vec4 u_cumulativeAudio;

// Offsets for oval animation
uniform float u_offsets[7];

// --- HELPER FUNCTIONS ---
vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

// 2D noise for the ring
float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
  return 0.5 + 0.5 * n;
}

// Draw a single oval with soft edges and calculate its gradient color
bool drawOval(vec2 polarUv, vec2 polarCenter, float a, float b, bool reverseGradient, float softness, out vec4 color) {
  vec2 p = polarUv - polarCenter;
  float oval = p.x * p.x / (a * a) + p.y * p.y / (b * b);
  float edge = smoothstep(1.0, 1.0 - softness, oval);
  if (edge > 0.0) {
    float gradient = reverseGradient ? 1.0 - (p.x / a + 1.0) / 2.0 : (p.x / a + 1.0) / 2.0;
    color = vec4(vec3(gradient), 0.8 * edge);
    return true;
  }
  return false;
}

// Map grayscale value to a 4-color ramp (color1, color2, color3, color4)
vec3 colorRamp(float grayscale, vec3 color1, vec3 color2, vec3 color3, vec3 color4) {
  if (grayscale < 0.33) {
    return mix(color1, color2, grayscale * 3.0);
  } else if (grayscale < 0.66) {
    return mix(color2, color3, (grayscale - 0.33) * 3.0);
  } else {
    return mix(color3, color4, (grayscale - 0.66) * 3.0);
  }
}

// Perlin noise eminating from the center of the orb
float flow(float radius, float theta, float offset) {
  return texture(uTextureNoise, vec2(radius * 0.03, theta / 4.0 / PI + offset) + vec2(u_time * -0.2, 0.0)).r;
}

float sharpRing(vec2 uv, float theta, float time) {
  float ringStart = 1.0;
  float ringWidth = 0.5;
  float noiseScale = 5.0;
  vec2 noiseCoord = vec2(theta / (2.0 * PI), time * 0.1);
  noiseCoord *= noiseScale;
  float noise = noise2D(noiseCoord);
  noise = (noise - 0.5) * 4.0;
  return ringStart + noise * ringWidth * 1.5;
}

float smoothRing(vec2 uv, float time) {
  float angle = atan(uv.y, uv.x);
  if (angle < 0.0) angle += 2.0 * PI;
  vec2 noiseCoord = vec2(angle / (2.0 * PI), time * 0.1);
  noiseCoord *= 6.0;
  float noise = noise2D(noiseCoord);
  noise = (noise - 0.5) * 8.0;
  float ringStart = 0.9;
  float ringWidth = 0.3;
  return ringStart + noise * ringWidth;
}

// --- MAIN SHADER ENTRYPOINT ---
void main() {
  // Normalize vUv to be centered around (0.0, 0.0)
  vec2 uv = out_uv * 2.0 - 1.0;
  // Adjust for viewport aspect ratio
  uv.x *= u_viewport.x / u_viewport.y;

  // Scale effect based on audio activity
  float audioScale = 1.0 - u_micLevel * 0.1 - (u_avgMag.x + u_avgMag.y + u_avgMag.z + u_avgMag.w) * 0.025;
  uv *= audioScale;

  // Convert uv to polar coordinates
  float radius = length(uv);
  float theta = atan(uv.y, uv.x);

  // Add noise to the angle for a flow-like distortion based on audio
  float audioIntensity = (u_avgMag.x + u_avgMag.y + u_avgMag.z + u_avgMag.w) * 0.25;
  float noise = mix(flow(radius, theta, 0.0), flow(radius, theta, 0.5), out_uv.x) - 0.5;
  theta += noise * mix(0.5, 1.0, audioIntensity + u_micLevel);
  if (theta < 0.0) theta += 2.0 * PI;
  // Normalize theta to [0, 2*PI]

  // Initialize the base color to white
  vec4 color = vec4(1.0, 1.0, 1.0, 1.0);

  // Original parameters for the ovals in polar coordinates
  float originalCenters[7] = float[7](0.0, 0.5 * PI, 1.0 * PI, 1.5 * PI, 2.0 * PI, 2.5 * PI, 3.0 * PI);

  // Parameters for the animated centers in polar coordinates
  float centers[7];
  for (int i = 0; i < 7; i++) {
    // Animate based on audio and time
    float audioOffset = u_cumulativeAudio[i % 4] * 0.001;
    centers[i] = originalCenters[i] + 0.5 * sin(u_time / 20.0 + u_offsets[i] + audioOffset);
  }

  float a, b;
  vec4 ovalColor;
  float bandAudio;

  // Check if the pixel is inside any of the ovals
  for (int i = 0; i < 7; i++) {
    float noise = texture(uTextureNoise, vec2(mod(centers[i] + u_time * 0.05, 1.0), 0.5)).r;

    // Modulate oval size based on audio
    bandAudio = u_avgMag[i % 4];
    a = 0.5 + noise * 0.5 + bandAudio * 0.2;
    b = noise * mix(4.5, 3.0, u_micLevel + bandAudio * 0.5);

    bool reverseGradient = i % 2 == 1;

    // Calculate the distance in polar coordinates
    float distTheta = abs(theta - centers[i]);
    if (distTheta > PI) distTheta = 2.0 * PI - distTheta;
    float distRadius = radius;
    float softness = 0.4 + audioIntensity * 0.2; // Audio-responsive softness

    // Check if the pixel is inside the oval in polar coordinates
    if (drawOval(vec2(distTheta, distRadius), vec2(0.0, 0.0), a, b, reverseGradient, softness, ovalColor)) {
      // Blend the oval color with the existing color
      color.rgb = mix(color.rgb, ovalColor.rgb, ovalColor.a);
      color.a = max(color.a, ovalColor.a);
    }
  }

  // Calculate both noisy rings
  float ringRadius1 = sharpRing(uv, theta, u_time);
  float ringRadius2 = smoothRing(uv, u_time);

  // Adjust rings based on input volume and audio
  float inputRadius1 = radius + u_micLevel * 0.3 + audioIntensity * 0.1;
  float inputRadius2 = radius + u_micLevel * 0.2 + audioIntensity * 0.15;
  float opacity1 = mix(0.3, 0.8, u_micLevel + audioIntensity);
  float opacity2 = mix(0.25, 0.6, u_micLevel + audioIntensity * 0.5);

  // Blend both rings
  float ringAlpha1 = inputRadius2 >= ringRadius1 ? opacity1 : 0.0;
  float ringAlpha2 = smoothstep(ringRadius2 - 0.05, ringRadius2 + 0.05, inputRadius1) * opacity2;
  float totalRingAlpha = max(ringAlpha1, ringAlpha2);

  // Apply screen blend mode for combined rings
  vec3 ringColor = vec3(1.0); // White ring color
  color.rgb = 1.0 - (1.0 - color.rgb) * (1.0 - ringColor * totalRingAlpha);

  // Define colours to ramp against greyscale
  vec3 color1 = vec3(0.0, 0.0, 0.0); // Black
  vec3 color2 = u_bloopColorLow; // Darker Color
  vec3 color3 = u_bloopColorMid; // Lighter Color
  vec3 color4 = u_bloopColorHigh; // White/Bright

  // Add state-based color modulation
  float stateInfluence = u_stateListen * 0.3 + u_stateSpeak * 0.5 + u_stateThink * 0.7 + u_stateHalt * 0.9;

  // Convert grayscale color to the color ramp
  float luminance = color.r * (1.0 + stateInfluence * 0.2);
  color.rgb = colorRamp(luminance, color1, color2, color3, color4);

  // Apply circle mask with audio-responsive size
  float circleRadius = 0.9 + audioIntensity * 0.1 + u_micLevel * 0.05;
  float circleMask = smoothstep(circleRadius, circleRadius - 0.1, radius);
  color.a *= circleMask;

  // Add subtle pulsing based on listening state
  float pulse = 1.0 + sin(u_time * 2.0) * 0.05 * u_isListening;
  color.rgb *= pulse;

  fragColor = color;
}`;

// Color themes (from reference)
const COLOR_THEMES = {
  BLUE: {
    main: [0.862, 0.969, 1.0], // #DCF7FF
    low: [0.004, 0.506, 0.996], // #0181FE
    mid: [0.643, 0.937, 1.0], // #A4EFFF
    high: [1.0, 0.996, 0.937] // #FFFDEF
  },
  DARK_BLUE: {
    main: [0.855, 0.961, 1.0], // #DAF5FF
    low: [0.0, 0.4, 0.8], // #0066CC
    mid: [0.18, 0.776, 0.961], // #2EC6F5
    high: [0.447, 0.918, 0.961] // #72EAF5
  },
  GREYSCALE: {
    main: [0.843, 0.843, 0.843], // #D7D7D7
    low: [0.188, 0.188, 0.188], // #303030
    mid: [0.596, 0.596, 0.596], // #989898
    high: [1.0, 1.0, 1.0] // #FFFFFF
  },
  ANGSTY_BLACK: {
    main: [0.286, 0.286, 0.286], // #494949
    low: [0.0, 0.0, 0.0], // #000000
    mid: [0.498, 0.498, 0.498], // #7F7F7F
    high: [0.412, 0.412, 0.412] // #696969
  },
  HELLO_TIBOR: {
    main: [1.0, 0.914, 0.529], // #FFE987
    low: [0.898, 0.545, 0.157], // #E58B28
    mid: [0.984, 0.447, 0.337], // #FB7256
    high: [0.953, 0.992, 0.996] // #F3FDFE
  }
} as const;

type ColorTheme = keyof typeof COLOR_THEMES;

// Advanced audio processor with frequency band analysis
class AudioProcessor {
  private callback: (data: { avgMag: number[]; cumulativeAudio: number[]; micLevel: number }) => void;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private cumulativeAudio: number[] = [0, 0, 0, 0];
  private lastUpdateTime: number = performance.now();

  constructor(callback: (data: { avgMag: number[]; cumulativeAudio: number[]; micLevel: number }) => void) {
    this.callback = callback;
  }

  async init(stream?: MediaStream) {
    try {
      this.stream = stream || await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048; // Higher resolution for better frequency analysis
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      this.update();
    } catch (error) {
      console.error('Microphone access denied or failed, using fake data', error);
      this.useFakeData();
    }
  }



  private update() {
    if (!this.analyser || !this.dataArray) return;
    this.analyser.getByteFrequencyData(this.dataArray);
    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    // Calculate frequency bands (matching reference implementation)
    const bands = 4;
    const loPass = 0;
    const hiPass = 400;
    const samplesPerBand = Math.floor((hiPass - loPass) / bands);
    const avgMag = [];
    for (let i = 0; i < bands; i++) {
      let sum = 0;
      const startIdx = loPass + i * samplesPerBand;
      const endIdx = startIdx + samplesPerBand;
      for (let j = startIdx; j < endIdx && j < this.dataArray.length; j++) {
        sum += this.dataArray[j];
      }
      const avg = (sum / samplesPerBand) / 255;
      avgMag.push(avg);
    }

    // Update cumulative audio (matching reference implementation)
    const TIME_CONSTANT = 2.0; // From reference: Hm = 2
    const GAIN_MULTIPLIER = 40; // From reference: Jm = 40
    const smoothingFactor = 1 - Math.exp(-deltaTime / TIME_CONSTANT);
    for (let i = 0; i < bands; i++) {
      const increment = avgMag[i] * deltaTime * 60 * GAIN_MULTIPLIER;
      this.cumulativeAudio[i] = this.cumulativeAudio[i] * (1 - smoothingFactor) + (this.cumulativeAudio[i] + increment) * smoothingFactor;
    }

    // Calculate overall mic level
    const micLevel = avgMag.reduce((a, b) => a + b) / bands;
    this.callback({ avgMag, cumulativeAudio: [...this.cumulativeAudio], micLevel });
    requestAnimationFrame(() => this.update());
  }

  private useFakeData() {
    const animate = () => {
      requestAnimationFrame(animate);
      const time = Date.now() / 1000;
      const avgMag = [
        Math.sin(time * 2) * 0.5 + 0.5,
        Math.sin(time * 3) * 0.5 + 0.5,
        Math.sin(time * 4) * 0.5 + 0.5,
        Math.sin(time * 5) * 0.5 + 0.5
      ];
      // Simulate cumulative audio
      for (let i = 0; i < 4; i++) {
        this.cumulativeAudio[i] += avgMag[i] * 0.016 * 60 * 40; // deltaTime * 60 * GAIN_MULTIPLIER
        this.cumulativeAudio[i] *= 0.98; // Decay
      }
      const micLevel = avgMag.reduce((a, b) => a + b) / 4;
      this.callback({ avgMag, cumulativeAudio: [...this.cumulativeAudio], micLevel });
    };
    animate();
  }

  // Process AI audio from RealtimeAPI
  processAudioData(audioData: ArrayBuffer | Float32Array) {
    if (!this.audioContext) return;
    // Convert to frequency domain for visualization
    const data = audioData instanceof ArrayBuffer ? new Float32Array(audioData) : audioData;
    // Simple amplitude analysis for AI audio
    const bands = 4;
    const samplesPerBand = Math.floor(data.length / bands);
    const avgMag = [];
    for (let i = 0; i < bands; i++) {
      let sum = 0;
      for (let j = i * samplesPerBand; j < (i + 1) * samplesPerBand && j < data.length; j++) {
        sum += Math.abs(data[j]);
      }
      avgMag.push(sum / samplesPerBand);
    }
    // Update cumulative audio
    const deltaTime = 0.016; // ~60fps
    for (let i = 0; i < bands; i++) {
      this.cumulativeAudio[i] += avgMag[i] * deltaTime * 60 * 40;
      this.cumulativeAudio[i] *= 0.98;
    }
    const micLevel = avgMag.reduce((a, b) => a + b) / bands;
    this.callback({ avgMag, cumulativeAudio: [...this.cumulativeAudio], micLevel });
  }

  cleanup() {
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
}

// Load noise texture (same as reference)
function loadNoiseTexture(gl: WebGL2RenderingContext): Promise<WebGLTexture> {
  return new Promise((resolve, reject) => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Placeholder pixel while loading
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = function() {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      resolve(texture);
    };
    image.onerror = reject;
    image.src = 'https://cdn.oaistatic.com/assets/noise-watercolor-m3j88gni.webp';
  });
}

// Main Bloop Component
export default function BloopVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const noiseTextureRef = useRef<WebGLTexture | null>(null);
  const realtimeAPIRef = useRef<RealtimeAPI | null>(null);
  const audioDataRef = useRef({ avgMag: [0, 0, 0, 0], cumulativeAudio: [0, 0, 0, 0], micLevel: 0 });
  const currentStateRef = useRef('idle');
  const themeRef = useRef<ColorTheme>('HELLO_TIBOR');
  const stateStartTimeRef = useRef(Date.now());
  const isListeningModeRef = useRef(true);
  const isCallActiveRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [uiState, setUiState] = useState({ isCallActive: false, currentState: 'idle', isListening: true, currentTheme: 'HELLO_TIBOR' as ColorTheme });

  // Trigger UI updates
  const updateUIState = useCallback(() => {
    setUiState(prev => ({ ...prev, isCallActive: isCallActiveRef.current, currentState: currentStateRef.current, isListening: isListeningModeRef.current }));
  }, []);

  // Start call function
  const handleStartCall = useCallback(async () => {
    try {
      setError(null);
      console.log('🎯 [Bloop2] Creating RealtimeAPI with callbacks...');
      const api = new RealtimeAPI({
        onUserStartSpeaking: () => {
          console.log('👤 [Bloop2] User started speaking');
          isListeningModeRef.current = false;
          updateUIState();
        },
        onUserStopSpeaking: () => {
          console.log('👤 [Bloop2] User stopped speaking');
          isListeningModeRef.current = true;
          updateUIState();
        },
        onAudioPlaybackStart: () => {
          console.log('🔊 [Bloop2] AI audio playback started');
          isListeningModeRef.current = false;
          updateUIState();
        },
        onAudioPlaybackEnd: () => {
          console.log('🔇 [Bloop2] AI audio playback ended');
          isListeningModeRef.current = true;
          updateUIState();
        },
        onError: (message: string) => {
          console.error('❌ [Bloop2] Realtime API error:', message);
          setError(message);
          isCallActiveRef.current = false;
          currentStateRef.current = 'idle';
          updateUIState();
        },
      });

      console.log('🚀 [Bloop2] Connecting to RealtimeAPI...');
      await api.connect();
      console.log('✅ [Bloop2] RealtimeAPI connected successfully');

      realtimeAPIRef.current = api;
      isCallActiveRef.current = true;
      currentStateRef.current = 'listenSpeak';
      stateStartTimeRef.current = Date.now();
      isListeningModeRef.current = true;
      updateUIState();

      // Initialize audio processor
      if (audioProcessorRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          await audioProcessorRef.current.init(stream);
        } catch (audioError) {
          console.warn('Could not setup audio visualization:', audioError);
        }
      }

      console.log('✅ [Bloop2] Call started successfully');
    } catch (error) {
      console.error('❌ [Bloop2] Failed to start call:', error);
      setError(`Failed to start call: ${error}`);
    }
  }, [updateUIState]);

  // Theme cycling
  const handleThemeChange = useCallback(() => {
    const themes: ColorTheme[] = ['HELLO_TIBOR', 'BLUE', 'DARK_BLUE', 'GREYSCALE', 'ANGSTY_BLACK'];
    const currentIndex = themes.indexOf(uiState.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    themeRef.current = nextTheme;
    setUiState(prev => ({ ...prev, currentTheme: nextTheme }));
  }, [uiState.currentTheme]);

  // End call
  const handleEndCall = useCallback(() => {
    console.log('🔴 [Bloop2] Ending call...');
    if (realtimeAPIRef.current) {
      realtimeAPIRef.current.disconnect();
      realtimeAPIRef.current = null;
    }
    isCallActiveRef.current = false;
    currentStateRef.current = 'idle';
    isListeningModeRef.current = true;
    stateStartTimeRef.current = Date.now();
    updateUIState();
    console.log('✅ [Bloop2] Call ended successfully');
  }, [updateUIState]);

  // Initialize WebGL
  const initWebGL = useCallback(() => {
    console.log('Initializing WebGL...');
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true });
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }
    console.log('WebGL2 context created');

    // Create shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader));
      return;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader));
      return;
    }

    // Create program
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Shader link failed:', gl.getProgramInfoLog(program));
      return;
    }
    console.log('Shader program linked successfully');
    gl.useProgram(program);

    glRef.current = gl;
    programRef.current = program;

    // Load noise texture
    loadNoiseTexture(gl).then(texture => {
      noiseTextureRef.current = texture;
      console.log('Noise texture loaded');
    }).catch(err => {
      console.error('Failed to load noise texture:', err);
    });

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    console.log('WebGL initialization complete');
  }, []);

  // State targets
  const stateTargets = useMemo(() => ({
    idle: { listen: 0, think: 0, speak: 0, halt: 0 },
    listen: { listen: 1, think: 0, speak: 0, halt: 0 },
    speak: { listen: 0, think: 0, speak: 1, halt: 0 },
    listenSpeak: { listen: 1, think: 0, speak: 0, halt: 0 },
    think: { listen: 0, think: 1, speak: 0, halt: 0 },
    halt: { listen: 0, think: 0, speak: 0, halt: 1 }
  }), []);

  // Use refs for interpolated states
  const interpolatedStatesRef = useRef({ listen: 0, think: 0, speak: 0, halt: 0 });
  const interpolatedListeningRef = useRef(1);
  const animationPhaseRef = useRef(0);
  const phaseSpeedRef = useRef(1.0);
  const warnedUniforms = useRef(new Set<string>());
  const ovalOffsetsRef = useRef<number[]>([
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  ]);

  // Render function
  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    const now = Date.now();
    const stateTime = (now - stateStartTimeRef.current) / 1000;

    // Phase-based animation (matching reference timing)
    const PHASE_INCREMENT = 0.016;
    const targetSpeed = isListeningModeRef.current ? 0.65 : 1.5;
    phaseSpeedRef.current = phaseSpeedRef.current * 0.95 + targetSpeed * 0.05;
    animationPhaseRef.current += PHASE_INCREMENT * phaseSpeedRef.current;

    // State transitions with smoother interpolation
    const STATE_SMOOTHING = 0.85;
    const targets = stateTargets[currentStateRef.current as keyof typeof stateTargets];
    interpolatedStatesRef.current = {
      listen: interpolatedStatesRef.current.listen * STATE_SMOOTHING + targets.listen * (1 - STATE_SMOOTHING),
      think: interpolatedStatesRef.current.think * STATE_SMOOTHING + targets.think * (1 - STATE_SMOOTHING),
      speak: interpolatedStatesRef.current.speak * STATE_SMOOTHING + targets.speak * (1 - STATE_SMOOTHING),
      halt: interpolatedStatesRef.current.halt * STATE_SMOOTHING + targets.halt * (1 - STATE_SMOOTHING)
    };

    const LISTENING_SMOOTHING = 0.96;
    const listeningTarget = isListeningModeRef.current ? 1.0 : 0.0;
    interpolatedListeningRef.current = interpolatedListeningRef.current * LISTENING_SMOOTHING + listeningTarget * (1 - LISTENING_SMOOTHING);

    // Render
    gl.viewport(0, 0, 227, 227);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set uniforms
    const setUniform = (name: string, value: any) => {
      if (name === 'u_offsets') {
        // Handle array uniform specially
        for (let i = 0; i < value.length; i++) {
          const location = gl.getUniformLocation(program, `u_offsets[${i}]`);
          if (location !== null) {
            gl.uniform1f(location, value[i]);
          }
        }
        return;
      }
      const location = gl.getUniformLocation(program, name);
      if (location === null) {
        if (!warnedUniforms.current.has(name)) {
          console.warn(`Uniform location not found: ${name}`);
          warnedUniforms.current.add(name);
        }
        return;
      }
      if (name === 'uTextureNoise') {
        gl.uniform1i(location, value);
      } else if (typeof value === 'number') {
        gl.uniform1f(location, value);
      } else if (typeof value === 'boolean') {
        gl.uniform1i(location, value ? 1 : 0);
      } else if (Array.isArray(value)) {
        if (value.length === 2) {
          gl.uniform2fv(location, value);
        } else if (value.length === 3) {
          gl.uniform3fv(location, value);
        } else if (value.length === 4) {
          gl.uniform4fv(location, value);
        }
      }
    };

    const colors = COLOR_THEMES[themeRef.current];
    const micLevel = currentStateRef.current === 'listenSpeak' ? audioDataRef.current.micLevel : audioDataRef.current.micLevel * 0.5;

    setUniform('u_time', animationPhaseRef.current);
    setUniform('u_stateTime', stateTime);
    setUniform('u_micLevel', micLevel);
    setUniform('u_viewport', [227, 227]);
    setUniform('u_bloopColorMain', [...colors.main]);
    setUniform('u_bloopColorLow', [...colors.low]);
    setUniform('u_bloopColorMid', [...colors.mid]);
    setUniform('u_bloopColorHigh', [...colors.high]);
    setUniform('u_avgMag', audioDataRef.current.avgMag);
    setUniform('u_cumulativeAudio', audioDataRef.current.cumulativeAudio);
    setUniform('u_stateListen', interpolatedStatesRef.current.listen);
    setUniform('u_stateThink', interpolatedStatesRef.current.think);
    setUniform('u_stateSpeak', interpolatedStatesRef.current.speak);
    setUniform('u_stateHalt', interpolatedStatesRef.current.halt);
    setUniform('u_isListening', interpolatedListeningRef.current);
    setUniform('u_offsets', ovalOffsetsRef.current);

    if (noiseTextureRef.current) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noiseTextureRef.current);
      setUniform('uTextureNoise', 0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    animationFrameRef.current = requestAnimationFrame(render);
  }, [stateTargets]);

  // Initialize
  useEffect(() => {
    console.log('🚀 [Bloop2] Component initialization starting...');
    initWebGL();

    // Initialize audio processor with callback
    audioProcessorRef.current = new AudioProcessor((data) => {
      audioDataRef.current = data;
    });
    audioProcessorRef.current.init();

    console.log('Audio processor initialized');

    // Start render loop
    const startRenderLoop = () => {
      if (glRef.current && programRef.current && !animationFrameRef.current) {
        render();
        console.log('Render loop started');
      } else {
        setTimeout(startRenderLoop, 100);
      }
    };
    startRenderLoop();

    return () => {
      console.log('🧹 [Bloop2] Component cleanup...');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioProcessorRef.current) {
        audioProcessorRef.current.cleanup();
      }
      if (realtimeAPIRef.current) {
        console.log('🔌 [Bloop2] Cleaning up RealtimeAPI connection...');
        realtimeAPIRef.current.disconnect();
      }
    };
  }, [initWebGL, render]);

  // Get theme-based button colors
  const getThemeButtonColors = (theme: ColorTheme) => {
    const themeColors = COLOR_THEMES[theme];
    const toRgb = (color: readonly number[]) => `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
    return {
      background: toRgb(themeColors.low),
      hover: toRgb(themeColors.mid),
      text: theme === 'ANGSTY_BLACK' || theme === 'GREYSCALE' ? 'white' : 'white'
    };
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen overflow-hidden bg-white">
      {/* Main Canvas */}
      <div className="flex-1 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="rounded-xl"
          style={{ width: '227px', height: '227px' }}
          width={227}
          height={227}
        />
      </div>

      {/* Call Button */}
      <div className="pb-20 flex flex-col items-center gap-4">
        <button
          onClick={uiState.isCallActive ? handleEndCall : handleStartCall}
          disabled={!!error}
          className={`px-8 py-4 w-[210px] rounded-full font-semibold text-lg transition-all duration-300 shadow-lg active:scale-95 ${
            uiState.isCallActive
              ? 'bg-black hover:bg-gray-800 text-white'
              : error
              ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
              : 'bg-white hover:bg-gray-100 text-black border border-black'
          }`}
        >
          {uiState.isCallActive ? 'End Call' : error ? 'Error - Try Again' : 'Start Call'}
        </button>

        {/* Theme Change Button */}
        <button
          onClick={handleThemeChange}
          className="px-8 py-4 w-[210px] rounded-full font-semibold text-lg transition-all duration-300 shadow-lg active:scale-95 hover:opacity-90"
          style={{
            backgroundColor: getThemeButtonColors(uiState.currentTheme).background,
            color: getThemeButtonColors(uiState.currentTheme).text
          }}
        >
          Theme
        </button>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm max-w-md text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}