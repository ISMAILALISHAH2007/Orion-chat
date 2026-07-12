// Helper to convert base64 to Uint8Array
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to convert Int16Array to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Inline AudioWorklet processor code for capturing mic audio into PCM16 chunks
// It runs in the audio thread, buffers 2048 frames, and posts Int16Array back.
const recorderWorkletCode = `
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.head = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0].length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.head++] = channelData[i];
        if (this.head >= this.bufferSize) {
          // Convert to PCM 16-bit
          const pcm16 = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            let s = Math.max(-1, Math.min(1, this.buffer[j]));
            pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
          this.head = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-recorder', PCMRecorderProcessor);
`;

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private isRecording = false;
  private onAudioData: ((base64Pcm: string) => void) | null = null;

  // Playback queue
  private nextPlayTime = 0;
  private isPlaying = false;
  private scheduledSources: AudioBufferSourceNode[] = [];

  constructor() {}

  public setOnAudioData(callback: (base64Pcm: string) => void) {
    this.onAudioData = callback;
  }

  public async startRecording() {
    if (this.isRecording) return;
    this.isRecording = true;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1,
        sampleRate: 16000,
      }});

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      // Resume context if needed
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.nextPlayTime = this.audioContext.currentTime;

      // Add worklet module via Blob URI
      const blob = new Blob([recorderWorkletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);

      this.sourceNode = this.audioContext.createMediaStreamSource(this.micStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-recorder');

      this.workletNode.port.onmessage = (e: MessageEvent) => {
        if (!this.isRecording) return;
        const arrayBuffer = e.data as ArrayBuffer;
        if (this.onAudioData) {
          const base64 = arrayBufferToBase64(arrayBuffer);
          this.onAudioData(base64);
        }
      };

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

    } catch (e) {
      console.error('Error starting audio recording:', e);
      this.stopRecording();
    }
  }

  public stopRecording() {
    this.isRecording = false;
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // Gemini returns audio at 24000 Hz, PCM 16-bit
  public addPlaybackData(base64Pcm: string) {
    if (!this.audioContext) return;
    this.isPlaying = true;

    const arrayBuffer = base64ToArrayBuffer(base64Pcm);
    const pcm16 = new Int16Array(arrayBuffer);
    
    // Create Float32Array for AudioBuffer
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime;
    }

    source.start(this.nextPlayTime);
    this.scheduledSources.push(source);
    this.nextPlayTime += audioBuffer.duration;

    source.onended = () => {
      this.scheduledSources = this.scheduledSources.filter(s => s !== source);
      if (this.audioContext && this.audioContext.currentTime >= this.nextPlayTime - 0.1) {
        this.isPlaying = false;
      }
    };
  }

  public interruptPlayback() {
    if (!this.audioContext) return;
    this.scheduledSources.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    this.scheduledSources = [];
    this.nextPlayTime = this.audioContext.currentTime;
    this.isPlaying = false;
  }
}
