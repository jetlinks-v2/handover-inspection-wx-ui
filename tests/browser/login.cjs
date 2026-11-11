// 浏览器回归：全部 API 使用本地 fixture，不访问真实 SaaS 业务数据。
// prettier-ignore
async (page) => {
  await page.unrouteAll()
  let loggedIn = false
  await page.route(
    (url) => url.pathname === '/config.json',
    (route) =>
      route.fulfill({
        json: {
          applicationId: 'visual-application',
          tenantDomain: 'visual',
          title: '承接查验',
          apiBase: '/api',
          allowedHostOrigins: []
        }
      })
  )
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname
      let result
      if (path.endsWith('/authorize/captcha/config')) result = { enabled: false }
      else if (path.endsWith('/authorize/login/configs')) result = { encrypt: { enabled: false } }
      else if (path.endsWith('/authorize/login')) {
        const body = route.request().postDataJSON()
        if (body.username !== 'test@visual' || body.password !== 'fixture-password')
          throw Error('登录内容错误')
        loggedIn = true
        result = { token: 'visual-only' }
      } else if (path.endsWith('/authorize/me'))
        result = {
          user: { id: 'visual-user', name: '测试员工' },
          permissions: [{ id: 'handover-problem', actions: ['query', 'save'] }]
        }
      else if (path.endsWith('/directory/projects')) result = []
      else throw Error('意外请求' + path)
      await route.fulfill({ json: { status: 200, result, message: 'success' } })
    }
  )
  await page.goto('http://127.0.0.1:9310/')
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await page.getByLabel('员工账号', { exact: true }).fill('test')
  await page.getByLabel('密码', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: /^登\s*录$/ }).click()
  await page.getByRole('heading', { name: '查验工作台' }).waitFor()
  if (!loggedIn) throw Error('登录按钮未提交')
  return { loginSubmitted: loggedIn, url: page.url() }
}
