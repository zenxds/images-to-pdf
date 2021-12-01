declare interface Options {
  outputPath: string
}

declare interface ToPdfOptions extends Options {
  images: string[]
  name: string
  chunk: number
  pdf: import('puppeteer').PDFOptions
}
