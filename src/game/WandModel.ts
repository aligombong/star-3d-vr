/**
 * WandModel.ts
 * Composite 7-part procedural Celestial Wand for WebXR controllers & simulator.
 * Fully procedural geometries and PBR materials with dynamic starlight ribbon trail.
 */

import * as THREE from 'three';

export interface WandCollisionInfo {
  tipPosition: THREE.Vector3;
  basePosition: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  isSwishing: boolean;
}

export class WandModel {
  public group: THREE.Group;
  public tipPoint: THREE.Vector3 = new THREE.Vector3();
  public previousTip: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public speed: number = 0;
  public isSwishing: boolean = false;

  private orbitRing: THREE.Mesh;
  private focusCrystal: THREE.Mesh;
  private energyBlade: THREE.Mesh;
  private tipLight: THREE.PointLight;
  private trailMesh: THREE.Mesh;
  private trailPositions: THREE.Vector3[] = [];
  private trailMaxPoints = 24;
  private trailGeometry: THREE.BufferGeometry;
  private trailPosAttr: THREE.BufferAttribute;
  private trailAlphaAttr: THREE.BufferAttribute;

  private wandColor: THREE.Color;

  constructor(themeColor: number = 0x67e8f9) {
    this.group = new THREE.Group();
    this.wandColor = new THREE.Color(themeColor);

    // 1. Primary Silhouette: Astral Fluted Grip Handle (LatheGeometry)
    const handlePoints: THREE.Vector2[] = [];
    const handleSegments = 16;
    for (let i = 0; i <= handleSegments; i++) {
      const t = i / handleSegments;
      const y = t * 0.22 - 0.12; // Length ~22cm
      // Ergonomic hourglass curve with rhythmic grip grooves
      const radius = 0.016 + Math.sin(t * Math.PI) * 0.004 + (i % 2 === 0 ? 0.0015 : 0);
      handlePoints.push(new THREE.Vector2(radius, y));
    }
    const handleGeom = new THREE.LatheGeometry(handlePoints, 24);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.1,
    });
    const handleMesh = new THREE.Mesh(handleGeom, handleMat);
    handleMesh.castShadow = true;
    this.group.add(handleMesh);

    // 2. Secondary Read: Pommel Endcap with Celestial Gem
    const pommelGeom = new THREE.CylinderGeometry(0.022, 0.012, 0.035, 12);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.9,
    });
    const pommel = new THREE.Mesh(pommelGeom, goldMat);
    pommel.position.y = -0.135;
    this.group.add(pommel);

    const pommelGemGeom = new THREE.IcosahedronGeometry(0.012, 0);
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: this.wandColor,
      emissive: this.wandColor,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.2,
      transmission: 0.85,
      thickness: 0.02,
    });
    const pommelGem = new THREE.Mesh(pommelGemGeom, gemMat);
    pommelGem.position.y = -0.155;
    this.group.add(pommelGem);

    // 3. Emitter Collar Guard
    const collarGeom = new THREE.CylinderGeometry(0.026, 0.018, 0.04, 16);
    const collar = new THREE.Mesh(collarGeom, goldMat);
    collar.position.y = 0.11;
    collar.castShadow = true;
    this.group.add(collar);

    // 4. Accent Detail: 4 Radiating Prongs
    const prongGeom = new THREE.BoxGeometry(0.006, 0.06, 0.006);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const prong = new THREE.Mesh(prongGeom, goldMat);
      prong.position.set(Math.cos(angle) * 0.022, 0.14, Math.sin(angle) * 0.022);
      prong.rotation.z = Math.cos(angle) * -0.15;
      prong.rotation.x = Math.sin(angle) * 0.15;
      this.group.add(prong);
    }

    // 5. Floating Gyro Celestial Ring
    const ringGeom = new THREE.TorusGeometry(0.038, 0.0035, 12, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.orbitRing = new THREE.Mesh(ringGeom, ringMat);
    this.orbitRing.position.y = 0.15;
    this.group.add(this.orbitRing);

    // 6. Focusing Core Crystal (Octahedron)
    const crystalGeom = new THREE.OctahedronGeometry(0.026, 0);
    this.focusCrystal = new THREE.Mesh(crystalGeom, gemMat);
    this.focusCrystal.position.y = 0.15;
    this.group.add(this.focusCrystal);

    // 7. Light Blade / Ethereal Tapered Stardust Tip
    const bladeGeom = new THREE.ConeGeometry(0.016, 0.28, 16);
    bladeGeom.translate(0, 0.14, 0); // Origin at base
    const bladeMat = new THREE.MeshPhysicalMaterial({
      color: this.wandColor,
      emissive: this.wandColor,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.75,
      transmission: 0.6,
    });
    this.energyBlade = new THREE.Mesh(bladeGeom, bladeMat);
    this.energyBlade.position.y = 0.16;
    this.group.add(this.energyBlade);

    // Dynamic Point Light at the wand tip
    this.tipLight = new THREE.PointLight(this.wandColor, 1.4, 3.5, 2);
    this.tipLight.position.y = 0.44;
    this.group.add(this.tipLight);

    // Initialize Ribbon Trail Geometry
    this.trailGeometry = new THREE.BufferGeometry();
    const totalVertices = this.trailMaxPoints * 2;
    const positions = new Float32Array(totalVertices * 3);
    const alphas = new Float32Array(totalVertices);
    const indices: number[] = [];

    for (let i = 0; i < this.trailMaxPoints - 1; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;
      indices.push(v0, v1, v2);
      indices.push(v2, v1, v3);
    }

    this.trailPosAttr = new THREE.BufferAttribute(positions, 3);
    this.trailAlphaAttr = new THREE.BufferAttribute(alphas, 1);
    this.trailGeometry.setAttribute('position', this.trailPosAttr);
    this.trailGeometry.setAttribute('alpha', this.trailAlphaAttr);
    this.trailGeometry.setIndex(indices);

    // Procedural Glowing Ribbon Material with dynamic vertex alpha
    const trailMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: this.wandColor },
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor * 1.5, vAlpha * 0.85);
        }
      `,
    });

    this.trailMesh = new THREE.Mesh(this.trailGeometry, trailMat);
    this.trailMesh.frustumCulled = false;

    // Adjust overall wand orientation to aim comfortably along controller forward ray (-Z / +Y)
    this.group.rotation.x = -Math.PI / 4;
  }

  public getTrailMesh(): THREE.Mesh {
    return this.trailMesh;
  }

  /**
   * Updates wand animations, velocity tracking, and stardust ribbon trail
   */
  public update(delta: number, time: number): WandCollisionInfo {
    // Gyro ring rotation & crystal pulse
    this.orbitRing.rotation.x = time * 2.5;
    this.orbitRing.rotation.y = time * 3.1;
    this.focusCrystal.rotation.y = -time * 1.8;
    this.focusCrystal.rotation.z = Math.sin(time * 3) * 0.2;

    // Calculate current tip world position
    const localTip = new THREE.Vector3(0, 0.44, 0);
    const currentTip = localTip.applyMatrix4(this.group.matrixWorld);

    // Velocity computation with clamped delta
    const dt = Math.max(0.001, Math.min(delta, 0.1));
    this.velocity.subVectors(currentTip, this.previousTip).divideScalar(dt);
    this.speed = this.velocity.length();

    // Swishing detection: speed > 1.2 m/s counts as a strong swing/flick ("kibasan")
    this.isSwishing = this.speed > 1.1;

    // Modulate tip light intensity based on movement speed
    const targetIntensity = 1.0 + Math.min(3.5, this.speed * 0.8);
    this.tipLight.intensity = THREE.MathUtils.damp(this.tipLight.intensity, targetIntensity, 12, dt);

    // Update Ribbon Trail Points
    if (this.trailPositions.length === 0) {
      for (let i = 0; i < this.trailMaxPoints; i++) {
        this.trailPositions.push(currentTip.clone());
      }
    } else {
      this.trailPositions.pop();
      this.trailPositions.unshift(currentTip.clone());
    }

    // Update trail ribbon geometry buffer
    const posArray = this.trailPosAttr.array as Float32Array;
    const alphaArray = this.trailAlphaAttr.array as Float32Array;
    const width = 0.055;

    // Calculate ribbon perpendicular tangent
    const upVec = new THREE.Vector3(0, 1, 0);
    const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion).normalize();
    const ribbonNormal = new THREE.Vector3().crossVectors(forwardVec, upVec).normalize();
    if (ribbonNormal.lengthSq() < 0.01) ribbonNormal.set(1, 0, 0);

    for (let i = 0; i < this.trailMaxPoints; i++) {
      const p = this.trailPositions[i] || currentTip;
      const t = i / (this.trailMaxPoints - 1);
      const halfW = width * (1 - t * 0.8);
      const alphaVal = (1.0 - t) * Math.min(1.0, this.speed * 0.5 + 0.1);

      // Top vertex
      const idx0 = i * 2;
      posArray[idx0 * 3] = p.x + ribbonNormal.x * halfW;
      posArray[idx0 * 3 + 1] = p.y + ribbonNormal.y * halfW;
      posArray[idx0 * 3 + 2] = p.z + ribbonNormal.z * halfW;
      alphaArray[idx0] = alphaVal;

      // Bottom vertex
      const idx1 = i * 2 + 1;
      posArray[idx1 * 3] = p.x - ribbonNormal.x * halfW;
      posArray[idx1 * 3 + 1] = p.y - ribbonNormal.y * halfW;
      posArray[idx1 * 3 + 2] = p.z - ribbonNormal.z * halfW;
      alphaArray[idx1] = alphaVal;
    }

    this.trailPosAttr.needsUpdate = true;
    this.trailAlphaAttr.needsUpdate = true;

    this.previousTip.copy(currentTip);

    const basePoint = new THREE.Vector3(0, 0, 0).applyMatrix4(this.group.matrixWorld);

    return {
      tipPosition: currentTip,
      basePosition: basePoint,
      velocity: this.velocity,
      speed: this.speed,
      isSwishing: this.isSwishing,
    };
  }

  public dispose() {
    this.trailGeometry.dispose();
  }
}
