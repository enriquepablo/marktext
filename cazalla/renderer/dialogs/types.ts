// `combo` is a select that also accepts a typed value; `time` is `HH:mm`.
export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'combo' | 'multiselect' | 'checkbox'

export interface Option {
  value: string
  label: string
}

export type Values = Record<string, unknown>

export interface FieldSpec {
  key: string
  label: string
  type: FieldType
  required?: boolean
  default?: unknown
  placeholder?: string
  // Choices for select and multiselect, read when the dialog opens.
  options?: () => Option[]
  // Hides the field unless the predicate holds for the current values.
  when?: (values: Values) => boolean
}

export interface DialogSpec {
  title: string
  fields: FieldSpec[]
  // Returns an error message to show, or nothing when the dialog may close.
  submit: (values: Values) => Promise<string | void>
}

export const DIALOG_EVENT = 'cazalla:dialog'
