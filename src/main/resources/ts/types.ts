import { systems } from "pixi.js"

export type ContainerConsumer = (layer: PIXI.Container) => void

/**
 * Given by the SDK
 */
export interface FrameInfo {
  number: number
  frameDuration: number
  date: number
}
/**
 * Given by the SDK
 */
export interface CanvasInfo {
  width: number
  height: number
  oversampling: number
}
/**
 * Given by the SDK
 */
export interface PlayerInfo {
  name: string
  avatar: PIXI.Texture
  color: number
  index: number
  isMe: boolean
  number: number
  type?: string
}


/*
* Particle systems 
*/
export interface Effect {
  busy: boolean
  display: PIXI.DisplayObject
}

export interface CoordDto {
  x: number
  y: number
}


export interface PodDto {
  id: number
  route: number[]
  currentIndex: number
  remainingCapacity: number
}

export interface TubeDto {
  buildings: BuildingPairDto
  capacity: number
}

export interface WorkerData {
  p: number,
  workers: number[]
}
export interface BuildingDto {
  id: number
  x: number
  y: number
  buildingType: number
  
  //locally
  hasTeleporter?: boolean
  isTeleporterEntrance?: boolean
  workerHistory?: WorkerData[]
  settledWorkers?: number
}

export type BuildingData = Pick<BuildingDto, 'id' | 'x' | 'y' | 'buildingType'>

export interface TeleporterDto {
  buildings: BuildingPairDto
}
export interface Teleporter extends TeleporterDto {
  arrows: PIXI.TilingSprite
}

export type BuildingPairDto = number[]

export interface CityDto {
  tubes: TubeDto[]
  teleporters: TeleporterDto[]
  buildings: BuildingDto[]
  resources: number
}

export interface TeleportDto {
  astronautId: number
  fromId: number
  toId: number
}

export interface AnimData {
  start: number
  end: number
}


export interface EventDto {
  type: number
  animData: AnimData
  params: number[]
}
export interface PodEffect extends Effect {
  workers: PIXI.Sprite[]
  getTooltip: () => string
}
export interface AstroEffect extends Effect {
  display: PIXI.Sprite
}
export interface ShuttleEffect extends Effect {
  sprite: PIXI.AnimatedSprite
}
export interface WaveEffect extends Effect {
  circle: PIXI.Graphics
}

export interface FrameDataDto {
  city?: CityDto
  events: EventDto[]
  newMonth: boolean
  score?: number
  isLastDayOfMonth: boolean
}

export interface FrameData extends FrameDataDto, FrameInfo {
  previous: FrameData
  buildingById: Record<number, BuildingDto>
  tubesByIdPair: Record<string, TubeDto>
  day: number
  month: number
  score: number
  city: CityDto
  tpParameters: TpParameters[]
  shuttleParams: ShuttleParams[]
}


export interface GlobalDataDto {
  maxX: number
  maxY: number
  minX: number
  minY: number
  gameRatio: number
  initialCity: CityDto
  simplifiedMode: boolean
  podEventCache: EventDto[]
}

export interface GlobalData extends GlobalDataDto {
  mapWidth: number
  mapHeight: number
  buildingIds: Set<number>
  buildingDataById: Record<number, BuildingData>
  tubeIdPairs: Set<string>
  gameX: number
  gameY: number
  gameWidth: number
  gameHeight: number
  gameRatio: number
  customGameRatio: boolean
  teleporters: Teleporter[]
}

export interface AnimData {
  start: number
  end: number
}

export interface Building {
  id: number
  container: PIXI.Container
  teleporter: {
    entrance: PIXI.Sprite
    exit: PIXI.Sprite
  }
  getTooltip: () => string
}

export interface Tube {
  container: PIXI.Container
  tube: PIXI.TilingSprite
}

export interface TpParameters {
  initS: number
  initA: number
  targS: number
  targA: number
}

export interface ShuttleParams {
  shakeDuration: number
  flyOutEndScale: number
  flyInStartScale: number
  flyInEnd: number
  shakeOutWorkersEnd: number
  flyOutEnd: number
}