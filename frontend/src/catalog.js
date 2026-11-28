const assets = import.meta.glob('../assets/*.webp', { eager: true, query: '?url', import: 'default' });

export const asset = (name) => assets[`../assets/${name}.webp`];
export const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

function product(data) {
  const { id, photos, ...details } = data;
  return {
    id, ...details,
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
    id: 'luxvisage', code: '996101', brand: 'Luxvisage', name: 'CC Cream Active Complex SPF\u00a010',
    type: 'Тональный CC-крем', detail: '20 Beige, 35 г', detailLabel: 'Оттенок и вес',
    description: 'Корректирующий CC-крем выравнивает тон, помогает скрыть покраснения и даёт естественный полуматовый финиш.',
    price: 234, competitorPrice: 300, photos: [1, 2],
  }),
  product({
    id: 'universum', brand: 'Influence Beauty', name: 'Universum Stick 3-in-1',
    type: 'Стик для лица, глаз и губ', detail: '03 Taup, 5,5 г', detailLabel: 'Оттенок и вес',
    description: 'Кремовый стик для макияжа лица, глаз и губ. Серо-коричневый оттенок 03 подходит для мягкого контуринга.',
    price: 372, competitorPrice: 410, photos: [1, 2, 3],
  }),
  product({
    id: 'holika', code: '1010332', brand: 'Holika Holika', name: 'Holipop Water Tint',
    type: 'Тинт для губ', detail: 'Оттенок 3, 9 мл', detailLabel: 'Оттенок и объём',
    description: 'Жидкий тинт для губ с аппликатором. В подборке представлен оттенок 3.',
    price: 459, competitorPrice: 665, photos: [1, 2, 3],
  }),
  product({
    id: 'loreal', code: '817517', brand: 'L’Oréal Paris', name: 'Volume Million Lashes Feline Noir',
    type: 'Тушь для ресниц', detail: 'Ультрачёрный, 9,2 мл', detailLabel: 'Оттенок и объём',
    description: 'Ультрачёрная тушь с изогнутой щёточкой, которая придаёт ресницам объём и разделяет их при нанесении.',
    price: 669, competitorPrice: 799, photos: [1, 2],
  }),
  product({
    id: 'the-act-hand', code: '1056606', brand: 'The Act', name: 'Hand Cream',
    type: 'Ламеллярный крем для рук', detail: '65 мл', detailLabel: 'Объём',
    description: 'Питательный ламеллярный крем с маслами для ухода за сухой кожей рук.',
    price: 445, competitorPrice: 498, photos: [1],
  }),
  product({
    id: 'the-act-extra', code: '1069208', brand: 'The Act', name: 'Extra Hair Oil Serum',
    type: 'Масло-сыворотка для волос', detail: '50 мл', detailLabel: 'Объём',
    description: 'Масло для ослабленных и повреждённых волос, в том числе после окрашивания и укладки. Наносится по длине.',
    price: 624, competitorPrice: 762, photos: [1, 2],
  }),
  product({
    id: 'influence', code: '970583', brand: 'Influence Beauty', name: 'Lunar Highlighter',
    type: 'Хайлайтер', detail: '4,8 г', detailLabel: 'Вес',
    description: 'Компактный хайлайтер с сияющими частицами. Нанесите на выступающие участки лица для деликатного сияния.',
    price: 511, competitorPrice: 711, photos: [1, 2, 3],
  }),
  product({
    id: 'divage', code: '1131186', brand: 'Divage', name: 'Skin Cult Rose Loose Powder',
    type: 'Рассыпчатая пудра для лица', detail: 'Светло-розовый, 7 г', detailLabel: 'Оттенок и вес',
    description: 'Светло-розовая рассыпчатая пудра с лёгким прозрачным покрытием. Подходит для закрепления макияжа и придаёт коже мягкое сияние.',
    price: 519, competitorPrice: 570, photos: [1, 2, 3],
  }),
  product({
    id: 'tangle', code: '947453', brand: 'Tangle Teezer', name: 'The Wet Detangler',
    type: 'Расчёска для волос', detail: 'Millennial Pink', detailLabel: 'Цвет',
    description: 'Расчёска с ручкой для распутывания сухих и влажных волос в розовом оттенке Millennial Pink.',
    price: 1528, competitorPrice: 2518, photos: [2, 1],
  }),
  product({
    id: 'celimax', code: '1112798', brand: 'Celimax', name: 'Dual Barrier Creamy Toner',
    type: 'Кремовый тонер', detail: '150 мл', detailLabel: 'Объём',
    description: 'Кремовый тонер с комплексом церамидов для ухода за сухой и чувствительной кожей.',
    price: 1185, competitorPrice: 2361, photos: [1, 2, 3],
  }),
];
