export function applicationEntry(search=location.search):string {
 const params=new URLSearchParams(search), values=params.getAll('applicationScope')
 if(values.length!==1||!/^[a-zA-Z0-9_-]{1,128}$/.test(values[0]))throw Error('请从具体应用入口打开此页面')
 if(params.has('token')||params.has('access_token'))throw Error('应用入口不能携带登录凭据')
 return values[0]
}
export function apiBase(value:unknown):string {
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\?#]/.test(value)||value.split('/').includes('..')||value.includes('%'))
  throw Error('接口必须配置为同源绝对路径')
 return value.replace(/\/$/,'')
}
