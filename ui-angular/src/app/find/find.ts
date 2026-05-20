import { TableModule } from 'primeng/table';
import { FormsModule } from '@angular/forms';
import { invoke } from '@tauri-apps/api/core';
import { FilterMatchMode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { listen } from '@tauri-apps/api/event';
import { ToolbarModule } from 'primeng/toolbar';
import { MessageModule } from 'primeng/message';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ClearableInputText } from './clearable-input-text/clearable-input-text';
import { getErrorMessage, getFirstTableData, TableDataRow } from '../../utils';
import type { MdastNode } from '../../types/ast';

type FindColumnField = 'index' | 'cell-0' | 'cell-1' | 'cell-2' | 'cell-3';

type FindTableRow = Record<string, string | number | undefined> & {
  index: number;
};

type TextFilter = {
  value: string | null;
  matchMode: string;
};

type FindTableFilters = Record<FindColumnField | 'global', TextFilter>;

type FindTableTotals = {
  total: number;
  count: number;
};

interface FindColumn {
  field: FindColumnField;
  header: string;
  className: string;
}

@Component({
  selector: 'app-find',
  imports: [
    FormsModule,
    ButtonModule,
    MessageModule,
    TableModule,
    ToolbarModule,
    ClearableInputText,
  ],
  templateUrl: './find.html',
})
export default class Find implements OnInit, OnDestroy {
  private unlistenSelectedChange?: () => void;

  protected readonly globalFilterFields: FindColumnField[] = [
    'index',
    'cell-0',
    'cell-1',
    'cell-2',
    'cell-3',
  ];

  protected readonly columns: FindColumn[] = [
    { field: 'index', header: '#', className: 'min-w-37.5 w-37.5' },
    { field: 'cell-0', header: 'Column 1', className: 'min-w-37.5 w-37.5' },
    { field: 'cell-1', header: 'Column 2', className: 'min-w-37.5 w-37.5' },
    { field: 'cell-2', header: 'Column 3', className: 'min-w-37.5 w-37.5' },
    { field: 'cell-3', header: 'Column 4', className: 'whitespace-nowrap' },
  ];

  protected readonly virtualScrollerOptions = { itemSize: 44 };
  protected readonly tablePassThrough = { tableContainer: 'h-full' };
  protected readonly filters = signal<FindTableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    index: { value: null, matchMode: FilterMatchMode.CONTAINS },
    'cell-0': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'cell-1': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'cell-2': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'cell-3': { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  protected readonly tableData = signal<TableDataRow[]>([]);
  protected readonly filteredRows = signal<FindTableRow[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly isLoading = signal(false);

  protected readonly tableRows = computed<FindTableRow[]>(() => {
    return this.tableData().map((row, index) => ({ index: index + 1, ...row }));
  });

  protected readonly hasActiveFilter = computed(() => {
    return Object.values(this.filters()).some((filter) => Boolean(filter.value?.trim()));
  });

  protected readonly totalForCell1 = computed<FindTableTotals>(() => {
    if (!this.hasActiveFilter()) {
      return { total: 0, count: 0 };
    }

    return this.filteredRows().reduce(
      (result, row) => {
        const value = parseFloat(String(row['cell-1'] ?? '0'));
        if (!Number.isNaN(value)) {
          result.total += value;
          result.count += 1;
        }

        return result;
      },
      { total: 0, count: 0 },
    );
  });

  async ngOnInit() {
    this.unlistenSelectedChange = await listen<string>('selected-change', async (event) => {
      await this.refreshFromSelection(event.payload);
    });
    await this.refreshFromSelection();
  }

  ngOnDestroy() {
    this.unlistenSelectedChange?.();
  }

  protected async parseMd() {
    try {
      this.isLoading.set(true);
      this.errorMessage.set('');
      const markdownAst = await invoke<string>('get_markdown_ast');
      const ast = JSON.parse(markdownAst) as MdastNode;
      this.tableData.set(getFirstTableData(ast));
      this.applyFilters();
    } catch (error) {
      this.tableData.set([]);
      this.filteredRows.set([]);
      this.errorMessage.set('解析失败: ' + getErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  protected setFilter(field: keyof FindTableFilters, value: string | null) {
    this.filters.update((filters) => ({
      ...filters,
      [field]: {
        ...filters[field],
        value,
      },
    }));
    this.applyFilters();
  }

  protected trackByIndex(_: number, row: FindTableRow) {
    return row.index;
  }

  private clearTableState() {
    this.tableData.set([]);
    this.filteredRows.set([]);
    this.errorMessage.set('');
  }

  private async refreshFromSelection(selectedFilePath?: string) {
    if (selectedFilePath !== undefined && !selectedFilePath) {
      this.clearTableState();
      return;
    }

    try {
      const currentSelectedFile = selectedFilePath ?? (await invoke<string>('get_selected_file'));
      if (!currentSelectedFile) {
        this.clearTableState();
        return;
      }
    } catch (error) {
      this.clearTableState();
      this.errorMessage.set('解析失败: ' + getErrorMessage(error));
      return;
    }

    await this.parseMd();
  }

  private applyFilters() {
    const rows = this.tableRows();
    this.filteredRows.set(rows.filter((row) => this.matchesFilters(row)));
  }

  private matchesFilters(row: FindTableRow) {
    const filters = this.filters();
    const globalFilter = this.normalizeFilterValue(filters.global.value);
    if (
      globalFilter &&
      !this.globalFilterFields.some((field) => this.matchesTextFilter(row[field], globalFilter))
    ) {
      return false;
    }

    return this.columns.every((column) => {
      const filterValue = this.normalizeFilterValue(filters[column.field].value);
      return !filterValue || this.matchesTextFilter(row[column.field], filterValue);
    });
  }

  private normalizeFilterValue(value: string | null) {
    return value?.trim().toLocaleLowerCase() ?? '';
  }

  private matchesTextFilter(value: string | number | undefined, filterValue: string) {
    if (value === undefined || value === null) {
      return false;
    }

    return String(value).toLocaleLowerCase().includes(filterValue);
  }
}
