import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import type { ReportData } from './data'

// Ported from cazalla-net.plugin `generateReport` (main.ts); returns the bytes instead of writing a file.
export const renderReportPdf = async(report: ReportData): Promise<Uint8Array> => {
  const doc = await PDFDocument.create()
  const times = await doc.embedFont(StandardFonts.TimesRoman)
  const helvetica = await doc.embedFont(StandardFonts.Helvetica)

  let page: PDFPage = doc.addPage()
  let { height } = page.getSize()
  let y = height - 50

  const draw = (text: string, x: number, size: number, font: PDFFont, gap: number): void => {
    if (y < 50) {
      page = doc.addPage()
      height = page.getSize().height
      y = height - 50
    }
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) })
    y -= gap
  }

  draw('Project Service Time Report', 50, 20, helvetica, 30)
  draw(`Task Breakdown and Effort Summary for Project: ${report.project}`, 50, 14, helvetica, 20)
  draw(`Time Period: ${report.startDate} - ${report.endDate}`, 50, 14, helvetica, 40)

  for (const task of report.tasks) {
    draw(`Task: ${task.title}`, 50, 12, times, 20)
    for (const line of task.effort) draw(`Date: ${line.date}, Hours: ${line.hours}`, 70, 12, times, 20)
    y -= 10
  }

  draw(`Total Hours: ${report.totalHours}`, 50, 14, helvetica, 20)
  return doc.save()
}
