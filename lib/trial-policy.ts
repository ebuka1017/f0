// Shared by the free-prompt UI and its server-side funding gate.
export const TRIAL_MODEL = 'anthropic/claude-opus-5.5-fast'
export const FREE_PROMPTS = 5

// The picker shows the "-fast" id as its base model with fast on; both are the trial model.
export function usesFreePrompts(model: string, effort: string, fast = false): boolean {
  const trialModel = model === TRIAL_MODEL || (fast && `${model}-fast` === TRIAL_MODEL)
  return trialModel && (!effort || effort === 'low')
}

// The model a sponsored turn is pinned to, whatever the chat selected: free
// prompts run the trial model, and a free plan runs F0_FREE_MODEL (default the
// trial model). Pro turns, and the legacy user-funded turns, run the chat's pick.
export interface ModelPin { model: string; effort: string; fast: boolean }
export function fundingModel(credential: object | null | undefined): ModelPin | null {
  if (!credential || !('kind' in credential)) return null
  const { kind, plan } = credential as { kind?: string; plan?: string }
  if (kind === 'trial') return { model: TRIAL_MODEL, effort: 'low', fast: true }
  if (kind === 'server' && plan !== 'pro') {
    const model = process.env.F0_FREE_MODEL
    return model ? { model, effort: 'low', fast: false } : { model: TRIAL_MODEL, effort: 'low', fast: true }
  }
  return null
}
