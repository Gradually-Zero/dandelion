const CellPrefix = 'cell-'

export function getFirstTableData(ast: MdastNode) {
  const tableData = []
  const tableHeader = []
  if (ast.type === 'root') {
    const astc = ast.children
    const table = astc.find((child) => child.type === 'table')
    const tablec = table?.children ?? []
    for (const [rowIndex, tableRow] of tablec.entries()) {
      if (rowIndex === 0) {
        // console.log('tableRow', tableRow)
        // 过滤表头
        continue
      }
      if (tableRow.type === 'tableRow') {
        const tableRowc = tableRow.children
        const rowData: Record<string, string | undefined> = {
          rowIndex: rowIndex.toString()
        }

        for (const [cellIndex, tableCell] of tableRowc.entries()) {
          if (tableCell.type === 'tableCell') {
            const tableCellc = tableCell.children[0]
            if (tableCellc) {
              if ('value' in tableCellc) {
                const cellv = tableCellc.value
                rowData[CellPrefix + cellIndex] = cellv
              } else if (tableCellc.type === 'link') {
                const linkc = tableCellc.children[0]
                if ('value' in linkc) {
                  const linkv = linkc.value
                  rowData[CellPrefix + cellIndex] = linkv
                }
              } else {
                rowData[CellPrefix + cellIndex] = undefined
              }
            }
          }
        }
        tableData.push(rowData)
      }
    }
  }
  return tableData
}
