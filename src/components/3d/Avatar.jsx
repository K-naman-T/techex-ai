import React, { useEffect, useRef, useMemo } from 'react';
import { useGLTF, useAnimations, useFBX, useTexture } from '@react-three/drei';
import { useFrame, useGraph } from '@react-three/fiber';
import * as THREE from 'three';

export function Avatar({ isSpeaking, analyser }) {
  const group = useRef();

  // 1. Load Assets
  const { scene } = useGLTF('/avatar.glb');
  const { nodes } = useGraph(scene);

  // 2. Load animations
  const idleFbx = useFBX('/Idle.fbx');
  const talkingFbx = useFBX('/Talking.fbx');

  // 3. Clean Animations
  const animations = useMemo(() => {
    const clips = [];
    const idleRaw = (idleFbx && idleFbx.animations) ? idleFbx.animations : [];
    const talkingRaw = (talkingFbx && talkingFbx.animations) ? talkingFbx.animations : [];

    const cleanClip = (clip, name) => {
      if (!clip) return null;
      const cloned = clip.clone();
      cloned.name = name;
      const newTracks = [];
      cloned.tracks.forEach(track => {
        let newName = track.name.replace(/^mixamorig:?/, '');
        if (newName === 'Hips.quaternion') return;
        track.name = newName;
        newTracks.push(track);
      });
      cloned.tracks = newTracks;
      cloned.tracks = cloned.tracks.filter(t => !t.name.match(/\.scale$/));
      return cloned;
    };

    if (idleRaw.length > 0) clips.push(cleanClip(idleRaw[0], 'Idle'));
    if (talkingRaw.length > 0) clips.push(cleanClip(talkingRaw[0], 'Talking'));

    return clips;
  }, [idleFbx, talkingFbx]);

  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const idle = actions['Idle'];
    const talk = actions['Talking'];
    if (idle) {
      idle.reset().play();
      idle.setEffectiveWeight(1);
    }
    if (talk) {
      talk.reset().play();
      talk.setEffectiveWeight(0);
    }
  }, [actions]);

  // 4. FRAME LOOP
  useFrame((state) => {
    // 1. Audio Intensity Analysis
    let intensity = 0;
    if (isSpeaking && analyser) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const average = sum / dataArray.length;
      intensity = Math.min(1, (average / 128) * 1.5);
    }

    // 2. Gesture Synchronization (Arms/Body)
    const idleAction = actions['Idle'];
    const talkAction = actions['Talking'];
    if (idleAction && talkAction) {
      // If we stop speaking, drop talk weight to 0 immediately to return to Idle
      const targetTalkWeight = isSpeaking ? (intensity > 0.05 ? 1 : 0) : 0;
      const currentTalkWeight = talkAction.getEffectiveWeight();
      const nextTalkWeight = THREE.MathUtils.lerp(currentTalkWeight, targetTalkWeight, 0.1);

      talkAction.setEffectiveWeight(nextTalkWeight);
      idleAction.setEffectiveWeight(1 - nextTalkWeight);
    }

    // 3. Lip Synchronization
    const head = nodes.Wolf3D_Head;
    const teeth = nodes.Wolf3D_Teeth;
    if (head?.morphTargetInfluences) {
      const mouthOpenIndex = head.morphTargetDictionary['mouthOpen'];
      if (mouthOpenIndex !== undefined) {
        head.morphTargetInfluences[mouthOpenIndex] = THREE.MathUtils.lerp(
          head.morphTargetInfluences[mouthOpenIndex], intensity, 0.4
        );
        if (teeth?.morphTargetInfluences) {
          teeth.morphTargetInfluences[teeth.morphTargetDictionary['mouthOpen']] = head.morphTargetInfluences[mouthOpenIndex];
        }
      }
    }

    // LOCKS
    if (nodes.Neck) nodes.Neck.rotation.set(0, 0, 0);
    if (nodes.Head) nodes.Head.rotation.set(0, 0, 0);
    if (nodes.Hips) {
      nodes.Hips.rotation.set(0, 0, 0);
      nodes.Hips.position.set(0, 1.0, 0);
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/avatar.glb');