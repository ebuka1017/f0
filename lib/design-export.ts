import { assetReference, BLANK_IMAGE, rewriteRemoteImages } from './design-artifact'
import { readDesignAsset } from './design-assets'

const MAX_EXPORT_IMAGE_CHARS = 20 * 1024 * 1024

// Attached images exist only in the app, so a design that leaves it (a download or
// a published site) carries them as data: URLs, within a budget counted per place
// they appear; remote images stay as their URLs.
export async function embedDesignAssets(sessionId: string, html: string): Promise<string> {
  const handles = new Set<string>()
  rewriteRemoteImages(html, (reference) => {
    const asset = assetReference(reference)
    if (asset) handles.add(asset.slice('fx0-asset:'.length))
    return null
  })
  if (!handles.size) return html
  const loaded = new Map<string, string>()
  await Promise.all([...handles].map(async (handle) => {
    const asset = await readDesignAsset(sessionId, handle).catch(() => null)
    if (asset) loaded.set(handle, `data:${asset.mimeType};base64,${asset.bytes.toString('base64')}`)
  }))
  let total = 0
  return rewriteRemoteImages(html, (reference) => {
    const asset = assetReference(reference)
    if (!asset) return null
    const data = loaded.get(asset.slice('fx0-asset:'.length))
    if (!data || total + data.length > MAX_EXPORT_IMAGE_CHARS) return BLANK_IMAGE
    total += data.length
    return data
  })
}
