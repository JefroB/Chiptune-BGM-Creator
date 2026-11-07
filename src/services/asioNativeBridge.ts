/**
 * Native Windows ASIO Backend & Bridge Specification
 * Provides architecture definitions and driver status for physical multichannel ASIO hardware (MOTU 16A, etc.)
 * Strictly distinguishes SIMULATED WebAudio browser execution from PHYSICAL NATIVE ASIO HOST DRIVERS.
 */

export interface AsioDriverInfo {
  id: string;
  name: string;
  version: string;
  inputChannels: number;
  outputChannels: number;
  preferredBufferSize: number; // e.g. 128 samples
  minBufferSize: number;
  maxBufferSize: number;
  supportedSampleRates: number[];
  state: 'LOADED' | 'NOT_PRESENT' | 'SIMULATOR_SANDBOX';
  isPhysicalDriverBound: boolean;
}

export interface AsioChannelMapping {
  hardwareChannel: number;
  channelName: string;
  assignedRole: string;
  direction: 'input' | 'output';
  isPhysical: boolean;
}

export class AsioNativeBridgeService {
  private static instance: AsioNativeBridgeService;

  // Registered standard Windows ASIO Drivers
  private drivers: AsioDriverInfo[] = [
    {
      id: 'motu_16a_asio',
      name: 'MOTU Pro Audio ASIO (16A / AVB)',
      version: '4.0.95843',
      inputChannels: 16,
      outputChannels: 16,
      preferredBufferSize: 128,
      minBufferSize: 64,
      maxBufferSize: 1024,
      supportedSampleRates: [44100, 48000, 88200, 96000, 176400, 192000],
      state: 'SIMULATOR_SANDBOX',
      isPhysicalDriverBound: false
    },
    {
      id: 'asio4all_v2',
      name: 'ASIO4ALL v2',
      version: '2.15',
      inputChannels: 8,
      outputChannels: 8,
      preferredBufferSize: 256,
      minBufferSize: 64,
      maxBufferSize: 2048,
      supportedSampleRates: [44100, 48000, 96000],
      state: 'SIMULATOR_SANDBOX',
      isPhysicalDriverBound: false
    },
    {
      id: 'yamaha_steinberg_usb',
      name: 'Yamaha Steinberg USB ASIO',
      version: '2.1.6',
      inputChannels: 6,
      outputChannels: 6,
      preferredBufferSize: 128,
      minBufferSize: 32,
      maxBufferSize: 2048,
      supportedSampleRates: [44100, 48000, 96000, 192000],
      state: 'SIMULATOR_SANDBOX',
      isPhysicalDriverBound: false
    }
  ];

  public static getInstance(): AsioNativeBridgeService {
    if (!AsioNativeBridgeService.instance) {
      AsioNativeBridgeService.instance = new AsioNativeBridgeService();
    }
    return AsioNativeBridgeService.instance;
  }

  /**
   * Status Disclosure: WebAudio runs in browser sandbox.
   * Direct kernel-level Windows ASIO driver interaction requires the native C++ desktop host.
   */
  public getDriverStatus(): {
    mode: 'SIMULATED_WEBAUDIO' | 'NATIVE_WINDOWS_ASIO';
    activeDriver: string;
    isNativeDriverBound: boolean;
    notice: string;
  } {
    return {
      mode: 'SIMULATED_WEBAUDIO',
      activeDriver: this.drivers[0].name,
      isNativeDriverBound: false,
      notice: 'MODE: SIMULATOR / NO PHYSICAL ASIO HOST DRIVER BOUND. WebAudio runs inside a sandboxed browser context. Physical ASIO hardware I/O and direct converter latency compensation require the native Windows desktop companion service.'
    };
  }

  public getAvailableDrivers(): AsioDriverInfo[] {
    return [...this.drivers];
  }

  /**
   * Calculates theoretical buffer latency without fabricating hardware pings
   */
  public calculateTheoreticalLatency(bufferSamples = 128, sampleRate = 48000): {
    oneWayMs: number;
    roundTripMs: number;
    formula: string;
  } {
    const oneWayMs = Math.round((bufferSamples / sampleRate) * 1000 * 100) / 100;
    const roundTripMs = Math.round(oneWayMs * 2 * 100) / 100;
    return {
      oneWayMs,
      roundTripMs,
      formula: `(2 × ${bufferSamples} samples) / ${sampleRate}Hz = ${roundTripMs}ms buffer latency (excluding physical DAC/ADC conversion)`
    };
  }
}

export const asioNativeBridge = AsioNativeBridgeService.getInstance();
