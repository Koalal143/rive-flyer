const catalog = {
  eva: {
    name: "Eva Mosaic Cherry Lip Balm",
    type: "Подарок по флаеру",
    description: "Ухаживающий бальзам для губ с ароматом черешни, 11 мл.",
    image: "balm",
    price: "В подарок",
    slug: "eva-mosaic-cherry-lip-balm",
  },
  holika: {
    name: "Holika Holika Holipop Water Tint",
    type: "Тинт для губ",
    description: "Жидкий тинт для губ, оттенок 3, 9 мл.",
    image: "tint",
    price: "459 ₽",
    slug: "holika-holika-holipop-water-tint-3",
  },
  influence: {
    name: "Influence Beauty Lunar Highlighter",
    type: "Хайлайтер",
    description: "Компактный хайлайтер с сияющими частицами, 4,8 г.",
    image: "highlighter",
    price: "509 ₽",
    slug: "influence-beauty-lunar-highlighter",
  },
  celimax: {
    name: "Celimax Dual Barrier Creamy Toner",
    type: "Тонер для лица",
    description: "Кремовый тонер с церамидами для сухой и чувствительной кожи, 150 мл.",
    image: "toner",
    price: "1 355 ₽",
    slug: "celimax-dual-barrier-creamy-toner",
  },
  tangle: {
    name: "Tangle Teezer The Wet Detangler",
    type: "Расчёска для волос",
    description: "Расчёска с ручкой для сухих и влажных волос в оттенке Millennial Pink.",
    image: "brush",
    price: "1 683 ₽",
    slug: "tangle-teezer-the-wet-detangler-millennial-pink-brush",
  },
};

const dialog = document.querySelector("#product-dialog");
const dialogImage = document.querySelector("#product-image");
const productName = document.querySelector("#product-name");
const productType = document.querySelector("#product-type");
const description = document.querySelector("#product-description");
const price = document.querySelector("#product-price");
const productLink = document.querySelector("#product-link");

document.querySelectorAll("[data-product]").forEach((button) => {
  button.addEventListener("click", () => {
    const product = catalog[button.dataset.product];
    productName.textContent = product.name;
    productType.textContent = product.type;
    description.textContent = product.description;
    price.textContent = product.price;
    productLink.href = `https://rivegauche.ru/product/${product.slug}`;
    dialogImage.src = `assets/${product.image}.webp`;
    dialogImage.alt = product.name;
    dialogImage.classList.toggle("dialog-balm", button.dataset.product === "eva");
    dialog.showModal();
  });
});

dialog.addEventListener("close", () => {
  dialogImage.removeAttribute("src");
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

const grid = document.querySelector("#product-grid");
const defaultOrder = [...grid.children];
document.querySelector("#sort-products").addEventListener("change", (event) => {
  const order = [...defaultOrder];
  if (event.target.value !== "default") {
    const direction = event.target.value === "asc" ? 1 : -1;
    order.sort((a, b) => direction * (Number(a.dataset.price) - Number(b.dataset.price)));
  }
  grid.append(...order);
});

const map = document.querySelector("#map-disclosure");
document.querySelectorAll("[data-open-map]").forEach((link) => {
  link.addEventListener("click", () => { map.open = true; });
});

const demoStock = {
  center: "12 бальзамов",
  north: "6 бальзамов",
  south: "0 бальзамов",
};
const shopChoice = document.querySelector("#shop-choice");
const stock = document.querySelector("#demo-stock");
const pins = document.querySelectorAll("[data-shop]");

function selectShop(id) {
  shopChoice.value = id;
  stock.textContent = `Тестовый остаток: ${demoStock[id]}`;
  pins.forEach((pin) => pin.setAttribute("aria-pressed", String(pin.dataset.shop === id)));
}

pins.forEach((pin) => pin.addEventListener("click", () => selectShop(pin.dataset.shop)));
shopChoice.addEventListener("change", () => selectShop(shopChoice.value));
