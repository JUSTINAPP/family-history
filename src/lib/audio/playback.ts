// Speech playback only: original uploaded bytes are never modified.
let context: AudioContext | undefined;
const graphs = new WeakMap<HTMLMediaElement, {source: MediaElementAudioSourceNode; gain: GainNode; limiter: WaveShaperNode; connected: boolean}>();
export function prepareVoicePlayback() {
  if (typeof window === 'undefined' || !window.AudioContext) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch { /* Native playback remains available. */ }
}
export async function playVoice(element: HTMLAudioElement) {
  prepareVoicePlayback();
  // Do not reroute audio into a suspended context (e.g. Safari blocks autoplay).
  if (context?.state === 'running') {
    const existing=graphs.get(element);
    if(existing && !existing.connected){existing.source.connect(existing.gain).connect(existing.limiter).connect(context.destination);existing.connected=true;}
    if(!existing) {
    try {
      const gain = context.createGain();
      gain.gain.value = 2; // +6 dB for quiet speech.
      const limiter = context.createWaveShaper();
      const curve = new Float32Array(4097);
      for (let i=0;i<curve.length;i++) {
        const x=2*i/(curve.length-1)-1;
        // Linear for quiet speech, smoothly limit louder peaks below full scale.
        curve[i]=Math.abs(x)<=0.5 ? x : Math.sign(x)*(0.5+0.45*Math.tanh((Math.abs(x)-0.5)/0.45));
      }
      limiter.curve=curve;
      limiter.oversample='2x';
      gain.connect(limiter).connect(context.destination);
      const source=context.createMediaElementSource(element);
      source.connect(gain);
      graphs.set(element,{source,gain,limiter,connected:true});
    } catch { /* Keep the native path when Web Audio is unavailable. */ }
    }
  }
  element.muted=false;
  element.volume=1;
  await element.play();
}

export function releaseVoicePlayback(element: HTMLAudioElement) {
  const graph=graphs.get(element);
  if(graph){graph.source.disconnect();graph.gain.disconnect();graph.limiter.disconnect();graph.connected=false;}
}
