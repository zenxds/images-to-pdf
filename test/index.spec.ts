import fs from 'fs'
import path from 'path'
import { removeSync } from 'fs-extra'
import { PDFDocument } from 'pdf-lib'
import ImagesToPDF from '../src'

const images = [
  'https://img.alicdn.com/tps/TB1cuJ6OXXXXXctXXXXXXXXXXXX-520-280.jpg',
  'https://img.alicdn.com/tps/TB1dnUfNVXXXXaGaFXXXXXXXXXX-520-280.jpg',
  'https://ossgw.alicdn.com/creatives-assets/f5567768-b901-47b0-b005-5b0cc67b5a70.jpg',
  'https://img.alicdn.com/simba/img/TB1NUvAOXXXXXbWXVXXSutbFXXX.jpg',
]
const outputDir = path.join(__dirname, '../output')
const cacheDir = path.join(outputDir, '_cache')
const pdfFile = path.join(outputDir, 'images.pdf')
const cacheFile = path.join(outputDir, '_cache/cache.json')

beforeEach(() => {
  removeSync(pdfFile)
  removeSync(cacheDir)
})

describe('images to pdf', () => {
  test('it should download images to pdf', async() => {
    const instance = new ImagesToPDF({})
    await instance.toPDF({
      chunk: 2,
      pdf: {
        width: 520,
      },
      cacheChunk: true,
      images
    })

    expect(fs.existsSync(pdfFile)).toBeTruthy()
    expect(fs.existsSync(cacheFile)).toBeTruthy()
  })

  test('it should not cache', async() => {
    const instance = new ImagesToPDF({})
    const toPDF = await instance.toPDF({
      chunk: 2,
      pdf: {
        width: 520,
      },
      cacheChunk: false,
      images
    })

    expect(toPDF.cacheChunk).toBeFalsy()
    expect(fs.existsSync(cacheDir)).toBeFalsy()
  })

  test('it should check chunk change', async() => {
    const instance = new ImagesToPDF({})
    await instance.toPDF({
      chunk: 2,
      pdf: {
        width: 520,
      },
      cacheChunk: true,
      images
    })

    const toPDF = await instance.toPDF({
      chunk: 3,
      pdf: {
        width: 520,
      },
      cacheChunk: true,
      images
    })

    expect(toPDF.cacheChunk).toBeFalsy()
  })

  test('it should check images change', async() => {
    const instance = new ImagesToPDF({})
    await instance.toPDF({
      chunk: 2,
      pdf: {
        width: 520,
      },
      cacheChunk: true,
      images
    })

    const toPDF = await instance.toPDF({
      chunk: 2,
      pdf: {
        width: 520,
      },
      cacheChunk: true,
      images: [images[1], images[2]]
    })

    expect(toPDF.cacheChunk).toBeFalsy()
  })

  test('it should clean latest chunk', async() => {
    const instance = new ImagesToPDF({})
    await instance.toPDF({
      chunk: 2,
      pdf: {
        width: 520,
      },
      cacheChunk: true,
      images: images.slice(0, 3)
    })

    let pdf = await PDFDocument.load(fs.readFileSync(pdfFile))
    expect(pdf.getPage(1).getHeight() < 300).toBeTruthy()

    await instance.toPDF({
      chunk: 2,
      pdf: {
        width: 520,
      },
      cacheChunk: true,
      images
    })

    pdf = await PDFDocument.load(fs.readFileSync(pdfFile))
    expect(pdf.getPageCount()).toBe(2)
    expect(pdf.getPage(1).getHeight() > 300).toBeTruthy()
  })

  test('it should process images array', async() => {
    const instance = new ImagesToPDF({})
    await instance.toPDF({
      chunk: 2,
      pdf: {
        width: 520,
      },
      cacheChunk: true,
      images: [
        images.slice(0, 3),
        images.slice(3)
      ]
    })

    let pdf = await PDFDocument.load(fs.readFileSync(pdfFile))
    expect(pdf.getPage(0).getHeight() > 600).toBeTruthy()
  })
})
