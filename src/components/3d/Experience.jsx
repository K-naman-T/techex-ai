import { Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import { Avatar } from './Avatar';

export const Experience = ({ isSpeaking, analyser }) => {
  return (
    <>
      {/* Fixed POV - Locked Controls */}
      <OrbitControls
        enableZoom={false}
        enableRotate={false}
        enablePan={false}
        target={[0, 1.65, 0]} // Look at Head Height
      />

      <Environment preset="city" />

      {/* 
         Align Avatar:
         Position at Y=0 (Floor). Camera looks at Y=1.65 (Head).
      */}
      <group position-y={0}>
        <ContactShadows opacity={0.4} scale={10} blur={1} far={10} resolution={256} color="#000000" />
        <Avatar isSpeaking={isSpeaking} analyser={analyser} />
      </group>

      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      {/* Add a rim light for that sci-fi look */}
      <spotLight position={[-5, 5, -5]} intensity={2} color="#00f0ff" />
    </>
  );
};