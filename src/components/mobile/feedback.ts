import {showFailToast,showSuccessToast,showConfirmDialog,showToast} from 'vant'
export type FormInstance={validate():Promise<unknown>}
export const feedback={warning:(text:string)=>showToast(text),error:(text:string,_duration?:number)=>showFailToast({message:text,wordBreak:'break-word'}),success:(text:string)=>showSuccessToast(text)}
export function confirmAction(options:{title:string;content?:string;okText?:string;cancelText?:string;danger?:boolean;onOk:()=>unknown}){
 void showConfirmDialog({title:options.title,message:options.content,confirmButtonText:options.okText||'确定',cancelButtonText:options.cancelText||'取消',confirmButtonColor:options.danger?'#ee0a24':undefined}).then(async()=>{try{await options.onOk()}catch(error){showFailToast(error instanceof Error?error.message:'操作失败')}}).catch(()=>{})
}
