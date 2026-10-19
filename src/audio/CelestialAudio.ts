/**
 * CelestialAudio.ts
 * Procedural Web Audio API synthesizer for cosmic soundscapes,
 * wand swooshes, star chimes, and haptic feedback.
 * 100% procedural with zero external audio assets.
 */

class CelestialAudio {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private droneOscillators: OscillatorNode[] = [];
  private pentatonicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
  private lastSwooshTime = 0;

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.startCosmicAmbience();
    } catch {
      console.warn('Web Audio not supported in this environment');
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Generates continuous soft ambient cosmic harmony (subtle space drone)
   */
  private startCosmicAmbience() {
    if (!this.ctx || !this.masterGain) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    // Warm deep harmonic pad: 110Hz (A2), 164.8Hz (E3), 220Hz (A3), 329.6Hz (E4)
    const baseFreqs = [110, 164.81, 220, 277.18];
    baseFreqs.forEach((freq, idx) => {
      if (!this.ctx || !this.ambientGain) return;
      const osc = this.ctx.createOscillator();
      const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      const filter = this.ctx.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      // Slow drift
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.1 + idx * 0.07, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(1.5, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380 + idx * 120, this.ctx.currentTime);

      if (pan) {
        pan.pan.setValueAtTime((idx - 1.5) * 0.4, this.ctx.currentTime);
        osc.connect(filter);
        filter.connect(pan);
        pan.connect(this.ambientGain);
      } else {
        osc.connect(filter);
        filter.connect(this.ambientGain);
      }

      osc.start();
      this.droneOscillators.push(osc);
    });
  }

  /**
   * Star chime when a star is swiped or dispersed
   * @param intensity Speed/force of the swipe (0 to 1)
   * @param octaveShift Optional pitch offset for combo streaks
   */
  public playStarChime(intensity: number = 0.5, octaveShift: number = 0) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    // Select random pentatonic pitch shifted by octave
    const noteIdx = Math.floor(Math.random() * (this.pentatonicScale.length - 2));
    const baseFreq = this.pentatonicScale[noteIdx];
    const pitchMultiplier = Math.pow(2, octaveShift * 0.15);
    const finalFreq = baseFreq * pitchMultiplier;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(finalFreq, now);

    // Shimmer overtone (pure crystal bell)
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(finalFreq * 2.005, now);

    const volume = Math.min(0.35, 0.12 + intensity * 0.25);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.55 + intensity * 0.4);

    osc.connect(gainNode);
    subOsc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 1.2);
    subOsc.stop(now + 1.2);
  }

  /**
   * Fast aerodynamic wand swoosh when controller is flicked ("dikibaskan")
   * @param speed Speed magnitude of the controller
   */
  public playWandSwoosh(speed: number) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSwooshTime < 0.12) return; // Debounce rapid sweeps
    this.lastSwooshTime = now;
    this.resume();

    // White noise burst filtered by dynamic bandpass
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(3.2, now);

    const startFreq = 300 + Math.min(1800, speed * 250);
    const endFreq = 900 + Math.min(3200, speed * 400);

    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.24);

    const swooshGain = this.ctx.createGain();
    const volume = Math.min(0.28, Math.max(0.06, speed * 0.05));
    swooshGain.gain.setValueAtTime(0.001, now);
    swooshGain.gain.linearRampToValueAtTime(volume, now + 0.04);
    swooshGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    noise.connect(filter);
    filter.connect(swooshGain);
    swooshGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.28);
  }

  /**
   * Supernova / Combo burst sound
   */
  public playSupernovaSound() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(3500, now + 0.15);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.7);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.85);
  }

  /**
   * Trigger controller haptic rumble on Pico VR or WebXR gamepads
   */
  public triggerHaptics(gamepad?: Gamepad | null, intensity: number = 0.6, durationMs: number = 40) {
    if (!gamepad) return;
    try {
      // Standard WebXR Gamepad Vibration Actuator
      const actuator = (gamepad as unknown as { hapticActuators?: Array<{ pulse: (v: number, d: number) => Promise<boolean> }> }).hapticActuators?.[0];
      if (actuator && typeof actuator.pulse === 'function') {
        actuator.pulse(Math.min(1, Math.max(0.1, intensity)), durationMs);
        return;
      }
      // Alternate standard gamepad vibrationActuator
      const vib = (gamepad as unknown as { vibrationActuator?: { playEffect: (type: string, opts: object) => Promise<void> } }).vibrationActuator;
      if (vib && typeof vib.playEffect === 'function') {
        vib.playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: intensity * 0.7,
          strongMagnitude: intensity,
        });
      }
    } catch {
      // Ignore vibration error on unsupported platforms
    }
  }
}

export const celestialAudio = new CelestialAudio();
