import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../state/store';
import { audioManager } from '../audio/AudioContextManager';

export function Avatar(props) {
    const group = useRef();
    const headRef = useRef();

    // Revert to original professional model
    // Using simple nodes access since this model structure is known
    const { scene, nodes } = useGLTF('/models/avatar.glb');

    const interactionState = useStore((state) => state.interactionState);
    const audioData = useMemo(() => new Uint8Array(256), []);
    const blinkTimer = useRef(0);
    const blinkInterval = 3000;

    // Initialize Audio Context
    useEffect(() => {
        const unlockAudio = () => audioManager.resume();
        window.addEventListener('click', unlockAudio);
        return () => window.removeEventListener('click', unlockAudio);
    }, []);

    // Setup Avatar Pose (Fix T-Pose -> A-Pose)
    useEffect(() => {
        if (!scene) return;

        scene.traverse((child) => {
            // Find Head for tracking
            if (child.isMesh && child.morphTargetDictionary && (child.name.match(/head|face|wolf3d/i))) {
                headRef.current = child;
            }

            // Procedurally fix T-Pose (Arms down at sides)
            if (child.isBone) {
                // Left Arm
                if (child.name === 'LeftArm' || child.name === 'ArmLeft') {
                    // Rotate Z to bring arm down (approx 75 degrees)
                    child.rotation.z = 1.3;
                    child.rotation.x = 0.1; // Slight natural curve forward
                }
                // Right Arm
                if (child.name === 'RightArm' || child.name === 'ArmRight') {
                    child.rotation.z = -1.3; // Mirror for right arm
                    child.rotation.x = 0.1;
                }
            }
        });
    }, [scene, nodes]);

    useFrame((state, delta) => {
        // 0. Idle Motion - Procedural breathing since we removed the dancing animation
        if (group.current) {
            group.current.position.y = -1.8 + Math.sin(state.clock.elapsedTime * 0.5) * 0.002;
        }

        // 1. Head Tracking
        const headBone = group.current.getObjectByName('Head') || group.current.getObjectByName('Neck');
        if (headBone) {
            const targetX = (state.pointer.x * 0.3);
            const targetY = (state.pointer.y * 0.3);

            // Smooth look-at
            headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, targetX, 0.1);
            headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, -targetY, 0.1);
        }

        // 2 & 3. Lip Sync & Blink
        if (headRef.current && headRef.current.morphTargetDictionary) {
            // Blink
            blinkTimer.current += delta * 1000;
            if (blinkTimer.current > blinkInterval) {
                const blinkValue = Math.sin((blinkTimer.current - blinkInterval) / 100 * Math.PI);
                const leftEye = headRef.current.morphTargetDictionary['eyeBlinkLeft'];
                const rightEye = headRef.current.morphTargetDictionary['eyeBlinkRight'];
                if (leftEye !== undefined) headRef.current.morphTargetInfluences[leftEye] = Math.max(0, blinkValue);
                if (rightEye !== undefined) headRef.current.morphTargetInfluences[rightEye] = Math.max(0, blinkValue);
                if (blinkTimer.current > blinkInterval + 200) blinkTimer.current = 0;
            }

            // Audio
            const analyser = audioManager.getAnalyser();
            if (analyser) {
                analyser.getByteFrequencyData(audioData);
                const average = audioData.reduce((a, b) => a + b) / audioData.length;
                const normalizedVolume = Math.min(1, average / 40);

                const jawIdx = headRef.current.morphTargetDictionary['jawOpen'];
                if (jawIdx !== undefined) {
                    headRef.current.morphTargetInfluences[jawIdx] = THREE.MathUtils.lerp(
                        headRef.current.morphTargetInfluences[jawIdx],
                        normalizedVolume * 0.8,
                        0.3
                    );
                }
            }
        }
    });

    return (
        <group ref={group} {...props} dispose={null}>
            <primitive object={scene || nodes.Scene || nodes.root} />
        </group>
    );
}

useGLTF.preload('/models/avatar.glb');
