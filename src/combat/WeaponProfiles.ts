export const SHOT_ENERGY={LOW:60,MEDIUM:220,HIGH:540,POWER:80000};
export type EnergyMode=keyof typeof SHOT_ENERGY;
export type PenetrationPolicy='material'|'stop'|'through';
export const WEAPON_PROFILES={
 LOW:{name:'Обычный револьвер',model:'/assets/revolver.glb',energy:60,penetration:'stop'},
 MEDIUM:{name:'Вулкан',model:'/assets/volcanic.glb',energy:220,penetration:'stop'},
 HIGH:{name:'Магнум',model:'/assets/magnum.glb',energy:540,penetration:'through'},
 POWER:{name:'Power Gun',model:'/assets/power-gun.glb',energy:80000,penetration:'through'},
} as const;
