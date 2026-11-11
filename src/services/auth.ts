import {authorize} from '../api/handover'
import {state} from './session'
/** 刷新必须联网核验具体应用；离线操作使用本次已核验的会话，不从旧凭据恢复授权。 */
export async function verifySession(){
 const session=state.session
 if(!session)throw Error('请先登录')
 const authorization=await authorize()
 if(state.session!==session)throw Error('登录上下文已变化')
 if(!authorization?.user?.id)throw Error('应用授权未返回有效身份')
 state.authorization=authorization
}
