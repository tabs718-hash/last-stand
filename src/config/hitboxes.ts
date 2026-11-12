/** Query-only ballistic proxies fitted to the clothed 0.6 silhouette.
 * Mechanical contact shapes, masses and inertia remain the original active ragdoll. */
export function hitboxSize(name:string,fallback:readonly number[]):[number,number,number]{
 if(name==='Head')return [.20,.26,.21];
 if(name==='Chest')return [.43,.25,.275];
 if(name==='Abdomen')return [.35,.18,.255];
 if(name==='Pelvis')return [.37,.20,.26];
 if(name.includes('upper arm'))return [.15,.29,.15];
 if(name.includes('forearm'))return [.125,.25,.13];
 if(name.includes('hand'))return [.12,.17,.095];
 if(name.includes('thigh'))return [.20,.37,.21];
 if(name.includes('shin'))return [.16,.36,.13];
 return [...fallback] as [number,number,number];
}
