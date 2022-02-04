declare interface Options {
  outputPath: string
}

declare interface ToPdfOptions extends Options {
  images: string[]
  name: string
  chunk: number
  timeout: number
  concurrent: number
  convertHeight?: (height: number) => number | string
  cacheChunk: boolean
  pdf: import('puppeteer').PDFOptions
}
