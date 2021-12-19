const grayScale = [...Array(256).keys()].map((i) => {
  return {
    r: i,
    g: i,
    b: i,
    a: 255,
  }
})

export const ColorTables = {
  grayScale,
}