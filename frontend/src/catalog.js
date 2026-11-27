const assets = import.meta.glob('../assets/*.webp', { eager: true, query: '?url', import: 'default' });

export const asset = (name) => assets[`../assets/${name}.webp`];
export const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

function product(data) {
  const { id, code, brand, name, description, type, detail, detailLabel, price, photos } = data;
  return {
    id, code, brand, name, description, type, detail, detailLabel, price,
    photos: photos.map((number) => asset(`${id}-${number}`)),
  };
}

export const gift = product({
  id: 'eva', code: '919141', brand: 'Eva Mosaic', name: 'Cherry Lip Balm',
  type: 'Бальзам для губ', detail: '11 мл', detailLabel: 'Объём',
  description: 'Ухаживающий бальзам для губ с ароматом черешни. Этот бальзам выбран в качестве подарка для демонстрационного сценария.',
  price: 0, photos: [1, 2],
});

export const selection = [
  product({
    id: 'holika', code: '1010332', brand: 'Holika Holika', name: 'Holipop Water Tint',
    type: 'Тинт для губ', detail: 'Оттенок 3, 9 мл', detailLabel: 'Оттенок и объём',
    description: 'Жидкий тинт для губ с аппликатором. В подборке представлен оттенок 3.',
    price: 459, photos: [1, 2, 3],
  }),
  product({
    id: 'influence', code: '970583', brand: 'Influence Beauty', name: 'Lunar Highlighter',
    type: 'Хайлайтер', detail: '4,8 г', detailLabel: 'Вес',
    description: 'Компактный хайлайтер с сияющими частицами. Нанесите на выступающие участки лица для деликатного сияния.',
    price: 509, photos: [1, 2, 3],
  }),
  product({
    id: 'tangle', code: '947453', brand: 'Tangle Teezer', name: 'The Wet Detangler',
    type: 'Расчёска для волос', detail: 'Millennial Pink', detailLabel: 'Цвет',
    description: 'Расчёска с ручкой для распутывания сухих и влажных волос в розовом оттенке Millennial Pink.',
    price: 1683, photos: [2, 1],
  }),
  product({
    id: 'celimax', code: '1112798', brand: 'Celimax', name: 'Dual Barrier Creamy Toner',
    type: 'Кремовый тонер', detail: '150 мл', detailLabel: 'Объём',
    description: 'Кремовый тонер с комплексом церамидов для ухода за сухой и чувствительной кожей.',
    price: 1355, photos: [1, 2, 3],
  }),
];
