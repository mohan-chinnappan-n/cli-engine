import assync from 'assync'
import { ICommand } from 'cli-engine-config'
import * as path from 'path'
import deps from '../deps'
import { IPluginManagerOptions, PluginManager } from './manager'
import { PluginManifest } from './manifest'
import { ITopics, Topic } from './topic'

export type PluginType = 'builtin' | 'core' | 'user' | 'link'
export type PluginOptions = IPluginManagerOptions & {
  root: string
  type: PluginType
  manifest: PluginManifest
  pjson: IPluginPJSON
}

export interface IPluginPJSON {
  name: string
  version: string
  main?: string
  scripts?: { [k: string]: string }
  'cli-engine': {
    commandsDir?: string
    aliases?: { [k: string]: string | string[] }
  }
}

export interface IPluginTopic {
  name: string
  description?: string
  hidden?: boolean
}

export interface IPluginModule {
  commands: ICommand[]
  topic?: IPluginTopic
  topics: IPluginTopic[]
}

export abstract class Plugin extends PluginManager {
  public name: string
  public version: string
  public abstract type: PluginType
  public root: string
  public tag?: string
  public pjson: IPluginPJSON
  private _module: Promise<IPluginModule | undefined>

  constructor(options: PluginOptions) {
    super(options)
    this.pjson = options.pjson
    if (!this.pjson['cli-engine']) this.pjson['cli-engine'] = {}
    this.name = this.pjson.name
    this.version = this.pjson.version
    this.root = options.root
    this.cacheKey = [this.name, options.type, this.version].join(':')
    this.debug = require('debug')(`cli:plugins:${this.cacheKey}`)
  }

  protected async _refresh() {
    await this.resetCache()
  }

  protected async _needsRefresh() {
    return !await this.cache.get(this.cacheKey, 'topics')
  }

  protected async _commandIDs() {
    let ids = await assync<any>([this.commandIDsFromDir(), this.fetchCommandIDsFromModule()]).flatMap<string>()
    if (!ids.length) throw new Error(`${this.name} has no IDs`)
    return ids
  }

  protected async _aliases() {
    return deps.util.objValsToArrays(this.pjson['cli-engine'].aliases)
  }

  protected async _findCommand(id: string): Promise<ICommand | undefined> {
    let cmd = await this.findCommandInModule(id)
    if (!cmd) cmd = await this.findCommandInDir(id)
    if (cmd) {
      cmd = this.addPluginToCommand(cmd)
      return cmd
    }
  }

  protected addPluginToCommand(cmd: ICommand): ICommand {
    cmd.plugin = {
      type: this.type,
      root: this.root,
      name: this.name,
      version: this.version,
    }
    return cmd
  }

  protected async _topics() {
    return Topic.mergeSubtopics(await this.fetchTopicsFromModule())
  }

  protected async resetCache() {
    await this.cache.reset(this.cacheKey)
  }

  private async findCommandInModule(id: string) {
    const m = await this.fetchModule()
    if (!m) return
    return m.commands.find(c => c.id === id)
  }

  private async findCommandInDir(id: string) {
    const dir = this.commandsDir
    if (!dir) return
    let p
    try {
      p = this.commandPath(id)
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') return
      throw err
    }
    if (!await deps.file.exists(p)) return
    return this.require(p, id)
  }

  private commandPath(id: string): string {
    if (!this.commandsDir) throw new Error('commandsDir not set')
    return require.resolve(path.join(this.commandsDir, id.split(':').join(path.sep)))
  }

  private async fetchModule(): Promise<IPluginModule | undefined> {
    if (this._module) return this._module
    return (this._module = (async () => {
      if (!this.pjson.main) return
      this.debug(`requiring ${this.name}@${this.version}`)

      const m: IPluginModule = {
        commands: [],
        topics: [],
        ...require(path.join(this.root, this.pjson.main!)),
      }

      if (m.topic) m.topics.push(m.topic)
      m.commands = m.commands.map(deps.util.undefault)

      const hooks = new deps.Hooks(this.config)
      await hooks.run('plugins:parse', { module: m, pjson: this.pjson })

      let legacy = new deps.PluginLegacy(this.config)

      return legacy.convert(m)
    })())
  }

  private async fetchCommandIDsFromModule(): Promise<string[]> {
    const m = await this.fetchModule()
    if (!m) return []
    return m.commands.map(m => m.id)
  }

  private async fetchTopicsFromModule(): Promise<ITopics> {
    const m = await this.fetchModule()
    if (!m) return {}
    return m.topics.reduce(
      (topics, t) => {
        topics[t.name] = new Topic(t)
        return topics
      },
      {} as ITopics,
    )
  }

  private commandIDsFromDir(): Promise<string[]> {
    const d = this.commandsDir
    if (!d) return Promise.resolve([])
    return new Promise((resolve, reject) => {
      let ids: string[] = []
      deps
        .klaw(d, { depthLimit: 10 })
        .on('data', f => {
          if (!f.stats.isDirectory() && f.path.endsWith('.js') && !f.path.endsWith('.test.js')) {
            let parsed = path.parse(f.path)
            let p = path.relative(d, path.join(parsed.dir, parsed.name))
            ids.push(p.split(path.sep).join(':'))
          }
        })
        .on('error', reject)
        .on('end', () => resolve(ids))
    })
  }

  private get commandsDir(): string | undefined {
    let d = this.pjson['cli-engine'].commandsDir
    if (d) return path.join(this.root, d)
  }
}
