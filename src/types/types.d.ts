declare interface Options {
  outputPath: string
}

declare interface ToPdfOptions extends Options {
  images: string[]
  name: string
  chunk: number
  concurrent: number
  parseHeight?: (height: number) => number | string
  cacheChunk: boolean
  pdf: import('puppeteer').PDFOptions
}
