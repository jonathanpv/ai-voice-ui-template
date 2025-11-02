'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeAPI } from '../../components/VoiceLandingPage/RealtimeAPI';

// Vertex Shader (same as reference)
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

// Fragment Shader - EXACT copy from reference with proper formatting
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

#define E (2.71828182846)
#define pi (3.14159265358979323844)
#define NUM_OCTAVES (4)

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

// --- DATA STRUCTURES ---
struct ColoredSDF {
    float distance;
    vec4 color;
};

struct SDFArgs {
    vec2 st;
    float amount;
    float duration;
    float time;
    float mainRadius;
};

// --- UTILITY & NOISE FUNCTIONS ---
float spring(float t, float d) { return 1.0 - exp(-E * 2.0 * t) * cos((1.0 - d) * 115.0 * t); }
float scaled(float edge0, float edge1, float x) { return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0); }
float fixedSpring(float t, float d) { 
    float s = mix(1.0 - exp(-E * 2.0 * t) * cos((1.0 - d) * 115.0 * t), 1.0, clamp(t, 0.0, 1.0)); 
    return s * (1.0 - t) + t; 
}
float opSmoothUnion(float d1, float d2, float k) { 
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0); 
    return mix(d2, d1, h) - k * h * (1.0 - h); 
}
vec2 rotate(vec2 v, float a) { 
    float s = sin(a); 
    float c = cos(a); 
    return mat2(c, s, -s, c) * v; 
}

vec3 blendLinearBurn_13_5(vec3 base, vec3 blend, float opacity) {
    return (max(base + blend - vec3(1.0), vec3(0.0))) * opacity + base * (1.0 - opacity);
}

vec4 permute(vec4 x) { return mod((x * 34.0 + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }

float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u * u * (3.0 - 2.0 * u);
    float res = mix(
        mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
        mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
        u.y
    );
    return res * res;
}

float fbm(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < NUM_OCTAVES; ++i) {
        v += a * noise(x);
        x = rot * x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

float cnoise(vec3 P) {
    vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0); 
    Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x); 
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = vec4(Pi0.z); vec4 iz1 = vec4(Pi1.z);
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
    vec4 gx0 = ixy0 / 7.0; vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5; 
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0); 
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(vec4(0.0), gx0) - 0.5); 
    gy0 -= sz0 * (step(vec4(0.0), gy0) - 0.5);
    vec4 gx1 = ixy1 / 7.0; vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5; 
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1); 
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(vec4(0.0), gx1) - 0.5); 
    gy1 -= sz1 * (step(vec4(0.0), gy1) - 0.5);
    vec3 g000 = vec3(gx0.x, gy0.x, gz0.x); vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
    vec3 g010 = vec3(gx0.z, gy0.z, gz0.z); vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
    vec3 g001 = vec3(gx1.x, gy1.x, gz1.x); vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
    vec3 g011 = vec3(gx1.z, gy1.z, gz1.z); vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);
    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
    float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z)); float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz)); float n111 = dot(g111, Pf1);
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
}

// --- STATE SHADER LOGIC ---
ColoredSDF applyIdleState(ColoredSDF sdf, SDFArgs args) {
    float radius = 0.33;
    float d = length(args.st) - radius;
    sdf.distance = mix(sdf.distance, d, args.amount);
    sdf.color = mix(sdf.color, vec4(u_bloopColorLow, 1.0), args.amount);
    return sdf;
}

ColoredSDF applyThinkState(ColoredSDF sdf, SDFArgs args) {
    float d = 1000.0;
    int count = 5;
    float entryAnimation = spring(scaled(0.0, 1.0, args.duration), 1.0);
    for (int i = 0; i < count; i++) {
        float f = float(i + 1) / float(count);
        float a = -f * pi * 2.0 + args.time / 3.0 + spring(scaled(0.0, 10.0, args.duration), 1.0) * pi / 2.0;
        float ringRadi = args.mainRadius * 0.45 * entryAnimation;
        ringRadi -= (sin(entryAnimation * pi * 4.0 + a * pi * 2.0 + args.time * 3.0) * 0.5 + 0.5) * args.mainRadius * 0.1;
        vec2 pos = vec2(cos(a), sin(a)) * ringRadi;
        float dd = length(args.st - pos) - args.mainRadius * 0.5;
        d = opSmoothUnion(d, dd, 0.03 * scaled(0.0, 10.0, args.duration) + 0.8 * (1.0 - entryAnimation));
    }
    sdf.distance = mix(sdf.distance, d, args.amount);
    sdf.color = mix(sdf.color, vec4(1.0), args.amount);
    return sdf;
}

ColoredSDF applyHaltState(ColoredSDF sdf, SDFArgs args) {
    float radius = mix(0.4, 0.45, sin(args.time * 0.25) * 0.5 + 0.5);
    float strokeWidth = mix(radius / 2.0, 0.02, args.amount);
    radius -= strokeWidth;
    radius *= mix(0.7, 1.0, args.amount);
    float circle = abs(length(args.st) - radius) - strokeWidth;
    sdf.distance = mix(sdf.distance, circle, args.amount);
    sdf.color = mix(sdf.color, vec4(1.0, 0.2, 0.2, 0.8), args.amount);
    return sdf;
}

// Active State (Listen/Speak) - Exact watercolor effect from reference
ColoredSDF applyActiveState(ColoredSDF sdf, SDFArgs args) {
    float listeningAmount = u_isListening;
    float entryAnimation = fixedSpring(scaled(0.0, 2.0, args.duration), 0.92);
    
    // Radius calculation matching reference exactly
    float radius = mix(0.43, 0.37, listeningAmount) * entryAnimation + u_micLevel * 0.065;
    
    // Oscillation for visual interest
    float maxDisplacement = 0.01;
    float oscillationPeriod = 4.0;
    float displacementOffset = maxDisplacement * sin(2.0 * pi / oscillationPeriod * args.time);
    vec2 adjusted_st = args.st - vec2(0.0, displacementOffset);

    // --- Core watercolor effect from reference ---
    vec4 uAudioAverage = u_avgMag;
    vec4 uCumulativeAudio = u_cumulativeAudio;

    float scaleFactor = 1.0 / (2.0 * radius);
    vec2 uv = adjusted_st * scaleFactor + 0.5;
    uv.y = 1.0 - uv.y;

    // EXACT parameters from reference
    float noiseScale = 1.25;
    float windSpeed = 0.075;
    float warpPower = 0.19;
    float waterColorNoiseScale = 18.0;
    float waterColorNoiseStrength = 0.01;
    float textureNoiseScale = 1.0;
    float textureNoiseStrength = 0.08;
    float verticalOffset = 0.09;
    float waveSpread = 1.0;
    float layer1Amplitude = 1.0;
    float layer1Frequency = 1.0;
    float layer2Amplitude = 1.0;
    float layer2Frequency = 1.0;
    float layer3Amplitude = 1.0;
    float layer3Frequency = 1.0;
    float fbmStrength = 1.0;
    float fbmPowerDamping = 0.55;
    float overallSoundScale = 1.0;
    float blurRadius = 1.0;
    float timescale = 1.0;

    float time = args.time * timescale * 0.85;
    vec3 sinOffsets = vec3(
        uCumulativeAudio.x * 0.15 * overallSoundScale,
        -uCumulativeAudio.y * 0.5 * overallSoundScale,
        uCumulativeAudio.z * 1.5 * overallSoundScale
    );
    verticalOffset += 1.0 - waveSpread;

    // Warp UV with noise
    float noiseX = cnoise(vec3(uv * 1.0 + vec2(0.0, 74.8572), (time + uCumulativeAudio.x * 0.05 * overallSoundScale) * 0.3));
    float noiseY = cnoise(vec3(uv * 1.0 + vec2(203.91282, 10.0), (time + uCumulativeAudio.z * 0.05 * overallSoundScale) * 0.3));
    uv += vec2(noiseX * 2.0, noiseY) * warpPower;

    // Water color noise
    float noiseA = cnoise(vec3(uv * waterColorNoiseScale + vec2(344.91282, 0.0), time * 0.3)) +
                   cnoise(vec3(uv * waterColorNoiseScale * 2.2 + vec2(723.937, 0.0), time * 0.4)) * 0.5;
    uv += noiseA * waterColorNoiseStrength;
    uv.y -= verticalOffset;

    // Texture noise displacement
    vec2 textureUv = uv * textureNoiseScale;
    float textureSampleR0 = texture(uTextureNoise, textureUv).r;
    float textureSampleG0 = texture(uTextureNoise, vec2(textureUv.x, 1.0 - textureUv.y)).g;
    float textureNoiseDisp0 = mix(textureSampleR0 - 0.5, textureSampleG0 - 0.5, (sin(time + uCumulativeAudio.a * 2.0) + 1.0) * 0.5) * textureNoiseStrength;

    textureUv += vec2(63.861 + uCumulativeAudio.x * 0.05, 368.937);
    float textureSampleR1 = texture(uTextureNoise, textureUv).r;
    float textureSampleG1 = texture(uTextureNoise, vec2(textureUv.x, 1.0 - textureUv.y)).g;
    float textureNoiseDisp1 = mix(textureSampleR1 - 0.5, textureSampleG1 - 0.5, (sin(time + uCumulativeAudio.a * 2.0) + 1.0) * 0.5) * textureNoiseStrength;

    textureUv += vec2(272.861, 829.937 + uCumulativeAudio.y * 0.1);
    textureUv += vec2(180.302 - uCumulativeAudio.z * 0.1, 819.871);
    float textureSampleR3 = texture(uTextureNoise, textureUv).r;
    float textureSampleG3 = texture(uTextureNoise, vec2(textureUv.x, 1.0 - textureUv.y)).g;
    float textureNoiseDisp3 = mix(textureSampleR3 - 0.5, textureSampleG3 - 0.5, (sin(time + uCumulativeAudio.a * 2.0) + 1.0) * 0.5) * textureNoiseStrength;
    uv += textureNoiseDisp0;

    // FBM noise
    vec2 st_fbm = uv * noiseScale;
    vec2 q = vec2(0.0);
    q.x = fbm(st_fbm * 0.5 + windSpeed * (time + uCumulativeAudio.a * 0.175 * overallSoundScale));
    q.y = fbm(st_fbm * 0.5 + windSpeed * (time + uCumulativeAudio.x * 0.136 * overallSoundScale));
    vec2 r = vec2(0.0);
    r.x = fbm(st_fbm + 1.0 * q + vec2(0.3, 9.2) + 0.15 * (time + uCumulativeAudio.y * 0.234 * overallSoundScale));
    r.y = fbm(st_fbm + 1.0 * q + vec2(8.3, 0.8) + 0.126 * (time + uCumulativeAudio.z * 0.165 * overallSoundScale));
    float f = fbm(st_fbm + r - q);
    float fullFbm = (f + 0.6 * f * f + 0.7 * f + 0.5) * 0.5;
    fullFbm = pow(fullFbm, fbmPowerDamping);
    fullFbm *= fbmStrength;

    // Wave layers
    blurRadius = blurRadius * 1.5;

    vec2 snUv = (uv + vec2((fullFbm - 0.5) * 1.2) + vec2(0.0, 0.025) + textureNoiseDisp0) * vec2(layer1Frequency, 1.0);
    float sn = noise(snUv * 2.0 + vec2(sin(sinOffsets.x * 0.25), time * 0.5 + sinOffsets.x)) * 2.0 * layer1Amplitude;
    float sn2 = smoothstep(sn - 1.2 * blurRadius, sn + 1.2 * blurRadius, (snUv.y - 0.5 * waveSpread) * (5.0 - uAudioAverage.x * 0.1 * overallSoundScale * 0.5) + 0.5);

    vec2 snUvBis = (uv + vec2((fullFbm - 0.5) * 0.85) + vec2(0.0, 0.025) + textureNoiseDisp1) * vec2(layer2Frequency, 1.0);
    float snBis = noise(snUvBis * 4.0 + vec2(sin(sinOffsets.y * 0.15) * 2.4 + 293.0, time * 1.0 + sinOffsets.y * 0.5)) * 2.0 * layer2Amplitude;
    float sn2Bis = smoothstep(snBis - (0.9 + uAudioAverage.y * 0.4 * overallSoundScale) * blurRadius, snBis + (0.9 + uAudioAverage.y * 0.8 * overallSoundScale) * blurRadius, (snUvBis.y - 0.6 * waveSpread) * (5.0 - uAudioAverage.y * 0.75) + 0.5);
    
    vec2 snUvThird = (uv + vec2((fullFbm - 0.5) * 1.1) + textureNoiseDisp3) * vec2(layer3Frequency, 1.0);
    float snThird = noise(snUvThird * 6.0 + vec2(sin(sinOffsets.z * 0.1) * 2.4 + 153.0, time * 1.2 + sinOffsets.z * 0.8)) * 2.0 * layer3Amplitude;
    float sn2Third = smoothstep(snThird - 0.7 * blurRadius, snThird + 0.7 * blurRadius, (snUvThird.y - 0.9 * waveSpread) * 6.0 + 0.5);
    
    sn2 = pow(sn2, 0.8);
    sn2Bis = pow(sn2Bis, 0.9);

    // Color blending
    vec3 sinColor;
    sinColor = blendLinearBurn_13_5(u_bloopColorMain, u_bloopColorLow, 1.0 - sn2);
    sinColor = blendLinearBurn_13_5(sinColor, mix(u_bloopColorMain, u_bloopColorMid, 1.0 - sn2Bis), sn2);
    sinColor = mix(sinColor, mix(u_bloopColorMain, u_bloopColorHigh, 1.0 - sn2Third), sn2 * sn2Bis);

    sdf.color = mix(sdf.color, vec4(sinColor, 1.0), args.amount);
    sdf.distance = mix(sdf.distance, length(adjusted_st) - radius, args.amount);

    return sdf;
}

// --- MAIN SHADER ENTRYPOINT ---
void main() {
    vec2 st = out_uv - 0.5;
    st.y *= u_viewport.y / u_viewport.x;
    
    ColoredSDF sdf;
    sdf.distance = 1000.0;
    sdf.color = vec4(1.0);
    
    SDFArgs args;
    args.st = st;
    args.time = u_time;
    args.mainRadius = 0.49;
    
    float idleAmount = max(0.0, 1.0 - (u_stateListen + u_stateThink + u_stateSpeak + u_stateHalt));
    
    // State Application & Blending
    SDFArgs idleArgs = args;
    idleArgs.amount = idleAmount;
    idleArgs.duration = u_time;
    sdf = applyIdleState(sdf, idleArgs);
    
    // Combined Listen/Speak state
    float activeAmount = max(u_stateListen, u_stateSpeak);
    if (activeAmount > 0.0) {
        SDFArgs activeArgs = args;
        activeArgs.amount = activeAmount;
        activeArgs.duration = u_stateTime;
        sdf = applyActiveState(sdf, activeArgs);
    }
    
    if (u_stateThink > 0.0) {
        SDFArgs thinkArgs = args;
        thinkArgs.amount = u_stateThink;
        thinkArgs.duration = u_stateTime;
        sdf = applyThinkState(sdf, thinkArgs);
    }
    
    if (u_stateHalt > 0.0) {
        SDFArgs haltArgs = args;
        haltArgs.amount = u_stateHalt;
        haltArgs.duration = u_stateTime;
        sdf = applyHaltState(sdf, haltArgs);
    }
    
    // Final Rendering
    float clampingTolerance = 0.0075;
    float clampedShape = smoothstep(clampingTolerance, 0.0, sdf.distance);
    float alpha = sdf.color.a * clampedShape;
    
    fragColor = vec4(sdf.color.rgb * alpha, alpha);
}`;

// Color themes (from reference)
const COLOR_THEMES = {
  BLUE: {
    main: [0.862, 0.969, 1.0],      // #DCF7FF
    low: [0.004, 0.506, 0.996],     // #0181FE  
    mid: [0.643, 0.937, 1.0],       // #A4EFFF
    high: [1.0, 0.996, 0.937]       // #FFFDEF
  },
  DARK_BLUE: {
    main: [0.855, 0.961, 1.0],      // #DAF5FF
    low: [0.0, 0.4, 0.8],           // #0066CC
    mid: [0.18, 0.776, 0.961],      // #2EC6F5
    high: [0.447, 0.918, 0.961]     // #72EAF5
  },
  GREYSCALE: {
    main: [0.843, 0.843, 0.843],    // #D7D7D7
    low: [0.188, 0.188, 0.188],     // #303030
    mid: [0.596, 0.596, 0.596],     // #989898
    high: [1.0, 1.0, 1.0]           // #FFFFFF
  },
  ANGSTY_BLACK: {
    main: [0.286, 0.286, 0.286],    // #494949
    low: [0.0, 0.0, 0.0],           // #000000
    mid: [0.498, 0.498, 0.498],     // #7F7F7F
    high: [0.412, 0.412, 0.412]     // #696969
  },
  HELLO_TIBOR: {
    main: [1.0, 0.914, 0.529],      // #FFE987
    low: [0.898, 0.545, 0.157],     // #E58B28
    mid: [0.984, 0.447, 0.337],     // #FB7256
    high: [0.953, 0.992, 0.996]     // #F3FDFE
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
    } catch (err) {
      console.log('Microphone access denied or failed, using fake data');
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
      this.cumulativeAudio[i] = this.cumulativeAudio[i] * (1 - smoothingFactor) + 
                                 (this.cumulativeAudio[i] + increment) * smoothingFactor;
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
    const data = audioData instanceof ArrayBuffer 
      ? new Float32Array(audioData) 
      : audioData;
    
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
  const [uiState, setUiState] = useState({
    isCallActive: false,
    currentState: 'idle',
    isListening: true,
    currentTheme: 'HELLO_TIBOR' as ColorTheme
  });

  // Trigger UI updates
  const updateUIState = useCallback(() => {
    setUiState(prev => ({
      ...prev,
      isCallActive: isCallActiveRef.current,
      currentState: currentStateRef.current,
      isListening: isListeningModeRef.current
    }));
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
  const stateTargets = {
    idle:        { listen: 0, think: 0, speak: 0, halt: 0 },
    listen:      { listen: 1, think: 0, speak: 0, halt: 0 },
    speak:       { listen: 0, think: 0, speak: 1, halt: 0 },
    listenSpeak: { listen: 1, think: 0, speak: 0, halt: 0 },
    think:       { listen: 0, think: 1, speak: 0, halt: 0 },
    halt:        { listen: 0, think: 0, speak: 0, halt: 1 }
  } as const;

  // Use refs for interpolated states
  const interpolatedStatesRef = useRef({ listen: 0, think: 0, speak: 0, halt: 0 });
  const interpolatedListeningRef = useRef(1);
  const animationPhaseRef = useRef(0);
  const phaseSpeedRef = useRef(1.0);
  const warnedUniforms = useRef(new Set<string>());

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
    interpolatedListeningRef.current = interpolatedListeningRef.current * LISTENING_SMOOTHING + 
      listeningTarget * (1 - LISTENING_SMOOTHING);
    
    // Render
    gl.viewport(0, 0, 227, 227);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set uniforms
    const setUniform = (name: string, value: any) => {
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
    const micLevel = currentStateRef.current === 'listenSpeak' 
      ? audioDataRef.current.micLevel 
      : audioDataRef.current.micLevel * 0.5;
    
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

    if (noiseTextureRef.current) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noiseTextureRef.current);
      setUniform('uTextureNoise', 0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    animationFrameRef.current = requestAnimationFrame(render);
  }, []);

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
  }, []);

  // Get theme-based button colors
  const getThemeButtonColors = (theme: ColorTheme) => {
    const themeColors = COLOR_THEMES[theme];
    const toRgb = (color: readonly number[]) => 
      `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
    
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