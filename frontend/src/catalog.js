const assets = import.meta.glob('../assets/*.webp', { eager: true, query: '?url', import: 'default' });

export const asset = (name) => assets[`../assets/${name}.webp`];
export const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

function product(data) {
  const { id, code, brand, name, description, type, detail, price, slug, photos } = data;
  return {
    id, code, brand, name, description, type, detail, price,
    url: `https://rivegauche.ru/product/${slug}`,
    photos: photos.map((number) => asset(`${id}-${number}`)),
  };
}

export const gift = product({
  id: 'eva', code: '919141', brand: 'Eva Mosaic', name: 'Cherry Lip Balm',
  type: 'Бальзам для губ', detail: '11 мл',
  description: 'Ухаживающий бальзам для губ с ароматом черешни. Его можно получить в подарок по бумажному флаеру из кофейни.',
  price: 0, slug: 'eva-mosaic-cherry-lip-balm', photos: [1, 2],
});

export const selection = [
  product({
    id: 'holika', code: '1010332', brand: 'Holika Holika', name: 'Holipop Water Tint',
    type: 'Тинт для губ', detail: 'Оттенок 3, 9 мл',
    description: 'Жидкий тинт для губ с аппликатором. В подборке представлен оттенок 3.',
    price: 459, slug: 'holika-holika-holipop-water-tint-3', photos: [1, 2, 3],
  }),
  product({
    id: 'influence', code: '970583', brand: 'Influence Beauty', name: 'Lunar Highlighter',
    type: 'Хайлайтер', detail: '4,8 г',
    description: 'Компактный хайлайтер с сияющими частицами. Нанесите на выступающие участки лица для деликатного сияния.',
    price: 509, slug: 'influence-beauty-lunar-highlighter', photos: [1, 2, 3],
  }),
  product({
    id: 'tangle', code: '947453', brand: 'Tangle Teezer', name: 'The Wet Detangler',
    type: 'Расчёска для волос', detail: 'Millennial Pink',
    description: 'Расчёска с ручкой для распутывания сухих и влажных волос в розовом оттенке Millennial Pink.',
    price: 1683, slug: 'tangle-teezer-the-wet-detangler-millennial-pink-brush', photos: [2, 1],
  }),
  product({
    id: 'celimax', code: '1112798', brand: 'Celimax', name: 'Dual Barrier Creamy Toner',
    type: 'Кремовый тонер', detail: '150 мл',
    description: 'Кремовый тонер с комплексом церамидов для ухода за сухой и чувствительной кожей.',
    price: 1355, slug: 'celimax-dual-barrier-creamy-toner', photos: [1, 2, 3],
  }),
];
