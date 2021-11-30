# images2pdf

contact images to a pdf file use puppeteer

```
const instance = new ImagesToPDF({
  // outputPath: ''
})

await instance.toPDF({
  // outputName: 'page',
  // width: 520,
  images: [
    'file1.jpg',
    'file2.jpg'
  ]
})
```
