import * as pdfjs from 'pdfjs-dist'

// The worker ships with pdfjs-dist; Vite copies it as an asset through the URL constructor.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href

const MAX_PAGES = 200

/** Plain text of a PDF, page by page, capped so a scanned book does not stall indexing. */
export const extractPdfText = async(data: Uint8Array): Promise<string> => {
  const task = pdfjs.getDocument({ data })
  const doc = await task.promise
  const parts: string[] = []
  const pages = Math.min(doc.numPages, MAX_PAGES)
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    parts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  await task.destroy()
  return parts.join('\n')
}
