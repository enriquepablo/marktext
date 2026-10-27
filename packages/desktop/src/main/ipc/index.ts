import { registerBootInfo } from './bootInfo'
import { registerFsHandlers } from './fs'
import { registerPathHandlers } from './paths'
import { registerRipgrepHandlers } from './ripgrep'
import { registerUploaderHandlers } from './uploader'
import { registerFontsHandlers } from './fonts'
import { registerShellHandlers } from './shell'
import { registerWindowHandlers } from './window'
import { registerCmdHandlers } from './cmd'
import { registerI18nHandlers } from './i18n'
import { registerDialogHandlers } from './dialog'
import { registerDiagramHandlers } from './diagram'
import { registerLinkHtmlHandler } from './linkHtml'
import { registerCazallaSiteHandlers } from '@cazalla/main/sites'
import { registerCazallaTerminalHandlers } from '@cazalla/main/terminal'
import { registerCazallaGitHandlers } from '@cazalla/main/git'
import { registerCazallaDevtoolsHandlers } from '@cazalla/main/devtools'
import { registerCazallaFileHandlers } from '@cazalla/main/files'

export const registerSandboxIpcHandlers = (): void => {
  registerBootInfo()
  registerFsHandlers()
  registerPathHandlers()
  registerRipgrepHandlers()
  registerUploaderHandlers()
  registerFontsHandlers()
  registerShellHandlers()
  registerWindowHandlers()
  registerCmdHandlers()
  registerI18nHandlers()
  registerDialogHandlers()
  registerDiagramHandlers()
  registerLinkHtmlHandler()
  registerCazallaSiteHandlers()
  registerCazallaTerminalHandlers()
  registerCazallaGitHandlers()
  registerCazallaDevtoolsHandlers()
  registerCazallaFileHandlers()
}
