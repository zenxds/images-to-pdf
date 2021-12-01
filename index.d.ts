declare module "node-images-to-pdf" {
  class ImagesToPDF {
    public constructor(options: Partial<Options>)
    public toPDF(pdfOptions: Partial<ToPdfOptions>): Promise<void>
  }

  export = ImagesToPDF
}
