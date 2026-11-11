// 浏览器回归：全部 API 使用本地 fixture，不访问真实 SaaS 业务数据。
// prettier-ignore
async (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const calls = []
  const problem = {
    id: 'construction-test',
    projectId: 'project-5g',
    version: 1,
    source: 'SITE_INSPECTION',
    description: '消防通道防火门闭门器松动',
    organizationId: 'organization-a',
    organizationName: '重庆建工集团',
    status: 0,
    auditStage: 0,
    inspectionTime: Date.now(),
    photos: [],
    nodes: []
  }
  await page.unrouteAll()
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
      calls.push(path)
      let result
      if(path.endsWith('/authorize/captcha/config'))result={enabled:false,type:'image'}
      else if (path.endsWith('/authorize/me'))
        result = {
          user: { id: 'construction-user', name: '施工王工' },
          permissions: [{ id: 'handover-problem', actions: ['query', 'accept', 'rectify'] }]
        }
      else if (path.endsWith('/directory/me'))
        result = {
          id: 'construction-user',
          name: '施工王工',
          employee: false,
          organizationIds: ['organization-a', 'organization-b']
        }
      else if (path.endsWith('/directory/projects')) result = [{ id: 'project-5g', name: '5G园区' }]
      else if (path.endsWith('/problem/_counts'))
        result = {
          total: 1,
          pending: problem.status === 0 ? 1 : 0,
          processing: problem.status === 1 ? 1 : 0,
          review: problem.status === 2 ? 1 : 0,
          completed: 0,
          rejected: 0
        }
      else if (path.endsWith('/problem/_query'))
        result = { total: 1, pageIndex: 0, pageSize: 12, data: [problem] }
      else if (path.endsWith('/problem/construction-test')) result = problem
      else if (path.endsWith('/problem/construction-test/accept')) {
        const body = route.request().postDataJSON()
        if (body.version !== problem.version) throw Error('接收版本错误')
        problem.status = 1
        problem.version++
        result = problem
      } else if (path.endsWith('/problem/construction-test/rectify')) {
        const body = route.request().postDataJSON()
        if (!body.description.includes('闭门器')) throw Error('整改说明未提交')
        problem.status = 2
        problem.version++
        result = problem
      } else throw Error('施工账号不应请求物业录入目录：' + path)
      await route.fulfill({ json: { status: 200, message: 'success', result } })
    }
  )
  await page.addInitScript(() => {
    sessionStorage.setItem('handover:offline-mode', 'false')
    sessionStorage.setItem(
      'handover-h5:session',
      JSON.stringify({
        token: 'construction-visual-only',
        tenantDomain: 'visual',
        applicationId: 'visual-application'
      })
    )
    sessionStorage.setItem(
      JSON.stringify(['handover-project', 'visual', 'visual-application', 'construction-user']),
      'project-5g'
    )
  })
  await page.goto('http://127.0.0.1:9310/')
  await page.getByRole('heading', { name: '查验工作台' }).waitFor()
  await page.getByRole('button', { name: '进入施工查验', exact: false }).click()
  await page.getByRole('button', { name: /消防通道防火门/ }).click()
  await page.getByRole('button', { name: '接收问题', exact: true }).click()
  await page.getByRole('button', { name: '确认接收问题', exact: true }).click()
  await page.getByRole('button', { name: '提交整改', exact: true }).click()
  await page.getByRole('textbox').fill('已紧固闭门器并复查启闭正常')
  await page.getByRole('button', { name: '确认提交整改', exact: true }).click()
  await page.getByText('待复验 · 待初审', { exact: true }).waitFor()
  if (problem.status !== 2 || errors.length)
    throw Error('施工端状态流失败：' + JSON.stringify({ problem, errors }))
  return { url: page.url(), errors, calls }
}
