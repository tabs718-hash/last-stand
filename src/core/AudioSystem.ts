/** Locally synthesized sounds; audio never drives the simulation clock. */
export class AudioSystem {
  context:AudioContext|null=null;
  muted=false;
  private noise:AudioBuffer|null=null;
  unlock(){
    if(typeof AudioContext==='undefined')return;
    this.context??=new AudioContext();void this.context.resume().catch(()=>{});
  }
  private tone(frequency:number,duration:number,volume:number,type:OscillatorType='sine',delay=0){
    const ctx=this.context;if(this.muted||!ctx||ctx.state!=='running')return;
    const o=ctx.createOscillator(),g=ctx.createGain(),at=ctx.currentTime+delay;
    o.type=type;o.frequency.setValueAtTime(frequency,at);g.gain.setValueAtTime(Math.max(.001,volume),at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    o.connect(g).connect(ctx.destination);o.start(at);o.stop(at+duration);o.onended=()=>{o.disconnect();g.disconnect()};
  }
  shot(distant=false){
    const ctx=this.context;if(this.muted||!ctx||ctx.state!=='running')return;
    if(!this.noise){this.noise=ctx.createBuffer(1,ctx.sampleRate*.28,ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*.042))}
    const source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
    source.buffer=this.noise;filter.type='lowpass';filter.frequency.value=distant?1500:4200;gain.gain.value=distant?.16:.32;
    source.connect(filter).connect(gain).connect(ctx.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};
    this.tone(distant?85:110,.13,distant?.05:.10,'triangle');
  }
  signal(){for(const [f,g] of [[880,.1],[1320,.045],[2200,.018]])this.tone(f,.65,g)}
  draw(){this.tone(180,.10,.025,'triangle');this.tone(520,.035,.018,'square',.08)}
  dry(){this.tone(280,.035,.035,'square')}
  result(won:boolean|null){const notes=won===true?[392,494,587]:won===false?[294,247,196]:[330,330];notes.forEach((f,i)=>this.tone(f,.33,.045,'triangle',i*.14))}
}
