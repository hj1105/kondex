import path from 'node:path'
import { test, expect } from './helpers/orca-app'

test.use({
  seedTestRepo: false,
  // An existing directory cannot launch a sidecar or inspect any real model account.
  orcaAppExtraEnv: { KONDEX_KONTEXT_SIDECAR_PATH: path.join(process.cwd(), 'tests') }
})

test('renders localized readiness boundaries through the real runtime bridge', async ({
  orcaPage
}, testInfo) => {
  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
    window.__store!.setState({ activeView: 'tasks' })
  })
  await expect(orcaPage.getByRole('heading', { name: '근거 기반 코딩 실행 환경' })).toBeVisible()
  await expect(
    orcaPage.getByRole('button', { name: '로직별 작업 항목', exact: true })
  ).toBeVisible()
  await expect(
    orcaPage.getByText('Kontext 보조 서버에 연결할 수 없음', { exact: true })
  ).toBeVisible()
  await expect(
    orcaPage.getByText(/새 작업·근거 등록과 최종 작업 완료 판정은 아직 연결되지 않았습니다/)
  ).toBeVisible()
  await expect(orcaPage.getByText('No published task', { exact: true })).toHaveCount(0)
  await expect(orcaPage.getByText('구독 실행 환경', { exact: true })).toHaveCount(0)
  await orcaPage.getByRole('button', { name: '재시도', exact: true }).click()
  await expect(
    orcaPage.getByText('Kontext 보조 서버에 연결할 수 없음', { exact: true })
  ).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('kondex-readiness-ko.png') })

  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
  })
  await expect(
    orcaPage.getByRole('heading', { name: 'Evidence-backed coding runtime' })
  ).toBeVisible()
  await expect(orcaPage.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  await expect(
    orcaPage.getByRole('button', { name: 'Logic Work Items', exact: true })
  ).toBeVisible()
  await expect(
    orcaPage.getByText(
      /New task\/source registration and final Task completion are not connected yet/
    )
  ).toBeVisible()
})
