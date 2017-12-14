import { Config, ICommand } from 'cli-engine-config'
import * as path from 'path'

const debug = require('debug')('cli:hooks')

export type PreRunOptions = {
  Command: ICommand
  argv: string[]
}

export class Hooks {
  config: Config

  constructor(config: Config) {
    this.config = config
  }

  async run(event: string, options: Object = {}) {
    let scripts = this.config.hooks[event]
    if (!scripts) return
    for (let script of scripts) {
      script = path.join(this.config.root, script)
      debug(`%s %s`, event, script)
      const m = require(script)
      await m(this.config, options)
    }
  }
}
