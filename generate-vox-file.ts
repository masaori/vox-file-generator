import fs from 'fs'
import BufferBuilder from 'buffer-builder'
import { format } from 'date-fns'

// 2. Chunk Structure
// -------------------------------------------------------------------------------
// # Bytes  | Type       | Value
// -------------------------------------------------------------------------------
// 1x4      | char       | chunk id
// 4        | int        | num bytes of chunk content (N)
// 4        | int        | num bytes of children chunks (M)

// N        |            | chunk content

// M        |            | children chunks
// -------------------------------------------------------------------------------
type MainChunk = {
  chunkId: 'MAIN'
  numBytesOfChunkContent: number
  numBytesOfChildrenChunks: number
  content: MainContent
  children: Chunk[]
}
type SizeChunk = {
  chunkId: 'SIZE'
  numBytesOfChunkContent: number
  numBytesOfChildrenChunks: number
  content: SizeContent
  children: Chunk[]
}
type XyziChunk = {
  chunkId: 'XYZI'
  numBytesOfChunkContent: number
  numBytesOfChildrenChunks: number
  content: XyziContent
  children: Chunk[]
}
type RgbaChunk = {
  chunkId: 'RGBA'
  numBytesOfChunkContent: number
  numBytesOfChildrenChunks: number
  content: RgbaContent
  children: Chunk[]
}
type Chunk = MainChunk | SizeChunk | XyziChunk | RgbaChunk

const numBytes = (chunk: Chunk) => chunk.numBytesOfChunkContent + chunk.numBytesOfChildrenChunks

const writeChunk = (buf: BufferBuilder, input: Chunk): void => {
  buf.appendString(input.chunkId, 'ascii')
  buf.appendUInt32LE(input.numBytesOfChunkContent)
  buf.appendUInt32LE(input.numBytesOfChildrenChunks)
  switch (input.chunkId) {
    case 'MAIN':
      writeMainContent(buf, input.content)
      break
    case 'SIZE':
      writeSizeContent(buf, input.content)
      break
    case 'XYZI':
      writeXyziContent(buf, input.content)
      break
    case 'RGBA':
      writeRgbaContent(buf, input.content)
      break
    default:
      throw new Error(`Unkown chunk Id`)
  }
  for (const child of input.children) {
    writeChunk(buf, child)
  }
}

// 3. Chunk id 'MAIN' : the root chunk and parent chunk of all the other chunks
type MainContent = {}

const writeMainContent = (buf: BufferBuilder, input: MainContent) => {
  // do nothing
}

// 4. Chunk id 'PACK' : if it is absent, only one model in the file; only used for the animation in 0.98.2
// -------------------------------------------------------------------------------
// # Bytes  | Type       | Value
// -------------------------------------------------------------------------------
// 4        | int        | numModels : num of SIZE and XYZI chunks
// -------------------------------------------------------------------------------

// 5. Chunk id 'SIZE' : model size
// -------------------------------------------------------------------------------
// # Bytes  | Type       | Value
// -------------------------------------------------------------------------------
// 4        | int        | size x
// 4        | int        | size y
// 4        | int        | size z : gravity direction
// -------------------------------------------------------------------------------
type SizeContent = {
  x: number
  y: number
  z: number
}

const writeSizeContent = (buf: BufferBuilder, input: SizeContent) => {
  buf.appendUInt32LE(input.x)
  buf.appendUInt32LE(input.y)
  buf.appendUInt32LE(input.z)
}

// 6. Chunk id 'XYZI' : model voxels, paired with the SIZE chunk
// -------------------------------------------------------------------------------
// # Bytes  | Type       | Value
// -------------------------------------------------------------------------------
// 4        | int        | numVoxels (N)
// 4 x N    | int        | (x, y, z, colorIndex) : 1 byte for each component
// -------------------------------------------------------------------------------
type XyziContent = {
  numVoxels: number
  components: XyziComponent[]
}

type XyziComponent = {
  x: number
  y: number
  z: number
  colorIndex: number
}

const writeXyziContent = (buf: BufferBuilder, input: XyziContent) => {
  if (input.numVoxels !== input.components.length) {
    throw new Error(`[XyziContent] numVoxels(${input.numVoxels}) != components.length(${input.components.length})`)
  }
  buf.appendUInt32LE(input.numVoxels)
  for (const component of input.components) {
    if (component.colorIndex <= 0 || component.colorIndex > 256) {
      throw new Error(`[XyziContent] component.colorIndex(${component.colorIndex}) must be 1 ~ 256)`)
    }
    buf.appendUInt8(component.x)
    buf.appendUInt8(component.y)
    buf.appendUInt8(component.z)
    buf.appendUInt8(component.colorIndex)
  }
}

// 7. Chunk id 'RGBA' : palette
// -------------------------------------------------------------------------------
// # Bytes  | Type       | Value
// -------------------------------------------------------------------------------
// 4 x 256  | int        | (R, G, B, A) : 1 byte for each component
//                       | * <NOTICE>
//                       | * color [0-254] are mapped to palette index [1-255], e.g :
//                       |
//                       | for ( int i = 0; i <= 254; i++ ) {
//                       |     palette[i + 1] = ReadRGBA();
//                       | }
// -------------------------------------------------------------------------------
type RgbaContent = {
  components: RgbaComponent[]
}

type RgbaComponent = {
  r: number
  g: number
  b: number
  a: number
}

const writeRgbaContent = (buf: BufferBuilder, input: RgbaContent) => {
  if (256 !== input.components.length) {
    throw new Error(`[RgbaContent] num of color index(256) != components.length(${input.components.length})`)
  }
  for (const component of input.components) {
    buf.appendUInt8(component.r)
    buf.appendUInt8(component.g)
    buf.appendUInt8(component.b)
    buf.appendUInt8(component.a)
  }
}

const sizeChunkFactory = (content: SizeContent): SizeChunk => ({
  chunkId: 'SIZE',
  numBytesOfChunkContent: 12,
  numBytesOfChildrenChunks: 0,
  content,
  children: [],
})

const xyziChunkFactory = (content: XyziContent): XyziChunk => ({
  chunkId: 'XYZI',
  numBytesOfChunkContent: content.components.length * 4,
  numBytesOfChildrenChunks: 0,
  content,
  children: [],
})

const rgbaChunkFactory = (content: RgbaContent): RgbaChunk => ({
  chunkId: 'RGBA',
  numBytesOfChunkContent: content.components.length * 4,
  numBytesOfChildrenChunks: 0,
  content,
  children: [],
})

const mainChunkFactory = (children: Chunk[]): MainChunk => ({
  chunkId: 'MAIN',
  numBytesOfChunkContent: 0,
  numBytesOfChildrenChunks: children.reduce((sum, chunk) => {
    return sum + numBytes(chunk)
  }, 0),
  content: {},
  children,
})

//
// generate vox file
//
export type GenerateVoxFileConfiguration = {
  size: {
    x: number
    y: number
    z: number
  }
  voxels: {
    x: number
    y: number
    z: number
    colorIndex: number
  }[]
  colorTable: {
    r: number
    g: number
    b: number
    a: number
  }[]
  dirctoryPath: string
  filePrefix: string
}
export const generateVoxFile = async (conf: GenerateVoxFileConfiguration) => {
  const mainChunk = mainChunkFactory([
    sizeChunkFactory(conf.size),
    xyziChunkFactory({
      numVoxels: conf.voxels.length,
      components: conf.voxels,
    }),
    rgbaChunkFactory({
      components: conf.colorTable,
    }),
  ])

  const builder = new BufferBuilder(8 + numBytes(mainChunk))
  // 1. File Structure : RIFF style
  // -------------------------------------------------------------------------------
  // # Bytes  | Type       | Value
  // -------------------------------------------------------------------------------
  // 1x4      | char       | id 'VOX ' : 'V' 'O' 'X' 'space', 'V' is first
  // 4        | int        | version number : 150
  builder.appendString('VOX ', 'ascii')
  builder.appendUInt32LE(150)
  writeChunk(builder, mainChunk)

  if (!fs.existsSync(conf.dirctoryPath)) {
    try {
      fs.mkdirSync(conf.dirctoryPath, { recursive: true })
    } catch(err) {
      throw new Error(`failed to make directory ${conf.dirctoryPath} : ${err}`)
    }
  }
  
  const now = Date.now()
  const resultFilePath = `${conf.dirctoryPath}/${conf.filePrefix}-${format(now, 'yyyyMMdd-HHmmss')}.vox`
  try {
    fs.writeFileSync(resultFilePath, builder.get())
  } catch(err) {
    throw new Error(`failed to write vox file to ${resultFilePath} : ${err}`)
  }
  console.log(`vox file generated successfully at ${resultFilePath}`)
}
