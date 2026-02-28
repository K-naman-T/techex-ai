import { Canvas } from '@react-three/fiber';
import { Experience } from '../3d/Experience';

export const Scene3D = ({ isSpeaking, analyser }) => {
    return (
        <div className="absolute inset-0 z-0">
            <Canvas shadows camera={{ position: [0, 1.65, 1.3], fov: 30 }}>
                <color attach="background" args={['#050505']} />
                <Experience isSpeaking={isSpeaking} analyser={analyser} />
            </Canvas>
        </div>
    );
};
