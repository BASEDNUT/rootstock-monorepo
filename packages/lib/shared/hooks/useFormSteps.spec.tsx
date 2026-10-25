import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { clearLocalStorageMock, mockLocalStorage } from '@repo/lib/test/utils/localstorage-mock'
import { useFormSteps, FormStep } from './useFormSteps'
import { waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  pathname: '/create',
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}))

beforeEach(() => {
  mockLocalStorage()
  mocks.replace.mockClear()
  mocks.push.mockClear()
  mocks.pathname = '/create'
})

afterAll(() => {
  clearLocalStorageMock()
})

const steps: FormStep[] = [
  { id: 'step-1-type', title: 'Type', Component: () => null },
  { id: 'step-2-tokens', title: 'Tokens', Component: () => null },
  { id: 'step-3-details', title: 'Details', Component: () => null },
  { id: 'step-4-fund', title: 'Fund', Component: () => null },
]

const LS_KEY = 'test.stepIndex'

function renderSteps(overrides: Record<string, unknown> = {}) {
  return testHook(() =>
    useFormSteps({
      steps,
      basePath: '/create',
      localStorageKey: LS_KEY,
      canRenderStepFn: () => true,
      isFormHydrated: true,
      shouldSkipRedirectToSavedStep: false,
      ...overrides,
    } as never)
  )
}

describe('useFormSteps — bare-entry step behavior', () => {
  it('bare entry lands on step 1 even when a saved step index exists (no silent resume by default)', async () => {
    window.localStorage.setItem(LS_KEY, '2')

    const { result } = renderSteps()

    await waitFor(() => expect(result.current.currentStepIndex).toBe(0))
    expect(mocks.replace).toHaveBeenCalledWith('/create/step-1-type')
    expect(mocks.replace).not.toHaveBeenCalledWith('/create/step-3-details')
  })

  it('opt-in resume restores the saved step (legacy draft-resume behavior)', async () => {
    window.localStorage.setItem(LS_KEY, '2')

    const { result } = renderSteps({ enableSavedStepResume: true })

    await waitFor(() => expect(result.current.currentStepIndex).toBe(2))
    expect(mocks.replace).toHaveBeenCalledWith('/create/step-3-details')
  })

  it('out-of-range saved index is treated as step 1, not an all-steps-complete state', async () => {
    window.localStorage.setItem(LS_KEY, '99')

    const { result } = renderSteps({ enableSavedStepResume: true })

    await waitFor(() => expect(result.current.currentStepIndex).toBe(0))
    await waitFor(() => expect(window.localStorage.getItem(LS_KEY)).toBe('0'))
    expect(mocks.replace).toHaveBeenCalledWith('/create/step-1-type')
  })

  it('URL step wins over saved index', async () => {
    window.localStorage.setItem(LS_KEY, '2')
    mocks.pathname = '/create/step-2-tokens'

    const { result } = renderSteps({ enableSavedStepResume: true })

    await waitFor(() => expect(result.current.currentStepIndex).toBe(1))
  })

  it('shouldSkipRedirectToSavedStep suppresses resume even when opted in', async () => {
    window.localStorage.setItem(LS_KEY, '2')

    const { result } = renderSteps({
      enableSavedStepResume: true,
      shouldSkipRedirectToSavedStep: true,
    })

    await waitFor(() => expect(result.current.currentStepIndex).toBe(0))
  })
})
