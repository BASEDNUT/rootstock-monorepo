import { usePathname, useRouter } from 'next/navigation'
import { useLocalStorage } from 'usehooks-ts'
import { ComponentType, useEffect, useRef } from 'react'
import { isAddress } from 'viem'
import { navTo } from '@repo/lib/shared/utils/ipfs-nav'

export interface FormStep {
  id: string
  title: string
  Component: ComponentType
}

export interface UseFormStepsConfig {
  steps: FormStep[]
  basePath: string
  localStorageKey: string
  canRenderStepFn: (currentStepIndex: number) => boolean
  isFormHydrated: boolean
  shouldSkipRedirectToSavedStep: boolean
  /**
   * Opt-in legacy behavior: bare entry (no step in the URL) resumes the
   * localStorage-saved step. Default false — bare entry always lands on
   * step 1, so the stepper never claims steps were completed when they
   * were not. Step URLs remain the single source of truth for position.
   */
  enableSavedStepResume?: boolean
}

function getStepIndexFromPathname(pathname: string, steps: FormStep[]): number | null {
  const index = steps.findIndex(step => pathname.endsWith(step.id))
  return index >= 0 ? index : null
}

export function useFormSteps(config: UseFormStepsConfig) {
  const {
    steps,
    basePath,
    localStorageKey,
    canRenderStepFn,
    isFormHydrated,
    shouldSkipRedirectToSavedStep,
    enableSavedStepResume = false,
  } = config

  const pathname = usePathname()
  const lastSegment = pathname.split('/').pop() ?? ''
  const isPathForLoadingPool = isAddress(lastSegment)
  const shouldRedirectToSavedStep = !isPathForLoadingPool && !shouldSkipRedirectToSavedStep

  const router = useRouter()
  const [savedStepIndex, setSavedStepIndex] = useLocalStorage(localStorageKey, 0)

  const stepIndexFromUrl = getStepIndexFromPathname(pathname, steps)

  // A saved index outside the current step list (e.g. left over from an
  // older build, or corrupted) must never render as "all steps complete".
  const isValidSavedStepIndex =
    typeof savedStepIndex === 'number' &&
    Number.isInteger(savedStepIndex) &&
    savedStepIndex >= 0 &&
    savedStepIndex < steps.length

  const safeSavedStepIndex = isValidSavedStepIndex ? savedStepIndex : 0

  // URL drives the current step; the saved index only resumes when
  // explicitly opted in AND resume is not suppressed. Bare entry without
  // the opt-in always starts at step 1.
  const canResumeSavedStep = enableSavedStepResume && !shouldSkipRedirectToSavedStep
  const currentStepIndex = stepIndexFromUrl ?? (canResumeSavedStep ? safeSavedStepIndex : 0)

  const isLastStep = currentStepIndex === steps.length - 1
  const isFirstStep = currentStepIndex === 0
  const currentStep = steps[currentStepIndex]
  const canRenderStep = isFormHydrated && canRenderStepFn(currentStepIndex)

  // On initial load without a valid URL step, redirect to the entry step.
  // With resume opted in this is the saved step (legacy draft-resume UX);
  // otherwise it is always step 1.
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (hasRedirected.current || !shouldRedirectToSavedStep) return

    if (stepIndexFromUrl === null) {
      const targetIndex = canResumeSavedStep ? safeSavedStepIndex : 0
      const targetStep = steps[targetIndex]

      if (targetStep) {
        router.replace(`${basePath}/${targetStep.id}`)
      }
    }

    hasRedirected.current = true
  }, [
    stepIndexFromUrl,
    safeSavedStepIndex,
    canResumeSavedStep,
    shouldRedirectToSavedStep,
    router,
    basePath,
    steps,
  ])

  useEffect(() => {
    if (!isFormHydrated) return
    // Heal a corrupt/out-of-range saved index so it can never resurface.
    if (!isValidSavedStepIndex) setSavedStepIndex(0)
    // if render attempt would crash page, redirect to first step
    if (!canRenderStep) router.replace(`${basePath}/${steps[0]?.id || ''}`)
    const shouldSyncLocalStorage = stepIndexFromUrl !== null && stepIndexFromUrl !== savedStepIndex
    if (shouldSyncLocalStorage) setSavedStepIndex(stepIndexFromUrl)
  }, [
    stepIndexFromUrl,
    savedStepIndex,
    setSavedStepIndex,
    isFormHydrated,
    canRenderStep,
    isValidSavedStepIndex,
    router,
    basePath,
    steps,
  ])

  const navigateToStep = (stepIndex: number) => {
    const step = steps[stepIndex]

    if (step) {
      navTo(router, `${basePath}/${step.id}`)
    }
  }

  const getStepPath = (index: number) => steps[index] && `${basePath}/${steps[index].id}`
  const nextStepPath = getStepPath(currentStepIndex + 1)
  const previousStepPath = getStepPath(currentStepIndex - 1)

  const goToNextStep = () => {
    navigateToStep(currentStepIndex + 1)
  }

  const goToPreviousStep = () => {
    navigateToStep(currentStepIndex - 1)
  }

  const goToLastStep = () => {
    navigateToStep(steps.length - 1)
  }

  const goToStep = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) {
      navigateToStep(stepIndex)
    }
  }

  const resetSteps = () => {
    setSavedStepIndex(0)
    router.replace(`${basePath}/${steps[0]?.id || ''}`)
  }

  const isBeforeStep = (stepTitle: string) => {
    const stepIndex = steps.findIndex(step => step.title === stepTitle)
    return currentStepIndex < stepIndex
  }

  const isStep = (stepTitle: string) => {
    return currentStep?.title === stepTitle
  }

  return {
    steps,
    canRenderStep,
    currentStepIndex,
    currentStep,
    isLastStep,
    isFirstStep,
    nextStepPath,
    previousStepPath,
    goToNextStep,
    goToPreviousStep,
    goToLastStep,
    goToStep,
    resetSteps,
    isBeforeStep,
    isStep,
  }
}
