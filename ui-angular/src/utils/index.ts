import type { MdastNode } from '../types/ast';

const CellPrefix = 'cell-';

export type TableDataRow = Record<string, string | undefined>;

export function getFirstTableData(ast: MdastNode) {
  const tableData: TableDataRow[] = [];

  if (ast.type !== 'root') {
    return tableData;
  }

  const table = ast.children.find((child) => child.type === 'table');
  const tableRows = table?.children ?? [];

  for (const [rowIndex, tableRow] of tableRows.entries()) {
    if (rowIndex === 0) {
      continue;
    }

    if (tableRow.type !== 'tableRow') {
      continue;
    }

    const rowData: TableDataRow = {
      rowIndex: rowIndex.toString(),
    };

    for (const [cellIndex, tableCell] of tableRow.children.entries()) {
      if (tableCell.type !== 'tableCell') {
        continue;
      }

      const firstCellChild = tableCell.children[0];
      if (!firstCellChild) {
        continue;
      }

      if ('value' in firstCellChild) {
        rowData[CellPrefix + cellIndex] = firstCellChild.value;
      } else if (firstCellChild.type === 'link') {
        const firstLinkChild = firstCellChild.children[0];
        rowData[CellPrefix + cellIndex] =
          firstLinkChild && 'value' in firstLinkChild ? firstLinkChild.value : undefined;
      } else {
        rowData[CellPrefix + cellIndex] = undefined;
      }
    }

    tableData.push(rowData);
  }

  return tableData;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return JSON.stringify(error);
}
