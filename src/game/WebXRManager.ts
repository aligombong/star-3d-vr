/**
 * WebXRManager.ts
 * Manages WebXR session lifecycle for Pico VR glasses, dual 6DOF controllers,
 * haptics, and non-VR desktop/mobile wand simulator.
 */

import * as THREE from 'three';
import { WandModel, WandCollisionInfo } from './WandModel';
import { StarSimulation } from './StarSimulation';

export type XRStateListener = (inXR: boolean, isSupported: boolean) => void;

export class WebXRManager {
  public isSupported: boolean = false;
  public inXR: boolean = false;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private starSim: StarSimulation;

  // VR Controllers
  private leftController: THREE.XRTargetRaySpace | null = null;
  private rightController: THREE.XRTargetRaySpace | null = null;
  private leftGrip: THREE.XRGripSpace | null = null;
  private rightGrip: THREE.XRGripSpace | null = null;

  private leftWand: WandModel;
  private rightWand: WandModel;

  // Desktop / Mobile Simulator Wand
  private simWand: WandModel;
  private isPointerDown: boolean = false;
  private pointerPos: THREE.Vector2 = new THREE.Vector2(0, 0);
  private targetSimPos: THREE.Vector3 = new THREE.Vector3(0, 1.4, -0.8);
  private currentSimPos: THREE.Vector3 = new THREE.Vector3(0, 1.4, -0.8);

  private stateListeners: Set<XRStateListener> = new Set();
  private xrSession: XRSession | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    starSim: StarSimulation
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.starSim = starSim;

    // Enable Three.js WebXR
    this.renderer.xr.enabled = true;

    // Create dual wands (Left: Cyan/Blue, Right: Gold/Amber)
    this.leftWand = new WandModel(0x38bdf8);
    this.rightWand = new WandModel(0xfbbf24);

    // Desktop/Mobile simulator wand (Starlight Indigo/Violet)
    this.simWand = new WandModel(0xa855f7);
    this.scene.add(this.simWand.group);
    this.scene.add(this.simWand.getTrailMesh());

    this.scene.add(this.leftWand.getTrailMesh());
    this.scene.add(this.rightWand.getTrailMesh());

    this.setupControllers();
    this.setupSimulatorInput();
    this.checkXRSupport();
  }

  public subscribe(listener: XRStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.inXR, this.isSupported);
    return () => this.stateListeners.delete(listener);
  }

  private notify() {
    this.stateListeners.forEach((l) => l(this.inXR, this.isSupported));
  }

  /**
   * Check if WebXR immersive-vr is supported on Pico browser or current device
   */
  public async checkXRSupport(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'xr' in navigator && navigator.xr) {
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        this.isSupported = supported;
        this.notify();
        return supported;
      } catch {
        this.isSupported = false;
        this.notify();
        return false;
      }
    }
    this.isSupported = false;
    this.notify();
    return false;
  }

  /**
   * Setup WebXR 6DOF Controllers for Pico VR Glasses & other WebXR headsets
   */
  private setupControllers() {
    // Controller 0 (Right hand typically)
    this.rightController = this.renderer.xr.getController(0);
    this.rightGrip = this.renderer.xr.getControllerGrip(0);
    this.rightGrip.add(this.rightWand.group);
    this.scene.add(this.rightController);
    this.scene.add(this.rightGrip);

    // Controller 1 (Left hand)
    this.leftController = this.renderer.xr.getController(1);
    this.leftGrip = this.renderer.xr.getControllerGrip(1);
    this.leftGrip.add(this.leftWand.group);
    this.scene.add(this.leftController);
    this.scene.add(this.leftGrip);

    // Trigger actions
    const onSelect = () => {
      // Trigger pressed: cosmic star pulse
      this.starSim.triggerSuperVortex();
    };

    this.rightController.addEventListener('selectstart', onSelect);
    this.leftController.addEventListener('selectstart', onSelect);

    // Session lifecycle handlers
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.inXR = true;
      this.simWand.group.visible = false;
      this.simWand.getTrailMesh().visible = false;
      this.leftWand.group.visible = true;
      this.rightWand.group.visible = true;
      this.leftWand.getTrailMesh().visible = true;
      this.rightWand.getTrailMesh().visible = true;
      this.notify();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.inXR = false;
      this.xrSession = null;
      this.simWand.group.visible = true;
      this.simWand.getTrailMesh().visible = true;
      this.notify();
    });
  }

  /**
   * Fallback Mouse / Touch simulator for testing outside VR glasses
   */
  private setupSimulatorInput() {
    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      this.pointerPos.x = (clientX / window.innerWidth) * 2 - 1;
      this.pointerPos.y = -(clientY / window.innerHeight) * 2 + 1;

      // Unproject pointer into 3D world space at reachable depth
      const vector = new THREE.Vector3(this.pointerPos.x, this.pointerPos.y, 0.5);
      vector.unproject(this.camera);
      const dir = vector.sub(this.camera.position).normalize();
      const distance = 1.35; // Distance in front of camera
      this.targetSimPos.copy(this.camera.position).addScaledVector(dir, distance);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });

    window.addEventListener('mousedown', () => {
      this.isPointerDown = true;
    });
    window.addEventListener('mouseup', () => {
      this.isPointerDown = false;
    });
  }

  /**
   * Requests WebXR Immersive-VR session for Pico VR glasses
   */
  public async enterVR(): Promise<boolean> {
    if (!navigator.xr) {
      console.warn('WebXR not available in this browser');
      return false;
    }

    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking'],
      });

      this.xrSession = session;
      await this.renderer.xr.setSession(session);
      return true;
    } catch (err) {
      console.error('Failed to start WebXR session:', err);
      // Fallback: try default without local-floor if device requires viewer/local
      try {
        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor'],
        });
        this.xrSession = session;
        await this.renderer.xr.setSession(session);
        return true;
      } catch (fallbackErr) {
        console.error('Fallback WebXR session also failed:', fallbackErr);
        return false;
      }
    }
  }

  /**
   * Exits active WebXR session
   */
  public async exitVR() {
    if (this.xrSession) {
      await this.xrSession.end();
      this.xrSession = null;
    }
  }

  /**
   * Per-frame update for controllers, wand physics, and star swatting
   */
  public update(delta: number, time: number) {
    const activeWandCollisions: WandCollisionInfo[] = [];
    let activeGamepad: Gamepad | null = null;

    if (this.inXR) {
      // In VR mode: track Pico Left and Right controllers
      const leftCol = this.leftWand.update(delta, time);
      const rightCol = this.rightWand.update(delta, time);

      activeWandCollisions.push(leftCol, rightCol);

      // Access active XR gamepads for haptic vibration
      if (this.xrSession) {
        for (const source of this.xrSession.inputSources) {
          if (source.gamepad) {
            activeGamepad = source.gamepad;
            break;
          }
        }
      }
    } else {
      // Simulator mode: smoothly damp the simulator wand towards pointer
      const dampSpeed = this.isPointerDown ? 24 : 16;
      this.currentSimPos.x = THREE.MathUtils.damp(this.currentSimPos.x, this.targetSimPos.x, dampSpeed, delta);
      this.currentSimPos.y = THREE.MathUtils.damp(this.currentSimPos.y, this.targetSimPos.y, dampSpeed, delta);
      this.currentSimPos.z = THREE.MathUtils.damp(this.currentSimPos.z, this.targetSimPos.z, dampSpeed, delta);

      this.simWand.group.position.copy(this.currentSimPos);

      // Angle wand naturally towards motion vector
      const simCol = this.simWand.update(delta, time);
      activeWandCollisions.push(simCol);
    }

    // Check kinetic swats against scattered stars!
    if (activeWandCollisions.length > 0) {
      this.starSim.checkControllerSwat(activeWandCollisions, activeGamepad);
    }
  }

  public dispose() {
    this.leftWand.dispose();
    this.rightWand.dispose();
    this.simWand.dispose();
  }
}
