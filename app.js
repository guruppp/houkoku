"use strict";

const CHANNELS = [
  { id: "inside", label: "店内販売", limitKey: "店内" },
  { id: "mobile", label: "移動販売", limitKey: "移動販売" }
];

const state = {
  groups: [],
  values: {},
  currentMenu: "standard",
  menus: {
    standard: null,
    newProducts: null
  },
  valuesByMenu: {
    standard: {},
    newProducts: {}
  },
  billingValuesByMenu: {
    standard: {},
    newProducts: {}
  }
};

const elements = {
  date: document.querySelector("#report-date"),
  panels: document.querySelector("#menu-panels"),
  count: document.querySelector("#copy-count"),
  total: document.querySelector("#sales-total"),
  menuSwitchButton: document.querySelector("#menu-switch-button"),
  currentMenuLabel: document.querySelector("#current-menu-label"),
  productMasterFile: document.querySelector("#product-master-file"),
  calculatorOpenButton: document.querySelector("#calculator-open-button"),
  calculatorOverlay: document.querySelector("#calculator-overlay"),
  calculatorCloseButton: document.querySelector("#calculator-close-button"),
  billingMenuName: document.querySelector("#billing-menu-name"),
  billingList: document.querySelector("#billing-list"),
  billingTotal: document.querySelector("#billing-total"),
  billingTotalCopyButton: document.querySelector("#billing-total-copy-button"),
  billingCopyStatus: document.querySelector("#billing-copy-status"),
  billingClearButton: document.querySelector("#billing-clear-button"),
  billingApplyButton: document.querySelector("#billing-apply-button"),
  output: document.querySelector("#report-output"),
  copyButton: document.querySelector("#copy-button"),
  copyStatus: document.querySelector("#copy-status")
};

function localDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function key(productId, channelId) {
  return `${productId}:${channelId}`;
}

function getValue(productId, channelId) {
  return state.values[key(productId, channelId)] || 0;
}

function setValue(productId, channelId, value) {
  state.values[key(productId, channelId)] =
    Math.max(0, Math.floor(Number(value) || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function billingProducts() {
  return state.groups.flatMap((group) =>
    group.products.map((product) => ({
      id: product.id,
      name: product["商品名"],
      price: product["価格"]
    }))
  );
}

function billingValues() {
  return state.billingValuesByMenu[state.currentMenu];
}

function billingQuantity(productId) {
  return billingValues()[productId] || 0;
}

function setBillingQuantity(productId, value) {
  billingValues()[productId] = Math.max(0, Math.floor(Number(value) || 0));
}

function updateBillingTotals(syncInputs = true) {
  let total = 0;
  let totalQuantity = 0;
  elements.billingList.querySelectorAll("[data-billing-product]").forEach((item) => {
    const productId = item.dataset.billingProduct;
    const price = Number(item.dataset.billingPrice);
    const quantity = billingQuantity(productId);
    total += price * quantity;
    totalQuantity += quantity;
    item.querySelector("[data-billing-line-total]").textContent =
      `${formatNumber(price * quantity)}円`;
    if (syncInputs) item.querySelector("input").value = quantity;
  });
  elements.billingTotal.textContent = formatNumber(total);
  elements.billingCopyStatus.textContent = "金額をクリックしてコピー";
  elements.billingApplyButton.disabled = totalQuantity === 0;
}

async function copyBillingTotal() {
  const text = `${elements.billingTotal.textContent}円`;
  try {
    await navigator.clipboard.writeText(text);
    elements.billingCopyStatus.textContent = `${text}をコピーしました`;
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = text;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.appendChild(temporaryInput);
    temporaryInput.select();
    const copied = typeof document.execCommand === "function" &&
      document.execCommand("copy");
    temporaryInput.remove();
    elements.billingCopyStatus.textContent = copied
      ? `${text}をコピーしました`
      : "コピーできませんでした";
  }
}

function productAcceptsChannel(product, channel) {
  const limitValue = product[channel.limitKey];
  return typeof limitValue !== "string" || limitValue === "上限なし";
}

function applyBillingToSalesReport() {
  let transferredQuantity = 0;
  const skippedProducts = [];

  state.groups.forEach((group) => {
    group.products.forEach((product) => {
      const quantity = billingQuantity(product.id);
      if (!quantity) return;

      const channel = CHANNELS.find((candidate) =>
        productAcceptsChannel(product, candidate)
      );
      if (!channel) {
        skippedProducts.push(product["商品名"]);
        return;
      }

      setValue(
        product.id,
        channel.id,
        getValue(product.id, channel.id) + quantity
      );
      transferredQuantity += quantity;
    });
  });

  state.billingValuesByMenu[state.currentMenu] = {};
  renderPanels();
  updateReport();
  renderBillingCalculator();
  closeCalculator();

  if (skippedProducts.length) {
    window.alert(
      `販売先が設定されていないため反映できなかった商品：\n${skippedProducts.join("\n")}`
    );
  } else if (!transferredQuantity) {
    window.alert("反映できる商品がありませんでした。");
  }
}

function renderBillingCalculator() {
  const values = billingValues();
  const isNewMenu = state.currentMenu === "newProducts";
  elements.billingMenuName.textContent = isNewMenu
    ? "新商品メニュー表の商品"
    : "通常メニュー表の商品";

  elements.billingList.innerHTML = state.groups.map((group) => `
    <section class="billing-group">
      <h3>${escapeHtml(group.name)}</h3>
      ${group.products.map((product) => `
        <div class="billing-item" data-billing-product="${escapeHtml(product.id)}" data-billing-price="${product["価格"]}">
          <div class="billing-product">
            <strong>${escapeHtml(product["商品名"])}</strong>
            <small>単価 ${formatNumber(product["価格"])}円</small>
          </div>
          <div class="billing-quantity" aria-label="${escapeHtml(product["商品名"])}の数量">
            <div class="billing-step-row decrease">
              <button type="button" data-billing-change="-100" aria-label="100個減らす">−100</button>
              <button type="button" data-billing-change="-10" aria-label="10個減らす">−10</button>
              <button type="button" data-billing-change="-1" aria-label="1個減らす">−1</button>
            </div>
            <input type="number" min="0" step="1" inputmode="numeric" value="${values[product.id] || 0}" aria-label="数量">
            <div class="billing-step-row increase">
              <button type="button" data-billing-change="1" aria-label="1個増やす">＋1</button>
              <button type="button" data-billing-change="10" aria-label="10個増やす">＋10</button>
              <button type="button" data-billing-change="100" aria-label="100個増やす">＋100</button>
            </div>
          </div>
          <strong class="billing-line-total" data-billing-line-total>0円</strong>
        </div>
      `).join("")}
    </section>
  `).join("");
  updateBillingTotals();
}

function openCalculator() {
  renderBillingCalculator();
  elements.calculatorOverlay.hidden = false;
  document.body.classList.add("calculator-is-open");
  elements.calculatorCloseButton.focus();
}

function closeCalculator() {
  elements.calculatorOverlay.hidden = true;
  document.body.classList.remove("calculator-is-open");
  elements.calculatorOpenButton.focus();
}

function counterHtml(product, channel) {
  const value = getValue(product.id, channel.id);
  const productName = product["商品名"];
  const limitValue = product[channel.limitKey];
  const label = `${productName}の${channel.label}`;

  if (typeof limitValue === "string" && limitValue !== "上限なし") {
    return `<div class="counter-note">${escapeHtml(limitValue)}</div>`;
  }

  return `
    <div class="counter" data-product="${escapeHtml(product.id)}" data-channel="${channel.id}">
      <button class="counter-reset" type="button" data-reset aria-label="${escapeHtml(label)}を0に戻す">リセット</button>
      <input type="number" min="0" step="1" inputmode="numeric" value="${value}" aria-label="${escapeHtml(label)}">
      <button type="button" data-change="1" aria-label="${escapeHtml(label)}を1増やす">+1</button>
      <button type="button" data-change="10" aria-label="${escapeHtml(label)}を10増やす">+10</button>
      <button type="button" data-change="100" aria-label="${escapeHtml(label)}を100増やす">+100</button>
    </div>
  `;
}

function renderPanels() {
  elements.panels.innerHTML = state.groups.map((group) => `
    <section class="menu-panel" aria-labelledby="group-${escapeHtml(group.id)}">
      <h2 id="group-${escapeHtml(group.id)}">${escapeHtml(group.name)}</h2>
      <div class="table-scroll">
        <table class="menu-table">
          <thead>
            <tr>
              <th scope="col">商品名</th>
              ${CHANNELS.map((channel) => `<th scope="col">${channel.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${group.products.map((product) => `
              <tr>
                <td class="product-name">
                  ${escapeHtml(product["商品名"])}
                  <small>価格 ${formatNumber(product["価格"])}円 ／ 店内 ${escapeHtml(product["店内"])} ／ 移動販売 ${escapeHtml(product["移動販売"])}</small>
                </td>
                ${CHANNELS.map((channel) => `<td>${counterHtml(product, channel)}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `).join("");

  document.querySelectorAll(".counter").forEach((counter) => {
    const productId = counter.dataset.product;
    const channelId = counter.dataset.channel;
    const input = counter.querySelector("input");

    input.addEventListener("input", () => {
      setValue(productId, channelId, input.value);
      input.value = getValue(productId, channelId);
      updateReport();
    });

    counter.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const nextValue = button.hasAttribute("data-reset")
          ? 0
          : getValue(productId, channelId) + Number(button.dataset.change);
        setValue(productId, channelId, nextValue);
        input.value = getValue(productId, channelId);
        updateReport();
      });
    });
  });
}

function activeProducts() {
  return state.groups.flatMap((group) =>
    group.products
      .map((product) => ({
        name: product["商品名"],
        inside: getValue(product.id, "inside"),
        mobile: getValue(product.id, "mobile"),
        price: product["価格"],
        sales: getValue(product.id, "inside") + getValue(product.id, "mobile")
      }))
      .filter((product) => product.sales)
  );
}

function displayWidth(text) {
  return [...text].reduce((width, character) => {
    const code = character.codePointAt(0);
    const isHalfWidth =
      code <= 0x7f ||
      (code >= 0xff61 && code <= 0xff9f);
    return width + (isHalfWidth ? 1 : 2);
  }, 0);
}

function createReport() {
  const active = activeProducts();
  const [, month = "", day = ""] = elements.date.value.split("-");
  const reportDate = `${Number(month)}/${Number(day)}`;

  if (!active.length) return reportDate;

  const nameColumnWidth = Math.max(
    ...active.map((product) => displayWidth(product.name))
  );
  const lines = active.map((product) => {
    const spacing = " ".repeat(
      nameColumnWidth - displayWidth(product.name) + 4
    );
    return `${product.name}${spacing}${product.sales}`;
  });

  return `${reportDate}\n${lines.join("\n")}`;
}

function updateReport() {
  const active = activeProducts();
  elements.count.textContent = active.length;
  elements.total.textContent = formatNumber(
    active.reduce((total, product) => total + product.sales * product.price, 0)
  );
  elements.output.value = active.length ? createReport() : "ここに報告文が表示されます";
}

function resetAll() {
  if (!window.confirm("すべての入力内容をリセットしますか？")) return;
  state.values = {};
  state.valuesByMenu[state.currentMenu] = state.values;
  state.billingValuesByMenu[state.currentMenu] = {};
  elements.date.value = localDate();
  renderPanels();
  updateReport();
  if (!elements.calculatorOverlay.hidden) renderBillingCalculator();
}

async function copyReport() {
  const report = createReport();
  elements.output.value = report;
  try {
    await navigator.clipboard.writeText(report);
    elements.copyButton.textContent = "コピー済み";
    elements.copyStatus.textContent = "報告文をコピーしました";
    window.setTimeout(() => {
      elements.copyButton.textContent = "コピー";
      elements.copyStatus.textContent = "";
    }, 1800);
  } catch {
    elements.output.focus();
    elements.output.select();
    elements.copyStatus.textContent = "報告文を選択しました";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeProductData(data) {
  const groups = Array.isArray(data)
    ? [{ id: "products", name: "商品一覧", products: data }]
    : data.groups;

  if (!Array.isArray(groups)) throw new Error("商品グループがありません");

  const isValidLimit = (value) =>
    (Number.isInteger(value) && value >= 0) ||
    (typeof value === "string" && value.trim().length > 0);

  const productsAreValid = groups.every((group) =>
      Array.isArray(group.products) &&
      group.products.every((product) =>
        typeof product.id === "string" &&
        typeof product["商品名"] === "string" &&
        Number.isInteger(product["価格"]) &&
        product["価格"] >= 0 &&
        isValidLimit(product["店内"]) &&
        isValidLimit(product["移動販売"])
      )
  );

  if (!productsAreValid) throw new Error("商品データの形式が正しくありません");
  return groups;
}

function applyProductData(data, menuId = "standard") {
  state.menus[menuId] = normalizeProductData(data);
  state.currentMenu = menuId;
  state.groups = state.menus[menuId];
  state.values = state.valuesByMenu[menuId];
  elements.calculatorOpenButton.disabled = false;
  renderPanels();
  updateReport();
}

function switchMenu() {
  const nextMenu = state.currentMenu === "standard" ? "newProducts" : "standard";
  if (!state.menus[nextMenu]) return;

  state.currentMenu = nextMenu;
  state.groups = state.menus[nextMenu];
  state.values = state.valuesByMenu[nextMenu];

  const isNewMenu = nextMenu === "newProducts";
  elements.currentMenuLabel.textContent = isNewMenu
    ? "現在：新商品メニュー表"
    : "現在：通常メニュー表";
  elements.menuSwitchButton.textContent = isNewMenu
    ? "通常メニュー表に戻る"
    : "新商品メニュー表に移動";
  elements.menuSwitchButton.setAttribute("aria-pressed", String(isNewMenu));
  elements.productMasterFile.textContent = isNewMenu
    ? "products-new.json"
    : "products.json";

  renderPanels();
  updateReport();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showProductLoadFallback() {
  const isLocalFile = window.location.protocol === "file:";
  elements.panels.innerHTML = `
    <div class="error-message">
      <strong>商品情報を自動で読み込めませんでした。</strong>
      <p>${isLocalFile
        ? "HTMLを直接開いているため、ブラウザがJSONファイルの読み込みを制限しています。"
        : "products.json の場所または内容をご確認ください。"}</p>
      <label class="file-load-button">
        products.json を選択
        <input id="product-file-input" type="file" accept=".json,application/json">
      </label>
    </div>
  `;

  document.querySelector("#product-file-input").addEventListener("change", async (event) => {
    const file = event.currentTarget.files[0];
    if (!file) return;
    try {
      applyProductData(JSON.parse(await file.text()));
    } catch {
      elements.panels.querySelector(".error-message p").textContent =
        "選択したファイルの形式が正しくありません。id・商品名・価格・店内・移動販売をご確認ください。";
    }
  });
}

async function loadProducts() {
  try {
    const loadFile = async (filename) => {
      const response = await fetch(filename, { cache: "no-store" });
      if (!response.ok) throw new Error(`${filename}を読み込めませんでした`);
      return response.json();
    };

    const standardData = await loadFile("products.json");
    applyProductData(standardData, "standard");

    try {
      state.menus.newProducts = normalizeProductData(
        await loadFile("products-new.json")
      );
      elements.menuSwitchButton.disabled = false;
    } catch {
      elements.menuSwitchButton.textContent = "新商品メニュー表を読み込めません";
      elements.menuSwitchButton.disabled = true;
    }
  } catch {
    showProductLoadFallback();
  }
}

elements.date.value = localDate();
elements.date.addEventListener("change", updateReport);
document.querySelector("#reset-button").addEventListener("click", resetAll);
elements.menuSwitchButton.addEventListener("click", switchMenu);
elements.copyButton.addEventListener("click", copyReport);
elements.calculatorOpenButton.addEventListener("click", openCalculator);
elements.calculatorCloseButton.addEventListener("click", closeCalculator);
elements.calculatorOverlay.addEventListener("click", (event) => {
  if (event.target === elements.calculatorOverlay) closeCalculator();
});
elements.billingList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const item = button.closest("[data-billing-product]");
  if (!item) return;
  const productId = item.dataset.billingProduct;
  setBillingQuantity(
    productId,
    billingQuantity(productId) + Number(button.dataset.billingChange)
  );
  updateBillingTotals();
});
elements.billingList.addEventListener("input", (event) => {
  if (!event.target.matches("input")) return;
  const item = event.target.closest("[data-billing-product]");
  setBillingQuantity(item.dataset.billingProduct, event.target.value);
  updateBillingTotals(false);
});
elements.billingList.addEventListener("change", (event) => {
  if (!event.target.matches("input")) return;
  updateBillingTotals();
});
elements.billingClearButton.addEventListener("click", () => {
  state.billingValuesByMenu[state.currentMenu] = {};
  renderBillingCalculator();
});
elements.billingApplyButton.addEventListener("click", applyBillingToSalesReport);
elements.billingTotalCopyButton.addEventListener("click", copyBillingTotal);
document.addEventListener("keydown", (event) => {
  if (elements.calculatorOverlay.hidden) return;
  if (event.key === "Escape") {
    closeCalculator();
    event.preventDefault();
  }
});

loadProducts();
