// Any part of the UI can open the paywall; UpgradeDialog listens once per page.
export const UPGRADE_EVENT = 'f0:upgrade'

export function openUpgrade(reason?: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(UPGRADE_EVENT, { detail: { reason } }))
}

// A 402 the server marked as a plan limit, with its message.
export async function upgradeReason(response: Response): Promise<string | null> {
  if (response.status !== 402) return null
  const body = await response.clone().json().catch(() => null) as { code?: string; error?: string; upgrade?: boolean } | null
  return body?.upgrade || body?.code === 'upgrade_required' ? body.error ?? 'Upgrade to Pro to continue.' : null
}
