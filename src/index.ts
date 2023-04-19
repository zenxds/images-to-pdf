import path from 'path'
import fs from 'fs'
import http from 'http'
import { promisify } from 'util'
import puppeteer from 'puppeteer'
import express, { Express } from 'express'
import { ensureDirSync, removeSync } from 'fs-extra'
import { PDFDocument } from 'pdf-lib'
import getPort from 'get-port'

import FileCache from './cache'
import { chunk, flatten, isEmptyDir, startsWidth } from './utils'

export class ToPDF {
  public options: ToPdfOptions
  public app: Express
  public images: string[]
  public chunks: string[][]
  public groups: string[][][]
  public cache: FileCache
  public cacheDir: string
  public cacheChunk: boolean
  public outputName: string
  public server?: http.Server
  public port: number

  public constructor(options: ToPdfOptions) {
    this.options = options
    this.app = express()
    this.port = 3000

    if (Array.isArray(this.options.images[0])) {
      const images = this.options.images as string[][]
      this.images = flatten(images)
      this.chunks = images
    } else {
      const images = this.options.images as string[]
      this.images = images
      this.chunks = chunk(images, this.options.chunk)
    }

    this.groups = chunk(this.chunks, this.options.concurrent)
    this.cacheDir = path.join(options.outputPath, '_cache')
    this.cache = new FileCache({
      root: this.cacheDir,
      name: 'cache'
    })
    this.cacheChunk = this.options.cacheChunk
    this.outputName = path.join(options.outputPath, `${options.name}.pdf`)
  }

  public async setup(): Promise<void> {
    await this.check()
    await this.init()
    await this.cleanLatestChunk()
    await this.startServer()
  }

  public init(): void {
    // 注意这里判断要用options，不管check的结果都要缓存
    if (this.options.cacheChunk) {
      this.cache.set('chunk', this.options.chunk)
      this.cache.set('images', this.images)
    }

    if (this.cacheChunk) {
      ensureDirSync(this.cacheDir)
    }
  }

  // 还应该check images
  public check(): void {
    if (this.cacheChunk) {
      const beforeChunk = this.cache.get('chunk')
      // 如果跟前一次的chunk分法不一致
      if (beforeChunk && beforeChunk !== this.options.chunk) {
        this.cacheChunk = false
      }

      // 如果传入的图片发生了改变
      const beforeImages = this.cache.get('images')
      if (beforeImages && !startsWidth(this.images, beforeImages as string[])) {
        this.cacheChunk = false
      }
    }
  }

  // 删除最新一页，因为最新一页的图片可能是不是一整个chunk
  public async cleanLatestChunk(): Promise<void> {
    const { outputName, cacheChunk } = this
    const latest = this.cache.get('latest') as string

    if (!cacheChunk || !latest) {
      return
    }

    const latestFile = path.join(this.cacheDir, latest)
    if (fs.existsSync(latestFile)) {
      removeSync(latestFile)
    }

    if (fs.existsSync(outputName)) {
      const pdf = await this.loadPDF(outputName)
      await pdf.removePage(pdf.getPageCount() - 1)
      fs.writeFileSync(outputName, await pdf.save())
    }
  }

  public async startServer(): Promise<void> {
    const { app, chunks, options } = this
    app.set('views', path.join(__dirname, '../views'))
    app.set('view engine', 'hbs')

    app.use(express.static(options.outputPath))
    app.get(
      '/',
      (req, res): void => {
        const page = req.query.page ? parseInt(req.query.page as string) : 1
        res.render('index', { images: chunks[page - 1] })
      }
    )

    const port = (this.port = await getPort({ port: 3000 }))
    return new Promise(
      (resolve): void => {
        this.server = app.listen(
          port,
          (): void => {
            resolve()
          }
        )
      }
    )
  }

  private async concurrentDownloadItem(
    browser: puppeteer.Browser,
    i: number
  ): Promise<void> {
    const { options } = this
    const chunkPath = this.getChunkPath(i)
    if (this.hasCacheFile(chunkPath)) {
      return
    }

    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${this.port}/?page=${i + 1}`, {
      timeout: options.timeout,
      waitUntil: 'networkidle0'
    })
    const height = await page.evaluate((): number => document.body.scrollHeight)
    const width = await page.evaluate((): number => document.images[0].width)

    const pdfOptions: puppeteer.PDFOptions = Object.assign(
      {
        width,
        height,
        path: chunkPath
      },
      options.pdf
    )

    if (options.convertHeight) {
      pdfOptions.height = options.convertHeight(height)
    }

    await page.pdf(pdfOptions)
    await page.close()
  }

  private async concurrentDownload(
    browser: puppeteer.Browser,
    groupIndex: number
  ): Promise<void> {
    const { groups, options } = this
    const group = groups[groupIndex]
    await Promise.all(
      group.map(
        (item, i): Promise<void> =>
          this.concurrentDownloadItem(
            browser,
            groupIndex * options.concurrent + i
          )
      )
    )
  }

  public async downloadPDF(): Promise<void> {
    const { groups, options } = this
    const isLinux = process.platform === 'linux'
    const args: string[] = []

    if (isLinux) {
      args.push('--no-sandbox')
    }

    if (options.proxy) {
      args.push('--proxy-server=' + options.proxy)
    }

    const browser = await puppeteer.launch({
      args
    })

    ensureDirSync(options.outputPath)

    for (let i = 0; i < groups.length; i++) {
      await this.concurrentDownload(browser, i)
    }

    await browser.close()
  }

  public async mergePDF(): Promise<void> {
    const { chunks, outputName, cacheChunk } = this

    const mergedPdf = this.hasCacheFile(outputName)
      ? await this.loadPDF(outputName)
      : await PDFDocument.create()
    const count = mergedPdf.getPageCount()

    for (let i = count; i < chunks.length; i++) {
      const chunkPath = this.getChunkPath(i)
      const document = await this.loadPDF(chunkPath)
      const copiedPages = await mergedPdf.copyPages(
        document,
        document.getPageIndices()
      )
      copiedPages.forEach(
        (page): void => {
          mergedPdf.addPage(page)
        }
      )

      if (cacheChunk) {
        this.cache.set('latest', path.basename(chunkPath))
      }
    }

    if (mergedPdf.getPageCount() > count) {
      const pdfBytes = await mergedPdf.save()
      fs.writeFileSync(outputName, pdfBytes)
    }
  }

  public async clean(): Promise<void> {
    const { server, chunks, cacheChunk } = this

    if (!cacheChunk) {
      removeSync(this.cache.file)

      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = this.getChunkPath(i)
        removeSync(chunkPath)
      }

      if (isEmptyDir(this.cacheDir)) {
        removeSync(this.cacheDir)
      }
    }

    if (server) {
      const close = promisify(server.close.bind(server))
      await close()
    }
  }

  public getChunkPath(i: number): string {
    const { options } = this
    return path.join(this.cacheDir, `${options.name}${i + 1}.pdf`)
  }

  public hasCacheFile(file: string): boolean {
    const { cacheChunk } = this
    return cacheChunk && fs.existsSync(file)
  }

  public loadPDF(file: string): Promise<PDFDocument> {
    return PDFDocument.load(fs.readFileSync(file))
  }
}

export default class ImagesToPDF {
  private options: Options

  public constructor(options: Partial<Options>) {
    this.options = Object.assign(
      {
        outputPath: path.join(__dirname, '../output')
      },
      options
    )
  }

  public async toPDF(pdfOptions: Partial<ToPdfOptions>): Promise<ToPDF> {
    const options: ToPdfOptions = Object.assign(
      {
        outputPath: this.options.outputPath,
        name: 'images',
        chunk: 10,
        concurrent: 5,
        timeout: 0,
        cacheChunk: false,
        images: [],
        pdf: {}
      },
      pdfOptions
    )
    const toPdf = new ToPDF(options)

    await toPdf.setup()
    await toPdf.downloadPDF()
    await toPdf.mergePDF()
    await toPdf.clean()
    return toPdf
  }
}
