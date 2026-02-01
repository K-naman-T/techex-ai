import React, { useEffect, useRef, useMemo } from 'react';
import { useGLTF, useAnimations, useFBX, useTexture } from '@react-three/drei';
import { useFrame, useGraph } from '@react-three/fiber';
import * as THREE from 'three';

export function Avatar({ isSpeaking }) {
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
    if (isSpeaking && talk) {
      idle?.fadeOut(0.5);
      talk.reset().fadeIn(0.5).play();
    } else if (idle) {
      talk?.fadeOut(0.5);
      idle.reset().fadeIn(0.5).play();
    }
  }, [isSpeaking, actions]);

  useEffect(() => {
    if (actions['Idle']) actions['Idle'].play();
  }, [actions]);

  // 4. FRAME LOOP
  useFrame((state) => {
    // LIP SYNC
    const head = nodes.Wolf3D_Head;
    const teeth = nodes.Wolf3D_Teeth;
    if (head?.morphTargetInfluences) {
      const mouthOpenIndex = head.morphTargetDictionary['mouthOpen'];
      if (mouthOpenIndex !== undefined) {
          let targetOpen = 0;
          if (isSpeaking) {
            const t = state.clock.elapsedTime;
            targetOpen = ((Math.sin(t * 25) + Math.cos(t * 10) + 2) / 8) + 0.1;
          }
          head.morphTargetInfluences[mouthOpenIndex] = THREE.MathUtils.lerp(
            head.morphTargetInfluences[mouthOpenIndex], targetOpen, 0.6
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