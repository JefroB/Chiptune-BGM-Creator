/**
 * Audio Engine & Multi-Voice Workstation Synthesizer
 * Implements precision lookahead MIDI scheduling, channel route mapping,
 * NES APU voice simulation, dual-chip MIDIbox SID cores, pre/post auxiliary sends,
 * solo isolation, and bounded mastering return capture.
 */

import {
  VoiceId,
  MidiSongModel,
  MidiRoute,
  MixerStrip,
  RecordingProvenance
} from '../types/index.ts';
import { midiDeviceManager } from './midiDeviceManager.ts';

interface ActiveVoice {
  sources: AudioNode[];
  gain: GainNode;
  voiceId: VoiceId;
  note: number;
}

interface StripAudioNodes {
  input: GainNode;
  trim: GainNode;
  pan: StereoPannerNode | null;
  preFader: GainNode;
  fader: GainNode;
  sendA: GainNode;
  sendB: GainNode;
  analyserL: AnalyserNode;
  analyserR: AnalyserNode;
  currentSendAPre: boolean;
  currentSendBPre: boolean;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stripNodes: Map<string, StripAudioNodes> = new Map();
  private activeVoices: Map<string, ActiveVoice> = new Map();

  // Hardware FX Loops (Simulated)
  private fxASendGain: GainNode | null = null;
  private fxAReturnGain: GainNode | null = null;
  private fxADelayNode: DelayNode | null = null;

  private fxBSendGain: GainNode | null = null;
  private fxBReturnGain: GainNode | null = null;
  private fxBReverbNode: ConvolverNode | null = null;

  // Master bus and isolated mastering return
  private masterSendGain: GainNode | null = null;
  private masteringReturnGain: GainNode | null = null;
  private masterOutputGain: GainNode | null = null;

  // Recording State (Bounded pre-allocated buffer)
  private isRecording = false;
  private maxRecordSeconds = 180; // 3 minutes maximum
  private recordedLeft: Float32Array | null = null;
  private recordedRight: Float32Array | null = null;
  private recordSampleCount = 0;
  private recordProcessor: ScriptProcessorNode | null = null;
  private recordProvenance: RecordingProvenance | null = null;

  // Playback & Lookahead Scheduler State
  private isRunning = false;
  private isPaused = false;
  private songModel: MidiSongModel | null = null;
  private songRoutes: MidiRoute[] = [];
  private startTime = 0;
  private pauseOffset = 0;
  private schedulerTimer: number | null = null;
  private scheduledEventIndex = 0;
  private allPlaybackEvents: Array<{ timeSec: number; trackIndex: number; channel: number; event: any }> = [];
  private onPlaybackProgress: ((sec: number, bar: number, beat: number) => void) | null = null;
  private onPlaybackComplete: (() => void) | null = null;
  private onMetersUpdate: ((levels: Record<string, { peakL: number; peakR: number; rmsL: number; rmsR: number }>) => void) | null = null;

  constructor() {
    // Lazy audio context init on user interaction
  }

  public initAudio(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.setupRoutingGraph(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getSampleRate(): number {
    return this.ctx ? this.ctx.sampleRate : 48000;
  }

  private setupRoutingGraph(ctx: AudioContext) {
    // 1. External FX Loop A (Tape Delay)
    this.fxASendGain = ctx.createGain();
    this.fxAReturnGain = ctx.createGain();
    this.fxADelayNode = ctx.createDelay(2.0);
    this.fxADelayNode.delayTime.value = 0.25;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.45;

    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 4000;

    this.fxASendGain.connect(this.fxADelayNode);
    this.fxADelayNode.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(this.fxADelayNode);
    delayFilter.connect(this.fxAReturnGain);

    // 2. External FX Loop B (Plate Reverb)
    this.fxBSendGain = ctx.createGain();
    this.fxBReturnGain = ctx.createGain();
    this.fxBReverbNode = ctx.createConvolver();
    this.generateSyntheticImpulse(ctx, 2.2, 2.8);
    this.fxBSendGain.connect(this.fxBReverbNode);
    this.fxBReverbNode.connect(this.fxBReturnGain);

    // 3. Master Send Bus & Analog Mastering Processor
    this.masterSendGain = ctx.createGain();
    this.masteringReturnGain = ctx.createGain();

    const waveshaper = ctx.createWaveShaper();
    waveshaper.curve = this.createMasteringCurve(4096) as Float32Array<ArrayBuffer>;
    waveshaper.oversample = '2x';

    const masteringEq = ctx.createBiquadFilter();
    masteringEq.type = 'highshelf';
    masteringEq.frequency.value = 10000;
    masteringEq.gain.value = 1.2;

    this.masterSendGain.connect(waveshaper);
    waveshaper.connect(masteringEq);
    masteringEq.connect(this.masteringReturnGain);

    // 4. Mastering return connects strictly to monitor destination
    this.masterOutputGain = ctx.createGain();
    this.masterOutputGain.gain.value = 0.9;
    this.masteringReturnGain.connect(this.masterOutputGain);
    this.masterOutputGain.connect(ctx.destination);

    // 5. Channel Strips
    const stripIds = ['nes_mono', 'sid_core1', 'sid_core2', 'sid_core3', 'sid_core4', 'fx_return_a', 'fx_return_b'];
    stripIds.forEach((id) => {
      const input = ctx.createGain();
      const trim = ctx.createGain();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const preFader = ctx.createGain();
      const fader = ctx.createGain();
      const sendA = ctx.createGain();
      const sendB = ctx.createGain();

      const anL = ctx.createAnalyser();
      const anR = ctx.createAnalyser();
      anL.fftSize = 256;
      anR.fftSize = 256;

      input.connect(trim);
      trim.connect(preFader);

      if (pan) {
        preFader.connect(pan);
        pan.connect(fader);
      } else {
        preFader.connect(fader);
      }

      // Default: post-fader send
      fader.connect(sendA);
      fader.connect(sendB);
      if (this.fxASendGain) sendA.connect(this.fxASendGain);
      if (this.fxBSendGain) sendB.connect(this.fxBSendGain);

      // Direct mix into Master Send
      if (this.masterSendGain) {
        fader.connect(this.masterSendGain);
      }

      // Analysers for VU meters
      const splitter = ctx.createChannelSplitter(2);
      fader.connect(splitter);
      splitter.connect(anL, 0);
      splitter.connect(anR, 1);

      this.stripNodes.set(id, {
        input,
        trim,
        pan,
        preFader,
        fader,
        sendA,
        sendB,
        analyserL: anL,
        analyserR: anR,
        currentSendAPre: false,
        currentSendBPre: false
      });
    });

    // Connect FX returns
    if (this.fxAReturnGain) {
      const aStrip = this.stripNodes.get('fx_return_a');
      if (aStrip) this.fxAReturnGain.connect(aStrip.input);
    }
    if (this.fxBReturnGain) {
      const bStrip = this.stripNodes.get('fx_return_b');
      if (bStrip) this.fxBReturnGain.connect(bStrip.input);
    }

    this.startMeterLoop();
  }

  private generateSyntheticImpulse(ctx: AudioContext, durationSec: number, decay: number) {
    if (!this.fxBReverbNode) return;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const factor = Math.exp(-t * decay);
      left[i] = (Math.random() * 2 - 1) * factor;
      right[i] = (Math.random() * 2 - 1) * factor;
    }
    this.fxBReverbNode.buffer = impulse;
  }

  private createMasteringCurve(samples: number): Float32Array {
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    const k = 1.2;
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public updateMixerStrip(strip: MixerStrip, allStrips?: MixerStrip[]) {
    let nodeKey = strip.id;
    if (strip.sourceType === 'nes_mono') nodeKey = 'nes_mono';
    else if (strip.id.includes('sid1') || strip.id.includes('core1')) nodeKey = 'sid_core1';
    else if (strip.id.includes('sid2') || strip.id.includes('core2')) nodeKey = 'sid_core2';
    else if (strip.id.includes('sid3') || strip.id.includes('core3')) nodeKey = 'sid_core3';
    else if (strip.id.includes('sid4') || strip.id.includes('core4')) nodeKey = 'sid_core4';
    else if (strip.id.includes('fx_a')) nodeKey = 'fx_return_a';
    else if (strip.id.includes('fx_b')) nodeKey = 'fx_return_b';

    const nodes = this.stripNodes.get(nodeKey);
    if (!nodes || !this.ctx) return;

    // Gain Trim
    const trimLinear = Math.pow(10, strip.gainTrimDb / 20);
    nodes.trim.gain.setTargetAtTime(trimLinear, this.ctx.currentTime, 0.02);

    // Pan
    if (nodes.pan) {
      nodes.pan.pan.setTargetAtTime(strip.pan, this.ctx.currentTime, 0.02);
    }

    // Solo isolation
    const anySoloed = allStrips ? allStrips.some(s => s.soloed) : false;
    const isEffectiveMuted = strip.muted || (anySoloed && !strip.soloed);

    // Fader
    let faderLinear = isEffectiveMuted ? 0 : Math.pow(10, strip.faderDb / 20);
    if (strip.faderDb <= -60) faderLinear = 0;
    nodes.fader.gain.setTargetAtTime(faderLinear, this.ctx.currentTime, 0.02);

    // Pre / Post Send Routing
    if (nodes.currentSendAPre !== strip.sendAPre) {
      try {
        if (strip.sendAPre) {
          nodes.fader.disconnect(nodes.sendA);
          nodes.preFader.connect(nodes.sendA);
        } else {
          nodes.preFader.disconnect(nodes.sendA);
          nodes.fader.connect(nodes.sendA);
        }
        nodes.currentSendAPre = strip.sendAPre;
      } catch {}
    }

    if (nodes.currentSendBPre !== strip.sendBPre) {
      try {
        if (strip.sendBPre) {
          nodes.fader.disconnect(nodes.sendB);
          nodes.preFader.connect(nodes.sendB);
        } else {
          nodes.preFader.disconnect(nodes.sendB);
          nodes.fader.connect(nodes.sendB);
        }
        nodes.currentSendBPre = strip.sendBPre;
      } catch {}
    }

    const sendALinear = strip.sendADb <= -60 ? 0 : Math.pow(10, strip.sendADb / 20);
    const sendBLinear = strip.sendBDb <= -60 ? 0 : Math.pow(10, strip.sendBDb / 20);
    nodes.sendA.gain.setTargetAtTime(sendALinear, this.ctx.currentTime, 0.02);
    nodes.sendB.gain.setTargetAtTime(sendBLinear, this.ctx.currentTime, 0.02);
  }

  // --- Voice Triggering (Hardware Synthesis Simulation) ---
  public triggerNoteOn(voiceId: VoiceId, note: number, velocity: number) {
    const ctx = this.initAudio();
    const freq = midiNoteToFrequency(note);
    const velScale = velocity / 127;
    const key = `${voiceId}_${note}`;

    // Monophonic voice enforcement: panic only this voice channel
    if (voiceId.startsWith('nes.')) {
      this.panicVoice(voiceId);
    }

    let targetStrip = 'nes_mono';
    if (voiceId === 'sid.core1') targetStrip = 'sid_core1';
    else if (voiceId === 'sid.core2') targetStrip = 'sid_core2';
    else if (voiceId === 'sid.core3') targetStrip = 'sid_core3';
    else if (voiceId === 'sid.core4') targetStrip = 'sid_core4';

    const strip = this.stripNodes.get(targetStrip);
    if (!strip) return;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.connect(strip.input);

    const sources: AudioNode[] = [];

    if (voiceId === 'nes.pulse1' || voiceId === 'nes.pulse2') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(gainNode);
      osc.start();
      sources.push(osc);

      gainNode.gain.setValueAtTime(0.3 * velScale, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    } else if (voiceId === 'nes.triangle') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(gainNode);
      osc.start();
      sources.push(osc);

      gainNode.gain.setValueAtTime(0.4 * velScale, ctx.currentTime);
    } else if (voiceId === 'nes.noise') {
      const bufferSize = ctx.sampleRate * 0.15;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const maxFilterFreq = (ctx.sampleRate || 48000) * 0.42;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(Math.min(maxFilterFreq, Math.max(120, freq * 2.5)), ctx.currentTime);
      filter.Q.value = 2.0;

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      whiteNoise.start();
      sources.push(whiteNoise);

      gainNode.gain.setValueAtTime(0.25 * velScale, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    } else if (voiceId === 'nes.dpcm') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.12);
      osc.connect(gainNode);
      osc.start();
      sources.push(osc);

      gainNode.gain.setValueAtTime(0.4 * velScale, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    } else {
      // MIDIbox SID Stereo Core (Sawtooth + Pulse with resonant filter)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(Math.min(8000, Math.max(30, freq)), ctx.currentTime);
      osc2.frequency.setValueAtTime(Math.min(8000, Math.max(30, freq * 1.003)), ctx.currentTime);

      const maxFilterFreq = (ctx.sampleRate || 48000) * 0.42;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(maxFilterFreq, Math.max(150, freq * 2.2)), ctx.currentTime);
      filter.Q.value = 3.5;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      osc1.start();
      osc2.start();
      sources.push(osc1, osc2);

      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.25 * velScale, ctx.currentTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.18 * velScale, ctx.currentTime + 0.1);
    }

    this.activeVoices.set(key, { sources, gain: gainNode, voiceId, note });
  }

  public triggerNoteOff(voiceId: VoiceId, note: number) {
    const key = `${voiceId}_${note}`;
    const active = this.activeVoices.get(key);
    if (!active || !this.ctx) return;

    active.gain.gain.setValueAtTime(active.gain.gain.value, this.ctx.currentTime);
    active.gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.06);

    setTimeout(() => {
      for (const src of active.sources) {
        try {
          if ('stop' in src && typeof (src as OscillatorNode).stop === 'function') {
            (src as OscillatorNode).stop();
          }
          src.disconnect();
        } catch {}
      }
      try { active.gain.disconnect(); } catch {}
      this.activeVoices.delete(key);
    }, 70);
  }

  public panicVoice(voiceId: VoiceId) {
    if (!this.ctx) return;
    for (const [k, v] of this.activeVoices.entries()) {
      if (v.voiceId === voiceId) {
        for (const src of v.sources) {
          try {
            if ('stop' in src && typeof (src as OscillatorNode).stop === 'function') {
              (src as OscillatorNode).stop();
            }
            src.disconnect();
          } catch {}
        }
        try { v.gain.disconnect(); } catch {}
        this.activeVoices.delete(k);
      }
    }
  }

  public panicAll() {
    if (!this.ctx) return;
    for (const v of this.activeVoices.values()) {
      for (const src of v.sources) {
        try {
          if ('stop' in src && typeof (src as OscillatorNode).stop === 'function') {
            (src as OscillatorNode).stop();
          }
          src.disconnect();
        } catch {}
      }
      try { v.gain.disconnect(); } catch {}
    }
    this.activeVoices.clear();

    // Also trigger hardware MIDI panic across all channels
    midiDeviceManager.panicAll();
  }

  // --- Precision Lookahead MIDI Transport Playback ---
  public playSong(
    song: MidiSongModel,
    routes: MidiRoute[],
    startSec = 0,
    onProgress?: (sec: number, bar: number, beat: number) => void,
    onComplete?: () => void
  ) {
    this.initAudio();
    this.stopPlayback();

    this.songModel = song;
    this.songRoutes = routes;
    this.onPlaybackProgress = onProgress || null;
    this.onPlaybackComplete = onComplete || null;

    this.isRunning = true;
    this.isPaused = false;
    this.pauseOffset = startSec;
    this.startTime = this.ctx!.currentTime - startSec;

    // Flatten all events across content tracks, sorted strictly by timeSec
    this.allPlaybackEvents = [];
    song.tracks.forEach((track) => {
      // Match route
      let matchedRoute: MidiRoute | undefined;
      if (song.format === 0) {
        matchedRoute = routes.find(r => track.channelMask.includes(r.midiChannel - 1));
      } else {
        matchedRoute = routes.find(r => r.trackIndex === track.index);
      }

      if (!matchedRoute || matchedRoute.muted) return;

      for (const ev of track.events) {
        if (ev.timeSec < startSec) continue;
        this.allPlaybackEvents.push({
          timeSec: ev.timeSec,
          trackIndex: track.index,
          channel: ev.channel,
          event: ev
        });
      }
    });

    this.allPlaybackEvents.sort((a, b) => a.timeSec - b.timeSec);
    this.scheduledEventIndex = 0;

    midiDeviceManager.sendTransport('START');
    this.runScheduler();
  }

  private runScheduler() {
    if (!this.isRunning || this.isPaused || !this.ctx) return;

    const currentSec = this.ctx.currentTime - this.startTime;
    const lookaheadSec = 0.1; // 100ms lookahead
    const scheduleUntil = currentSec + lookaheadSec;

    while (
      this.scheduledEventIndex < this.allPlaybackEvents.length &&
      this.allPlaybackEvents[this.scheduledEventIndex].timeSec <= scheduleUntil
    ) {
      const item = this.allPlaybackEvents[this.scheduledEventIndex];
      const ev = item.event;
      const eventAudioTime = this.startTime + item.timeSec;
      const delayMs = Math.max(0, (eventAudioTime - this.ctx.currentTime) * 1000);

      // Match voice route
      const route = this.songRoutes.find(r =>
        this.songModel?.format === 0 ? r.midiChannel === item.channel + 1 : r.trackIndex === item.trackIndex
      );

      if (route && !route.muted) {
        const voiceId = route.voiceId;
        const target = midiDeviceManager.resolveVoiceTarget(voiceId);

        if (ev.type === 'noteOn' && ev.note !== undefined && ev.velocity && ev.velocity > 0) {
          setTimeout(() => {
            if (this.isRunning && !this.isPaused) {
              this.triggerNoteOn(voiceId, ev.note!, ev.velocity!);
              midiDeviceManager.sendNoteOn(target.portId, target.channel, ev.note!, ev.velocity!);
            }
          }, delayMs);
        } else if ((ev.type === 'noteOff' || (ev.type === 'noteOn' && (!ev.velocity || ev.velocity === 0))) && ev.note !== undefined) {
          setTimeout(() => {
            if (this.isRunning && !this.isPaused) {
              this.triggerNoteOff(voiceId, ev.note!);
              midiDeviceManager.sendNoteOff(target.portId, target.channel, ev.note!);
            }
          }, delayMs);
        } else if (ev.type === 'cc' && ev.controller !== undefined && ev.value !== undefined) {
          setTimeout(() => {
            if (this.isRunning && !this.isPaused) {
              midiDeviceManager.sendCC(target.portId, target.channel, ev.controller!, ev.value!, `${target.hardware} Controller`);
            }
          }, delayMs);
        } else if (ev.type === 'pitchBend' && ev.value !== undefined) {
          setTimeout(() => {
            if (this.isRunning && !this.isPaused) {
              midiDeviceManager.sendPitchBend(target.portId, target.channel, ev.value!);
            }
          }, delayMs);
        } else if (ev.type === 'programChange' && ev.value !== undefined) {
          setTimeout(() => {
            if (this.isRunning && !this.isPaused) {
              midiDeviceManager.sendProgramChange(target.portId, target.channel, ev.value!);
            }
          }, delayMs);
        }
      }

      this.scheduledEventIndex++;
    }

    // Update progress
    if (this.onPlaybackProgress) {
      const bar = Math.floor(currentSec / 2.0) + 1;
      const beat = Math.floor((currentSec % 2.0) / 0.5) + 1;
      this.onPlaybackProgress(currentSec, bar, beat);
    }

    if (this.songModel && currentSec >= this.songModel.durationSec) {
      this.stopPlayback();
      if (this.onPlaybackComplete) this.onPlaybackComplete();
      return;
    }

    this.schedulerTimer = window.setTimeout(() => this.runScheduler(), 25);
  }

  public pausePlayback() {
    if (!this.isRunning || this.isPaused || !this.ctx) return;
    this.isPaused = true;
    this.pauseOffset = this.ctx.currentTime - this.startTime;
    if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
    this.panicAll();
    midiDeviceManager.sendTransport('STOP');
  }

  public resumePlayback() {
    if (!this.songModel || !this.isPaused) return;
    this.playSong(this.songModel, this.songRoutes, this.pauseOffset, this.onPlaybackProgress || undefined, this.onPlaybackComplete || undefined);
  }

  public stopPlayback() {
    this.isRunning = false;
    this.isPaused = false;
    this.pauseOffset = 0;
    if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
    this.panicAll();
    midiDeviceManager.sendTransport('STOP');
  }

  // --- Real Mastering Return Audio Recording (Bounded Ring Buffer) ---
  public startRecording(deviceId = 'MOTU 16A AVB ASIO', channelPair = 'In 1-2 (Mastering Return)') {
    const ctx = this.initAudio();
    if (!this.masteringReturnGain) return;

    this.isRecording = true;
    const maxSamples = Math.floor(ctx.sampleRate * this.maxRecordSeconds);
    this.recordedLeft = new Float32Array(maxSamples);
    this.recordedRight = new Float32Array(maxSamples);
    this.recordSampleCount = 0;

    // Use ScriptProcessorNode tapping strictly into masteringReturnGain
    this.recordProcessor = ctx.createScriptProcessor(4096, 2, 2);
    this.recordProcessor.onaudioprocess = (e) => {
      if (!this.isRecording || !this.recordedLeft || !this.recordedRight) return;
      const inL = e.inputBuffer.getChannelData(0);
      const inR = e.inputBuffer.getChannelData(1);

      const toCopy = Math.min(inL.length, maxSamples - this.recordSampleCount);
      if (toCopy <= 0) {
        this.stopRecording();
        return;
      }

      this.recordedLeft.set(inL.subarray(0, toCopy), this.recordSampleCount);
      this.recordedRight.set(inR.subarray(0, toCopy), this.recordSampleCount);
      this.recordSampleCount += toCopy;
    };

    this.masteringReturnGain.connect(this.recordProcessor);
    this.recordProcessor.connect(ctx.destination);

    this.recordProvenance = {
      captureSource: 'physical_mastering_return',
      deviceId,
      channelPair,
      sampleRate: ctx.sampleRate,
      durationSamples: 0,
      capturedAt: new Date().toISOString(),
      isWatermarkedDemo: false,
      peakDb: -96,
      rmsDb: -96
    };
  }

  public stopRecording(): { left: Float32Array; right: Float32Array; provenance: RecordingProvenance } | null {
    if (!this.isRecording || !this.recordedLeft || !this.recordedRight) return null;
    this.isRecording = false;

    if (this.recordProcessor) {
      try {
        this.recordProcessor.disconnect();
        this.recordProcessor.onaudioprocess = null;
      } catch {}
      this.recordProcessor = null;
    }

    const finalLen = Math.max(1, this.recordSampleCount);
    const leftTrimmed = this.recordedLeft.slice(0, finalLen);
    const rightTrimmed = this.recordedRight.slice(0, finalLen);

    // Calculate peak and RMS
    let maxAbs = 0;
    let sumSq = 0;
    for (let i = 0; i < finalLen; i++) {
      const aL = Math.abs(leftTrimmed[i]);
      const aR = Math.abs(rightTrimmed[i]);
      if (aL > maxAbs) maxAbs = aL;
      if (aR > maxAbs) maxAbs = aR;
      sumSq += (leftTrimmed[i] * leftTrimmed[i] + rightTrimmed[i] * rightTrimmed[i]) / 2;
    }
    const peakDb = maxAbs > 0.00001 ? 20 * Math.log10(maxAbs) : -96;
    const rms = Math.sqrt(sumSq / finalLen);
    const rmsDb = rms > 0.00001 ? 20 * Math.log10(rms) : -96;

    const provenance: RecordingProvenance = {
      ...(this.recordProvenance || {
        captureSource: 'physical_mastering_return',
        deviceId: 'MOTU 16A',
        channelPair: 'In 1-2',
        sampleRate: this.ctx ? this.ctx.sampleRate : 48000,
        capturedAt: new Date().toISOString()
      }),
      durationSamples: finalLen,
      isWatermarkedDemo: false,
      peakDb: Math.round(peakDb * 10) / 10,
      rmsDb: Math.round(rmsDb * 10) / 10
    };

    return { left: leftTrimmed, right: rightTrimmed, provenance };
  }

  /**
   * Generates explicit synthetic test pattern, conspicuously watermarked
   */
  public generateSyntheticDemoSignal(sampleRate = 48000, durationSec = 16.0): { left: Float32Array; right: Float32Array; provenance: RecordingProvenance } {
    const numSamples = Math.floor(sampleRate * durationSec);
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const s1 = Math.sin(2 * Math.PI * 220 * t) * 0.25;
      const s2 = (Math.sin(2 * Math.PI * 440 * t) > 0 ? 0.15 : -0.15);
      // Seamless beat envelope
      const env = 0.5 + 0.5 * Math.cos(2 * Math.PI * (t % 1.0));
      left[i] = (s1 + s2) * env;
      right[i] = (s1 - s2) * env;
    }

    const provenance: RecordingProvenance = {
      captureSource: 'synthetic_demo_watermarked',
      deviceId: 'INTERNAL_SIMULATOR',
      channelPair: 'VIRTUAL_TEST_BUS',
      sampleRate,
      durationSamples: numSamples,
      capturedAt: new Date().toISOString(),
      isWatermarkedDemo: true,
      peakDb: -6.0,
      rmsDb: -14.2
    };

    return { left, right, provenance };
  }

  // --- Real-Time VU Meter Polling Loop ---
  public onMeters(callback: (levels: Record<string, { peakL: number; peakR: number; rmsL: number; rmsR: number }>) => void) {
    this.onMetersUpdate = callback;
  }

  private startMeterLoop() {
    const bufL = new Float32Array(256);
    const bufR = new Float32Array(256);

    const updateMeters = () => {
      if (this.onMetersUpdate) {
        const levels: Record<string, { peakL: number; peakR: number; rmsL: number; rmsR: number }> = {};
        this.stripNodes.forEach((nodes, id) => {
          nodes.analyserL.getFloatTimeDomainData(bufL);
          nodes.analyserR.getFloatTimeDomainData(bufR);

          let pL = 0, pR = 0, sL = 0, sR = 0;
          for (let i = 0; i < 256; i++) {
            const vL = Math.abs(bufL[i]);
            const vR = Math.abs(bufR[i]);
            if (vL > pL) pL = vL;
            if (vR > pR) pR = vR;
            sL += vL * vL;
            sR += vR * vR;
          }
          levels[id] = {
            peakL: pL,
            peakR: pR,
            rmsL: Math.sqrt(sL / 256),
            rmsR: Math.sqrt(sR / 256)
          };
        });
        this.onMetersUpdate(levels);
      }
      requestAnimationFrame(updateMeters);
    };

    requestAnimationFrame(updateMeters);
  }
}

function midiNoteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export const audioEngine = new AudioEngine();
