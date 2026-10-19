/**
 * StarSimulation.ts
 * Manages thousands of scattered stars ("bintang bertaburan"),
 * kinetic swatting/dispersal physics, burst particles, and special celestial objects.
 */

import * as THREE from 'three';
import { celestialAudio } from '../audio/CelestialAudio';
import { WandCollisionInfo } from './WandModel';

export interface StarGameStats {
  score: number;
  combo: number;
  maxCombo: number;
  starsDispersed: number;
  lastSwipeTime: number;
}

interface StarParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  basePosition: THREE.Vector3;
  color: THREE.Color;
  size: number;
  phase: number;
  isDispersed: boolean;
  dispersedTimer: number;
  targetWeight: number;
}

export class StarSimulation {
  public group: THREE.Group;
  public stats: StarGameStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    starsDispersed: 0,
    lastSwipeTime: 0,
  };

  private starCount: number;
  private stars: StarParticle[] = [];
  private pointGeometry: THREE.BufferGeometry;
  private pointPositions: Float32Array;
  private pointColors: Float32Array;
  private pointSizes: Float32Array;
  private pointMaterial: THREE.PointsMaterial;
  private pointMesh: THREE.Points;

  // Stardust Burst Particles for swat impacts
  private burstCount = 450;
  private burstGeom: THREE.BufferGeometry;
  private burstPositions: Float32Array;
  private burstColors: Float32Array;
  private burstVelocities: THREE.Vector3[] = [];
  private burstLifetimes: Float32Array;
  private burstPoints: THREE.Points;
  private burstIndex = 0;

  // Special Golden / Constellation Nova Stars (3D Meshes)
  private specialStarsGroup: THREE.Group;
  private specialStars: Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    active: boolean;
    pointsValue: number;
  }> = [];

  // Scratch vectors for zero GC
  private _scratchVec = new THREE.Vector3();
  private _deltaVec = new THREE.Vector3();
  private _impulseVec = new THREE.Vector3();

  // Mode: 'zen' | 'chaser' | 'constellation'
  public gameMode: 'zen' | 'chaser' | 'constellation' = 'zen';
  public comboTimeout = 2.2; // seconds to keep combo alive

  constructor(starCount: number = 2200) {
    this.group = new THREE.Group();
    this.starCount = starCount;

    // 1. Procedural 4-point diffraction star sprite texture via HTML5 2D Canvas
    const starTexture = this.createStarGlowTexture();

    // 2. Main Scattered Star Field (BufferGeometry Points)
    this.pointGeometry = new THREE.BufferGeometry();
    this.pointPositions = new Float32Array(this.starCount * 3);
    this.pointColors = new Float32Array(this.starCount * 3);
    this.pointSizes = new Float32Array(this.starCount);

    const palette = [
      new THREE.Color('#38bdf8'), // Cyan / Icy blue
      new THREE.Color('#818cf8'), // Indigo / Violet
      new THREE.Color('#fbbf24'), // Warm Gold
      new THREE.Color('#f472b6'), // Rose Quartz
      new THREE.Color('#34d399'), // Emerald Nebula
      new THREE.Color('#ffffff'), // Pure Starlight
      new THREE.Color('#f59e0b'), // Amber Sun
    ];

    for (let i = 0; i < this.starCount; i++) {
      // Distribute stars in an expansive floating celestial shell around the player's reachable volume
      // Player stands at (0, 1.6, 0). Reachable interactive zone is radius 0.4m to 3.5m, plus ambient backdrop
      const isInteractiveZone = i < this.starCount * 0.75;
      const radius = isInteractiveZone
        ? 0.5 + Math.random() * 3.0
        : 3.5 + Math.random() * 7.0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      // Height centered comfortably around standing chest/eye height (1.2m to 2.2m)
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = 1.35 + (radius * 0.8) * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const color = palette[Math.floor(Math.random() * palette.length)].clone();
      const basePos = new THREE.Vector3(x, y, z);

      this.stars.push({
        position: basePos.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05
        ),
        basePosition: basePos,
        color: color,
        size: isInteractiveZone ? 0.08 + Math.random() * 0.12 : 0.05 + Math.random() * 0.08,
        phase: Math.random() * Math.PI * 2,
        isDispersed: false,
        dispersedTimer: 0,
        targetWeight: 0.8 + Math.random() * 0.4,
      });

      this.pointPositions[i * 3] = x;
      this.pointPositions[i * 3 + 1] = y;
      this.pointPositions[i * 3 + 2] = z;

      this.pointColors[i * 3] = color.r;
      this.pointColors[i * 3 + 1] = color.g;
      this.pointColors[i * 3 + 2] = color.b;

      this.pointSizes[i] = this.stars[i].size;
    }

    this.pointGeometry.setAttribute('position', new THREE.BufferAttribute(this.pointPositions, 3));
    this.pointGeometry.setAttribute('color', new THREE.BufferAttribute(this.pointColors, 3));
    this.pointGeometry.setAttribute('size', new THREE.BufferAttribute(this.pointSizes, 1));

    this.pointMaterial = new THREE.PointsMaterial({
      size: 0.16,
      map: starTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.pointMesh = new THREE.Points(this.pointGeometry, this.pointMaterial);
    this.pointMesh.frustumCulled = false;
    this.group.add(this.pointMesh);

    // 3. Stardust Burst Particle System
    this.burstGeom = new THREE.BufferGeometry();
    this.burstPositions = new Float32Array(this.burstCount * 3);
    this.burstColors = new Float32Array(this.burstCount * 3);
    this.burstLifetimes = new Float32Array(this.burstCount);

    for (let i = 0; i < this.burstCount; i++) {
      this.burstVelocities.push(new THREE.Vector3());
      this.burstLifetimes[i] = 0;
    }

    this.burstGeom.setAttribute('position', new THREE.BufferAttribute(this.burstPositions, 3));
    this.burstGeom.setAttribute('color', new THREE.BufferAttribute(this.burstColors, 3));

    const burstMat = new THREE.PointsMaterial({
      size: 0.12,
      map: starTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.burstPoints = new THREE.Points(this.burstGeom, burstMat);
    this.burstPoints.frustumCulled = false;
    this.group.add(this.burstPoints);

    // 4. Special 3D Stellar Objects (Nova / Golden Stellated Polyhedra)
    this.specialStarsGroup = new THREE.Group();
    this.group.add(this.specialStarsGroup);
    this.initSpecialStars();
  }

  /**
   * Procedural Star Texture with diffraction spikes and soft glowing corona
   */
  private createStarGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const centerX = 64;
    const centerY = 64;

    // Radial gradient core
    const radGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 62);
    radGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    radGrad.addColorStop(0.18, 'rgba(230, 245, 255, 0.95)');
    radGrad.addColorStop(0.45, 'rgba(120, 190, 255, 0.45)');
    radGrad.addColorStop(0.8, 'rgba(70, 110, 255, 0.15)');
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, 128, 128);

    // 4-Point Starlight Diffraction Spikes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;

    // Horizontal spike
    const hGrad = ctx.createLinearGradient(10, centerY, 118, centerY);
    hGrad.addColorStop(0, 'rgba(255,255,255,0)');
    hGrad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    hGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = hGrad;
    ctx.beginPath();
    ctx.moveTo(8, centerY);
    ctx.lineTo(120, centerY);
    ctx.stroke();

    // Vertical spike
    const vGrad = ctx.createLinearGradient(centerX, 10, centerX, 118);
    vGrad.addColorStop(0, 'rgba(255,255,255,0)');
    vGrad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    vGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = vGrad;
    ctx.beginPath();
    ctx.moveTo(centerX, 8);
    ctx.lineTo(centerX, 120);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Initializes 3D Stellated Golden Stars that float in for high-score hits
   */
  private initSpecialStars() {
    // Stellated Octahedron / Golden Nova Star composite
    const starGeom = new THREE.OctahedronGeometry(0.16, 0);
    const starMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 1.4,
      roughness: 0.15,
      metalness: 0.9,
      transmission: 0.3,
    });

    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(starGeom, starMat);
      mesh.visible = false;
      this.specialStarsGroup.add(mesh);
      this.specialStars.push({
        mesh,
        velocity: new THREE.Vector3(),
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3
        ),
        active: false,
        pointsValue: 250,
      });
    }
  }

  /**
   * Spawns a floating golden nova star near the player
   */
  public spawnSpecialStar() {
    const inactive = this.specialStars.find((s) => !s.active);
    if (!inactive) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 1.2 + Math.random() * 1.4;
    const height = 1.2 + Math.random() * 0.9;

    inactive.mesh.position.set(Math.cos(angle) * dist, height, Math.sin(angle) * dist);
    inactive.velocity.set(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.2
    );
    inactive.mesh.visible = true;
    inactive.active = true;
  }

  /**
   * Checks collision and exerts swatting momentum from controller wands onto the star field
   */
  public checkControllerSwat(wands: WandCollisionInfo[], gamepad?: Gamepad | null): number {
    let hitCount = 0;
    const now = performance.now() * 0.001;

    for (const wand of wands) {
      // Swatting occurs when wand speed > 0.6 m/s or tip is moving through stars
      const isStrongSwing = wand.speed > 1.0;
      const reachRadius = isStrongSwing ? 0.36 : 0.24;

      // Check against standard scattered stars
      for (let i = 0; i < this.stars.length; i++) {
        const star = this.stars[i];
        const dist = star.position.distanceTo(wand.tipPosition);

        if (dist < reachRadius) {
          // Compute kinetic impulse vector
          this._impulseVec.copy(wand.velocity).multiplyScalar(0.7);

          // Add radial blast push away from wand center
          this._deltaVec.subVectors(star.position, wand.tipPosition).normalize();
          this._impulseVec.addScaledVector(this._deltaVec, Math.max(1.8, wand.speed * 1.4));

          star.velocity.copy(this._impulseVec);
          star.isDispersed = true;
          star.dispersedTimer = 3.5;

          hitCount++;

          // Spawn stardust burst sparkles
          this.emitStardustBurst(star.position, star.color, wand.velocity);
        }
      }

      // Check against 3D Golden Nova Stars
      for (const special of this.specialStars) {
        if (!special.active) continue;
        const dist = special.mesh.position.distanceTo(wand.tipPosition);
        if (dist < 0.42) {
          // Big Supernova impact!
          special.velocity.copy(wand.velocity).multiplyScalar(1.4);
          special.active = false;
          special.mesh.visible = false;

          hitCount += 10;
          this.stats.score += special.pointsValue * Math.max(1, this.stats.combo);
          this.stats.starsDispersed += 5;

          // Sound & Haptics for Supernova
          celestialAudio.playSupernovaSound();
          celestialAudio.triggerHaptics(gamepad, 1.0, 90);

          // Massive sparkle burst
          for (let b = 0; b < 40; b++) {
            this.emitStardustBurst(
              special.mesh.position,
              new THREE.Color('#fbbf24'),
              wand.velocity
            );
          }
        }
      }

      // Trigger audio & haptics when swiping through stars
      if (hitCount > 0) {
        this.stats.starsDispersed += hitCount;
        this.stats.combo++;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
        this.stats.score += hitCount * 10 * Math.max(1, Math.min(10, Math.floor(this.stats.combo / 5) + 1));
        this.stats.lastSwipeTime = now;

        const comboPitchShift = Math.min(8, Math.floor(this.stats.combo / 4));
        celestialAudio.playStarChime(Math.min(1.0, wand.speed * 0.4), comboPitchShift);

        // Haptic feedback to Pico controller
        celestialAudio.triggerHaptics(gamepad, Math.min(0.9, 0.35 + hitCount * 0.08), 35);
      } else if (wand.isSwishing) {
        // Pure swoosh sound without star impact
        celestialAudio.playWandSwoosh(wand.speed);
      }
    }

    return hitCount;
  }

  /**
   * Emits a burst of sparkling stardust particles at impact
   */
  private emitStardustBurst(pos: THREE.Vector3, color: THREE.Color, wandVel: THREE.Vector3) {
    const burstCountPerHit = 6;
    for (let i = 0; i < burstCountPerHit; i++) {
      const idx = (this.burstIndex + i) % this.burstCount;
      const posArray = this.burstPositions;
      const colArray = this.burstColors;

      posArray[idx * 3] = pos.x;
      posArray[idx * 3 + 1] = pos.y;
      posArray[idx * 3 + 2] = pos.z;

      colArray[idx * 3] = color.r * 1.5;
      colArray[idx * 3 + 1] = color.g * 1.5;
      colArray[idx * 3 + 2] = color.b * 1.5;

      // Random spherical explosion + inherit wand momentum
      const vel = this.burstVelocities[idx];
      vel.set(
        (Math.random() - 0.5) * 1.8 + wandVel.x * 0.3,
        (Math.random() - 0.5) * 1.8 + wandVel.y * 0.3,
        (Math.random() - 0.5) * 1.8 + wandVel.z * 0.3
      );

      this.burstLifetimes[idx] = 0.8 + Math.random() * 0.6;
    }
    this.burstIndex = (this.burstIndex + burstCountPerHit) % this.burstCount;
  }

  /**
   * Updates star physics, gentle return orbits, twinkling, and bursts
   */
  public update(delta: number, time: number) {
    const dt = Math.min(delta, 0.05);
    const now = performance.now() * 0.001;

    // Decay combo if inactive
    if (this.stats.combo > 0 && now - this.stats.lastSwipeTime > this.comboTimeout) {
      this.stats.combo = 0;
    }

    // Occasionally spawn special golden stars in challenge modes
    if (this.gameMode !== 'zen' && Math.random() < 0.02) {
      this.spawnSpecialStar();
    }

    // Update Scattered Stars
    const posArray = this.pointPositions;
    const sizeArray = this.pointSizes;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];

      if (star.isDispersed) {
        // High speed trajectory after being swatted
        star.position.addScaledVector(star.velocity, dt);
        // Drag/friction slowing down the kinetic explosion
        star.velocity.multiplyScalar(Math.pow(0.88, dt * 60));

        star.dispersedTimer -= dt;
        if (star.dispersedTimer <= 0) {
          star.isDispersed = false;
        }
      } else {
        // Peaceful cosmic orbital breathing & drift around base position
        const orbitSpeed = 0.4 * star.targetWeight;
        const driftX = Math.sin(time * orbitSpeed + star.phase) * 0.04;
        const driftY = Math.cos(time * orbitSpeed * 0.8 + star.phase) * 0.04;
        const driftZ = Math.sin(time * orbitSpeed * 1.2 + star.phase * 2) * 0.04;

        // Soft harmonic attraction back to original cosmic habitat
        this._deltaVec.subVectors(star.basePosition, star.position);
        star.position.addScaledVector(this._deltaVec, dt * 0.8);
        star.position.x += driftX * dt;
        star.position.y += driftY * dt;
        star.position.z += driftZ * dt;
      }

      posArray[i * 3] = star.position.x;
      posArray[i * 3 + 1] = star.position.y;
      posArray[i * 3 + 2] = star.position.z;

      // Twinkling pulsation
      const twinkle = Math.sin(time * 3.5 + star.phase) * 0.4 + 0.6;
      sizeArray[i] = (star.isDispersed ? star.size * 1.8 : star.size) * twinkle;
    }

    this.pointGeometry.attributes.position.needsUpdate = true;
    this.pointGeometry.attributes.size.needsUpdate = true;

    // Update Stardust Burst Sparkles
    const burstPos = this.burstPositions;
    for (let i = 0; i < this.burstCount; i++) {
      if (this.burstLifetimes[i] > 0) {
        this.burstLifetimes[i] -= dt;
        const vel = this.burstVelocities[i];
        burstPos[i * 3] += vel.x * dt;
        burstPos[i * 3 + 1] += vel.y * dt;
        burstPos[i * 3 + 2] += vel.z * dt;
        vel.y -= 0.6 * dt; // subtle celestial gravity
        vel.multiplyScalar(0.96);
      } else {
        // Place far away
        burstPos[i * 3 + 1] = -999;
      }
    }
    this.burstGeom.attributes.position.needsUpdate = true;

    // Update Special Nova Stars
    for (const special of this.specialStars) {
      if (!special.active) continue;
      special.mesh.rotation.x += special.rotSpeed.x * dt;
      special.mesh.rotation.y += special.rotSpeed.y * dt;
      special.mesh.rotation.z += special.rotSpeed.z * dt;

      special.mesh.position.addScaledVector(special.velocity, dt);

      // Despawn if out of bounds
      if (special.mesh.position.length() > 8.0) {
        special.active = false;
        special.mesh.visible = false;
      }
    }
  }

  /**
   * Resets simulation and game stats
   */
  public resetGame() {
    this.stats = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      starsDispersed: 0,
      lastSwipeTime: performance.now() * 0.001,
    };
    for (const star of this.stars) {
      star.position.copy(star.basePosition);
      star.velocity.set(0, 0, 0);
      star.isDispersed = false;
    }
    for (const special of this.specialStars) {
      special.active = false;
      special.mesh.visible = false;
    }
  }

  /**
   * Swirls all stars into a majestic cosmic vortex ("Kibasan Badai Bintang")
   */
  public triggerSuperVortex() {
    celestialAudio.playSupernovaSound();
    for (const star of this.stars) {
      const angle = Math.atan2(star.position.z, star.position.x);
      const dist = Math.sqrt(star.position.x * star.position.x + star.position.z * star.position.z);
      // Tangential velocity creates whirlpool vortex
      star.velocity.set(
        -Math.sin(angle) * 3.5,
        (Math.random() - 0.5) * 1.8,
        Math.cos(angle) * 3.5
      );
      star.isDispersed = true;
      star.dispersedTimer = 4.0;
    }
  }

  public dispose() {
    this.pointGeometry.dispose();
    this.pointMaterial.dispose();
    this.burstGeom.dispose();
  }
}
