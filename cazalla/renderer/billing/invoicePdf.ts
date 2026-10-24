import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'
import type { InvoiceData } from './data'

const pnum = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Ported from cazalla-net.plugin `src/invoice.ts`; fixed layout, returns the bytes.
export const renderInvoicePdf = async(invoice: InvoiceData): Promise<Uint8Array> => {
  const doc = await PDFDocument.create()
  const page = doc.addPage()
  const { width } = page.getSize()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const black = rgb(0, 0, 0)

  const text = (s: string, x: number, y: number, size = 12, font: PDFFont = regular): void => {
    page.drawText(s, { x, y, size, font, color: black })
  }
  const box = (x: number, y: number, w: number, h: number): void => {
    page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: black, borderWidth: 1 })
  }
  const rule = (y: number): void => {
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: black })
  }

  let y = page.getSize().height - 50
  text(`INVOICE PD - ${invoice.invoiceNumber}`, 50, y, 16, bold)
  y -= 20
  text(`DATE ${invoice.date}`, 50, y)
  y -= 40

  const boxWidth = (width - 140) / 2
  const boxHeight = 120
  const leftX = 50
  const rightX = 50 + boxWidth + 40
  box(leftX, y, boxWidth, boxHeight)
  box(rightX, y, boxWidth, boxHeight)
  invoice.companyDetails.forEach((line, i) => text(line, leftX + 10, y - 15 - i * 15, 10))
  invoice.clientDetails.forEach((line, i) => text(line, rightX + 10, y - 15 - i * 15, 10))
  y -= boxHeight + 30

  text('SERVICES DELIVERED', 50, y, 14, bold)
  y -= 20
  text('Description', 50, y, 12, bold)
  text('Qty (Hrs)', 250, y, 12, bold)
  text('Price', 320, y, 12, bold)
  text('VAT %', 400, y, 12, bold)
  text('Total', 470, y, 12, bold)
  y -= 15
  rule(y)
  y -= 20

  let subtotal = 0
  for (const s of invoice.services) {
    const total = s.quantity * s.price * (1 + s.vat / 100)
    subtotal += total
    text(s.description, 50, y, 9)
    text(String(s.quantity), 260, y, 10)
    text(`${pnum(s.price)}€`, 320, y, 10)
    text(`${s.vat}%`, 400, y, 10)
    text(`${pnum(total)}€`, 470, y, 10)
    y -= 20
  }
  y -= 10
  rule(y)
  text(`Total Amount: ${pnum(subtotal)}€`, 50, y - 15, 12, bold)

  const footerTop = 150
  const taxX = 50
  box(taxX, footerTop, boxWidth, 60)
  text('TAX', taxX + 10, footerTop - 15, 12, bold)
  text('Vat Basis', taxX + 10, footerTop - 35, 10)
  text('VAT Rate %', taxX + 100, footerTop - 35, 10)
  text('Tax Rate', taxX + 180, footerTop - 35, 10)
  text(pnum(invoice.vatBasis), taxX + 10, footerTop - 50, 10)
  text(`${invoice.vatRate}%`, taxX + 100, footerTop - 50, 10)
  text('0', taxX + 180, footerTop - 50, 10)

  const totalX = taxX + boxWidth + 40
  box(totalX, footerTop, boxWidth, 100)
  text('TOTAL', totalX + 10, footerTop - 15, 12, bold)
  text('VAT Basis', totalX + 10, footerTop - 35, 10)
  text(pnum(invoice.total), totalX + 150, footerTop - 35, 10)
  text('Tax Rate', totalX + 10, footerTop - 55, 10)
  text(`TOTAL ${invoice.currency}`, totalX + 10, footerTop - 75, 12, bold)
  text(`${pnum(invoice.total)} ${invoice.currency}`, totalX + 150, footerTop - 75, 10)

  text('PAYMENT DETAILS', 50, footerTop - 100, 8, bold)
  text(invoice.paymentTerms, 150, footerTop - 100, 8)
  text('BANK DATA', 50, footerTop - 115, 8, bold)
  text(invoice.bankAccount, 150, footerTop - 115, 8)
  text(`SWIFT: ${invoice.swift}`, 350, footerTop - 115, 8)

  return doc.save()
}
