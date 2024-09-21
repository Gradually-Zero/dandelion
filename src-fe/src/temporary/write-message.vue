<template>
  <table>
    <thead>
      <tr>
        <th></th>
        <th v-for="col in cols" :key="col">{{ col }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, rowIndex) in cells" :key="rowIndex">
        <th>{{ rowIndex }}</th>
        <td v-for="(cell, colIndex) in row" :key="colIndex">
          <div class="cell" :title="cell" @click="editCell(rowIndex, colIndex)">
            <input
              v-if="editingCell === `${rowIndex}-${colIndex}`"
              v-model="cells[rowIndex][colIndex]"
              @blur="saveCell"
            />
            <span v-else>{{ evalCell(cell) }}</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const COLS = 5
const ROWS = 20

const cells = reactive(
  Array.from(Array(ROWS).keys()).map(() => Array.from(Array(COLS).keys()).map(() => ''))
)

function evalCell(exp) {
  if (!exp.startsWith('=')) {
    return exp
  }

  exp = exp
    .slice(1)
    .replace(/\b([A-Z])(\d{1,2})\b/g, (_, c, r) => `get(${c.charCodeAt(0) - 65},${r})`)

  try {
    return new Function('get', `return ${exp}`)(getCellValue)
  } catch (e) {
    return `#ERROR ${e}`
  }
}

function getCellValue(c, r) {
  const val = evalCell(cells[c][r])
  const num = Number(val)
  return Number.isFinite(num) ? num : val
}

const cols = Array.from(Array(COLS).keys()).map((_, i) => String.fromCharCode(65 + i))
const editingCell = ref(null)

function editCell(rowIndex, colIndex) {
  if (editingCell.value !== `${rowIndex}-${colIndex}`) {
    editingCell.value = `${rowIndex}-${colIndex}`
    setTimeout(() => {
      const input = document.querySelector('.cell input')
      input && input.focus()
    }, 0)
  }
}

function saveCell() {
  editingCell.value = null
}
</script>

<style scoped>
table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
}

th {
  background-color: #eee;
}

tr:first-of-type th {
  width: 100px;
}

tr:first-of-type th:first-of-type {
  width: 25px;
}

td {
  border: 1px solid #ccc;
  height: 1.5em;
  overflow: hidden;
}

.cell,
.cell input {
  height: 1.5em;
  line-height: 1.5;
  font-size: 15px;
}

.cell span {
  padding: 0 6px;
}

.cell input {
  width: 100%;
  box-sizing: border-box;
}
</style>
