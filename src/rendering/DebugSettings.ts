export interface DebugSettings {
  mannequin:boolean;
  hitboxes:boolean;
  colliders:boolean;
  joints:boolean;
  support:boolean;
  centerOfMass:boolean;
  targets:boolean;
  shots:boolean;
}
export const DEFAULT_DEBUG_SETTINGS:DebugSettings={mannequin:false,hitboxes:false,colliders:true,joints:true,support:true,centerOfMass:true,targets:true,shots:true};
