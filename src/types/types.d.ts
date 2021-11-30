declare interface Options {
  outputPath: string
}

declare interface ToPdfOptions extends Options {
  images: string[]
  outputName: string
  chunk: number
  width?: number
}
