import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VertexShader = `
uniform float uTime;
uniform float uAudio;
varying vec2 vUv;
varying float vDisplacement;

// Simplex Noise (simplified for brevity)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vUv = uv;
  
  // Noise frequency and amplitude based on audio
  float noiseFreq = 2.0;
  float noiseAmp = 0.4 + (uAudio * 0.8); 
  
  vec3 noisePos = vec3(position.x * noiseFreq + uTime, position.y * noiseFreq + uTime, position.z * noiseFreq);
  float noise = snoise(noisePos);
  
  vDisplacement = noise;
  
  vec3 newPos = position + normal * (noise * noiseAmp);
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
`;

const FragmentShader = `
uniform float uTime;
uniform float uAudio;
varying float vDisplacement;
varying vec2 vUv;

void main() {
  // Base color (Dark Tech Blue)
  vec3 color1 = vec3(0.0, 0.1, 0.2);
  
  // Highlight color (Cyan/Electric Blue)
  vec3 color2 = vec3(0.0, 0.8, 1.0);
  
  // Mix based on displacement
  float mixStrength = smoothstep(-0.2, 0.5, vDisplacement);
  vec3 color = mix(color1, color2, mixStrength);
  
  // Add pulse glow based on audio
  color += vec3(0.0, 0.5, 0.8) * uAudio * 0.8;
  
  // Fresnel-like rim glow
  float glow = 0.0; // Simplified for now
  
  gl_FragColor = vec4(color, 1.0);
}
`;

export const OrbAvatar = ({ isSpeaking, isListening, analyser }) => {
  const meshRef = useRef();
  
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudio: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    const { clock } = state;
    if (meshRef.current) {
      // Update Time
      meshRef.current.material.uniforms.uTime.value = clock.getElapsedTime() * 0.5;

      // Update Audio Data
      let audioValue = 0;
      if (analyser && isSpeaking) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average of lower frequencies (bass/speech)
        let sum = 0;
        const range = Math.floor(dataArray.length / 4); // First quarter of frequencies
        for (let i = 0; i < range; i++) {
          sum += dataArray[i];
        }
        // Normalize 0-255 to 0.0-1.0
        const rawAvg = sum / range / 255;
        audioValue = rawAvg;
      }

      // Smooth interpolation for audio value
      meshRef.current.material.uniforms.uAudio.value += (audioValue - meshRef.current.material.uniforms.uAudio.value) * 0.15;
      
      // Rotate mesh slowly
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.z += 0.001;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <icosahedronGeometry args={[1, 60]} />
      <shaderMaterial
        fragmentShader={FragmentShader}
        vertexShader={VertexShader}
        uniforms={uniforms}
        wireframe={true} // Techy look
        transparent={true}
      />
    </mesh>
  );
};
