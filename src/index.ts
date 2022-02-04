import path from 'path'
import fs from 'fs'
import http from 'http'
import { promisify } from 'util'
import puppeteer from 'puppeteer'
import express, { Express } from 'express'
import { ensureDirSync } from 'fs-extra'
// import PDFMerger from 'pdf-merger-js'
import { PDFDocument } from 'pdf-lib'
import getPort from 'get-port'

import { chunk } from './utils'

export class ToPDF {
  private options: ToPdfOptions
  private app: Express
  private groups: string[][][]
  private chunks: string[][]
  private server?: http.Server
  private port: number

  public constructor(options: ToPdfOptions) {
    this.options = options
    this.app = express()
    this.chunks = chunk(this.options.images, this.options.chunk)
    this.groups = chunk(this.chunks, this.options.concurrent)
    this.port = 3000
  }

  public async startServer(): Promise<void> {
    const { app, chunks } = this
    app.set('views', path.join(__dirname, '../views'))
    app.set('view engine', 'hbs')

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

  public getChunkPath(i: number): string {
    const { options } = this
    return path.join(options.outputPath, `${options.name}${i + 1}.pdf`)
  }

  private async concurrentDownloadItem(
    browser: puppeteer.Browser,
    i: number
  ): Promise<void> {
    const { options } = this
    const chunkPath = this.getChunkPath(i)
    if (options.cacheChunk && fs.existsSync(chunkPath)) {
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

  public async downloadPdf(): Promise<void> {
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
    const { options, chunks } = this

    const mergedPdf = await PDFDocument.create()

    for (let i = 0; i < chunks.length; i++) {
      let document = await PDFDocument.load(
        fs.readFileSync(this.getChunkPath(i))
      )

      const copiedPages = await mergedPdf.copyPages(
        document,
        document.getPageIndices()
      )
      copiedPages.forEach(
        (page): void => {
          mergedPdf.addPage(page)
        }
      )
    }

    const pdfBytes = await mergedPdf.save()
    fs.writeFileSync(
      path.join(options.outputPath, `${options.name}.pdf`),
      pdfBytes
    )

    // PDFMerger increases the size of merged file
    // const merger = new PDFMerger()

    // for (let i = 0; i < chunks.length; i++) {
    //   merger.add(this.getChunkPath(i))
    // }

    // await merger.save(path.join(options.outputPath, `${options.name}.pdf`))
  }

  public async clean(): Promise<void> {
    const { options, server, chunks } = this

    if (!options.cacheChunk) {
      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = this.getChunkPath(i)
        fs.unlinkSync(chunkPath)
      }
    }

    if (server) {
      const close = promisify(server.close.bind(server))
      await close()
    }
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
    await toPdf.downloadPdf()
    await toPdf.mergePDF()
    await toPdf.clean()
  }
}
