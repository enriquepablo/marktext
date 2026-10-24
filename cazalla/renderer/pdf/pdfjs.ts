import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// The worker ships with pdfjs-dist; Vite emits it as an asset through the URL constructor,
// in the dev server and in the built app alike.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href

/** Opens a PDF from bytes. The caller destroys the task when done. */
export const openPdf = (data: Uint8Array): { task: ReturnType<typeof pdfjs.getDocument>; promise: Promise<PDFDocumentProxy> } => {
  // A fresh copy: pdf.js transfers the buffer to its worker and detaches it.
  const task = pdfjs.getDocument({ data: new Uint8Array(data) })
  return { task, promise: task.promise }
}

export const readPdfBytes = async(file: string): Promise<Uint8Array> => {
  const data = await window.fileUtils.readFile(file)
  return typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
}
