export interface Position {
  start: number;
  end: number;
}

export interface AttributeContent {
  name: string;
  value?: string;
}

export interface Stop {
  start: number;
  end: number;
  source: string;
}

export interface ReferenceKind {
  // 表示引用的类型
  type: string;
}

export type AlignKind = 'left' | 'right' | 'center' | 'none';
