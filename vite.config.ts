import {defineConfig} from 'vite';
export default defineConfig({
 base:'./',
 build:{manifest:true,rollupOptions:{output:{manualChunks(id){
  if(id.includes('@dimforge/rapier3d-compat'))return 'physics-vendor';
  if(id.includes('/node_modules/three/'))return 'three-vendor';
  if(/\/node_modules\/(react|react-dom|react-reconciler|scheduler|@react-three)\//.test(id))return 'render-vendor';
 }}}},
});
