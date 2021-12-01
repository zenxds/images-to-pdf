import fs from 'fs'
import path from 'path'
import ImagesToPDF from '../src'

describe('images to pdf', () => {
  test('it should download images to pdf', async() => {
    const instance = new ImagesToPDF({})
    await instance.toPDF({
      chunk: 2,
      pdf: {
        width: 520,
      },
      images: [
        'https://img.alicdn.com/tps/TB1cuJ6OXXXXXctXXXXXXXXXXXX-520-280.jpg',
        'https://img.alicdn.com/simba/img/TB1NUvAOXXXXXbWXVXXSutbFXXX.jpg',
        'https://ossgw.alicdn.com/creatives-assets/f5567768-b901-47b0-b005-5b0cc67b5a70.jpg',
        'https://img.alicdn.com/tps/TB1dnUfNVXXXXaGaFXXXXXXXXXX-520-280.jpg']
    })

    expect(fs.existsSync(path.join(__dirname, '../output/images.pdf'))).toBeTruthy()
  })
})
