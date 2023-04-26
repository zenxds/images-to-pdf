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
  cacheImage: boolean
  pdf: import('puppeteer').PDFOptions
}

declare interface ChunkPath {
  name: string
  pdf: string
  image: string
}
