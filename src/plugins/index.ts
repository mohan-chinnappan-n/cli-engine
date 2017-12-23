import { IConfig } from 'cli-engine-config'
import * as path from 'path'
import _ from 'ts-lodash'
import deps from '../deps'
import { Builtin } from './builtin'
import { CorePlugins } from './core'
import { LinkPlugins } from './link'
import { Plugin, PluginType } from './plugin'
import { UserPlugins } from './user'

export type InstallOptions = ILinkInstallOptions | IUserInstallOptions
export interface IUserInstallOptions {
  type: 'user'
  name: string
  tag: string
  force?: boolean
}
export interface ILinkInstallOptions {
  type: 'link'
  root: string
  force?: boolean
}

export class Plugins {
  public builtin: Builtin
  public core: CorePlugins
  public user: UserPlugins
  public link: LinkPlugins
  protected debug = require('debug')('cli:plugins')
  private plugins: Plugin[]

  constructor(private config: IConfig) {
    this.core = new CorePlugins(this.config)
    this.user = new UserPlugins(this.config)
    this.link = new LinkPlugins(this.config)
  }

  public async submanagers() {
    return [this.link, this.user, this.core]
  }

  public async install(options: InstallOptions) {
    await this.init()
    let name = options.type === 'user' ? options.name : await this.getLinkedPackageName(options.root)
    if (!options.force && (await this.pluginType(name))) {
      throw new Error(`${name} is already installed, run with --force to install anyway`)
    }
    if (options.type === 'link') {
      await this.link.install(options.root)
    } else {
      await this.user.install(name, options.tag)
    }
  }

  public async update(): Promise<void> {
    await this.user.update()
  }

  public async uninstall(name: string): Promise<void> {
    const type = await this.pluginType(name)
    if (!type) {
      const linked = await this.link.findByRoot(name)
      if (linked) {
        name = linked.name
      } else throw new Error(`${name} is not installed`)
    }
    if (type === 'user') await this.user.uninstall(name)
  }

  public async list() {
    await this.init()
    return this.plugins
  }

  private async init() {
    if (this.plugins) return
    const managers = _.compact([this.link, this.user, this.core])
    await Promise.all(managers.map(m => m.init()))
    const plugins = managers.reduce((o, i) => o.concat(i.plugins), [] as Plugin[])
    this.plugins = _.compact([...plugins, this.builtin])
    await await this.plugins.map(p => p.load())
  }

  private async getLinkedPackageName(root: string): Promise<string> {
    const pjson = await deps.file.fetchJSONFile(path.join(root, 'package.json'))
    return pjson.name
  }

  private pluginType(name: string): PluginType | undefined {
    const plugin = this.plugins.find(p => p.name === name)
    return plugin && plugin.type
  }
}
