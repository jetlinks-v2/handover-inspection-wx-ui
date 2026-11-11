// 浏览器回归：全部业务和文件 API 使用隔离 fixture，不访问 SaaS 业务数据。
;async (existingPage) => {
  const page = await existingPage.context().newPage()
  const errors = [],
    problems = [],
    calls = []
  let uploads = 0
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=',
    'base64'
  )
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(
    (url) => url.pathname === '/config.json',
    (route) =>
      route.fulfill({
        json: {
          applicationId: 'property-fixture',
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
      if (path.startsWith('/api/file/') && path !== '/api/file/upload') {
        await route.fulfill({ body: png, contentType: 'image/png' })
        return
      }
      let result
      if (path.endsWith('/authorize/captcha/config')) result = { enabled: false }
      else if (path.endsWith('/authorize/me'))
        result = {
          user: { id: 'property-user', name: '物业张工' },
          permissions: [
            { id: 'handover-problem', actions: ['query', 'save', 'initial-review', 'final-review'] }
          ]
        }
      else if (path.endsWith('/directory/me'))
        result = {
          id: 'property-user',
          name: '物业张工',
          employee: true,
          organizationIds: ['project-fixture']
        }
      else if (path.endsWith('/directory/projects'))
        result = [{ id: 'project-fixture', name: '隔离测试园区' }]
      else if (path.endsWith('/directory/organizations')) result = [{ id: 'external', name: '测试施工单位' }]
      else if (path.endsWith('/directory/spaces')) result = [{ id: 'space', name: '测试楼栋' }]
      else if (path.endsWith('/directory/users'))
        result = { data: [{ id: 'property-user', name: '物业张工' }], total: 1 }
      else if (path.endsWith('/problem-category/_query'))
        result = { data: [{ id: 'category', name: '消防工程' }], total: 1 }
      else if (path.endsWith('/item/_query')) result = { data: [], total: 0 }
      else if (path.endsWith('/problem/_counts'))
        result = {
          total: problems.length,
          pending: problems.length,
          processing: 0,
          review: 0,
          completed: 0,
          rejected: 0
        }
      else if (path.endsWith('/problem/_query'))
        result = { data: problems, total: problems.length, pageIndex: 0, pageSize: 12 }
      else if (path === '/api/file/upload')
        result = { id: 'photo-' + ++uploads, name: '现场.png', contentType: 'image/png' }
      else if (path === '/api/property/handover/problem') {
        const input = route.request().postDataJSON()
        if (!input.clientRequestId || input.photos.length !== 1 || !input.photos[0].fileId)
          throw Error('问题/照片提交契约错误')
        if (problems.some((row) => row.clientRequestId === input.clientRequestId))
          throw Error('浏览器重复提交')
        result = { ...input, id: 'problem-' + (problems.length + 1), version: 1, nodes: [] }
        problems.push(result)
      } else if (path.includes('/problem/problem-'))
        result = problems.find((row) => path.endsWith('/' + row.id))
      else throw Error('意外接口：' + path)
      if (result && Array.isArray(result.data)) {
        result.pageIndex ??= 0
        result.pageSize ??= 200
      }
      await route.fulfill({ json: { status: 200, message: 'success', result } })
    }
  )
  await page.addInitScript(() => {
    sessionStorage.setItem('handover:offline-mode', 'false')
    sessionStorage.setItem(
      'handover-h5:session',
      JSON.stringify({
        token: 'property-visual-only',
        tenantDomain: 'visual',
        applicationId: 'property-fixture'
      })
    )
    sessionStorage.setItem(
      JSON.stringify(['handover-project', 'visual', 'property-fixture', 'property-user']),
      'project-fixture'
    )
  })
  const enter = async (description) => {
    await page.getByRole('button', { name: '录入现场查验问题', exact: false }).click()
    await page.locator('textarea').fill(description)
    await page
      .locator('input[type=file][multiple]')
      .setInputFiles({ name: '现场.png', mimeType: 'image/png', buffer: png })
    await page.locator('.photo-grid img').waitFor()
  }
  await page.goto('http://127.0.0.1:9310/')
  await page.getByRole('button', { name: '录入现场查验问题', exact: false }).waitFor()
  await enter('在线照片回归：防火门闭门器松动')
  const category = page.locator('.ant-form-item').filter({ hasText: '问题分类' })
  await category.getByRole('combobox').click()
  await page.getByTitle('消防工程', { exact: true }).click()
  await page.getByRole('button', { name: '提交问题', exact: true }).click()
  await page.getByRole('button', { name: /在线照片回归/ }).click()
  await page.getByRole('button', { name: '问题照片 1', exact: true }).click()
  await page.getByAltText('查验照片原图').waitFor()
  if (problems[0].categoryId !== 'category') throw Error('项目问题分类未提交')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('http://127.0.0.1:9310/')
  await page.getByRole('switch').click()
  const offlineDescription = '离线照片回归：排水接头渗漏 ' + Date.now()
  await enter(offlineDescription)
  await page.getByRole('button', { name: '保存到待上传', exact: true }).click()
  await page.getByRole('heading', { name: '离线同步中心' }).waitFor()
  await page.reload()
  await page.getByText(offlineDescription, { exact: true }).waitFor()
  if (uploads !== 1 || problems.length !== 1) throw Error('离线录入不应调用写入接口')
  await page
    .getByRole('button', { name: /^上\s*传$/ })
    .last()
    .click()
  await page.getByText(offlineDescription, { exact: true }).waitFor({ state: 'detached' })
  if (uploads !== 2 || problems.length !== 2 || errors.length)
    throw Error(JSON.stringify({ uploads, created: problems.length, errors }))
  const result = {
    onlinePhotoPreview: true,
    offlinePhotoRestoredAfterReload: true,
    uploads,
    created: problems.length,
    errors,
    calls
  }
  await page.close()
  return result
}
