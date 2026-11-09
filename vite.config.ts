import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {stagePlugin} from './server/plugin';
export default defineConfig({plugins:[stagePlugin(),react()],resolve:{alias:{'@vibestage/models':fileURLToPath(new URL('./user-models',import.meta.url)),'@vibestage/core':fileURLToPath(new URL('./lib/core/index.ts',import.meta.url))}},assetsInclude:['**/*.glb','**/*.gltf'],server:{host:'127.0.0.1',port:5173,hmr:{overlay:false},watch:{ignored:['**/projects/**','**/user-models/**','**/lib/**','**/templates/**']}},build:{chunkSizeWarningLimit:1000}});
