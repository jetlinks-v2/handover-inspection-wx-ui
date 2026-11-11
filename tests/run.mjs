import {build} from 'esbuild'
import {mkdtemp,rm,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
const directory=await mkdtemp(join(tmpdir(),'repair-h5-tests-'))
try{
 const entries=(await readdir('tests')).filter(file=>file.endsWith('.test.ts'))
 await build({entryPoints:entries.map(file=>'tests/'+file),bundle:true,platform:'node',format:'esm',outdir:directory,outExtension:{'.js':'.mjs'}})
 const result=spawnSync(process.execPath,['--test',...entries.map(file=>join(directory,file.replace(/\.ts$/,'.mjs')))],{stdio:'inherit'})
 process.exitCode=result.status??1
}finally{await rm(directory,{recursive:true,force:true})}
