"use strict";

const CHANNELS = [
  { id: "sales", label: "販売数" }
];

const state = {
  groups: [],
  values: {}
};

const elements = {
  date: document.querySelector("#report-date"),
  staff: document.querySelector("#staff-name"),
  panels: document.querySelector("#menu-panels"),
  count: document.querySelector("#copy-count"),
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

function setValue(productId, channelId, value, salesLimit) {
  state.values[key(productId, channelId)] = Math.min(
    salesLimit,
    Math.max(0, Math.floor(Number(value) || 0))
  );
}

function counterHtml(product, channel) {
  const value = getValue(product.id, channel.id);
  const productName = product["商品名"];
  const salesLimit = product["販売上限"];
  const label = `${productName}の${channel.label}`;
  return `
    <div class="counter" data-product="${escapeHtml(product.id)}" data-channel="${channel.id}" data-limit="${salesLimit}">
      <button type="button" data-change="-10" aria-label="${escapeHtml(label)}を10減らす">−10</button>
      <button type="button" data-change="-1" aria-label="${escapeHtml(label)}を1減らす">−1</button>
      <input type="number" min="0" max="${salesLimit}" step="1" inputmode="numeric" value="${value}" aria-label="${escapeHtml(label)}（上限${salesLimit}）">
      <button type="button" data-change="1" aria-label="${escapeHtml(label)}を1増やす">+1</button>
      <button type="button" data-change="10" aria-label="${escapeHtml(label)}を10増やす">+10</button>
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
                  <small>上限 ${product["販売上限"]}</small>
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
    const salesLimit = Number(counter.dataset.limit);
    const input = counter.querySelector("input");

    input.addEventListener("input", () => {
      setValue(productId, channelId, input.value, salesLimit);
      input.value = getValue(productId, channelId);
      updateReport();
    });

    counter.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        setValue(
          productId,
          channelId,
          getValue(productId, channelId) + Number(button.dataset.change),
          salesLimit
        );
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
        groupName: group.name,
        name: product["商品名"],
        sales: getValue(product.id, "sales")
      }))
      .filter((product) => product.sales)
  );
}

function createReport() {
  const active = activeProducts();
  const heading = `【売上報告】${elements.date.value.replaceAll("-", "/")}${elements.staff.value.trim() ? `　担当：${elements.staff.value.trim()}` : ""}`;

  if (!active.length) return `${heading}\n\n入力された商品はありません。`;

  let currentGroup = "";
  const lines = active.flatMap((product) => {
    const result = [];
    if (product.groupName !== currentGroup) {
      currentGroup = product.groupName;
      result.push(`■ ${currentGroup}`);
    }
    result.push(`・${product.name}：${product.sales}`);
    return result;
  });

  const salesTotal = active.reduce((sum, product) => sum + product.sales, 0);

  return `${heading}\n\n${lines.join("\n")}\n\n【販売合計】${salesTotal}`;
}

function updateReport() {
  const active = activeProducts();
  elements.count.textContent = active.length;
  elements.output.value = active.length ? createReport() : "ここに報告文が表示されます";
}

function resetAll() {
  if (!window.confirm("すべての入力内容をリセットしますか？")) return;
  state.values = {};
  elements.date.value = localDate();
  elements.staff.value = "";
  renderPanels();
  updateReport();
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

  const productsAreValid = groups.every((group) =>
      Array.isArray(group.products) &&
      group.products.every((product) =>
        typeof product.id === "string" &&
        typeof product["商品名"] === "string" &&
        Number.isInteger(product["販売上限"]) &&
        product["販売上限"] >= 0
      )
  );

  if (!productsAreValid) throw new Error("商品データの形式が正しくありません");
  return groups;
}

function applyProductData(data) {
  state.groups = normalizeProductData(data);
  renderPanels();
  updateReport();
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
        "選択したファイルの形式が正しくありません。id・商品名・販売上限をご確認ください。";
    }
  });
}

async function loadProducts() {
  try {
    const response = await fetch("products.json", { cache: "no-store" });
    if (!response.ok) throw new Error();
    applyProductData(await response.json());
  } catch {
    showProductLoadFallback();
  }
}

elements.date.value = localDate();
elements.date.addEventListener("change", updateReport);
elements.staff.addEventListener("input", updateReport);
document.querySelector("#reset-button").addEventListener("click", resetAll);
elements.copyButton.addEventListener("click", copyReport);

loadProducts();
