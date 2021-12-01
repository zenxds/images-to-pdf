declare interface Options {
  outputPath: string
}

declare interface ToPdfOptions extends Options {
  images: string[]
  name: string
  chunk: number
  cacheChunk: boolean
  pdf: import('puppeteer').PDFOptions
}
