import deps from '../deps'
import { Plugin, PluginType, PluginOptions, PluginPJSON } from './plugin'
import { PluginManager } from './manager'
import * as path from 'path'

export class CorePlugins extends PluginManager {
  public plugins: CorePlugin[]

  protected async _init() {
    this.plugins = this.submanagers = await Promise.all(this.config.corePlugins.map(name => this.initPlugin(name)))
  }

  private async initPlugin(name: string) {
    const pjson = await deps.file.fetchJSONFile(path.join(this.root(name), 'package.json'))
    return new CorePlugin({
      name,
      type: 'core',
      config: this.config,
      cache: this.cache,
      manifest: this.manifest,
      root: this.root(name),
      version: pjson.version,
      pjson,
    })
  }

  private root(name: string): string {
    return path.join(this.config.root, 'node_modules', name)
  }
}

export class CorePlugin extends Plugin {
  public type: PluginType = 'core'
  public pjson: PluginPJSON

  constructor(options: PluginOptions & { pjson: PluginPJSON }) {
    super(options)
  }
}
