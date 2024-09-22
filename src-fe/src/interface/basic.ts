interface Position {
  start: number
  end: number
}

interface AttributeContent {
  name: string
  value?: string
}

interface Stop {
  start: number
  end: number
  source: string
}

interface ReferenceKind {
  // 表示引用的类型
  type: string
}

enum AlignKind {
  // 左对齐
  Left = 'left',
  // 右对齐
  Right = 'right',
  // 居中对齐
  Center = 'center',
  // 无对齐
  None = 'none'
}
