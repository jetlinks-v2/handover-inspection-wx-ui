import type {ComputedRef,InjectionKey} from 'vue'
import type {FieldRule} from 'vant'
export interface Rule {required?:boolean;whitespace?:boolean;min?:number;max?:number;pattern?:RegExp;message?:string;type?:string}
export const formContext:InjectionKey<{model:ComputedRef<Record<string,unknown>>;rules:ComputedRef<Record<string,Rule[]>>;disabled:ComputedRef<boolean|undefined>}> = Symbol('business-form')
/** 保留原字段的必填、空白、长度和正则规则，交由 Vant Form 显示与阻止提交。 */
export function fieldRules(rules:Rule[],required?:boolean,label='此项',getValue?:()=>unknown):FieldRule[]{
 const source=required&&!rules.some(rule=>rule.required)?[{required:true,message:'请填写'+label},...rules]:rules
 return source.map(rule=>({message:rule.message||'请检查'+label,validateEmpty:true,validator:(value:unknown)=>{
  if(getValue)value=getValue()
  const empty=value===undefined||value===null||value===''||Array.isArray(value)&&!value.length
  if(rule.required&&empty)return false
  if(empty)return true
  if(rule.whitespace&&typeof value==='string'&&!value.trim())return false
  if(rule.pattern&&!rule.pattern.test(String(value)))return false
  const length=typeof value==='string'||Array.isArray(value)?value.length:typeof value==='number'?value:undefined
  return length===undefined||(rule.min===undefined||length>=rule.min)&&(rule.max===undefined||length<=rule.max)
 }}))
}
