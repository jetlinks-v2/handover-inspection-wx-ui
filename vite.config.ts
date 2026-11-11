import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {readdirSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
export default defineConfig({
 base:'/handover-h5/',plugins:[vue({template:{compilerOptions:{isCustomElement:tag=>tag==='altcha-widget'}}}),{name:'handover-static-shell',closeBundle(){
 const base='/handover-h5/',assets=[base,base+'index.html',...readdirSync('dist/assets').map(name=>base+'assets/'+name)]
 const version=createHash('sha256').update(assets.join(',')).digest('hex').slice(0,12)
 writeFileSync('dist/sw.js',`const CACHE='handover-h5-shell-${version}',BASE=${JSON.stringify(base)},ASSETS=${JSON.stringify(assets)};
 self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
 self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('handover-h5-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
 self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET'||!url.pathname.startsWith(BASE)||url.pathname===BASE+'config.json')return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(BASE+'index.html')));return;}
 if(ASSETS.includes(url.pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));});`);
 }}],
 resolve:{dedupe:['vue']},server:{host:'127.0.0.1',port:9310,strictPort:true,
 proxy:process.env.H5_API_PROXY?{'/api':{target:process.env.H5_API_PROXY,changeOrigin:true,rewrite:path=>path.replace(/^\/api/,'')}}:undefined},
})
