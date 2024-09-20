import { IPointData } from 'pixi.js'
import { HEIGHT, WIDTH } from '../core/constants.js'
import { ErrorLog } from '../core/ErrorLog.js'
import { bell, ease, easeIn, easeOut } from '../core/transitions.js'
import { lerp, lerpPosition, unlerp, lerpAngle, fitAspectRatio } from '../core/utils.js'
import { AnimData, AstroEffect, Building, BuildingDto, BuildingPairDto, CanvasInfo, CityDto, ContainerConsumer, CoordDto, Effect, EventDto, FrameData, FrameInfo, GlobalData, GlobalDataDto, PlayerInfo, PodEffect, ShuttleEffect, ShuttleParams, Tube, TubeDto, WaveEffect, WorkerData } from '../types.js'
import { parseData, parseGlobalData } from './Deserializer.js'
import ev from './events.js'
import { GAME_COLORS, LANDING_BUILDING, WORKERS_PER_POD } from './gameConstants.js'
import { TooltipManager } from './TooltipManager.js'

import { fit, getWorkerDispatch, last, setAnimationProgress } from './utils.js'
import {  SHUTTLE_HEIGHT, SHUTTLE_WORKERS_POSITION, STATION_RADIUS, TUBE_SECTION_HEIGHT, HUD_EXTERN_TEXTS_OFFSET, LANDING_FRAMES, DUST_FRAMES, SHUTTLE_FRAMES, ARROW_HEIGHT, ARROW_WIDTH, LANDING_RADIUS, DUST_RADIUS } from './assetConstants.js'

export const TUBE_THICKNESS = 30

/*TODO:
(referee mathis: timeout and win/lose, and loop)
*/
interface EffectPool {
  [key: string]: Effect[]
}

const api = {
  setDebugMode: (value: boolean) => {
    api.options.debugMode = value
  },
  options: {
    debugMode: false,

    showOthersMessages: true,
    showMyMessages: true,
    meInGame: false,
  }
}
export { api }

interface MovableSprite {
  getPos: (frame: FrameData) => IPointData
  entity: PIXI.DisplayObject
}

export class ViewModule {
  states: FrameData[]
  globalData: GlobalData
  pool: EffectPool
  api: any
  playerSpeed: number
  previousData: FrameData
  currentData: FrameData
  progress: number
  oversampling: number
  container: PIXI.Container
  time: number
  canvasData: CanvasInfo

  movables: MovableSprite[]

  tooltipManager: TooltipManager
  podLayer: PIXI.Container
  workerLayer: PIXI.Container
  shuttleLayer: PIXI.Container
  dustLayer: PIXI.Container
  waveLayer: PIXI.Container
  hud: { score: PIXI.BitmapText; day: PIXI.BitmapText; month: PIXI.BitmapText; resources: PIXI.BitmapText }
  tubesByIdPair: Record<string, Tube>
  buildings: Building[]
  buildingById: Record<number, Building>
  gameZone: PIXI.Container
  gameScale: number
  shuttleTextures: PIXI.Texture[]
  landingTextures: PIXI.Texture[]

  constructor() {
    window.debug = this
    this.states = []
    this.pool = {}
    this.time = 0
    this.tooltipManager = new TooltipManager()
    this.api = api
  }

  static get moduleName() {
    return 'graphics'
  }

  registerTooltip(container: PIXI.Container, getString: () => string) {
    container.interactive = true
    this.tooltipManager.register(container, getString)
  }

  // Effects
  getFromPool(type: string): Effect {
    if (!this.pool[type]) {
      this.pool[type] = []
    }

    for (const e of this.pool[type]) {
      if (!e.busy) {
        e.busy = true
        e.display.visible = true
        return e
      }
    }

    const e = this.createEffect(type)
    this.pool[type].push(e)
    e.busy = true
    return e
  }

  createEffect(type: string): Effect {
    let display = null
    if (type === 'pod') {
      display = new PIXI.Container()
      const sprite = PIXI.Sprite.from('Monorail.png')
      sprite.angle = 90
      sprite.anchor.set(0.5)

      this.podLayer.addChild(display)
      const effect: PodEffect = {
        busy: false,
        display,
        workers: [],
        getTooltip: () => 'unset'
      }
      const workers = new PIXI.Container()
      for (let i = 0; i < WORKERS_PER_POD; ++i) {
        const worker = PIXI.Sprite.from('cercle.png')
        worker.anchor.set(0.5)
        worker.visible = false
        fit(worker, 12, 12)

        worker.position.set(SHUTTLE_WORKERS_POSITION[i].x, SHUTTLE_WORKERS_POSITION[i].y)

        workers.addChild(worker)
        effect.workers.push(worker)

      }
      workers.pivot.set(sprite.width / 2, sprite.height / 2)
      workers.angle = 90

      display.addChild(sprite)
      display.addChild(workers)

      this.registerTooltip(display, () => {
        return effect.getTooltip()
      })

      return effect as Effect
    } else if (type === 'astronaut') {
      display = new PIXI.Container()
      const sprite = PIXI.Sprite.from('cercle.png')
      sprite.anchor.set(0.5)
      fit(sprite, 20, 20)
      display = sprite
      this.workerLayer.addChild(sprite)
      return { busy: false, display } as AstroEffect
    } else if (type === 'dust') {
      const dust = PIXI.AnimatedSprite.fromFrames(DUST_FRAMES)
      dust.anchor.set(0.5)
      dust.width = DUST_RADIUS * 2
      dust.height = DUST_RADIUS * 2
      this.dustLayer.addChild(dust)
      display = dust
    } else if (type === 'shuttle') {
      display = new PIXI.Container()
      const sprite = PIXI.AnimatedSprite.fromFrames(SHUTTLE_FRAMES)
      sprite.loop = false
      sprite.stop()
      sprite.anchor.set(0.5, 104/377)
      fit(sprite, 999999, SHUTTLE_HEIGHT)
      display.addChild(sprite)
      this.shuttleLayer.addChild(display)
      return { busy: false, display, sprite} as ShuttleEffect
    } else if (type === 'wave') {
      const circle = new PIXI.Graphics()
      circle.lineStyle(10, 0xffffff)
      circle.drawCircle(0, 0, 180)
      circle.alpha = 0.7
      this.waveLayer.addChild(circle)
      display = circle
      return { busy: false, display } as WaveEffect
    } else {
      ErrorLog.push(new Error('Unknown effect type ' + type))
    }
    return { busy: false, display }
  }

  updateScene(previousData: FrameData, currentData: FrameData, progress: number, playerSpeed?: number) {
    const frameChange = (this.currentData !== currentData)
    const fullProgressChange = ((this.progress === 1) !== (progress === 1))

    this.previousData = previousData
    this.currentData = currentData
    this.progress = progress
    this.playerSpeed = playerSpeed || 0

    this.resetEffects()


    this.updateMovables()
    this.updateAstronauts()
    this.updateHud()
    this.updateBuildings()
    this.updateTubes()

    const podEvents = this.currentData.events.filter(e => e.type === ev.TRANSPORT_POD)
    const tpEvents = this.currentData.events.filter(e => e.type === ev.TRANSPORT_TP)
    const arrivalEvents = this.currentData.events.filter(e => e.type === ev.ARRIVAL)
    const tubeUpgradeEvents = this.currentData.events.filter(e => e.type === ev.UPGRADE_TUBE)
    const tubeBuildEvents = this.currentData.events.filter(e => e.type === ev.BUILD_TUBE)
    const newBuildingEvents = this.currentData.events.filter(e => e.type === ev.NEW_BUILDING)
    const newTeleporterEvents = this.currentData.events.filter(e => e.type === ev.NEW_TELEPORTER)


    for (const event of newBuildingEvents) {
      this.animateNewBuildingEvent(event)
    }
    for (const event of newTeleporterEvents) {
      this.animateNewTeleporterEvent(event)
    }
    for (const event of podEvents) {
      this.animatePodEvent(event)
    }
    let idx = 0
    for (const event of tpEvents) {
      this.animateTPEvent(event, idx++)
    }
    for (const event of tubeBuildEvents) {
      this.animateBuildTubeEvent(event)
    }
    for (const event of tubeUpgradeEvents) {
      this.animateTubeUpgradeEvent(event)
    }
    idx = 0
    for (const event of arrivalEvents) {
      this.animateArrivalEvent(event, idx)
    }
  }



  animateArrivalEvent(event: EventDto, idx: number) {
    const p = this.getAnimProgress(event.animData, this.progress)

    if (p <= 0 || p >= 1) {
      return
    }

    const id = event.params[0]
    const shuttle = this.getFromPool('shuttle') as ShuttleEffect
    const dust = this.getFromPool('dust').display as PIXI.AnimatedSprite

    const {
      flyOutEndScale,
      flyInStartScale,
      flyInEnd,
      shakeOutWorkersEnd,
      flyOutEnd
    } = this.currentData.shuttleParams[idx]

    const landingPad = this.globalData.buildingDataById[id]

    const landingPadContainer = this.buildingById[id].container
    const dustTarget = this.toGameZone(landingPad)
    const target = this.toGlobal(landingPadContainer)

    shuttle.display.pivot.set(0)
    // shuttle.sprite.gotoAndStop(0)
    let shuttleScale = 1

    dust.visible = false

    if (p < flyInEnd) {
      const flyInP = unlerp(0, flyInEnd, p)
      const arriveFrom = {
        x: target.x,
        y: HEIGHT + shuttle.sprite.texture.height
      }

      const pos = lerpPosition(arriveFrom, target, easeOut(flyInP))
      shuttle.display.position.copyFrom(pos)
      shuttleScale = lerp(flyInStartScale, 1, easeOut(flyInP))
      shuttle.sprite.textures = this.landingTextures
      setAnimationProgress(shuttle.sprite, flyInP)

    } else if (p < shakeOutWorkersEnd) {
      const shakeOutWorkersP = unlerp(flyInEnd, shakeOutWorkersEnd, p)
      shuttle.display.position.copyFrom(target)
      this.shake(shuttle.display, shakeOutWorkersP)
      shuttle.sprite.textures = this.shuttleTextures
      shuttle.sprite.gotoAndStop(0)
    } else if (p < flyOutEnd) {
      const flyOutP = unlerp(shakeOutWorkersEnd, flyOutEnd, p)
      const leavePoint = {
        x: target.x,
        y: - shuttle.sprite.texture.height
      }
      const pos = lerpPosition(target, leavePoint, easeIn(flyOutP))
      shuttle.display.position.copyFrom(pos)
      shuttleScale = lerp(1, flyOutEndScale, easeIn(flyOutP))
      shuttle.sprite.textures = this.shuttleTextures
      setAnimationProgress(shuttle.sprite, flyOutP)
    }
    shuttle.display.zIndex = shuttle.display.scale.x
    shuttle.display.scale.set(shuttleScale * this.gameScale)

    const dustStartP = flyInEnd - 0.1
    const dustEndP = dustStartP + 0.35

    if (p >= dustStartP && p <= shakeOutWorkersEnd) {
      const dustP = unlerp(dustStartP, dustEndP, p)
      dust.visible = true
      dust.position.copyFrom(dustTarget)
      setAnimationProgress(dust, dustP)
    }
  }

  animateNewBuildingEvent(event: EventDto) {
    const p = this.getAnimProgress(event.animData, this.progress)
    const [id] = event.params
    const building = this.buildingById[id].container
    building.scale.set(this.easeOutElastic(p))
  }

  animateNewTeleporterEvent(event: EventDto) {
    const p = this.getAnimProgress(event.animData, this.progress)
    if (p >= 1) {
      return
    }
    const [id1, id2] = event.params
    const building1 = this.buildingById[id1]
    const building2 = this.buildingById[id2]

    const teleporter1 = building1.teleporter.entrance
    const teleporter2 = building2.teleporter.exit

    const tps = [
      {teleporter: teleporter1, factor: this.globalData.buildingDataById[id1].buildingType === LANDING_BUILDING ? 2 : 1},
      {teleporter: teleporter2, factor: this.globalData.buildingDataById[id2].buildingType === LANDING_BUILDING ? 2 : 1}
    ]

    if (p <= 0) {
      for (const tp of tps) {
        tp.teleporter.visible  = false
      }
      return
    }

    for (const tp of tps) {
      const waveEffect = this.getFromPool('wave') as WaveEffect
      waveEffect.display.position.copyFrom(this.toGlobal(tp.teleporter))
      waveEffect.display.scale.set(easeOut(p))
      this.shake(waveEffect.display, p)

      tp.teleporter.scale.set(lerp(0.5, 1, this.easeOutElastic(p)) * tp.factor)

      const waveDisappearP = 0.7
      if (p > waveDisappearP) {
        const waveUpdateP = unlerp(waveDisappearP, 1, p)
        waveEffect.display.alpha = lerp(0.7, 0, waveUpdateP)
      } else {
        waveEffect.display.alpha = 0.7
      }
    }
  }

  animateBuildTubeEvent(event: EventDto) {
    const p = this.getAnimProgress(event.animData, this.progress)
    const [id1, id2] = event.params
    const idPair = [id1, id2].sort().join('-')
    const tube = this.tubesByIdPair[idPair]
    tube.tube.scale.x = p
    tube.container.hitArea = new PIXI.Rectangle(STATION_RADIUS, -tube.tube.height / 2, (tube.tube.width * tube.tube.scale.x) - 2 * STATION_RADIUS, TUBE_THICKNESS)
  }

  animatePodEvent(event: EventDto) {
    const p = this.getAnimProgress(event.animData, this.progress)
    if (p <= 0 || p >= 1) {
      return
    }

    const pod = this.getFromPool('pod') as PodEffect

    const fromId = event.params[0]
    const toId = event.params[1]
    const podId = event.params[2]
    const workerTypes = event.params.slice(3)
    for (let i = 0; i < WORKERS_PER_POD; ++i) {
      const type = workerTypes[i] ?? 0
      pod.workers[i].tint = GAME_COLORS[type]
      pod.workers[i].visible = type !== 0
    }

    pod.getTooltip = () => {
      if (workerTypes.length > 0) {
        return `Pod ${podId}\nPassengers:\n${this.getWorkerList(workerTypes)}`
      }
      return `Pod ${podId}`
    }

    const currentRoute = {
      from: this.globalData.buildingDataById[fromId],
      to: this.globalData.buildingDataById[toId]
    }

    const pos = lerpPosition(currentRoute.from, currentRoute.to, p)
    const angle = Math.atan2(currentRoute.to.y - currentRoute.from.y, currentRoute.to.x - currentRoute.from.x)

    pod.display.position.copyFrom(this.toGameZone(pos))
    pod.display.rotation = angle

  }

  animateTubeUpgradeEvent(event: EventDto) {
    const p = this.getAnimProgress(event.animData, this.progress)
    if (p <= 0 || p >= 1) {
      return
    }

    const [id1, id2] = event.params
    const idPair = [id1, id2].sort().join('-')
    const tube = this.tubesByIdPair[idPair]
    tube.container.scale.y = this.easeOutElastic(p) * bell(p) + 1
    this.shake(tube.container, p)
  }

  shake(entity: PIXI.DisplayObject, progress: number) {
    const shakeForceMax = 1.4
    const omega = 100000 * (Math.random() * 0.5 + 0.5)

    const shakeForce = shakeForceMax * unlerp(0, 0.5, bell(progress))
    const shakeX = shakeForce * Math.cos(2 * progress * omega)
    const shakeY = shakeForce * Math.sin(progress * omega)

    entity.pivot.x = shakeX
    entity.pivot.y = shakeY
  }

  getAnimProgress({ start, end }: AnimData, progress: number) {
    return unlerp(start, end, progress)
  }


  upThenDown(t: number) {
    return Math.min(1, bell(t) * 2)
  }

  animateTPEvent(event: EventDto, idx: number) {
    const p = this.getAnimProgress(event.animData, this.progress)
    if (p <= 0 || p >= 1) {
      return
    }

    const particle = this.getFromPool('astronaut') as AstroEffect
    const [fromId, toId, workerType] = event.params
    particle.display.tint = GAME_COLORS[workerType]
    particle.display.alpha = 1

    const from = this.globalData.buildingDataById[fromId]
    const to = this.globalData.buildingDataById[toId]

    const x = ease(p)

    const { initS, initA, targS, targA } = this.currentData.tpParameters[idx]

    const newPositionX =
      (initS * Math.cos(initA) + targS * Math.cos(targA) - 2 * to.x + 2 * from.x) * (x ** 3) +
      (-2 * initS * Math.cos(initA) - targS * Math.cos(targA) + 3 * to.x - 3 * from.x) * (x ** 2) +
      (initS * Math.cos(initA)) * x +
      from.x

    const newPositionY =
      (initS * Math.sin(initA) + targS * Math.sin(targA) - 2 * to.y + 2 * from.y) * (x ** 3) +
      (-2 * initS * Math.sin(initA) - targS * Math.sin(targA) + 3 * to.y - 3 * from.y) * (x ** 2) +
      (initS * Math.sin(initA)) * x +
      from.y

    particle.display.position.copyFrom(this.toGameZone({ x: newPositionX, y: newPositionY }))
  }

  getPositionFromAngle(center: { x: number; y: number }, radius: number, angle: number) {
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    }
  }

  updateArrows() {
    for (const tp of this.globalData.teleporters) {
      tp.arrows.tilePosition.x = this.time * tp.arrows.tileScale.x / 16
    }
  }

  updateAstronauts() {
    for (const building of this.currentData.city.buildings) {
      const workerData = building.workerHistory
      const radius = (building.buildingType === LANDING_BUILDING ? LANDING_RADIUS : STATION_RADIUS) - 10

      const preData = this.getCurrentWorkerData(workerData, this.progress)
      const curData = this.getNextWorkerData(workerData, this.progress)
      // if (preData.p === curData.p) {
      //   this.updateAstronautsSimple(building, preData.workers, radius)
      //   continue
      // }

      const p = unlerp(preData.p, curData.p, this.progress)

      const prevWorkers = preData.workers
      const curWorkers = curData.workers

      const prevAngles = []
      const curAngles = []
      for (const structure of [{ workers: curWorkers, angles: curAngles }, { workers: prevWorkers, angles: prevAngles }]) {

        for (let idx = 0; idx < structure.workers.length; ++idx) {
          const angle = idx * (2 * Math.PI / structure.workers.length) - Math.PI / 2
          structure.angles.push(angle)
        }
      }

      const { newWorkers, leavingWorkers, stayingWorkers } = getWorkerDispatch(prevWorkers, curWorkers)

      const stayingIdxsFrom = []
      const stayingIdxsTo = []
      const leavingIdxs = []
      const newIdxs = []
      let poolOfStaying = [...stayingWorkers]
      const poolOfLeaving = [...leavingWorkers]
      const poolOfNew = [...newWorkers]

      for (let i = 0; i < prevWorkers.length; i++) {
        const workerType = prevWorkers[i]
        if (poolOfStaying.includes(workerType)) {
          poolOfStaying.splice(poolOfStaying.indexOf(workerType), 1)
          stayingIdxsFrom.push(i)
        } else if (poolOfLeaving.includes(workerType)) {
          poolOfLeaving.splice(poolOfLeaving.indexOf(workerType), 1)
          leavingIdxs.push(i)
        }
      }

      poolOfStaying = [...stayingWorkers]

      for (let i = 0; i < curWorkers.length; i++) {
        const workerType = curWorkers[i]
        if (poolOfStaying.includes(workerType)) {
          poolOfStaying.splice(poolOfStaying.indexOf(workerType), 1)
          stayingIdxsTo.push(i)
        } else if (poolOfNew.includes(workerType)) {
          poolOfNew.splice(poolOfNew.indexOf(workerType), 1)
          newIdxs.push(i)
        }
      }

      let stayIdx = 0
      for (const worker of stayingWorkers) {
        const astro = this.getFromPool('astronaut') as AstroEffect
        const centre = this.toGameZone(building)
        const fromIdx = stayingIdxsFrom[stayIdx]
        const toIdx = stayingIdxsTo[stayIdx]
        const fromAngle = prevAngles[fromIdx]
        const toAngle = curAngles[toIdx]
        const angle = lerpAngle(fromAngle, toAngle, p)
        const pos = this.getPositionFromAngle(centre, radius, angle)

        astro.display.position.set(pos.x, pos.y)
        astro.display.tint = GAME_COLORS[worker]
        astro.display.alpha = 1
        stayIdx++
      }

      let leaveIdx = 0
      for (const worker of leavingWorkers) {
        const astro = this.getFromPool('astronaut') as AstroEffect
        const centre = this.toGameZone(building)
        const idx = leavingIdxs[leaveIdx]
        const angle = prevAngles[idx]
        const position = this.getPositionFromAngle(centre, radius, angle)
        astro.display.position.set(position.x, position.y)
        astro.display.alpha = 1 - p
        astro.display.tint = GAME_COLORS[worker]
        leaveIdx++
      }

      let newIdx = 0
      for (const worker of newWorkers) {
        const astro = this.getFromPool('astronaut') as AstroEffect
        const centre = this.toGameZone(building)
        const idx = newIdxs[newIdx]
        const angle = curAngles[idx]
        const position = this.getPositionFromAngle(centre, radius, angle)
        astro.display.position.set(position.x, position.y)
        astro.display.alpha = p
        astro.display.tint = GAME_COLORS[worker]
        newIdx++
      }
    }
  }

  updateAstronautsSimple(building, workers, radius) {
    let idx = 0
    for (const worker of workers) {
      const astro = this.getFromPool('astronaut') as AstroEffect
      const centre = this.toGameZone(building)
      const angle = idx * (2 * Math.PI / workers.length) - Math.PI / 2
      const x = centre.x + radius * Math.cos(angle)
      const y = centre.y + radius * Math.sin(angle)
      astro.display.position.set(x, y)
      astro.display.tint = GAME_COLORS[worker]
      idx++
    }
  }

  updateHud() {
    const day = this.currentData.number === 0 ? 1 : this.currentData.day
    const month = this.currentData.number === 0 ? 1 : this.currentData.month

    this.hud.score.text = `${this.currentData.score}`
    this.hud.day.text = `${day < 10 ? '0' : ''}${day}`
    this.hud.month.text = `${month < 10 ? '0' : ''}${month}`
    this.hud.resources.text = `${this.currentData.city.resources}`

    this.hud.score.pivot.set(0)
    this.hud.resources.pivot.set(0)

    if (this.currentData.isLastDayOfMonth && !this.globalData.simplifiedMode) {
      if (this.previousData.score < this.currentData.score) {
        this.hud.score.text = `${Math.round(lerp(this.previousData.score, this.currentData.score, easeOut(this.progress)))}`
        this.shake(this.hud.score, this.progress)
      }
      if (this.previousData.city.resources < this.currentData.city.resources) {
        this.hud.resources.text = `${Math.round(lerp(this.previousData.city.resources, this.currentData.city.resources, easeOut(this.progress)))}`
        this.shake(this.hud.resources, this.progress)
      }
    }
  }


  updateBuildings() {
    for (const building of this.buildings) {
      const data = this.currentData.buildingById[building.id]
      building.container.visible = data != null
      building.container.scale.set(data != null ? 1 : 0)

      if (data != null && data.hasTeleporter) {
        const teleporter = data.isTeleporterEntrance ? building.teleporter.entrance : building.teleporter.exit
        teleporter.visible = true
        if (data.isTeleporterEntrance) {
          const teleportBuilding = this.globalData.buildingDataById[this.getTeleporterOtherBuilding(building.id).id]
          const teleportDest = this.toGameZone(teleportBuilding)
          const teleportOrigin = this.toGameZone(data)
          const angle = Math.atan2(teleportDest.y - teleportOrigin.y, teleportDest.x - teleportOrigin.x) + Math.PI / 2
          teleporter.rotation = angle
        }
      } else {
        building.teleporter.entrance.visible = false
        building.teleporter.exit.visible = false
      }
    }
  }

  updateTubes() {
    for (const idPair in this.tubesByIdPair) {
      const tube = this.tubesByIdPair[idPair]
      const data = this.currentData.tubesByIdPair[idPair]
      tube.container.visible = data !== null
      tube.container.scale.y = 1
      tube.tube.scale.x = this.currentData.previous.tubesByIdPair[idPair] ? 1 : 0
      const hitArea = new PIXI.Rectangle(STATION_RADIUS, -tube.tube.height / 2, tube.tube.width - 2 * STATION_RADIUS, TUBE_THICKNESS)
      tube.container.hitArea = hitArea
    }
  }


  updateMovables() {
    for (const m of this.movables) {
      const prev = m.getPos(this.previousData)
      const cur = m.getPos(this.currentData)

      let visible = true
      let alpha = 1
      if (prev && cur) {
        const pos = lerpPosition(prev, cur, this.progress)
        m.entity.position.copyFrom(pos)
      } else if (prev) {
        m.entity.position.copyFrom(prev)
        alpha = 1 - this.progress
      } else if (cur) {
        m.entity.position.copyFrom(cur)
        alpha = this.progress
      } else {
        visible = false
      }
      m.entity.visible = visible
      m.entity.alpha = alpha
    }
  }

  getCurrentWorkerData(history: WorkerData[], progress: number): WorkerData {
    if (history.length === 0) {
      return { workers: [], p: 0 }
    }
    const idx = history.findIndex(h => h.p >= progress)
    if (idx === -1) {
      return last(history)
    }
    return {
      workers: history[idx - 1]?.workers ?? [],
      p: history[idx - 1]?.p ?? 0
    }
  }


  getNextWorkerData(history: WorkerData[], progress: number): WorkerData {
    if (history.length === 0) {
      return { workers: [], p: 0 }
    }
    const idx = history.findIndex(h => h.p >= progress)
    if (idx === -1) {
      return last(history)
    }
    return {
      workers: history[idx]?.workers ?? [],
      p: history[idx]?.p ?? 0
    }
  }


  resetEffects() {
    for (const type in this.pool) {
      for (const effect of this.pool[type]) {
        effect.display.visible = false
        effect.busy = false
      }
    }
  }

  animateScene(delta: number) {
    this.time += delta

    this.updateArrows()
  }

  asLayer(func: ContainerConsumer): PIXI.Container {
    const layer = new PIXI.Container()
    func.bind(this)(layer)
    return layer
  }

  reinitScene(container: PIXI.Container, canvasData: CanvasInfo) {
    this.time = 0
    this.oversampling = canvasData.oversampling
    this.container = container
    this.pool = {}
    this.canvasData = canvasData

    this.movables = []

    this.shuttleTextures = SHUTTLE_FRAMES.map(x => PIXI.Texture.from(x))
    this.landingTextures = LANDING_FRAMES.map(x => PIXI.Texture.from(x))

    const tooltipLayer = this.tooltipManager.reinit()
    tooltipLayer.interactiveChildren = false
    const gameZone = new PIXI.Container()

    const background = this.createBackground()
    const buildingLayer = this.asLayer(this.initBuildings)
    const tubeLayer = this.asLayer(this.initTubes)
    const arrowLayer = this.asLayer(this.initArrows)
    const hudLayer = this.asLayer(this.initHud)

    this.podLayer = new PIXI.Container()
    this.workerLayer = new PIXI.Container()
    this.shuttleLayer = new PIXI.Container()
    this.dustLayer = new PIXI.Container()
    this.waveLayer = new PIXI.Container()


    gameZone.addChild(tubeLayer)
    gameZone.addChild(this.podLayer)
    gameZone.addChild(buildingLayer)
    gameZone.addChild(this.workerLayer)
    gameZone.addChild(this.dustLayer)
    gameZone.addChild(this.waveLayer)

    container.addChild(background)
    container.addChild(gameZone)
    container.addChild(arrowLayer)
    container.addChild(this.shuttleLayer)
    container.addChild(hudLayer)
    container.addChild(tooltipLayer)

    this.shuttleLayer.sortableChildren = true

    if (this.globalData.customGameRatio) {
      const hudHeight = 60
      const gameScale = this.gameScale
      gameZone.scale.set(gameScale)


      const origin = this.toGameZone({ x: this.globalData.minX, y: this.globalData.minY })
      const x = WIDTH / 2 - (this.globalData.gameWidth * gameScale)/2 - origin.x * gameScale
      const y = HEIGHT / 2 - (this.globalData.gameHeight * gameScale)/2 - origin.y * gameScale

      gameZone.position.set(x, y+ hudHeight/2)
    }
    this.gameZone = gameZone

    container.interactive = true

    /* Might help with performance */
    background.interactive = false
    hudLayer.interactive = false
    tooltipLayer.interactive = false
    tubeLayer.interactive = false
    tubeLayer.interactiveChildren = false
    this.podLayer.interactive = false
    this.podLayer.interactiveChildren = false
    buildingLayer.interactive = false
    this.workerLayer.interactive = false
    this.workerLayer.interactiveChildren = false
    this.shuttleLayer.interactive = false
    this.shuttleLayer.interactiveChildren = false

    container.on('mousemove', (event) => {
      this.tooltipManager.moveTooltip(event)
    })
  }

  createBackground(): PIXI.Sprite {
    const sprite = PIXI.Sprite.from('Background.jpg')
    fit(sprite, WIDTH, HEIGHT)
    return sprite
  }

  initArrows(layer: PIXI.Container) {
    for (const tp of this.globalData.teleporters) {
      const fromPos = this.toGameZone(this.globalData.buildingDataById[tp.buildings[0]])
      const toPos = this.toGameZone(this.globalData.buildingDataById[tp.buildings[1]])
      const dist = Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y)
      const arrows = PIXI.TilingSprite.from('arrow.png', { width: ARROW_WIDTH, height: ARROW_HEIGHT })
      arrows.interactive = false
      arrows.anchor.x = 0
      arrows.anchor.y = 0.5
      arrows.position.copyFrom(fromPos)
      arrows.width = dist
      arrows.height = ARROW_HEIGHT
      const rotation = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x)
      arrows.rotation = rotation
      arrows.visible = false
      layer.addChild(arrows)
      tp.arrows = arrows as PIXI.TilingSprite
    }
  }

  initBuildings(layer: PIXI.Container) {
    this.buildings = []
    this.buildingById = {}

    for (const id of this.globalData.buildingIds) {
      const building = this.createBuilding(id)
      layer.addChild(building)
    }
  }

  initHud(layer: PIXI.Container) {
    const sprite = PIXI.Sprite.from('HUD.png')
    fit(sprite, WIDTH / 5 * 4, 100)
    sprite.anchor.set(0.5, 0)
    sprite.position.set(WIDTH / 2, 0)

    const score = new PIXI.BitmapText('0', {fontName: 'Nasalization', fontSize: 37})
    score.tint = 0x03E5FE
    score.anchor = new PIXI.Point(0, 0.24)
    const day = new PIXI.BitmapText('01', {fontName: 'Nasalization', fontSize: 37})
    day.tint = 0x03E5FE
    day.anchor = new PIXI.Point(0.5, 0.24)
    const month = new PIXI.BitmapText('01', {fontName: 'Nasalization', fontSize: 37})
    month.tint = 0x03E5FE
    month.anchor = new PIXI.Point(0.5, 0.24)
    const resources = new PIXI.BitmapText('0', {fontName: 'Nasalization', fontSize: 37, align: 'right'})
    resources.tint = 0x03E5FE
    resources.anchor = new PIXI.Point(1, 0.24)

    score.position.set(HUD_EXTERN_TEXTS_OFFSET, 2)
    day.position.set(WIDTH / 2 - 57, 8)
    month.position.set(WIDTH / 2 + 57, 8)
    resources.position.set(WIDTH - HUD_EXTERN_TEXTS_OFFSET, 2)

    this.hud = {
      score,
      day,
      month,
      resources
    }



    layer.addChild(sprite)
    layer.addChild(score)
    layer.addChild(day)
    layer.addChild(month)
    layer.addChild(resources)
  }

  initTubes(layer: PIXI.Container) {
    this.tubesByIdPair = {}

    for (const idPair of this.globalData.tubeIdPairs) {
      const [id1, id2] = idPair.split('-').map(x => +x)
      const b1 = this.globalData.buildingDataById[id1]
      const b2 = this.globalData.buildingDataById[id2]
      const tube = this.createTube(b1, b2)

      this.registerTooltip(tube.container, () => {
        const data = this.currentData.tubesByIdPair[idPair]
        if (data == null) {
          return null
        }
        return `Tube capacity: ${data.capacity}`
      })

      layer.addChild(tube.container)
      this.tubesByIdPair[idPair] = tube
    }
  }

  toGameZone(point: IPointData): IPointData {
    return {
      x: this.globalData.gameX + (point.x - this.globalData.minX) * this.globalData.gameRatio,
      y: this.globalData.gameY + (point.y - this.globalData.minY) * this.globalData.gameRatio
    }
  }

  fromGameZone(point: IPointData): IPointData {
    return {
      x: (point.x - this.globalData.gameX) / this.globalData.gameRatio + this.globalData.minX,
      y: (point.y - this.globalData.gameY) / this.globalData.gameRatio + this.globalData.minY
    }
  }

  createTube(a: CoordDto, b: CoordDto): Tube {

    const container = new PIXI.Container()
    const tube = new PIXI.TilingSprite(PIXI.Texture.from(this.globalData.simplifiedMode ? 'Rail_black.png' : 'Rail.png'))

    tube.anchor.set(0, 0.5)
    tube.width = Math.hypot(b.x - a.x, b.y - a.y) * this.globalData.gameRatio
    tube.height = TUBE_THICKNESS
    tube.tileScale.set(TUBE_THICKNESS / TUBE_SECTION_HEIGHT)

    const hitArea = new PIXI.Rectangle(STATION_RADIUS, -tube.height / 2, tube.width - 2 * STATION_RADIUS, TUBE_THICKNESS)

    container.rotation = Math.atan2(b.y - a.y, b.x - a.x)
    container.position.copyFrom(this.toGameZone(a))
    container.addChild(tube)
    container.hitArea = hitArea

    return { container, tube }
  }

  getBuildingSprite(buildingType: number): PIXI.Sprite {
    if (buildingType === LANDING_BUILDING) {
      const tmpSprite = PIXI.Sprite.from('Station_0.png')
      tmpSprite.width = LANDING_RADIUS * 2
      tmpSprite.height = LANDING_RADIUS * 2
      return tmpSprite
    }
    return PIXI.Sprite.from(`Station_${buildingType}`)
  }

  createBuilding(id: number) {
    const buildingData = this.globalData.buildingDataById[id]
    const container = new PIXI.Container()

    const sprite = this.getBuildingSprite(buildingData.buildingType)
    sprite.anchor.set(0.5)
    container.addChild(sprite)

    const teleporterEntrance = PIXI.Sprite.from('tp_entrance.png')
    teleporterEntrance.anchor.set(0.5, 0.5)
    teleporterEntrance.position.set(0, 0)
    teleporterEntrance.visible = false
    sprite.addChild(teleporterEntrance)

    const teleporterExit = PIXI.Sprite.from('tp_exit.png')
    teleporterExit.anchor.set(0.5, 0.5)
    teleporterExit.position.set(0, 0)
    teleporterExit.visible = false
    sprite.addChild(teleporterExit)

    for (const tpStprite of [teleporterEntrance, teleporterExit]) {
      if (buildingData.buildingType === LANDING_BUILDING) {
        tpStprite.scale.set(2)
      } else {
        tpStprite.scale.set(1.2)
      }
    }

    container.position.copyFrom(this.toGameZone(buildingData))

    const b: Building = {
      container,
      id,
      teleporter: {
        entrance: teleporterEntrance,
        exit: teleporterExit
      },
      getTooltip: () => {
        const buildingData = this.currentData.buildingById[id]
        if (buildingData == null) {
          return null
        }
        let text = `Building ${buildingData.id}`
          + `\nType: ${buildingData.buildingType}`
          + `\npos: (${buildingData.x}, ${buildingData.y})`

        // Teleporter info
        if (buildingData.hasTeleporter) {
          const teleporter = this.currentData.city.teleporters.find(
            tp => tp.buildings[0] === buildingData.id || tp.buildings[1] === buildingData.id
          )
          const entranceId = teleporter.buildings[0]
          const exitId = teleporter.buildings[1]

          if (entranceId === buildingData.id) {
            text += `\nTeleporter to ${exitId}`
          } else {
            text += `\nTeleporter from ${entranceId}`
          }
        }

        // Astronaut info
        if (buildingData.workerHistory.length > 0) {
          const workers = last(buildingData.workerHistory).workers
          const warning = this.progress < 1 ? ' at end of day' : ''
          if (workers.length > 0) {
            text += `\nAstronauts${warning}:\n${this.getWorkerList(workers)}`
          }
          const settledWorkers = buildingData.settledWorkers
          if (settledWorkers > 0) {
            text += `\nSettled here${warning}:\n${settledWorkers}`
          }
        }

        return text
      }
    }
    this.buildings.push(b)
    this.buildingById[id] = b

    container.on('mouseover', () => {
      const teleporterArrows = this.getTeleporterArrows(id)
      if (teleporterArrows != null) {
        teleporterArrows.visible = true
      }
    })

    container.on('mouseout', () => {
      const teleporterArrows = this.getTeleporterArrows(id)
      if (teleporterArrows != null) {
        teleporterArrows.visible = false
      }
    })

    this.registerTooltip(container, () => {
      return b.getTooltip()
    })

    return container
  }

  getWorkerList(workers: number[]): string {
    let optionA = workers.join(' ')

    let counter = {}
    for (let i = 0; i < workers.length; i++) {
      counter[workers[i]] = (counter[workers[i]] ?? 0) + 1
    }
    const texts = Object.keys(counter).map(k => `${k}(x${counter[k]})`)
    const groups = []
    for (let i = 0; i < texts.length; i += 6) {
      groups.push(texts.slice(i, i + 6).join(', '))
    }
    let optionB = groups.join(',\n')

    if (optionA.length <= optionB.length) {
      return optionA
    }
    return optionB
  }

  getTeleporterOtherBuilding(buildingId: number): Building {
    const buildingData = this.currentData.buildingById[buildingId]
    if (buildingData == null || !buildingData.hasTeleporter) {
      return null
    }
    const teleporter = this.currentData.city.teleporters.find(
      tp => tp.buildings[0] === buildingData.id || tp.buildings[1] === buildingData.id
    )
    const otherId = teleporter.buildings[0] === buildingData.id ? teleporter.buildings[1] : teleporter.buildings[0]
    return this.buildingById[otherId]
  }

  getTeleporterArrows(buildingId: number): PIXI.Sprite {
    const buildingData = this.currentData.buildingById[buildingId]
    if (buildingData == null || !buildingData.hasTeleporter) {
      return null
    }
    const teleporter = this.globalData.teleporters.find(
      tp => tp.buildings[0] === buildingData.id || tp.buildings[1] === buildingData.id
    )
    return teleporter.arrows
  }

  easeOutElastic(x: number): number {
    const c4 = (2 * Math.PI) / 3

    return x === 0
      ? 0
      : x === 1
        ? 1
        : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
  }

  handleGlobalData(players: PlayerInfo[], raw: string): void {
    const globalData: GlobalDataDto = parseGlobalData(raw)

    const mapWidth = globalData.maxX - globalData.minX
    const mapHeight = globalData.maxY - globalData.minY
    const hudHeight = 84
    const assetPadding = 260

    let gameRatio: number
    let customGameRatio = false
    if (globalData.gameRatio > 0) {
      gameRatio = globalData.gameRatio
      customGameRatio = true
    } else {
      gameRatio = fitAspectRatio(mapWidth, mapHeight, WIDTH - assetPadding, HEIGHT - assetPadding - hudHeight)
    }

    const gameWidth = mapWidth * gameRatio
    const gameHeight = mapHeight * gameRatio


    let gameX = (WIDTH / 2) - gameWidth / 2
    let gameY = (HEIGHT / 2) - gameHeight / 2 + (hudHeight / 2)

    if (customGameRatio) {
      const hudHeight = 60
      const assetPadding = 100
      const gameScale = fitAspectRatio(gameWidth, gameHeight, WIDTH - assetPadding, HEIGHT - assetPadding - hudHeight)
      this.gameScale = gameScale
    } else {
      this.gameScale = 1
    }

    this.globalData = {
      ...globalData,
      buildingIds: new Set(),
      buildingDataById: {},
      tubeIdPairs: new Set(),
      mapWidth,
      mapHeight,
      gameX,
      gameY,
      gameWidth,
      gameHeight,
      gameRatio,
      customGameRatio,
      teleporters: []
    }

    for (const building of globalData.initialCity.buildings) {
      this.globalData.buildingIds.add(building.id)
      this.globalData.buildingDataById[building.id] = building
      building.workerHistory = []
      building.settledWorkers = 0
    }
  }



  handleFrameData(frameInfo: FrameInfo, raw: string): FrameData {
    const parsed = parseData(raw, this.globalData)

    const prev = last(this.states)
    let currentDay = prev?.day ?? 29
    let currentMonth = prev?.month ?? 0
    let currentScore = parsed.score ?? prev?.score ?? 0

    let currentCity: CityDto = {
      ...prev?.city ?? this.globalData.initialCity, // Previous state
      ...parsed.city, // New state if exists
      buildings: [
        ...prev?.city?.buildings ?? this.globalData.initialCity.buildings, // Previous buildings
        ...parsed.city?.buildings ?? [] // New buildings if exists
      ],
      tubes: [
        ...prev?.city?.tubes ?? this.globalData.initialCity.tubes
      ],
      teleporters: [
        ...prev?.city?.teleporters ?? this.globalData.initialCity.teleporters
      ]
    }

    if (parsed.newMonth) {
      currentDay = 1
      currentMonth++
    } else {
      currentDay++
    }

    const frameData: FrameData = {
      ...parsed,
      city: currentCity,
      ...frameInfo,
      previous: null,
      buildingById: {},
      tubesByIdPair: {},
      day: currentDay,
      month: currentMonth,
      score: currentScore,
      tpParameters: [],
      shuttleParams: []
    }

    // trick to split tp events
    const firstTpEventIndex = frameData.events.findIndex(e => e.type === ev.TRANSPORT_TP)
    const tpEvents = frameData.events.filter(e => e.type === ev.TRANSPORT_TP)
    frameData.events = frameData.events.filter(e => e.type !== ev.TRANSPORT_TP)
    const newEvents = []
    for (const event of tpEvents) {
      const fromId = event.params[0]
      const toId = event.params[1]
      const timeBetweenTeleport = event.params[2]
      const tpTime = event.params[3]
      let astronautCounter = 0
      for (let i = 4; i < event.params.length; i += 2) {
        const type = event.params[i]
        const count = event.params[i + 1]
        for (let j = 0; j < count; j++) {
          const start = event.animData.start + (astronautCounter * timeBetweenTeleport)
          astronautCounter++
          const newEvent = {
            type: ev.TRANSPORT_TP,
            params: [fromId, toId, type],
            animData: {
              start: start,
              end: start + tpTime
            },
          }
          newEvents.push(newEvent)
        }
      }
    }
    // preserve events order
    const oldEventsFirst = frameData.events.slice(0, firstTpEventIndex)
    const oldEventsSecond = frameData.events.slice(firstTpEventIndex)
    frameData.events = [...oldEventsFirst, ...newEvents, ...oldEventsSecond]

    // Data structuring
    if (parsed.city?.buildings != null) {
      // new buildings
      for (const building of parsed.city.buildings) {
        this.globalData.buildingIds.add(building.id)
        this.globalData.buildingDataById[building.id] = building
      }
    }


    const copiedBuildings = []

    for (const building of currentCity.buildings) {

      const copy: BuildingDto = { ...building, workerHistory: [], settledWorkers: prev?.buildingById[building.id]?.settledWorkers ?? 0 }
      frameData.buildingById[building.id] = copy
      copiedBuildings.push(copy)
      const lastHistory = last(prev?.buildingById[building.id]?.workerHistory ?? [])
      if (lastHistory != null) {
        copy.workerHistory = [
          {
            ...lastHistory,
            p: 0
          }
        ]
      } else {
        copy.workerHistory = [
          {
            workers: [],
            p: 0
          }
        ]
      }

      if (parsed.newMonth) {
        if (lastHistory != null && lastHistory.workers.length > 0) {
          copy.workerHistory.push({ workers: [], p: 100 / frameInfo.frameDuration })
        }
        copy.settledWorkers = 0
      }
    }
    currentCity.buildings = copiedBuildings


    const copiedTubes = currentCity.tubes.map(tube => ({ ...tube }))
    const firstTeleportTimeByBuildingId: { [key: number]: number } = {}
    // Event handling 1
    for (const event of frameData.events) {
      if (event.type === ev.BUILD_TUBE) {
        const tube: TubeDto = {
          buildings: [event.params[0], event.params[1]],
          capacity: 1
        }
        copiedTubes.push(tube)
      }
    }
    currentCity.tubes = copiedTubes

    for (const tube of currentCity.tubes) {
      const bothIds = [...tube.buildings]
      bothIds.sort()
      const pair = `${bothIds[0]}-${bothIds[1]}`
      this.globalData.tubeIdPairs.add(pair)
      frameData.tubesByIdPair[pair] = tube
    }
    for (const event of frameData.events) {
      if (event.type === ev.UPGRADE_TUBE) {
        const bothIds = event.params.slice(0, 2)
        const upgradesCount = event.params[2]
        bothIds.sort()
        const pair = `${bothIds[0]}-${bothIds[1]}`
        frameData.tubesByIdPair[pair].capacity += upgradesCount
      }
    }

    // Event handling 2
    for (const event of frameData.events) {
      event.animData.start /= frameInfo.frameDuration
      event.animData.end /= frameInfo.frameDuration

      if (event.type === ev.ARRIVAL) {
        const buildingId = event.params[0]
        const workerCounts = event.params
        const building = frameData.buildingById[buildingId]
        const workerPool: number[] = []

        for (let workerType = 1; workerType < workerCounts.length; ++workerType) {
          const workerCount = workerCounts[workerType]
          if (workerCount > 0) {
            for (let i = 0; i < workerCount; ++i) {
              workerPool.push(workerType)
            }
          }
        }

        const landingPad = this.globalData.buildingDataById[buildingId]
        const landingPadRealPos = this.toGameZone(landingPad)
        landingPadRealPos.x *= this.gameScale
        landingPadRealPos.y *= this.gameScale

        const highestShuttleScale = 4
        const vPad = (SHUTTLE_HEIGHT * highestShuttleScale / 2)
        const shakeDuration = 0.4
        const flyOutRatio = unlerp(-vPad, HEIGHT + vPad, landingPadRealPos.y)
        const flyOutDuration = flyOutRatio * (1 - shakeDuration)
        const flyInDuration = 1 - shakeDuration - flyOutDuration
        const flyOutEndScale = lerp(1, highestShuttleScale, flyOutRatio)
        const flyInStartScale = lerp(1, highestShuttleScale, 1 - flyOutRatio)
        const flyInEnd = flyInDuration
        const shakeOutWorkersEnd = flyInDuration + shakeDuration
        const flyOutEnd = 1

        const shuttleParams: ShuttleParams = {
          shakeDuration, flyOutEndScale, flyInStartScale, flyInEnd, shakeOutWorkersEnd, flyOutEnd
        }
        frameData.shuttleParams.push(shuttleParams)

        const shakeStartAnimP = flyInDuration
        const shakeEndAnimP = flyInDuration + shakeDuration
        const shakeStartP = lerp(event.animData.start, event.animData.end, shakeStartAnimP)

        this.freezeWorkerStateAtTime(building, shakeStartP) // last 20%

        let workers: number[] = []

        for (let i = 0; i < workerPool.length; ++i) {
          const endAnimP = lerp(shakeStartAnimP, shakeEndAnimP, (i + 1) / workerPool.length)
          const endP = lerp(event.animData.start, event.animData.end, endAnimP)
          workers = [...workers, workerPool[i]]
          building.workerHistory.push({ workers, p: endP })
        }
      }

      if (event.type == ev.TRANSPORT_TP) {
        const tpParameter = {
          initS: Math.random() * 10 + 10,
          initA: Math.random() * Math.PI * 2,
          targS: Math.random() * 10 + 10,
          targA: Math.random() * Math.PI * 2,
        }
        frameData.tpParameters.push(tpParameter)

        const buildingFrom = frameData.buildingById[event.params[0]]
        const buildingTo = frameData.buildingById[event.params[1]]
        const workerType = event.params[2]
        this.removeFirstWorkerOfTypeAtTime(buildingFrom, workerType, event.animData.start)
        this.addWorkerOfTypeAtTime(buildingTo, workerType, event.animData.end)

        const fadeInP = lerp(event.animData.start, event.animData.end, 0.9)

        if (firstTeleportTimeByBuildingId[buildingTo.id] == null && workerType !== buildingTo.buildingType) {
          firstTeleportTimeByBuildingId[buildingTo.id] = fadeInP
        }
        if (firstTeleportTimeByBuildingId[buildingTo.id] > fadeInP && workerType !== buildingTo.buildingType) {
          firstTeleportTimeByBuildingId[buildingTo.id] = fadeInP
        }
      }

      if (event.type === ev.TRANSPORT_POD) {
        const buildingFrom = frameData.buildingById[event.params[0]]
        const buildingTo = frameData.buildingById[event.params[1]]
        const workerTypes = event.params.slice(3)

        const endFadeOutP = lerp(event.animData.start, event.animData.end, 0.2)

        this.freezeWorkerStateAtTime(buildingFrom, event.animData.start)
        for (const workerType of workerTypes) {
          this.removeFirstWorkerOfTypeAtTime(buildingFrom, workerType, endFadeOutP)
        }
        this.freezeWorkerStateAtTime(buildingTo, lerp(event.animData.start, event.animData.end, 0.8))
        for (const workerType of workerTypes) {
          this.addWorkerOfTypeAtTime(buildingTo, workerType, event.animData.end)
        }
      }

      if (event.type === ev.NEW_TELEPORTER) {
        const buildingFrom = frameData.buildingById[event.params[0]]
        const buildingTo = frameData.buildingById[event.params[1]]
        buildingFrom.hasTeleporter = true
        buildingTo.hasTeleporter = true
        buildingFrom.isTeleporterEntrance = true
        buildingTo.isTeleporterEntrance = false
        const buildings: BuildingPairDto = [buildingFrom.id, buildingTo.id]
        this.globalData.teleporters.push({ buildings, arrows: null})
        currentCity.teleporters = [...currentCity.teleporters, { buildings }]
      }
    }

    for (const buildingId in firstTeleportTimeByBuildingId) {
      const building = frameData.buildingById[+buildingId]
      const teleportTime = firstTeleportTimeByBuildingId[building.id]
      this.freezeWorkerStateAtTime(building, teleportTime)
    }

    frameData.previous = last(this.states) ?? frameData


    this.states.push(frameData)
    return frameData
  }

  isSameProgress(a: number, b: number): boolean {
    const EPSILON = 0.0000001
    return Math.abs(a - b) < EPSILON
  }

  freezeWorkerStateAtTime(building: BuildingDto, progress: number) {
    for (const buildingHistory of building.workerHistory) {

      if (this.isSameProgress(buildingHistory.p, progress)) {
        return
      }
    }

    const lastHistoryBeforeAddition = building.workerHistory.findLast(h => h.p < progress)
    if (lastHistoryBeforeAddition != null) {
      const newHistory = {
        ...lastHistoryBeforeAddition,
        workers: [...lastHistoryBeforeAddition.workers],
        p: progress
      }
      building.workerHistory.push(newHistory)
    } else {
      building.workerHistory.push({ workers: [], p: progress })
    }
    building.workerHistory = building.workerHistory.sort((a, b) => a.p - b.p)

  }
  addWorkerOfTypeAtTime(building: BuildingDto, workerType: number, progress: number) {
    if (building.buildingType === workerType) {
      building.settledWorkers += 1
      // NOTE: this disables display of workers when they are on their target building
      return
    }

    let isExactProgress = false
    for (const buildingHistory of building.workerHistory) {
      if (this.isSameProgress(buildingHistory.p, progress)) {
        isExactProgress = true
        buildingHistory.workers.push(workerType)
      } else if (buildingHistory.p >= progress) {
        buildingHistory.workers.push(workerType)
      }
    }
    if (!isExactProgress) {
      const lastHistoryBeforeAddition = building.workerHistory.findLast(h => h.p < progress)
      if (lastHistoryBeforeAddition != null) {
        const newHistory = {
          ...lastHistoryBeforeAddition,
          workers: [...lastHistoryBeforeAddition.workers, workerType],
          p: progress
        }
        building.workerHistory.push(newHistory)
      } else {
        building.workerHistory.push({ workers: [workerType], p: progress })
      }
    }
    building.workerHistory = building.workerHistory.sort((a, b) => a.p - b.p)
  }

  removeFirstWorkerOfTypeAtTime(building: BuildingDto, workerType: number, progress: number) {
    let isExactProgress = false
    for (const buildingHistory of building.workerHistory) {
      if (this.isSameProgress(buildingHistory.p, progress)) {
        isExactProgress = true
        buildingHistory.workers = this.removeFirstWorkerOfType(buildingHistory.workers, workerType)
      } else if (buildingHistory.p >= progress) {
        buildingHistory.workers = this.removeFirstWorkerOfType(buildingHistory.workers, workerType)
      }
    }
    if (!isExactProgress) {
      const lastHistoryBeforeRemoval = building.workerHistory.findLast(h => h.p < progress)
      if (lastHistoryBeforeRemoval != null) {
        const newHistory = {
          ...lastHistoryBeforeRemoval,
          workers: this.removeFirstWorkerOfType(lastHistoryBeforeRemoval.workers, workerType),
          p: progress
        }
        building.workerHistory.push(newHistory)
      }
    }
    building.workerHistory = building.workerHistory.sort((a, b) => a.p - b.p)
  }

  removeFirstWorkerOfType(workers: number[], workerType: number) {
    const workersCopy = [...workers]
    workersCopy.splice(workersCopy.findIndex(w => w === workerType), 1)
    return workersCopy
  }


  toGlobal (element: PIXI.DisplayObject) {
    return this.container.toLocal(new PIXI.Point(0, 0), element)
  }
}

