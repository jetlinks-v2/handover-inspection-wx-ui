export type Choice=string|number|boolean
export interface Option {value:Choice;label?:string;name?:string;disabled?:boolean;children?:unknown[]}
export function selectionRows(options:Option[],tree=false,changeOnSelect=false,parent:Choice[]=[],depth=0):{value:Choice;label:string;disabled:boolean;path:Choice[]}[]{
 return options.flatMap(option=>{const children=(option.children||[]) as Option[],path=[...parent,option.value];return [{value:option.value,label:'　'.repeat(depth)+(option.label||option.name||String(option.value)),disabled:!!option.disabled||tree&&!!children.length&&!changeOnSelect,path},...selectionRows(children,tree,changeOnSelect,path,depth+1)]})
}
