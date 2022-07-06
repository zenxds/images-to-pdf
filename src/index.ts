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
import { chunk, isEmptyDir } from './utils'

export class ToPDF {
  private options: ToPdfOptions
  private app: Express
  private groups: string[][][]
  private chunks: string[][]
  private cacheDir: string
  private server?: http.Server
  private port: number
  private cache: FileCache
  private outputName: string

  public constructor(options: ToPdfOptions) {
    this.options = options
    this.app = express()
    this.chunks = chunk(this.options.images, this.options.chunk)
    this.groups = chunk(this.chunks, this.options.concurrent)
    this.port = 3000
    this.cacheDir = path.join(options.outputPath, '_cache')
    this.cache = new FileCache({
      root: this.cacheDir,
      name: 'cache'
    })
    this.outputName = path.join(options.outputPath, `${options.name}.pdf`)

    ensureDirSync(this.cacheDir)
  }

  // 删除最新一页，因为最新一页的图片可能是不是一整个chunk
  public async fixLatestChunk(): Promise<void> {
    const { outputName, options } = this
    const latest = this.cache.get('latest')

    if (!options.cacheChunk || !latest) {
      return
    }

    const latestFile = path.join(this.cacheDir, latest)
    if (fs.existsSync(latestFile)) {
      fs.unlinkSync(latestFile)
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
    const { options, chunks, outputName } = this

    const mergedPdf = this.hasCacheFile(outputName)
      ? await this.loadPDF(outputName)
      : await PDFDocument.create()
    const count = mergedPdf.getPageCount()

    for (let i = count; i < chunks.length; i++) {
      const chunkPath = this.getChunkPath(i)
      const cacheKey = path.basename(chunkPath)
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

      if (options.cacheChunk) {
        this.cache.set(cacheKey, '1')
        this.cache.set('latest', cacheKey)
      }
    }

    if (mergedPdf.getPageCount() > count) {
      const pdfBytes = await mergedPdf.save()
      fs.writeFileSync(outputName, pdfBytes)
    }
  }

  public async clean(): Promise<void> {
    const { options, server, chunks } = this

    if (!options.cacheChunk) {
      this.cache.clean()

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
    const { options } = this
    return options.cacheChunk && fs.existsSync(file)
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

  public async toPDF(pdfOptions: Partial<ToPdfOptions>): Promise<void> {
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

    await toPdf.startServer()
    await toPdf.fixLatestChunk()
    await toPdf.downloadPDF()
    await toPdf.mergePDF()
    await toPdf.clean()
  }
}
