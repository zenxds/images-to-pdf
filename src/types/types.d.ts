declare interface Options {
  outputPath: string
}

declare interface ToPdfOptions extends Options {
  name: string
  images: string[] | string[][]
  chunk: number
  concurrent: number
  timeout: number
  proxy?: string
  convertHeight?: (height: number) => number | string
  cacheChunk: boolean
  pdf: import('puppeteer').PDFOptions
}

declare interface ChunkPath {
  pdf: string
  image: string
}
