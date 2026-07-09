// ah.mjs — Albert Heijn via de (onofficiële, al jaren stabiele) mobiele API op
// api.ah.nl. Publieke prijzen werken met een anoniem token; persoonlijke bonus
// en het vullen van het winkelmandje vereisen een ingelogd token.
//
// Inloggen: login.ah.nl gebruikt een browser-OAuth met bot-bescherming. Je logt
// dus één keer met een echte browser in (zie `node login.mjs ah`), waarna wij de
// `code` uit de appie://login-exit redirect omruilen voor tokens en de
// refresh-token bewaren in state/ah-token.json. Daarna nooit meer een browser nodig.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { STATE_DIR } from "./lib.mjs";

const API = "https://api.ah.nl";
const HEADERS = {
  "User-Agent": "Appie/9.28 (iPhone17,3; iPhone; CPU OS 26_1 like Mac OS X)",
  "x-client-name": "appie-ios",
  "x-client-version": "9.28",
  "x-application": "AHWEBSHOP",
  Accept: "application/json",
  "Content-Type": "application/json",
};
const TOKENPAD = join(STATE_DIR, "ah-token.json");

function laadToken() {
  if (existsSync(TOKENPAD)) {
    try {
      return JSON.parse(readFileSync(TOKENPAD, "utf8"));
    } catch {
      /* */
    }
  }
  return null;
}
function bewaarToken(t) {
  writeFileSync(TOKENPAD, JSON.stringify(t, null, 2), { mode: 0o600 });
}

async function anoniemToken() {
  const res = await fetch(`${API}/mobile-auth/v1/auth/token/anonymous`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ clientId: "appie" }),
  });
  if (!res.ok) throw new Error(`AH anoniem token faalde: ${res.status}`);
  return res.json();
}

async function ververs(refreshToken) {
  const res = await fetch(`${API}/mobile-auth/v1/auth/token/refresh`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ clientId: "appie", refreshToken }),
  });
  if (!res.ok) throw new Error(`AH token verversen faalde: ${res.status}`);
  return res.json();
}

// Ruil de OAuth-code (uit appie://login-exit?code=…) om voor tokens en bewaar ze.
export async function wisselCodeIn(code) {
  const res = await fetch(`${API}/mobile-auth/v1/auth/token`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ clientId: "appie", code }),
  });
  if (!res.ok) throw new Error(`AH code inwisselen faalde: ${res.status}`);
  const t = await res.json();
  bewaarToken(t);
  return t;
}

// Geeft een geldig access token terug. Gebruikt de ingelogde sessie als die er is
// (persoonlijke bonus + winkelmandje), anders een anoniem token (publieke prijzen).
export async function accessToken() {
  const opgeslagen = laadToken();
  if (opgeslagen?.refresh_token) {
    try {
      const t = await ververs(opgeslagen.refresh_token);
      bewaarToken(t);
      return { token: t.access_token, ingelogd: true };
    } catch (e) {
      console.warn(
        `  ⚠︎ AH: verversen mislukt (${e.message}), val terug op anoniem.`,
      );
    }
  }
  const t = await anoniemToken();
  return { token: t.access_token, ingelogd: false };
}

async function api(pad, token, opts = {}) {
  const res = await fetch(`${API}${pad}`, {
    ...opts,
    headers: {
      ...HEADERS,
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`AH ${pad}: ${res.status}`);
  return res.json();
}

export async function zoek(token, term) {
  const data = await api(
    `/mobile-services/product/search/v2?query=${encodeURIComponent(term)}&page=0&size=5&sortOn=RELEVANCE`,
    token,
  );
  return data.products || data.cards?.flatMap((c) => c.products) || [];
}

// Geeft { prijs, url, omschrijving, productId } voor het beste zoekresultaat.
export async function prijsVoor(token, term) {
  const producten = await zoek(token, term);
  if (!producten.length) return null;
  const p = producten[0];
  const prijs =
    p.priceBeforeBonus ??
    p.currentPrice ??
    p.price?.now ??
    p.priceV2?.now?.amount ??
    null;
  const bonus = p.bonusPrice ?? (p.isBonus ? p.currentPrice : null);
  const gekozen = bonus ?? prijs;
  if (gekozen == null) return null;
  return {
    prijs: Number(gekozen),
    productId: p.webshopId ?? p.id ?? p.productId,
    url: p.webshopId
      ? `https://www.ah.nl/producten/product/wi${p.webshopId}`
      : undefined,
    omschrijving: [p.title, p.salesUnitSize].filter(Boolean).join(" · "),
  };
}

// Winkelmandje vullen (vereist ingelogd token). Voegt toe aan bestaande regels i.p.v. te vervangen.
export async function voegToeAanMandje(token, items) {
  // items: [{ productId, quantity }]
  const huidig = await actiefMandje(token).catch(() => null);
  const bestaand =
    huidig?.items ?? huidig?.order?.items ?? huidig?.orderLines ?? [];
  const map = new Map();
  for (const i of bestaand) {
    const id = Number(i.productId ?? i.id);
    if (!id) continue;
    map.set(id, {
      productId: id,
      quantity: (map.get(id)?.quantity || 0) + (i.quantity ?? i.amount ?? 1),
    });
  }
  for (const i of items) {
    const id = Number(i.productId);
    map.set(id, {
      productId: id,
      quantity: (map.get(id)?.quantity || 0) + i.quantity,
    });
  }
  const merged = [...map.values()];
  return api(`/mobile-services/order/v1/items?sortBy=DEFAULT`, token, {
    method: "PUT",
    body: JSON.stringify({
      items: merged.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        originCode: "PRD",
        description: "",
        strikethrough: false,
      })),
    }),
  });
}

export async function actiefMandje(token) {
  return api(
    `/mobile-services/order/v1/summaries/active?sortBy=DEFAULT`,
    token,
  );
}
