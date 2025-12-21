// Тестовый файл для проверки парсера таблиц
const testTable = `| Имя | Возраст | Город |
|------|---------|-------|
| Иван | 25     | Москва |
| Мария | 30    | СПб   |`;

console.log('Тестовая таблица:');
console.log(testTable);
console.log('');

// Функция парсинга строки таблицы
function parseTableRow(line) {
  return line.split('|').slice(1, -1).map(cell => cell.trim());
}

// Функция определения выравнивания
function parseTableAlignment(line) {
  return line.split('|').slice(1, -1).map(() => 'left');
}

console.log('Парсинг заголовка:', parseTableRow('| Имя | Возраст | Город |'));
console.log('Парсинг разделителя:', parseTableAlignment('|------|---------|-------|'));
console.log('Парсинг первой строки данных:', parseTableRow('| Иван | 25     | Москва |'));
console.log('Парсинг второй строки данных:', parseTableRow('| Мария | 30    | СПб   |'));
