/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { StarSimulation, StarGameStats } from './game/StarSimulation';
import { EnvironmentScene } from './game/EnvironmentScene';
import { WebXRManager } from './game/WebXRManager';
import { celestialAudio } from './audio/CelestialAudio';
import { GameHUD } from './components/GameHUD';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  // Game & VR State
  const [stats, setStats] = useState<StarGameStats>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    starsDispersed: 0,
    lastSwipeTime: 0,
  });
  const [gameMode, setGameMode] = useState<'zen' | 'chaser' | 'constellation'>('zen');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isXRSupported, setIsXRSupported] = useState<boolean>(false);
  const [inXR, setInXR] = useState<boolean>(false);

  // References to game engine instances
  const starSimRef = useRef<StarSimulation | null>(null);
  const xrManagerRef = useRef<WebXRManager | null>(null);
  const envSceneRef = useRef<EnvironmentScene | null>(null);

  // Sound & interaction start
  const handleUserInteraction = useCallback(() => {
    celestialAudio.init();
    celestialAudio.resume();
  }, []);

  const handleToggleMute = useCallback(() => {
    handleUserInteraction();
    const muted = celestialAudio.toggleMute();
    setIsMuted(muted);
  }, [handleUserInteraction]);

  const handleReset = useCallback(() => {
    if (starSimRef.current) {
      starSimRef.current.resetGame();
      setStats({ ...starSimRef.current.stats });
    }
  }, []);

  const handleTriggerVortex = useCallback(() => {
    handleUserInteraction();
    if (starSimRef.current) {
      starSimRef.current.triggerSuperVortex();
    }
  }, [handleUserInteraction]);

  const handleEnterVR = useCallback(async () => {
    handleUserInteraction();
    if (xrManagerRef.current) {
      if (inXR) {
        await xrManagerRef.current.exitVR();
      } else {
        await xrManagerRef.current.enterVR();
      }
    }
  }, [handleUserInteraction, inXR]);

  const handleModeChange = useCallback((mode: 'zen' | 'chaser' | 'constellation') => {
    setGameMode(mode);
    if (starSimRef.current) {
      starSimRef.current.gameMode = mode;
      if (mode === 'chaser') {
        // Spawn an initial batch of golden stars
        for (let i = 0; i < 4; i++) {
          starSimRef.current.spawnSpecialStar();
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    // Position camera at comfortable human standing height (1.6m) on the celestial dais
    camera.position.set(0, 1.6, 1.8);

    // 2. Modern Renderer with ACESFilmic & SRGB
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountRef.current.appendChild(renderer.domElement);

    // 3. Desktop Orbit Controls with damping (disabled during VR session)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.4, 0);
    controls.maxPolarAngle = Math.PI * 0.58; // Don't let camera go below platform
    controls.minDistance = 0.5;
    controls.maxDistance = 6.0;

    // 4. Procedural Environment & Dais
    const envScene = new EnvironmentScene(scene, renderer);
    envSceneRef.current = envScene;

    // 5. Scattered Stars Simulation Engine
    const starSim = new StarSimulation(2400);
    scene.add(starSim.group);
    starSimRef.current = starSim;

    // 6. WebXR Manager for Pico VR glasses & controllers
    const xrManager = new WebXRManager(renderer, scene, camera, starSim);
    xrManagerRef.current = xrManager;

    const unsubXR = xrManager.subscribe((xrActive, supported) => {
      setInXR(xrActive);
      setIsXRSupported(supported);
      controls.enabled = !xrActive;
    });

    // 7. Synchronous 60/90/120fps Game Loop via renderer.setAnimationLoop
    const clock = new THREE.Clock();
    let lastStatsUpdateTime = 0;

    renderer.setAnimationLoop((timestamp, frame) => {
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05); // Frame delta clamping
      const elapsedTime = clock.getElapsedTime();

      // Controls update outside VR
      if (!renderer.xr.isPresenting) {
        controls.update();
      }

      // Update Star Physics & Kinetic Swatting
      starSim.update(dt, elapsedTime);

      // Update Wand tracking & Pico VR controllers
      xrManager.update(dt, elapsedTime);

      // Update Celestial Astrolabes & Horizon
      envScene.update(elapsedTime);

      // Synchronize in-VR 3D scoreboard
      envScene.updateVrHud(
        starSim.stats.score,
        starSim.stats.combo,
        starSim.stats.starsDispersed,
        starSim.gameMode
      );

      // Throttled sync to React state (every 100ms) to prevent render overhead
      if (timestamp - lastStatsUpdateTime > 100) {
        lastStatsUpdateTime = timestamp;
        setStats({ ...starSim.stats });
      }

      // Render frame (Three.js automatically handles WebXR stereo rendering when in XR)
      renderer.render(scene, camera);
    });

    // 8. Window resize handler
    const handleResize = () => {
      if (!renderer.xr.isPresenting) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      unsubXR();
      window.removeEventListener('resize', handleResize);
      renderer.setAnimationLoop(null);
      controls.dispose();
      starSim.dispose();
      xrManager.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none"
      onClick={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
      {/* Isolated Three.js Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* Ergonomic Game HUD Overlay */}
      <GameHUD
        stats={stats}
        gameMode={gameMode}
        setGameMode={handleModeChange}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onReset={handleReset}
        onTriggerVortex={handleTriggerVortex}
        onEnterVR={handleEnterVR}
        isXRSupported={isXRSupported}
        inXR={inXR}
      />
    </div>
  );
}
