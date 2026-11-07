/**
 * Hardware MIDI Device Manager & Transmission Queue
 * Connects to Windows physical MIDI ports via Web MIDI API (sysex enabled).
 * Manages atomic NRPN groups, SysEx patch dumps, and hardware emergency panic.
 */

import { MidiPortInfo, HardwareBindingConfig } from '../types/index.ts';
import { encodeNrpn } from './sidProtocolAdapter.ts';

export type WebMidiStatus = 'unsupported' | 'permission_denied' | 'ready' | 'connected' | 'simulated';

export interface MidiTxLogEntry {
  timestamp: number;
  portId: string;
  type: 'NOTE' | 'CC' | 'NRPN' | 'SYSEX' | 'CLOCK' | 'PANIC';
  channel: number;
  data: number[];
  summary: string;
}

interface MidiPortLike {
  id: string;
  name?: string;
  manufacturer?: string;
  state?: string;
  connection?: string;
  send(bytes: number[] | Uint8Array, timestamp?: number): void;
}

interface MidiAccessLike {
  inputs: Map<string, MidiPortLike>;
  outputs: Map<string, MidiPortLike>;
  onstatechange?: ((event: any) => void) | null;
}

class MidiDeviceManager {
  private midiAccess: MidiAccessLike | null = null;
  private inputPorts: Map<string, MidiPortLike> = new Map();
  private outputPorts: Map<string, MidiPortLike> = new Map();
  private status: WebMidiStatus = 'simulated';
  private statusListeners: Array<(status: WebMidiStatus) => void> = [];
  private txLog: MidiTxLogEntry[] = [];
  private txQueue: Array<{ portId: string; bytes: number[]; summary: string; type: MidiTxLogEntry['type']; channel: number }> = [];
  private isProcessingQueue = false;

  private binding: HardwareBindingConfig = {
    mode: 'simulator',
    midinesPortId: null,
    midinesChannel: 1,
    sidCorePorts: [null, null, null, null],
    sidCoreChannels: [6, 7, 8, 9],
    syncClockOutput: true
  };

  constructor() {
    this.initWebMidi();
  }

  public async initWebMidi(): Promise<WebMidiStatus> {
    if (typeof window === 'undefined' || !(navigator as any).requestMIDIAccess) {
      this.status = 'unsupported';
      this.notifyStatus();
      return this.status;
    }

    try {
      this.midiAccess = await (navigator as any).requestMIDIAccess({ sysex: true });
      this.refreshPorts();
      if (this.midiAccess) {
        this.midiAccess.onstatechange = () => {
          this.refreshPorts();
        };
      }
      this.status = this.outputPorts.size > 0 ? 'connected' : 'ready';
      this.notifyStatus();
      return this.status;
    } catch (err) {
      console.warn('Web MIDI Access denied or unavailable:', err);
      this.status = 'permission_denied';
      this.notifyStatus();
      return this.status;
    }
  }

  private refreshPorts() {
    if (!this.midiAccess) return;
    this.inputPorts.clear();
    this.outputPorts.clear();

    this.midiAccess.inputs.forEach((input: MidiPortLike) => {
      this.inputPorts.set(input.id, input);
    });

    this.midiAccess.outputs.forEach((output: MidiPortLike) => {
      this.outputPorts.set(output.id, output);
    });
  }

  public getStatus(): WebMidiStatus {
    return this.status;
  }

  public onStatusChange(listener: (status: WebMidiStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  private notifyStatus() {
    for (const listener of this.statusListeners) {
      try { listener(this.status); } catch { /* ignore */ }
    }
  }

  public getAvailablePorts(): { inputs: MidiPortInfo[]; outputs: MidiPortInfo[] } {
    const inputs: MidiPortInfo[] = Array.from(this.inputPorts.values()).map(p => ({
      id: p.id,
      name: p.name || 'Unnamed MIDI Input',
      manufacturer: p.manufacturer,
      state: p.state === 'connected' ? 'connected' : 'disconnected',
      type: 'input'
    }));

    const outputs: MidiPortInfo[] = Array.from(this.outputPorts.values()).map(p => ({
      id: p.id,
      name: p.name || 'Unnamed MIDI Output',
      manufacturer: p.manufacturer,
      state: p.state === 'connected' ? 'connected' : 'disconnected',
      type: 'output'
    }));

    return { inputs, outputs };
  }

  public getBinding(): HardwareBindingConfig {
    return { ...this.binding };
  }

  public updateBinding(config: Partial<HardwareBindingConfig>) {
    this.binding = { ...this.binding, ...config };
  }

  /**
   * Queue raw bytes for transmission, rate-limited to avoid MIDI bus saturation
   */
  public sendRaw(portId: string | null, bytes: number[] | Uint8Array, type: MidiTxLogEntry['type'], channel: number, summary: string) {
    const rawArray = Array.from(bytes);
    this.txLog.unshift({
      timestamp: Date.now(),
      portId: portId || 'SIMULATOR',
      type,
      channel,
      data: rawArray.slice(0, 16),
      summary
    });
    if (this.txLog.length > 100) this.txLog.pop();

    if (!portId || this.binding.mode === 'simulator') {
      return; // Simulated / offline mode
    }

    this.txQueue.push({ portId, bytes: rawArray, summary, type, channel });
    this.processQueue();
  }

  private processQueue() {
    if (this.isProcessingQueue || this.txQueue.length === 0) return;
    this.isProcessingQueue = true;

    const item = this.txQueue.shift();
    if (item) {
      const port = this.outputPorts.get(item.portId);
      if (port && port.state === 'connected') {
        try {
          port.send(item.bytes);
        } catch (err) {
          console.warn(`Failed to send MIDI to port ${item.portId}:`, err);
        }
      }
    }

    // Small 2ms throttle between messages to respect 31.25 kbaud MIDI bandwidth
    setTimeout(() => {
      this.isProcessingQueue = false;
      this.processQueue();
    }, 2);
  }

  /**
   * Transmit MIDInes Controller parameter update
   */
  public sendMidinesCC(channel: number, controller: number, value: number, desc: string) {
    const ch = Math.max(0, Math.min(15, channel - 1));
    const bytes = [0xb0 | ch, controller & 0x7f, value & 0x7f];
    this.sendRaw(this.binding.midinesPortId, bytes, 'CC', channel, `MIDInes Ch ${channel} CC${controller}=${value} (${desc})`);
  }

  /**
   * Transmit MIDIbox SID NRPN parameter update
   */
  public sendSidNrpn(coreIndex: number, nrpnAddress: number, value: number, desc: string) {
    const channel = this.binding.sidCoreChannels[coreIndex] || (coreIndex + 6);
    const portId = this.binding.sidCorePorts[coreIndex] || this.binding.midinesPortId;
    const nrpn = encodeNrpn(channel - 1, nrpnAddress, value);
    this.sendRaw(portId, nrpn.rawBytes, 'NRPN', channel, `SID Core ${coreIndex + 1} Ch ${channel} NRPN 0x${nrpnAddress.toString(16).toUpperCase()}=${value} (${desc})`);
  }

  /**
   * Transmit SysEx patch dump or command
   */
  public sendSysEx(portId: string | null, sysexBytes: Uint8Array | number[], desc: string) {
    const targetPort = portId || this.binding.midinesPortId;
    this.sendRaw(targetPort, sysexBytes, 'SYSEX', 0, `SysEx: ${desc} (${sysexBytes.length} bytes)`);
  }

  /**
   * Transmit 24 PPQN MIDI Clock pulse to synchronized hardware sequencers
   */
  public sendClockPulse() {
    if (!this.binding.syncClockOutput) return;
    // 0xF8 = Timing Clock
    const ports = new Set([this.binding.midinesPortId, ...this.binding.sidCorePorts].filter(Boolean));
    for (const portId of ports) {
      if (portId) {
        this.sendRaw(portId, [0xf8], 'CLOCK', 0, 'MIDI Clock (24 PPQN)');
      }
    }
  }

  /**
   * Transmit Start / Stop / Continue realtime transport messages
   */
  public sendTransport(cmd: 'START' | 'STOP' | 'CONTINUE') {
    const byte = cmd === 'START' ? 0xfa : cmd === 'STOP' ? 0xfc : 0xfb;
    const ports = new Set([this.binding.midinesPortId, ...this.binding.sidCorePorts].filter(Boolean));
    for (const portId of ports) {
      if (portId) {
        this.sendRaw(portId, [byte], 'CLOCK', 0, `MIDI Transport: ${cmd}`);
      }
    }
  }

  /**
   * Complete Hardware Panic: Shuts off all notes on all 16 MIDI channels across all outputs
   */
  public panicAll() {
    this.txQueue = []; // Clear pending queue immediately

    const ports = Array.from(this.outputPorts.keys());
    if (ports.length === 0) {
      this.sendRaw(null, [0xb0, 120, 0], 'PANIC', 0, 'Simulator Panic Silence');
      return;
    }

    for (const portId of ports) {
      for (let ch = 0; ch < 16; ch++) {
        // CC 120 = All Sound Off
        this.sendRaw(portId, [0xb0 | ch, 120, 0], 'PANIC', ch + 1, `Panic: All Sound Off (Ch ${ch + 1})`);
        // CC 123 = All Notes Off
        this.sendRaw(portId, [0xb0 | ch, 123, 0], 'PANIC', ch + 1, `Panic: All Notes Off (Ch ${ch + 1})`);
        // CC 121 = Reset All Controllers
        this.sendRaw(portId, [0xb0 | ch, 121, 0], 'PANIC', ch + 1, `Panic: Reset Controllers (Ch ${ch + 1})`);
      }
    }
  }

  public getRecentTxLog(): MidiTxLogEntry[] {
    return [...this.txLog];
  }
}

export const midiDeviceManager = new MidiDeviceManager();
