# node-images-to-pdf

transform images to pdf file, based on puppeteer

```
import ImagesToPDF from 'node-images-to-pdf'
// const ImagesToPDF = require('node-images-to-pdf').default

const instance = new ImagesToPDF({
  // outputPath: ''
})

await instance.toPDF({
  // name: 'images',
  pdf: {
    // width: 520,
    // height: 1000
  },
  images: [
    // local images in outputPath
    // or remote image url
    'file1.jpg',
    'file2.jpg'
  ]
})
```
