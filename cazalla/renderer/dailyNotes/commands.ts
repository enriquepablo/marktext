import bus from '@/bus'
import type { CommandDescriptor } from '@/commands'
import { TOGGLE_BUS_EVENT } from './store'

export const DAILY_NOTES_COMMAND = 'view.toggle-daily-notes'

/** Command palette entries for the daily notes panel. Spread into the app's command list. */
export const dailyNotesCommands: CommandDescriptor[] = [
  {
    id: DAILY_NOTES_COMMAND,
    execute: async() => {
      bus.emit(TOGGLE_BUS_EVENT)
    }
  }
]
