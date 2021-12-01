# images2pdf

contact images to a pdf file use puppeteer

```
const instance = new ImagesToPDF({
  // outputPath: ''
})

await instance.toPDF({
  // name: '',
  pdf: {
    // width: 520,
    // height: 1000
  },
  images: [
    'file1.jpg',
    'file2.jpg'
  ]
})
```
