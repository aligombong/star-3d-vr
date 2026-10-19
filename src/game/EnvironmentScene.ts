/**
 * EnvironmentScene.ts
 * Procedural Cosmic Sanctuary environment with celestial dais platform,
 * astrolabe rings, background nebulae, PBR lighting, and 3D in-VR hologram HUD.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class EnvironmentScene {
  public group: THREE.Group;
  public vrHudMesh: THREE.Mesh;
  private vrHudCanvas: HTMLCanvasElement;
  private vrHudContext: CanvasRenderingContext2D;
  private vrHudTexture: THREE.CanvasTexture;

  private astrolabeRing1: THREE.Mesh;
  private astrolabeRing2: THREE.Mesh;
  private astrolabeRing3: THREE.Mesh;
  private ambientNebulaParticles: THREE.Points;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // 1. Studio Environment Setup via RoomEnvironment & PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 2. Horizon Fog & Cosmic Sky
    scene.background = new THREE.Color(0x030514);
    scene.fog = new THREE.FogExp2(0x05081c, 0.04);

    // 3. Balanced Studio Lighting Rig
    // Warm Key Light (golden starlight from celestial zenith)
    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    keyLight.position.set(4, 7, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    const d = 5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    this.group.add(keyLight);

    // Cool Hemisphere Fill (Starlight sky vs deep abyss floor)
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x020617, 1.2);
    this.group.add(hemiLight);

    // Subtle Rim Light from behind
    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.0);
    rimLight.position.set(-3, 3, -5);
    this.group.add(rimLight);

    // 4. Procedural Celestial Dais Platform (5-part composite model)
    const daisGroup = new THREE.Group();

    // Part 1: Main circular cosmic platform base
    const daisBaseGeom = new THREE.CylinderGeometry(2.4, 2.7, 0.22, 48);
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.2,
    });
    const daisBase = new THREE.Mesh(daisBaseGeom, marbleMat);
    daisBase.position.y = -0.11;
    daisBase.receiveShadow = true;
    daisGroup.add(daisBase);

    // Part 2: Golden inlaid celestial chart rings
    const ringGeom = new THREE.RingGeometry(1.6, 1.72, 48);
    ringGeom.rotateX(-Math.PI / 2);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const inlaidRing = new THREE.Mesh(ringGeom, goldMat);
    inlaidRing.position.y = 0.002;
    inlaidRing.receiveShadow = true;
    daisGroup.add(inlaidRing);

    const outerRingGeom = new THREE.RingGeometry(2.15, 2.22, 48);
    outerRingGeom.rotateX(-Math.PI / 2);
    const outerInlaidRing = new THREE.Mesh(outerRingGeom, goldMat);
    outerInlaidRing.position.y = 0.002;
    outerInlaidRing.receiveShadow = true;
    daisGroup.add(outerInlaidRing);

    // Part 3: Eight perimeter crystal pylons
    const pylonGeom = new THREE.CylinderGeometry(0.06, 0.09, 0.45, 8);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.5,
    });
    const crystalCapGeom = new THREE.OctahedronGeometry(0.08, 0);
    const crystalCapMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      transmission: 0.8,
      thickness: 0.05,
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const px = Math.cos(angle) * 2.3;
      const pz = Math.sin(angle) * 2.3;

      const pylon = new THREE.Mesh(pylonGeom, pylonMat);
      pylon.position.set(px, 0.2, pz);
      pylon.castShadow = true;
      pylon.receiveShadow = true;
      daisGroup.add(pylon);

      const cap = new THREE.Mesh(crystalCapGeom, crystalCapMat);
      cap.position.set(px, 0.48, pz);
      daisGroup.add(cap);
    }

    // Part 4: Soft Radial Contact Shadow beneath dais
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d')!;
    const sGrad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 62);
    sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    sGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 6.4),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.23;
    daisGroup.add(shadowPlane);

    this.group.add(daisGroup);

    // 5. Huge Distant Astrolabe Rings in the Nebula Horizon
    const astroMat = new THREE.MeshStandardMaterial({
      color: 0x4f46e5,
      emissive: 0x1e1b4b,
      roughness: 0.3,
      metalness: 0.8,
    });
    this.astrolabeRing1 = new THREE.Mesh(new THREE.TorusGeometry(12, 0.08, 16, 80), astroMat);
    this.astrolabeRing1.position.set(0, 3, -14);
    this.group.add(this.astrolabeRing1);

    this.astrolabeRing2 = new THREE.Mesh(new THREE.TorusGeometry(18, 0.1, 16, 90), goldMat);
    this.astrolabeRing2.position.set(0, 2, -18);
    this.group.add(this.astrolabeRing2);

    this.astrolabeRing3 = new THREE.Mesh(new THREE.TorusGeometry(26, 0.12, 16, 100), astroMat);
    this.astrolabeRing3.position.set(0, 4, -22);
    this.group.add(this.astrolabeRing3);

    // 6. Deep Ambient Nebula Dust Particles
    const nebulaCount = 600;
    const nebGeom = new THREE.BufferGeometry();
    const nebPos = new Float32Array(nebulaCount * 3);
    const nebCol = new Float32Array(nebulaCount * 3);
    for (let i = 0; i < nebulaCount; i++) {
      const dist = 14 + Math.random() * 25;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      nebPos[i * 3] = dist * Math.sin(ph) * Math.cos(th);
      nebPos[i * 3 + 1] = dist * Math.sin(ph) * Math.sin(th) + 4;
      nebPos[i * 3 + 2] = dist * Math.cos(ph);

      // Subtle cyan & purple deep nebula dust
      const isPurple = Math.random() > 0.5;
      nebCol[i * 3] = isPurple ? 0.5 : 0.2;
      nebCol[i * 3 + 1] = isPurple ? 0.3 : 0.6;
      nebCol[i * 3 + 2] = 0.9;
    }
    nebGeom.setAttribute('position', new THREE.BufferAttribute(nebPos, 3));
    nebGeom.setAttribute('color', new THREE.BufferAttribute(nebCol, 3));
    this.ambientNebulaParticles = new THREE.Points(
      nebGeom,
      new THREE.PointsMaterial({
        size: 0.45,
        vertexColors: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.group.add(this.ambientNebulaParticles);

    // 7. In-VR 3D Holographic Display (HUD)
    // Mounted in front of the player (Z: -2.0m, Y: 1.85m), slight downward tilt
    this.vrHudCanvas = document.createElement('canvas');
    this.vrHudCanvas.width = 512;
    this.vrHudCanvas.height = 256;
    this.vrHudContext = this.vrHudCanvas.getContext('2d')!;

    this.vrHudTexture = new THREE.CanvasTexture(this.vrHudCanvas);
    this.vrHudTexture.colorSpace = THREE.SRGBColorSpace;

    const vrHudGeom = new THREE.PlaneGeometry(1.4, 0.7);
    const vrHudMat = new THREE.MeshBasicMaterial({
      map: this.vrHudTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.vrHudMesh = new THREE.Mesh(vrHudGeom, vrHudMat);
    this.vrHudMesh.position.set(0, 1.85, -2.1);
    this.vrHudMesh.rotation.x = 0.08;
    this.group.add(this.vrHudMesh);

    this.updateVrHud(0, 0, 0, 'zen');
  }

  /**
   * Updates the in-VR floating holographic scoreboard
   */
  public updateVrHud(score: number, combo: number, starsDispersed: number, modeName: string) {
    const ctx = this.vrHudContext;
    ctx.clearRect(0, 0, 512, 256);

    // Glowing cosmic background card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 236, 24);
    ctx.fill();

    // Sleek border
    ctx.strokeStyle = combo > 5 ? 'rgba(251, 191, 36, 0.8)' : 'rgba(99, 102, 241, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Header Mode
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('PICO WEBXR · KIBASAN BINTANG', 36, 52);

    ctx.textAlign = 'right';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(modeName.toUpperCase(), 476, 52);

    // Score readouts
    ctx.textAlign = 'left';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(score.toLocaleString(), 36, 120);

    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('SKOR KOSMIK', 38, 145);

    // Combo & Stars stats
    ctx.textAlign = 'right';
    if (combo > 1) {
      ctx.font = 'bold 42px system-ui, sans-serif';
      ctx.fillStyle = combo > 8 ? '#f59e0b' : '#a855f7';
      ctx.fillText(`${combo}x COMBO`, 476, 115);
    } else {
      ctx.font = '32px system-ui, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Kibaskan!`, 476, 115);
    }

    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`★ ${starsDispersed} Bintang Terkibas`, 476, 155);

    // Bottom Controller hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(36, 175, 440, 2);

    ctx.textAlign = 'center';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Ayunkan / kibaskan controller untuk menyebarkan bintang', 256, 212);

    this.vrHudTexture.needsUpdate = true;
  }

  public update(time: number) {
    // Slow rotational drift of astrolabe rings
    this.astrolabeRing1.rotation.x = time * 0.04;
    this.astrolabeRing1.rotation.y = time * 0.06;

    this.astrolabeRing2.rotation.y = -time * 0.03;
    this.astrolabeRing2.rotation.z = time * 0.05;

    this.astrolabeRing3.rotation.z = time * 0.02;

    // Subtle gentle floating bob of the in-VR HUD
    this.vrHudMesh.position.y = 1.85 + Math.sin(time * 1.5) * 0.025;
  }
}
