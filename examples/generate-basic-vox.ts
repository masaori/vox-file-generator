import { generateVoxFile, ColorTables } from 'vox-file-generator'

generateVoxFile({
    size: {
        x: 16, // max 256
        y: 16, // max 256
        z: 16, // max 256
    },
    voxels: [
      {
        x: 0, // start at 0
        y: 0,
        z: 0,
        colorIndex: 1, // This specify the index in the Color Table defined below. must be 1-255
      },
      {
        x: 15,
        y: 15,
        z: 0,
        colorIndex: 15,
      },
      {
        x: 0,
        y: 15,
        z: 15,
        colorIndex: 31,
      },
      {
        x: 15,
        y: 0,
        z: 15,
        colorIndex: 63,
      },
      {
        x: 7,
        y: 7,
        z: 7,
        colorIndex: 225,
      },
    ],
    colorTable: ColorTables.grayScale, // You can use pre-defined color tables
    dirctoryPath: './dist/vox',
    filePrefix: 'my-fist-vox',
})
