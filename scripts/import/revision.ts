// Generates data/import/revision.html — a self-contained, local curation page
// over everything in staging. The client browses with photos, ticks what she
// actually sells, adjusts price/category/brand/stock where needed, and exports
// the `approved` array to paste into scripts/import/seleccion.json.
//
// The page is a git-ignored LOCAL tool: it shows supplier photos straight from
// their CDNs for review purposes only. The storefront never hotlinks — approved
// products get their images re-hosted on Cloudinary by promote.ts.
//
//   npm run import:revision
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES } from "./lib/config";
import { computeSalePriceCents } from "./lib/pricing";
import { readAllStaged, readSeleccion } from "./lib/staging";

type Row = {
  ref: string;
  sup: string;
  name: string;
  marca: string | null;
  catSug: string | null;
  precio: number;
  sugerido: number | null;
  propuesto: number;
  varia: boolean;
  opts: string;
  nImg: number;
  img: string | null;
  url: string;
  disp: boolean;
  sel: null | {
    salePriceCOP?: number;
    categorySlug?: string;
    brand?: string;
    initialStock?: number;
    note?: string;
  };
};

function main() {
  const staged = readAllStaged();
  const seleccion = readSeleccion();
  const approvedByRef = new Map(
    seleccion.approved.map((a) => [a.supplierRef, a]),
  );

  const rows: Row[] = [...staged.values()].map((p) => {
    const entry = approvedByRef.get(p.supplierRef) ?? null;
    const margin =
      seleccion.pricing.marginPct[p.supplier as "distrisex" | "climax"];
    return {
      ref: p.supplierRef,
      sup: p.supplier,
      name: p.name,
      marca: p.brand,
      catSug: p.suggestedCategorySlug,
      precio: p.supplierPriceCents,
      sugerido: p.suggestedRetailCents,
      propuesto: computeSalePriceCents(
        p.supplierPriceCents,
        margin,
        seleccion.pricing.roundUpToCOP,
      ),
      varia: p.priceVariesByVariant,
      opts: p.options.map((o) => `${o.name} (${o.values.length})`).join(" · "),
      nImg: p.images.length,
      img: p.images[0]?.url ?? null,
      url: p.supplierUrl,
      disp: p.variants.some((v) => v.available),
      sel: entry
        ? {
            salePriceCOP: entry.salePriceCOP,
            categorySlug: entry.categorySlug,
            brand: entry.brand,
            initialStock: entry.initialStock,
            note: entry.note,
          }
        : null,
    };
  });

  const payload = JSON.stringify({
    rows,
    categories: CATEGORIES.map((c) => ({ slug: c.slug, name: c.name })),
    pricing: seleccion.pricing,
    generatedAt: new Date().toISOString(),
  }).replace(/<\/script/gi, "<\\/script");

  const html = `<!doctype html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SECRETO — revisión del catálogo de proveedores</title>
<style>
  :root { --marfil:#F7F1E8; --crema:#FFFDF9; --arena:#F1E7D8; --linea:#E2D5C2;
          --tinta:#2B1B20; --vino:#5C1A2E; --cobre:#8C5A3C; --exito:#587A4F; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--marfil); color:var(--tinta);
         font:14px/1.45 system-ui, "Segoe UI", sans-serif; }
  header { position:sticky; top:0; z-index:2; background:var(--crema);
           border-bottom:1px solid var(--linea); padding:10px 16px;
           display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  header b { color:var(--vino); }
  input[type=search], select, input[type=number], input[type=text] {
    border:1px solid var(--linea); border-radius:4px; padding:5px 8px;
    background:var(--crema); color:var(--tinta); font:inherit; }
  input[type=search] { min-width:230px; }
  label.chk { display:flex; align-items:center; gap:4px; cursor:pointer; }
  main { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
         gap:12px; padding:14px 16px 90px; }
  .card { background:var(--crema); border:1px solid var(--linea); border-radius:4px;
          padding:10px; display:flex; flex-direction:column; gap:6px; }
  .card.on { outline:2px solid var(--vino); }
  .imgbox { aspect-ratio:4/5; background:var(--arena); border-radius:4px;
            display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .imgbox img { width:100%; height:100%; object-fit:contain; }
  .name { font-weight:600; min-height:2.6em; }
  .meta { color:var(--cobre); font-size:12px; text-transform:uppercase;
          letter-spacing:1px; display:flex; gap:6px; justify-content:space-between; }
  .price { display:flex; gap:8px; align-items:baseline; }
  .price .prov { color:#7a6a60; font-size:12px; }
  .price .prop { color:var(--vino); font-weight:600; }
  .hint { font-size:12px; color:var(--exito); }
  .warn { font-size:12px; color:#A33D3D; }
  .fields { display:grid; grid-template-columns:1fr 1fr; gap:5px; font-size:12px; }
  .fields label { display:flex; flex-direction:column; gap:2px; color:#7a6a60; }
  .approve { display:flex; align-items:center; gap:8px; margin-top:2px;
             font-weight:600; color:var(--vino); cursor:pointer; }
  .approve input { width:18px; height:18px; accent-color:var(--vino); }
  a { color:var(--cobre); }
  footer { position:fixed; bottom:0; left:0; right:0; background:var(--crema);
           border-top:1px solid var(--linea); padding:10px 16px; display:flex;
           gap:12px; align-items:center; z-index:2; }
  footer button { background:var(--vino); color:var(--crema); border:0;
                  border-radius:2px; padding:9px 16px; letter-spacing:1.5px;
                  text-transform:uppercase; font-weight:500; cursor:pointer; }
  footer button:hover { background:#71243C; }
  dialog { border:1px solid var(--linea); border-radius:6px; background:var(--crema);
           max-width:720px; width:90vw; }
  dialog textarea { width:100%; height:300px; font:12px/1.4 Consolas, monospace; }
  .count { color:var(--vino); font-weight:600; }
  .note { font-size:11px; color:#7a6a60; }
</style>
<header>
  <b>SECRETO</b> · revisión de proveedores
  <input type="search" id="q" placeholder="Buscar nombre, marca o ref…">
  <select id="fSup"><option value="">Proveedor: todos</option>
    <option value="distrisex">DistriSex</option><option value="climax">Climax</option></select>
  <select id="fCat"><option value="">Categoría: todas</option>
    <option value="lenceria">Lencería</option>
    <option value="cosmetica-intima">Cosmética íntima</option>
    <option value="jugueteria-y-dispositivos">Juguetería</option>
    <option value="__none__">Sin asignar</option></select>
  <label class="chk"><input type="checkbox" id="fAprob"> solo aprobados</label>
  <label class="chk"><input type="checkbox" id="fDisp" checked> solo disponibles</label>
  <span id="shown"></span>
</header>
<main id="grid"></main>
<footer>
  <span class="count" id="nAprob"></span>
  <button id="exportar">Exportar selección</button>
  <span class="note">El export reemplaza el array <code>approved</code> de scripts/import/seleccion.json.
  Fotos servidas por el proveedor solo en esta página local — la tienda usa Cloudinary.</span>
</footer>
<dialog id="dlg">
  <p>Pegar en <code>scripts/import/seleccion.json</code> como el valor de <code>"approved"</code>:</p>
  <textarea id="out" readonly></textarea>
  <p><button id="copiar">Copiar</button> <button id="cerrar">Cerrar</button></p>
</dialog>
<script id="data" type="application/json">${payload}</script>
<script>
const DATA = JSON.parse(document.getElementById("data").textContent);
const state = new Map(); // ref -> {on, price, cat, brand, stock, note}
for (const r of DATA.rows) {
  state.set(r.ref, {
    on: r.sel !== null,
    price: r.sel && r.sel.salePriceCOP != null ? String(r.sel.salePriceCOP) : "",
    cat: (r.sel && r.sel.categorySlug) || r.catSug || "",
    brand: (r.sel && r.sel.brand) || r.marca || "",
    stock: r.sel && r.sel.initialStock != null ? r.sel.initialStock : 0,
    note: (r.sel && r.sel.note) || undefined,
  });
}
const cop = (cents) => "$" + Math.round(cents / 100).toLocaleString("es-CO");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function card(r) {
  const s = state.get(r.ref);
  const catOpts = ['<option value="">(sin asignar)</option>']
    .concat(DATA.categories.map((c) =>
      '<option value="' + c.slug + '"' + (s.cat === c.slug ? " selected" : "") + ">" + esc(c.name) + "</option>"))
    .join("");
  return '<div class="card' + (s.on ? " on" : "") + '" data-ref="' + esc(r.ref) + '">' +
    '<div class="imgbox">' + (r.img ? '<img loading="lazy" src="' + esc(r.img) + '" alt="">' : "sin foto") + "</div>" +
    '<div class="meta"><span>' + esc(r.sup) + "</span><span>" + (r.nImg) + " fotos</span></div>" +
    '<div class="name">' + esc(r.name) + "</div>" +
    '<div class="price"><span class="prov">prov. ' + cop(r.precio) + (r.varia ? " (varía)" : "") + "</span>" +
    '<span class="prop">venta ' + cop(r.propuesto) + "</span></div>" +
    (r.sugerido ? '<div class="hint">sugerido del proveedor: ' + cop(r.sugerido) + "</div>" : "") +
    (r.opts ? '<div class="note">' + esc(r.opts) + "</div>" : "") +
    (!r.disp ? '<div class="warn">agotado donde el proveedor</div>' : "") +
    '<div class="fields">' +
    '<label>precio venta COP<input type="number" class="fPrice" min="0" step="500" placeholder="' + Math.round(r.propuesto / 100) + '" value="' + esc(s.price) + '"></label>' +
    '<label>stock inicial<input type="number" class="fStock" min="0" value="' + s.stock + '"></label>' +
    '<label>categoría<select class="fCat">' + catOpts + "</select></label>" +
    '<label>marca<input type="text" class="fBrand" value="' + esc(s.brand) + '"></label>' +
    "</div>" +
    '<label class="approve"><input type="checkbox" class="fOn"' + (s.on ? " checked" : "") + "> Vender en SECRETO</label>" +
    '<a href="' + esc(r.url) + '" target="_blank" rel="noreferrer">ver donde el proveedor →</a>' +
    "</div>";
}

function visible() {
  const q = document.getElementById("q").value.trim().toLowerCase();
  const sup = document.getElementById("fSup").value;
  const cat = document.getElementById("fCat").value;
  const soloAprob = document.getElementById("fAprob").checked;
  const soloDisp = document.getElementById("fDisp").checked;
  return DATA.rows.filter((r) => {
    const s = state.get(r.ref);
    if (sup && r.sup !== sup) return false;
    const effCat = s.cat || "";
    if (cat === "__none__" ? effCat !== "" : cat && effCat !== cat) return false;
    if (soloAprob && !s.on) return false;
    if (soloDisp && !r.disp && !s.on) return false;
    if (q && !(r.name + " " + (r.marca || "") + " " + r.ref).toLowerCase().includes(q)) return false;
    return true;
  });
}

let renderLimit = 400;
function render() {
  const rows = visible();
  document.getElementById("shown").textContent = rows.length + " de " + DATA.rows.length;
  document.getElementById("grid").innerHTML =
    rows.slice(0, renderLimit).map(card).join("") +
    (rows.length > renderLimit
      ? '<button id="more" style="grid-column:1/-1;padding:12px">Mostrar más (' + (rows.length - renderLimit) + " restantes)</button>"
      : "");
  const more = document.getElementById("more");
  if (more) more.onclick = () => { renderLimit += 400; render(); };
  updateCount();
}
function updateCount() {
  let n = 0;
  for (const s of state.values()) if (s.on) n++;
  document.getElementById("nAprob").textContent = n + " aprobados";
}

document.getElementById("grid").addEventListener("change", (e) => {
  const el = e.target;
  const cardEl = el.closest(".card");
  if (!cardEl) return;
  const s = state.get(cardEl.dataset.ref);
  if (el.classList.contains("fOn")) { s.on = el.checked; cardEl.classList.toggle("on", s.on); }
  if (el.classList.contains("fPrice")) s.price = el.value;
  if (el.classList.contains("fStock")) s.stock = Number(el.value) || 0;
  if (el.classList.contains("fCat")) s.cat = el.value;
  if (el.classList.contains("fBrand")) s.brand = el.value;
  updateCount();
});
for (const id of ["q", "fSup", "fCat", "fAprob", "fDisp"])
  document.getElementById(id).addEventListener("input", () => { renderLimit = 400; render(); });

document.getElementById("exportar").onclick = () => {
  const byRef = new Map(DATA.rows.map((r) => [r.ref, r]));
  const out = [];
  for (const [ref, s] of state) {
    if (!s.on) continue;
    const r = byRef.get(ref);
    const e = { supplierRef: ref };
    if (s.price !== "" && Number(s.price) > 0) e.salePriceCOP = Number(s.price);
    if (s.cat && s.cat !== r.catSug) e.categorySlug = s.cat;
    if (s.brand.trim() && s.brand.trim() !== (r.marca || "")) e.brand = s.brand.trim();
    if (s.stock > 0) e.initialStock = s.stock;
    if (s.note) e.note = s.note;
    out.push(e);
  }
  document.getElementById("out").value = JSON.stringify(out, null, 2);
  document.getElementById("dlg").showModal();
};
document.getElementById("copiar").onclick = () => {
  const ta = document.getElementById("out");
  ta.select();
  navigator.clipboard.writeText(ta.value).catch(() => document.execCommand("copy"));
};
document.getElementById("cerrar").onclick = () => document.getElementById("dlg").close();
render();
</script>
</html>`;

  const outPath = path.join(process.cwd(), "data", "import", "revision.html");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(
    `Revision page: ${outPath} — ${rows.length} staged products, ${seleccion.approved.length} currently approved.`,
  );
}

main();
