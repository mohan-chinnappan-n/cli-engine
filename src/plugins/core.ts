import * as path from 'path'

import Config from '../config'

import { IPluginPJSON, Plugin, PluginType } from './plugin'

export class CorePlugins {
  public plugins: CorePlugin[]

  constructor(private config: Config) {}

  public async submanagers(): Promise<CorePlugin[]> {
    await this.init()
    return this.plugins
  }

  public async init(): Promise<void> {
    if (this.plugins || !this.config.root) return
    this.plugins = this.config.corePlugins.map(
      name =>
        new CorePlugin({
          root: path.join(this.config.root!, 'node_modules', name),
          config: this.config,
          type: 'core',
        }),
    )
  }
}

export class CorePlugin extends Plugin {
  public type: PluginType = 'core'
  public pjson: IPluginPJSON
}
