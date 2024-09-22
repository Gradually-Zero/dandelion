// MdastNode 类型定义
type MdastNode =
  | Root
  | BlockQuote
  | FootnoteDefinition
  | MdxJsxFlowElement
  | List
  | MdxjsEsm
  | Toml
  | Yaml
  | Break
  | InlineCode
  | InlineMath
  | Delete
  | Emphasis
  | MdxTextExpression
  | FootnoteReference
  | Html
  | Image
  | ImageReference
  | MdxJsxTextElement
  | Link
  | LinkReference
  | Strong
  | Text
  | Code
  | Math
  | MdxFlowExpression
  | Heading
  | Table
  | ThematicBreak
  | TableRow
  | TableCell
  | ListItem
  | Definition
  | Paragraph

interface Root {
  type: 'root'
  children: MdastNode[]
  position?: Position
}

interface BlockQuote {
  type: 'blockQuote'
  children: MdastNode[]
  position?: Position
}

interface FootnoteDefinition {
  type: 'footnoteDefinition'
  children: MdastNode[]
  position?: Position
  // 关联信息
  identifier: string // 必需的标识符
  label?: string // 可选的标签
}

interface MdxJsxFlowElement {
  type: 'mdxJsxFlowElement'
  children: MdastNode[]
  position?: Position
  // JSX 元素
  name?: string // 可选的名称
  attributes: AttributeContent[] // 属性内容数组
}

interface List {
  type: 'list'
  children: MdastNode[]
  position?: Position
  // 额外信息
  ordered: boolean // 是否有序
  start?: number // 起始数字，unordered 时为 None
  spread: boolean // 是否有空行分隔
}

interface MdxjsEsm {
  type: 'mdxjsEsm'
  // 字面量内容
  value: string
  position?: Position
  // 自定义数据
  stops: Stop[] // 包含 Stop 类型的数组
}

interface Toml {
  type: 'toml'
  // 字面量内容
  value: string
  position?: Position
}

interface Yaml {
  type: 'yaml'
  // 字面量内容
  value: string
  position?: Position
}

interface Break {
  type: 'break'
  position?: Position
}

interface InlineCode {
  type: 'inlineCode'
  // 文本内容
  value: string
  position?: Position
}

interface InlineMath {
  type: 'inlineMath'
  // 文本内容
  value: string
  position?: Position
}

interface Delete {
  type: 'delete'
  children: MdastNode[]
  position?: Position
}

interface Emphasis {
  type: 'emphasis'
  children: MdastNode[]
  position?: Position
}

interface MdxTextExpression {
  type: 'mdxTextExpression'
  // 字面量内容
  value: string
  position?: Position
  // 自定义数据
  stops: Stop[] // 包含 Stop 类型的数组
}

interface FootnoteReference {
  type: 'footnoteReference'
  position?: Position
  // 关联信息
  identifier: string // 匹配节点的值
  label?: string // 可选标签
}

interface Html {
  type: 'html'
  // 文本内容
  value: string
  position?: Position
}

interface Image {
  type: 'image'
  position?: Position
  // 替代文本
  alt: string // 替代内容
  // 资源链接
  url: string // 引用的资源 URL
  // 提示信息
  title?: string // 可选标题
}

interface ImageReference {
  type: 'imageReference'
  position?: Position
  // 替代文本
  alt: string // 替代内容
  // 引用类型
  reference_kind: ReferenceKind // 引用的明确性
  // 匹配节点的值
  identifier: string // 标识符
  // 标签
  label?: string // 可选标签
}

interface MdxJsxTextElement {
  type: 'mdxJsxTextElement'
  children: MdastNode[]
  position?: Position
  // JSX 元素名称
  name?: string // 可选名称
  // 属性
  attributes: AttributeContent[] // 包含 AttributeContent 类型的数组
}

interface Link {
  type: 'link'
  children: MdastNode[]
  position?: Position
  // 资源链接
  url: string // 引用的资源 URL
  // 提示信息
  title?: string // 可选标题
}

interface LinkReference {
  type: 'linkReference'
  children: MdastNode[]
  position?: Position
  // 引用类型
  reference_kind: ReferenceKind // 引用的明确性
  // 匹配节点的值
  identifier: string // 标识符
  // 标签
  label?: string // 可选标签
}

interface Strong {
  type: 'strong'
  children: MdastNode[]
  position?: Position
}

interface Text {
  type: 'text'
  // 文本内容
  value: string
  position?: Position
}

interface Code {
  type: 'code'
  value: string // 文本内容
  position?: Position
  // 额外信息
  lang?: string // 可选编程语言
  meta?: string // 可选自定义信息
}

interface Math {
  type: 'math'
  value: string // 文本内容
  position?: Position
  // 额外信息
  meta?: string // 可选自定义信息
}

interface MdxFlowExpression {
  type: 'mdxFlowExpression'
  value: string // 文本内容
  position?: Position
  // 自定义数据
  stops: Stop[] // 包含 Stop 类型的数组
}

interface Heading {
  type: 'heading'
  children: MdastNode[]
  position?: Position
  // 额外信息
  depth: number // 介于 1 和 6 之间的深度
}

interface Table {
  type: 'table'
  children: MdastNode[]
  position?: Position
  // 额外信息
  align: AlignKind[] // 包含 AlignKind 类型的数组
}

interface ThematicBreak {
  type: 'thematicBreak'
  position?: Position
}

interface TableRow {
  type: 'tableRow'
  children: MdastNode[]
  position?: Position
}

interface TableCell {
  type: 'tableCell'
  children: MdastNode[]
  position?: Position
}

interface ListItem {
  type: 'listItem'
  children: MdastNode[]
  position?: Position
  // 额外信息
  spread: boolean // 是否存在空行
  checked?: boolean | null // 是否完成 (true, false 或 null)
}

interface Definition {
  type: 'definition'
  position?: Position
  // 资源
  url: string // 资源的 URL
  title?: string // 可选的资源说明
  // 关联信息
  identifier: string // 匹配节点的标识符
  label?: string // 可选的标签
}

interface Paragraph {
  type: 'paragraph'
  children: MdastNode[]
  position?: Position
}
