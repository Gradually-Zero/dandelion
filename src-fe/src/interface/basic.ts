export interface Position {
  start: number
  end: number
}

export interface AttributeContent {
  name: string
  value?: string
}

export interface Stop {
  start: number
  end: number
  source: string
}

export interface ReferenceKind {
  // 表示引用的类型
  type: string
}

export enum AlignKind {
  // 左对齐
  Left = 'left',
  // 右对齐
  Right = 'right',
  // 居中对齐
  Center = 'center',
  // 无对齐
  None = 'none'
}
