
import { BuildingDto, CityDto, EventDto, FrameDataDto, GlobalData, GlobalDataDto, PodDto, TeleportDto, TeleporterDto, TubeDto } from '../types.js'
import ev from './events.js'
import pako from '../pako.min.js'


function splitLine (str: string) {
  return str.length === 0 ? [] : str.split(' ')
}

export function parseData (unzipped: string, globalData: GlobalDataDto): FrameDataDto {
  const unsplit = decompressFromBase64(unzipped)
  const raw =  unsplit.split('\n')
  let idx = 0
  const isNewMonth = raw[idx++] === '1'
  const isMonthEnd = raw[idx++] === '1'

  let city = null
  let score = null
  if (isNewMonth) {
    score = +raw[idx++]
    city = parseCity(raw[idx++])
  }
  if (isMonthEnd) {
    score = +raw[idx++]
    city = {
      ...city,
      resources: +raw[idx++]
    }
  }


  const events: EventDto[] = []
  const eventCount = +raw[idx++]
  for (let i = 0; i < eventCount; ++i) {
    const rawEvent = splitLine(raw[idx++])

    let evIdx = 0
    if (rawEvent.length === 1) {
      const cacheIdx = +rawEvent[0]
      const e = globalData.podEventCache[cacheIdx]
      if (e == null) {
        console.error('Event cache missing for index', cacheIdx)
      }
      events.push({...e, animData: {...e.animData}})
      continue
    }

    const type = +rawEvent[evIdx++]
    const start = +rawEvent[evIdx++]
    const end = +rawEvent[evIdx++]

    const rawParams = rawEvent.slice(evIdx)
    const params = []
    if (type === ev.TRANSPORT_POD) {
      rawParams.slice(0, 3).map(x => +x).forEach((x) => {
        params.push(x)
      })
      let code = rawParams[3]
      let workers = parseWorkers(code)
      params.push(...workers)
    } else {
      rawParams.map(x => +x).forEach((x) => {
        params.push(x)
      })
    }

    const animData = { start, end }

    const e = {
      type,
      animData,
      params
    }

    if (globalData.podEventCache.length < 1000) {
      globalData.podEventCache.push({...e, animData: {...e.animData}})
    }

    events.push(e)
  }

  return {
    city,
    events,
    newMonth: isNewMonth,
    score,
    isLastDayOfMonth: isMonthEnd
  }
}

export function parseCity (unsplit: string): CityDto {
  const raw = splitLine(unsplit)
  let idx = 0
  const buildings: BuildingDto[] = []

  const buildingCount = +raw[idx++]
  for (let i = 0; i < buildingCount; ++i) {
    const id = +raw[idx++]
    const buildingType = +raw[idx++]
    const x = +raw[idx++]
    const y = +raw[idx++]
    buildings.push({
      id, x, y, buildingType
    })
  }
  const resources = +raw[idx++]
  return {
    tubes: [],
    teleporters: [],
    buildings,
    resources
  }
}

export function parseGlobalData (unsplit: string): GlobalDataDto {
  const raw = unsplit.split('\n')
  let idx = 0
  const minX = +raw[idx++]
  const minY = +raw[idx++]
  const maxX = +raw[idx++]
  const maxY = +raw[idx++]
  const simplifiedMode = raw[idx++] === '1'
  const gameRatio = +raw[idx++]

  const city = parseCity(raw[idx++])

  return {
    minX, maxX,
    minY, maxY,
    initialCity: city,
    gameRatio,
    simplifiedMode,
    podEventCache: []
  }
}

function parseCoord (coord: string) {
  const [x, y] = coord.split(' ').map(x => +x)
  return { x, y }
}

function parseWorkers(param: string): number[] {
  if (param == null) {
    return []
  }

  const code = fromBase91(param)
  const workers = splitAndParse(code.toString())

  return workers
}


const base91Charset = '0123456789:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~!"#$%&()*+,-./'
function fromBase91(str) {
  const base = BigInt(base91Charset.length)
  let num = BigInt(0)

  for (let i = 0; i < str.length; i++) {
    const value = base91Charset.indexOf(str[i])
    if (value === -1) {
      throw new Error('Invalid character in the base-91 string')
    }
    num = num * base + BigInt(value)
  }

  return num
}

function splitAndParse(str) {
  let result = []

  for (let i = str.length; i > 0; i -= 2) {
    let pair = str.slice(Math.max(i - 2, 0), i)
    result.unshift(parseInt(pair, 10))
  }

  return result
}

function decompressFromBase64(base64String) {
  try {
    // Decode Base64 to byte array
    const compressedData = Uint8Array.from(atob(base64String), c => c.charCodeAt(0))

    // Decompress using pako (zlib in JS)
    const decompressedData = pako.inflate(compressedData)

    // Convert byte array to string
    return new TextDecoder('utf-8').decode(decompressedData)
  } catch (e) {
    console.error('An error occurred during decompression:', e)
  }
}