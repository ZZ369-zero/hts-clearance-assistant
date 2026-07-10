import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { chineseSearchCatalog, isMaterialCatalogEntry } from "./public/search-catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const HTS_API_BASE = "https://hts.usitc.gov/reststop/";
const SECTION_232_FALLBACK_METALS_LIST_URL =
  "https://content.govdelivery.com/attachments/USDHSCBP/2026/06/05/file_attachments/3675566/Metals%20HTS%20LIST%206426FINAL.docx";
const SECTION_232_MONITOR_URLS = [
  "https://www.cbp.gov/trade/programs-administration/trade-remedies",
  "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/41aa83d"
];
const COTTON_ASSESSMENT_URL =
  "https://www.ecfr.gov/current/title-7/subtitle-B/chapter-XI/part-1205/subpart-ECFR80efc31412f8612";
const ADCVD_OFFICIAL_URL = "https://access.trade.gov/adcvd";
const TRANSLATE_API_BASE = "https://api.mymemory.translated.net/get";
const ADCVD_CSV_PATH = path.resolve(__dirname, "..", "工作流", "中国输美_AD_CVD_HTS_CODE整理_主表.csv");
const ADCVD_SOURCE_XLSX_PATH = path.resolve(__dirname, "..", "工作流", "中国输美_AD_CVD_HTS_CODE整理_2026-07-06.xlsx");

const vehiclePartsSection232Options = [
  {
    code: "9903.94.05",
    rate: 25,
    autoApply: true,
    choiceGroup: "vehicle-parts-section232",
    choiceRank: 1,
    label: "232-汽车零配件",
    materialCode: "automobile-parts",
    materialLabel: "汽车零配件",
    shortLabel: "汽车零配件",
    context: "Automobile parts, as provided for in U.S. note 33 to Chapter 99."
  },
  {
    code: "9903.74.08",
    rate: 25,
    autoApply: false,
    choiceGroup: "vehicle-parts-section232",
    choiceRank: 2,
    label: "232-重型汽车零配件",
    materialCode: "heavy-duty-vehicle-parts",
    materialLabel: "重型汽车零配件",
    shortLabel: "重型车零配件",
    context: "Medium- and heavy-duty vehicle parts, as provided for in U.S. note 38 to Chapter 99."
  }
];

const cache = new Map();
const syncState = new Map();
const ttl = {
  status: 60 * 60 * 1000,
  search: 60 * 60 * 1000,
  rates: 60 * 60 * 1000,
  chapter: 60 * 60 * 1000,
  section232: 6 * 60 * 60 * 1000,
  cottonAssessment: 24 * 60 * 60 * 1000,
  translation: 7 * 24 * 60 * 60 * 1000,
  adcvd: 24 * 60 * 60 * 1000
};

const syncSources = [
  {
    id: "htsStatus",
    name: "USITC HTS 版本",
    sourceName: "USITC HTS",
    url: "https://hts.usitc.gov/reststop/currentRelease",
    intervalMs: 60 * 60 * 1000,
    description: "官方 HTS 版本、修订号和发布日期。"
  },
  {
    id: "chapter99",
    name: "Chapter 99 附加税",
    sourceName: "USITC HTS Chapter 99",
    url: "https://hts.usitc.gov/reststop/exportList?from=9900&to=9999&format=JSON&styles=false",
    intervalMs: 60 * 60 * 1000,
    description: "301、122、232 等 Chapter 99 税项基础数据。"
  },
  {
    id: "section232",
    name: "232 钢铁铝铜清单",
    sourceName: "CBP / GovDelivery Metals HTS List",
    url: SECTION_232_FALLBACK_METALS_LIST_URL,
    monitorUrls: SECTION_232_MONITOR_URLS,
    intervalMs: 6 * 60 * 60 * 1000,
    description: "自动监控 CBP 公告页，发现最新 Metals HTS List DOCX 后抓取。"
  },
  {
    id: "cotton",
    name: "棉费 Import Assessment",
    sourceName: "eCFR 7 CFR 1205",
    url: COTTON_ASSESSMENT_URL,
    intervalMs: 24 * 60 * 60 * 1000,
    description: "棉类商品 Import Assessment Table。"
  },
  {
    id: "adcvdOfficial",
    name: "AD/CVD 官方 ACCESS",
    sourceName: "ITA ACCESS AD/CVD",
    url: ADCVD_OFFICIAL_URL,
    intervalMs: 24 * 60 * 60 * 1000,
    description: "官方反倾销反补贴站点在线状态监控；官方站点为 Blazor 应用。"
  },
  {
    id: "adcvdLocal",
    name: "AD/CVD HTS 匹配库",
    sourceName: "本地 AD/CVD 整理表",
    url: ADCVD_OFFICIAL_URL,
    intervalMs: 24 * 60 * 60 * 1000,
    description: "用于按 HTS CODE 提示 AD/CVD 命中，来源为本地整理表并关联官方 ACCESS。"
  }
];

const chineseAliases = new Map([
  ["咖啡", "coffee"],
  ["咖啡机", "coffee maker"],
  ["茶", "tea"],
  ["手机", "cellular phone"],
  ["电话", "telephone"],
  ["电脑", "computer"],
  ["笔记本电脑", "laptop computer"],
  ["耳机", "headphones"],
  ["鞋", "footwear shoes"],
  ["服装", "apparel clothing"],
  ["衣服", "apparel clothing"],
  ["服饰", "apparel clothing garment garments"],
  ["衣物", "apparel clothing garment garments"],
  ["成衣", "apparel clothing garment garments"],
  ["无人机", "unmanned aircraft"],
  ["无人飞行器", "unmanned aircraft"],
  ["钟表", "watch watches clock clocks"],
  ["手表", "watch watches"],
  ["滴剂", "medicaments drops measured doses"],
  ["滴液", "medicaments drops measured doses"],
  ["眼药水", "medicaments primarily affecting the eyes"],
  ["生物制品", "antisera blood fractions immunological products vaccines cell cultures"],
  ["生物制剂", "antisera blood fractions immunological products vaccines cell cultures"],
  ["疫苗", "vaccines"],
  ["血清", "antisera sera"],
  ["药品", "medicaments pharmaceutical products"],
  ["药物", "medicaments pharmaceutical products"],
  ["医药", "pharmaceutical products"],
  ["医疗器械", "medical surgical dental veterinary instruments appliances"],
  ["医疗设备", "medical surgical dental veterinary instruments appliances"],
  ["X 光/辐射设备", "x-ray apparatus radiation-emitting apparatus"],
  ["X光/辐射设备", "x-ray apparatus radiation-emitting apparatus"],
  ["X 光", "x-ray apparatus"],
  ["X光", "x-ray apparatus"],
  ["X射线", "x-ray apparatus"],
  ["辐射设备", "radiation-emitting apparatus"],
  ["棉签", "swab swabs flocked swabs"],
  ["玩具", "toy"],
  ["家具", "furniture"],
  ["灯", "lamp lighting"],
  ["电池", "battery"],
  ["太阳能板", "solar panel"],
  ["自行车", "bicycle"],
  ["眼镜", "spectacles eyewear"],
  ["包", "bag handbag"],
  ["箱包", "luggage bag"],
  ["塑料", "plastic"],
  ["钢", "steel"],
  ["铝", "aluminum"],
  ["木制品", "wood article"],
  ["陶瓷", "ceramic"],
  ["纺织品", "textile"],
  ["螺丝", "screw fastener"],
  ["泵", "pump"],
  ["阀门", "valve"],
  ["轴承", "bearing"],
  ["化妆品", "cosmetic"],
  ["食品", "food preparation"],
  ["纸", "paper paperboard"],
  ["纸张", "paper paperboard"],
  ["纸板", "paperboard"],
  ["热敏纸", "thermal paper heat-sensitive paper"],
  ["收银纸", "thermal paper"]
]);

const exactDescriptionTranslations = new Map([
  ["Coffee or tea makers", "咖啡机或茶具"],
  ["Automatic drip and pump type", "自动滴滤式及泵压式"],
  ["Percolator", "渗滤式咖啡壶"],
  ["Not decaffeinated", "未脱咖啡因"],
  ["Decaffeinated", "脱咖啡因"],
  ["Coffee husks and skins", "咖啡果壳和果皮"],
  ["Coffee substitutes containing coffee", "含咖啡的咖啡代用品"],
  ["Instant coffee, not flavored", "未调味速溶咖啡"],
  ["Non-dairy coffee whiteners", "非乳制咖啡伴侣"],
  ["Multiple loudspeakers, mounted in the same enclosure", "多个扬声器，安装在同一音箱箱体内"],
  ["Single loudspeakers, mounted in their enclosures", "单个扬声器，安装在音箱箱体内"],
  ["Headphones and earphones, whether or not combined with a microphone", "头戴式耳机和耳塞式耳机，无论是否带麦克风"],
  ["T-shirts, singlets and other vests, knitted or crocheted", "针织或钩编的T恤衫、汗衫及其他背心"],
  ["T-shirts, singlets and other vests", "T恤衫、汗衫及其他背心"],
  ["Women's (339)", "女式（339）"],
  ["Men's (338)", "男式（338）"],
  ["Boys' (338)", "男童（338）"],
  ["Girls' (339)", "女童（339）"],
  ["Other", "其他"],
  ["Certified organic", "有机认证"],
  ["Males", "雄性"],
  ["Females", "雌性"],
  ["Male", "雄性"],
  ["Female", "雌性"],
  ["Imported for immediate slaughter", "进口后立即屠宰"],
  ["Purebred breeding animals", "纯种繁殖动物"]
]);

const phraseTranslations = [
  ["The duty provided in the applicable subheading", "适用子目规定的税率"],
  ["articles the product of China", "中国原产商品"],
  ["articles the product of Mexico", "墨西哥原产商品"],
  ["articles the product of Canada", "加拿大原产商品"],
  ["as provided for in", "按照"],
  ["Except as provided in", "除以下规定外"],
  ["provided for in subheading", "归入子目"],
  ["whether or not", "无论是否"],
  ["not roasted", "未烘焙"],
  ["roasted", "烘焙"],
  ["decaffeinated", "脱咖啡因"],
  ["coffee husks and skins", "咖啡果壳和果皮"],
  ["coffee substitutes", "咖啡代用品"],
  ["containing coffee", "含咖啡"],
  ["in any proportion", "任何比例"],
  ["extracts, essences and concentrates", "提取物、香精及浓缩物"],
  ["preparations with a basis of", "以其为基础的制品"],
  ["coffee or tea makers", "咖啡机或茶具"],
  ["automatic drip", "自动滴滤式"],
  ["pump type", "泵压式"],
  ["electrothermic", "电热式"],
  ["for domestic purposes", "家用"],
  ["designed to", "设计用于"],
  ["men's or boys'", "男式或男童"],
  ["women's or girls'", "女式或女童"],
  ["men's", "男式"],
  ["women's", "女式"],
  ["boys'", "男童"],
  ["girls'", "女童"],
  ["children's", "儿童"],
  ["infants'", "婴幼儿"],
  ["t-shirts", "T恤衫"],
  ["singlets", "汗衫"],
  ["tank tops", "背心"],
  ["other vests", "其他背心"],
  ["vests", "背心"],
  ["shirts", "衬衫"],
  ["blouses", "女式衬衫"],
  ["trousers", "长裤"],
  ["shorts", "短裤"],
  ["dresses", "连衣裙"],
  ["skirts", "半身裙"],
  ["sweaters", "毛衣"],
  ["pullovers", "套头衫"],
  ["knitted or crocheted", "针织或钩编"],
  ["knitted", "针织"],
  ["crocheted", "钩编"],
  ["of cotton", "棉制"],
  ["of man-made fibers", "化学纤维制"],
  ["of wool", "羊毛制"],
  ["multiple loudspeakers", "多个扬声器"],
  ["single loudspeakers", "单个扬声器"],
  ["loudspeakers", "扬声器"],
  ["speaker", "扬声器"],
  ["mounted in the same enclosure", "安装在同一音箱箱体内"],
  ["mounted in their enclosures", "安装在各自箱体内"],
  ["mounted", "安装"],
  ["same enclosure", "同一箱体"],
  ["enclosure", "箱体"],
  ["microphone", "麦克风"],
  ["audio-frequency electric amplifiers", "音频电放大器"],
  ["sound amplifier sets", "扩音设备"],
  ["stainless steel", "不锈钢"],
  ["plastic", "塑料"],
  ["wood", "木材"],
  ["aluminum", "铝"],
  ["iron or steel", "钢铁"],
  ["cotton", "棉"],
  ["textile", "纺织"],
  ["footwear", "鞋类"],
  ["apparel", "服装"],
  ["furniture", "家具"],
  ["toys", "玩具"],
  ["lamps", "灯具"],
  ["parts", "零件"],
  ["accessories", "附件"],
  ["other", "其他"],
  ["free", "免税"]
];

const chapters = [
  ["01", "Live animals"],
  ["02", "Meat and edible meat offal"],
  ["03", "Fish and crustaceans"],
  ["04", "Dairy produce; eggs; honey"],
  ["05", "Products of animal origin"],
  ["06", "Live trees and plants"],
  ["07", "Edible vegetables"],
  ["08", "Edible fruit and nuts"],
  ["09", "Coffee, tea, mate and spices"],
  ["10", "Cereals"],
  ["11", "Milling products"],
  ["12", "Oil seeds and miscellaneous grains"],
  ["13", "Lac; gums; resins"],
  ["14", "Vegetable plaiting materials"],
  ["15", "Animal or vegetable fats and oils"],
  ["16", "Prepared meat, fish or crustaceans"],
  ["17", "Sugars and sugar confectionery"],
  ["18", "Cocoa and cocoa preparations"],
  ["19", "Preparations of cereals"],
  ["20", "Preparations of vegetables or fruit"],
  ["21", "Miscellaneous edible preparations"],
  ["22", "Beverages, spirits and vinegar"],
  ["23", "Food industry residues"],
  ["24", "Tobacco and substitutes"],
  ["25", "Salt; sulfur; earths; stone"],
  ["26", "Ores, slag and ash"],
  ["27", "Mineral fuels and oils"],
  ["28", "Inorganic chemicals"],
  ["29", "Organic chemicals"],
  ["30", "Pharmaceutical products"],
  ["31", "Fertilizers"],
  ["32", "Tanning or dyeing extracts"],
  ["33", "Essential oils and cosmetics"],
  ["34", "Soap and waxes"],
  ["35", "Albuminoidal substances"],
  ["36", "Explosives and pyrotechnics"],
  ["37", "Photographic goods"],
  ["38", "Miscellaneous chemical products"],
  ["39", "Plastics and articles thereof"],
  ["40", "Rubber and articles thereof"],
  ["41", "Raw hides and skins"],
  ["42", "Leather articles and travel goods"],
  ["43", "Furskins and artificial fur"],
  ["44", "Wood and articles of wood"],
  ["45", "Cork and articles of cork"],
  ["46", "Straw and plaiting articles"],
  ["47", "Pulp of wood"],
  ["48", "Paper and paperboard"],
  ["49", "Printed books and manuscripts"],
  ["50", "Silk"],
  ["51", "Wool and animal hair"],
  ["52", "Cotton"],
  ["53", "Other vegetable textile fibers"],
  ["54", "Man-made filaments"],
  ["55", "Man-made staple fibers"],
  ["56", "Wadding, felt and nonwovens"],
  ["57", "Carpets and textile floor coverings"],
  ["58", "Special woven fabrics"],
  ["59", "Impregnated textile fabrics"],
  ["60", "Knitted or crocheted fabrics"],
  ["61", "Knitted apparel"],
  ["62", "Non-knitted apparel"],
  ["63", "Other made up textile articles"],
  ["64", "Footwear"],
  ["65", "Headgear"],
  ["66", "Umbrellas and walking-sticks"],
  ["67", "Prepared feathers and artificial flowers"],
  ["68", "Articles of stone, plaster or cement"],
  ["69", "Ceramic products"],
  ["70", "Glass and glassware"],
  ["71", "Precious stones and metals"],
  ["72", "Iron and steel"],
  ["73", "Articles of iron or steel"],
  ["74", "Copper and articles thereof"],
  ["75", "Nickel and articles thereof"],
  ["76", "Aluminum and articles thereof"],
  ["78", "Lead and articles thereof"],
  ["79", "Zinc and articles thereof"],
  ["80", "Tin and articles thereof"],
  ["81", "Other base metals"],
  ["82", "Tools and cutlery"],
  ["83", "Miscellaneous base metal articles"],
  ["84", "Machinery and mechanical appliances"],
  ["85", "Electrical machinery and equipment"],
  ["86", "Railway locomotives"],
  ["87", "Vehicles"],
  ["88", "Aircraft and spacecraft"],
  ["89", "Ships and boats"],
  ["90", "Optical, medical and measuring instruments"],
  ["91", "Clocks and watches"],
  ["92", "Musical instruments"],
  ["93", "Arms and ammunition"],
  ["94", "Furniture; bedding; lamps"],
  ["95", "Toys, games and sports equipment"],
  ["96", "Miscellaneous manufactured articles"],
  ["97", "Works of art and antiques"],
  ["98", "Special classification provisions"],
  ["99", "Temporary legislation and additional duties"]
];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, 500, {
      error: "服务器内部错误",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}).listen(port, host, () => {
  console.log(`HTS clearance assistant running at http://localhost:${port}`);
  for (const url of getLocalAccessUrls(port)) {
    console.log(`LAN access: ${url}`);
  }
  startAutoSync();
});

function getLocalAccessUrls(port) {
  if (host !== "0.0.0.0" && host !== "::") {
    return [`http://${host}:${port}`];
  }

  const urls = [];
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal && !address.address.startsWith("169.254.")) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }
  return [...new Set(urls)];
}

function startAutoSync() {
  setTimeout(() => {
    refreshSyncSource("all", false).catch((error) => {
      console.warn(`Initial auto sync failed: ${error.message}`);
    });
  }, 3000);

  for (const source of syncSources) {
    setInterval(() => {
      refreshSyncSource(source.id, false).catch((error) => {
        console.warn(`Auto sync failed for ${source.id}: ${error.message}`);
      });
    }, source.intervalMs);
  }
}

async function refreshSyncSource(sourceId = "all", force = false) {
  const selected = sourceId === "all"
    ? syncSources
    : syncSources.filter((source) => source.id === sourceId);

  if (!selected.length) {
    throw new Error(`Unknown sync source: ${sourceId}`);
  }

  const results = [];
  for (const source of selected) {
    results.push(await runSyncTask(source, force));
  }
  return results;
}

async function runSyncTask(source, force = false) {
  setSyncRunning(source.id);
  try {
    let detail = {};
    if (source.id === "htsStatus") {
      const release = await usitcJson("currentRelease", "status:currentRelease", ttl.status, force);
      detail = {
        release: release?.description || release?.title || release?.name || "USITC HTS",
        count: release ? 1 : 0
      };
    } else if (source.id === "chapter99") {
      const data = await usitcJson(
        "exportList?from=9900&to=9999&format=JSON&styles=false",
        "chapter:99",
        ttl.chapter,
        force
      );
      detail = { count: getRows(data).length };
    } else if (source.id === "section232") {
      const mappings = await loadSection232Mappings(force);
      detail = {
        count: mappings.entries?.length || 0,
        url: mappings.sourceUrl,
        discoveredAt: mappings.discoveredAt,
        effectiveNote: mappings.effectiveNote
      };
    } else if (source.id === "cotton") {
      const table = await loadCottonAssessments(force);
      detail = { count: table.rows?.length || 0 };
    } else if (source.id === "adcvdOfficial") {
      detail = await loadAdCvdOfficialStatus(force);
    } else if (source.id === "adcvdLocal") {
      const data = await loadAdCvdData(force);
      detail = {
        count: data.entries?.length || 0,
        updatedAt: data.updatedAt,
        csvPath: ADCVD_CSV_PATH,
        officialUrl: ADCVD_OFFICIAL_URL
      };
    }

    return setSyncSuccess(source.id, detail);
  } catch (error) {
    return setSyncError(source.id, error);
  }
}

function setSyncRunning(id) {
  const previous = syncState.get(id) || {};
  syncState.set(id, {
    ...previous,
    status: "running",
    startedAt: new Date().toISOString(),
    message: "正在同步"
  });
}

function setSyncSuccess(id, detail = {}) {
  const source = syncSources.find((item) => item.id === id) || {};
  const state = {
    id,
    status: "ok",
    lastSyncAt: new Date().toISOString(),
    nextSyncAt: source.intervalMs ? new Date(Date.now() + source.intervalMs).toISOString() : "",
    message: "同步成功",
    detail
  };
  syncState.set(id, state);
  return state;
}

function setSyncError(id, error) {
  const source = syncSources.find((item) => item.id === id) || {};
  const previous = syncState.get(id) || {};
  const state = {
    ...previous,
    id,
    status: "error",
    lastErrorAt: new Date().toISOString(),
    nextSyncAt: source.intervalMs ? new Date(Date.now() + source.intervalMs).toISOString() : "",
    message: error.message || "同步失败",
    detail: previous.detail || {}
  };
  syncState.set(id, state);
  return state;
}

function getSyncStatus() {
  return syncSources.map((source) => ({
    ...source,
    intervalMinutes: Math.round(source.intervalMs / 60000),
    state: syncState.get(source.id) || {
      id: source.id,
      status: "pending",
      message: "等待首次同步",
      detail: {}
    }
  }));
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/status") {
    const force = url.searchParams.get("refresh") === "1";
    const release = await usitcJson("currentRelease", "status:currentRelease", ttl.status, force);
    setSyncSuccess("htsStatus", {
      release: release?.description || release?.title || release?.name || "USITC HTS",
      count: release ? 1 : 0
    });
    sendJson(res, 200, {
      release,
      source: "USITC HTS",
      sourceUrl: "https://hts.usitc.gov/",
      fetchedAt: new Date().toISOString(),
      cacheEntries: cache.size
    });
    return;
  }

  if (url.pathname === "/api/chapters") {
    sendJson(res, 200, { chapters });
    return;
  }

  if (url.pathname === "/api/sync/status") {
    sendJson(res, 200, {
      autoSync: true,
      serverTime: new Date().toISOString(),
      sources: getSyncStatus()
    });
    return;
  }

  if (url.pathname === "/api/sync/refresh" && req.method === "POST") {
    const source = cleanValue(url.searchParams.get("source") || "all");
    const result = await refreshSyncSource(source, true);
    sendJson(res, 200, {
      ok: true,
      source,
      result,
      sources: getSyncStatus(),
      serverTime: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === "/api/static/section-232-index") {
    const force = url.searchParams.get("refresh") === "1";
    const mappings = await loadSection232Mappings(force);
    sendJson(res, 200, {
      ...mappings,
      source: {
        name: "CBP Metals HTS List",
        url: mappings.sourceUrl || SECTION_232_FALLBACK_METALS_LIST_URL,
        discoveryUrl: mappings.discoveryUrl,
        discoveryStatus: mappings.discoveryStatus,
        fetchedAt: mappings.fetchedAt,
        effectiveNote: mappings.effectiveNote
      }
    });
    return;
  }

  if (url.pathname === "/api/static/cotton-index") {
    const force = url.searchParams.get("refresh") === "1";
    const table = await loadCottonAssessments(force);
    sendJson(res, 200, {
      ...table,
      source: {
        name: "eCFR 7 CFR 1205 Import Assessment Table",
        url: COTTON_ASSESSMENT_URL,
        fetchedAt: table.fetchedAt
      }
    });
    return;
  }

  if (url.pathname === "/api/static/adcvd-index") {
    const force = url.searchParams.get("refresh") === "1";
    const [dataResult, official] = await Promise.all([
      loadAdCvdData(force).catch((error) => ({
        entries: [],
        updatedAt: "",
        fetchedAt: new Date().toISOString(),
        error: error.message
      })),
      loadAdCvdOfficialStatus(force).catch((error) => ({ error: error.message, officialUrl: ADCVD_OFFICIAL_URL }))
    ]);
    sendJson(res, 200, {
      ...dataResult,
      official,
      source: {
        name: "China AD/CVD HTS dataset",
        csvPath: ADCVD_CSV_PATH,
        workbookPath: ADCVD_SOURCE_XLSX_PATH,
        officialUrl: ADCVD_OFFICIAL_URL,
        updatedAt: dataResult.updatedAt,
        fetchedAt: dataResult.fetchedAt
      }
    });
    return;
  }

  if (url.pathname === "/api/search") {
    const originalQuery = (url.searchParams.get("q") || "").trim();
    if ([...originalQuery].length < 2 && !hasChineseText(originalQuery) && !chineseAliases.has(originalQuery)) {
      sendJson(res, 400, { error: "请输入至少 2 个字符" });
      return;
    }

    const force = url.searchParams.get("refresh") === "1";
    const searchPlan = buildServerSearchPlan(originalQuery);
    let rows = hasChineseText(originalQuery)
      ? await searchStaticIndexRowsByPlan(searchPlan)
      : await searchHtsRowsByPlan(searchPlan, force);
    if (!rows.length) {
      rows = await findHtsFallbackRows(searchPlan.primaryQuery, force);
    }
    sendJson(res, 200, {
      originalQuery,
      query: searchPlan.displayQuery,
      translated: searchPlan.aliasMatched || searchPlan.displayQuery !== originalQuery,
      count: rows.length,
      value: rows
    });
    return;
  }

  if (url.pathname === "/api/rates") {
    const htsno = (url.searchParams.get("htsno") || "").trim();
    const keyword = (url.searchParams.get("keyword") || htsno).trim();
    if (!/^[0-9.]+$/.test(htsno)) {
      sendJson(res, 400, { error: "HTS CODE 格式不正确" });
      return;
    }

    const endpoint = htsno.startsWith("99")
      ? `getRates99?htsno=${encodeURIComponent(htsno)}&keyword=${encodeURIComponent(keyword)}`
      : `getRates?htsno=${encodeURIComponent(htsno)}&keyword=${encodeURIComponent(keyword)}`;
    const data = await usitcJson(endpoint, `rates:${htsno}:${keyword}`, ttl.rates, false);
    const rows = getRows(data);
    sendJson(res, 200, {
      htsno,
      count: rows.length,
      value: normalizeRows(rows)
    });
    return;
  }

  if (url.pathname === "/api/chapter") {
    const chapter = (url.searchParams.get("chapter") || "").padStart(2, "0");
    if (!/^(0[1-9]|[1-9][0-9])$/.test(chapter) || Number(chapter) > 99) {
      sendJson(res, 400, { error: "章节必须是 01-99" });
      return;
    }

    const from = `${chapter}00`;
    const to = chapter === "99" ? "9999" : `${String(Number(chapter) + 1).padStart(2, "0")}00`;
    const force = url.searchParams.get("refresh") === "1";
    const data = await usitcJson(
      `exportList?from=${from}&to=${to}&format=JSON&styles=false`,
      `chapter:${chapter}`,
      ttl.chapter,
      force
    );
    const rows = getRows(data);
    sendJson(res, 200, {
      chapter,
      from,
      to,
      count: rows.length,
      value: normalizeRows(rows)
    });
    return;
  }

  if (url.pathname === "/api/additional-duties") {
    const codes = [...new Set((url.searchParams.get("codes") || "")
      .split(",")
      .map((code) => code.trim())
      .filter((code) => /^99\d{2}\.\d{2}\.\d{2}$/.test(code)))];

    if (!codes.length) {
      sendJson(res, 200, { count: 0, value: [] });
      return;
    }

    const rows = [];
    for (const code of codes) {
      const data = await usitcJson(
        `search?keyword=${encodeURIComponent(code)}`,
        `additional:${code}`,
        ttl.rates,
        false
      );
      const match = getRows(data).find((row) => cleanValue(row.htsno) === code);
      if (match) {
        rows.push(match);
      }
    }

    sendJson(res, 200, {
      count: rows.length,
      value: normalizeRows(rows)
    });
    return;
  }

  if (url.pathname === "/api/section-232") {
    const hts = cleanValue(url.searchParams.get("hts"));
    if (!normalizeHtsDigits(hts)) {
      sendJson(res, 400, { error: "HTS CODE 不能为空" });
      return;
    }

    const force = url.searchParams.get("refresh") === "1";
    const mappings = await loadSection232Mappings(force);
    const matches = findSection232Matches(hts, mappings, url.searchParams.get("general"));
    sendJson(res, 200, {
      hts,
      count: matches.length,
      source: {
        name: "CBP Metals HTS List",
        url: mappings.sourceUrl || SECTION_232_FALLBACK_METALS_LIST_URL,
        discoveryUrl: mappings.discoveryUrl,
        discoveryStatus: mappings.discoveryStatus,
        fetchedAt: mappings.fetchedAt,
        effectiveNote: mappings.effectiveNote
      },
      value: matches
    });
    return;
  }

  if (url.pathname === "/api/cotton-assessment") {
    const hts = cleanValue(url.searchParams.get("hts"));
    if (!normalizeHtsDigits(hts)) {
      sendJson(res, 400, { error: "HTS CODE 不能为空" });
      return;
    }

    const force = url.searchParams.get("refresh") === "1";
    const table = await loadCottonAssessments(force);
    const match = findCottonAssessment(hts, table);
    sendJson(res, 200, {
      hts,
      count: match ? 1 : 0,
      source: {
        name: "eCFR 7 CFR 1205 Import Assessment Table",
        url: COTTON_ASSESSMENT_URL,
        fetchedAt: table.fetchedAt
      },
      value: match ? [match] : []
    });
    return;
  }

  if (url.pathname === "/api/adcvd") {
    const hts = cleanValue(url.searchParams.get("hts"));
    if (!normalizeHtsDigits(hts)) {
      sendJson(res, 400, { error: "HTS CODE 不能为空" });
      return;
    }

    const force = url.searchParams.get("refresh") === "1";
    const [data, official] = await Promise.all([
      loadAdCvdData(force),
      loadAdCvdOfficialStatus(force).catch((error) => ({ error: error.message, officialUrl: ADCVD_OFFICIAL_URL }))
    ]);
    const matches = findAdCvdMatches(hts, data);
    sendJson(res, 200, {
      hts,
      count: matches.length,
      source: {
        name: "中国输美 AD/CVD HTS CODE 整理",
        csvPath: ADCVD_CSV_PATH,
        workbookPath: ADCVD_SOURCE_XLSX_PATH,
        officialUrl: ADCVD_OFFICIAL_URL,
        official,
        updatedAt: data.updatedAt,
        fetchedAt: data.fetchedAt
      },
      value: matches
    });
    return;
  }

  if (url.pathname === "/api/translate-description") {
    const text = cleanValue(url.searchParams.get("text"));
    if (!text) {
      sendJson(res, 400, { error: "商品描述不能为空" });
      return;
    }

    const force = url.searchParams.get("refresh") === "1";
    const translation = await translateDescriptionWithFallback(text, force);
    sendJson(res, 200, {
      text,
      translation,
      source: hasChineseText(translation) && !translation.startsWith("中文释义待核") ? "auto" : "local"
    });
    return;
  }

  if (url.pathname === "/api/refresh" && req.method === "POST") {
    cache.clear();
    const result = await refreshSyncSource("all", true);
    const release = await usitcJson("currentRelease", "status:currentRelease", ttl.status, true);
    sendJson(res, 200, {
      ok: true,
      release,
      result,
      cacheEntries: cache.size,
      fetchedAt: new Date().toISOString()
    });
    return;
  }

  sendJson(res, 404, { error: "接口不存在" });
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error("Not a file");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": contentTypes[ext] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(await readFile(filePath));
  } catch {
    res.writeHead(302, { location: "/" });
    res.end();
  }
}

async function usitcJson(endpoint, key, ttlMs, force = false) {
  const now = Date.now();
  const cached = cache.get(key);
  if (!force && cached && now - cached.time < ttlMs) {
    return cached.data;
  }

  const response = await fetch(`${HTS_API_BASE}${endpoint}`, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "HTS-Clearance-Assistant/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`USITC request failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const data = JSON.parse(text);
  cache.set(key, { time: now, data });
  return data;
}

async function loadSection232Mappings(force = false) {
  const now = Date.now();
  const key = "section232:metals-list";
  const cached = cache.get(key);
  if (!force && cached && now - cached.time < ttl.section232) {
    return cached.data;
  }

  const source = await discoverSection232Document(force);
  const response = await fetch(source.url, {
    headers: {
      accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*",
      "user-agent": "HTS-Clearance-Assistant/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`CBP Metals HTS List request failed: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const documentXml = extractZipEntry(buffer, "word/document.xml").toString("utf8");
  const paragraphs = extractDocxParagraphs(documentXml);
  const mappings = parseSection232Paragraphs(paragraphs);
  mappings.fetchedAt = new Date().toISOString();
  mappings.sourceUrl = source.url;
  mappings.discoveryUrl = source.discoveryUrl;
  mappings.discoveredAt = source.discoveredAt;
  mappings.discoveryStatus = source.status;
  cache.set(key, { time: now, data: mappings });
  return mappings;
}

async function discoverSection232Document(force = false) {
  const now = Date.now();
  const key = "section232:latest-docx";
  const cached = cache.get(key);
  if (!force && cached && now - cached.time < ttl.section232) {
    return cached.data;
  }

  for (const monitorUrl of SECTION_232_MONITOR_URLS) {
    try {
      const response = await fetch(monitorUrl, {
        headers: {
          accept: "text/html,*/*",
          "user-agent": "HTS-Clearance-Assistant/0.1"
        }
      });
      if (!response.ok) {
        continue;
      }
      const html = await response.text();
      const found = findSection232DocxLink(html, monitorUrl);
      if (found) {
        const data = {
          url: found,
          discoveryUrl: monitorUrl,
          discoveredAt: new Date().toISOString(),
          status: "discovered"
        };
        cache.set(key, { time: now, data });
        return data;
      }
    } catch {
      // Continue to the next monitor URL, then fall back to the known file.
    }
  }

  const fallback = {
    url: SECTION_232_FALLBACK_METALS_LIST_URL,
    discoveryUrl: SECTION_232_MONITOR_URLS[0],
    discoveredAt: new Date().toISOString(),
    status: "fallback"
  };
  cache.set(key, { time: now, data: fallback });
  return fallback;
}

function findSection232DocxLink(html, baseUrl) {
  const links = [...String(html || "").matchAll(/href=["']([^"']+\.docx(?:\?[^"']*)?)["']/gi)]
    .map((match) => absolutizeUrl(match[1], baseUrl))
    .filter((url) => /metals?\s*hts|metals%20hts|hts%20list|hts.list/i.test(url));

  if (links.length) {
    return links[0];
  }

  const fallback = [...String(html || "").matchAll(/https?:\/\/[^\s"'<>]+\.docx/gi)]
    .map((match) => match[0])
    .find((url) => /metals?\s*hts|metals%20hts|hts%20list|hts.list/i.test(url));
  return fallback || "";
}

function absolutizeUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

async function loadCottonAssessments(force = false) {
  const now = Date.now();
  const key = "cotton:ecfr-assessment-table";
  const cached = cache.get(key);
  if (!force && cached && now - cached.time < ttl.cottonAssessment) {
    return cached.data;
  }

  const response = await fetch(COTTON_ASSESSMENT_URL, {
    headers: {
      accept: "text/html,*/*",
      "user-agent": "HTS-Clearance-Assistant/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`eCFR Cotton Assessment request failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const rows = parseCottonAssessmentTable(html);
  const data = {
    fetchedAt: new Date().toISOString(),
    rows
  };
  cache.set(key, { time: now, data });
  return data;
}

function parseCottonAssessmentTable(html) {
  const start = html.indexOf("Import Assessment Table");
  if (start < 0) {
    return [];
  }

  const afterStart = html.slice(start);
  const tableEnd = afterStart.indexOf("</tbody>");
  const tableHtml = tableEnd >= 0 ? afterStart.slice(0, tableEnd) : afterStart;
  const rows = [];
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>(\d{6,10})<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(tableHtml))) {
    const hts = normalizeHtsDigits(match[1]);
    const conversionFactor = Number(cleanHtml(match[2]));
    const centsPerKg = Number(cleanHtml(match[3]));
    if (!hts || !Number.isFinite(centsPerKg)) {
      continue;
    }
    rows.push({
      hts,
      conversionFactor: Number.isFinite(conversionFactor) ? conversionFactor : null,
      centsPerKg,
      usdPerKg: centsPerKg / 100
    });
  }
  return rows;
}

function findCottonAssessment(hts, table) {
  const normalized = normalizeHtsDigits(hts);
  const rows = table.rows || [];
  const exact = rows.find((row) => row.hts === normalized);
  if (exact) {
    return {
      ...exact,
      confidence: "exact",
      source: "eCFR 7 CFR 1205"
    };
  }

  const candidates = rows.filter((row) => row.hts.startsWith(normalized) || normalized.startsWith(row.hts));
  if (!candidates.length) {
    return null;
  }

  const distinctRates = new Set(candidates.map((row) => `${row.conversionFactor}|${row.centsPerKg}`));
  if (distinctRates.size === 1) {
    return {
      ...candidates[0],
      hts: normalized,
      matchedHts: candidates[0].hts,
      confidence: "prefix",
      alternatives: candidates.length,
      source: "eCFR 7 CFR 1205"
    };
  }

  return null;
}

async function loadAdCvdData(force = false) {
  const now = Date.now();
  const key = "adcvd:china-hts-dataset";
  const cached = cache.get(key);
  if (!force && cached && now - cached.time < ttl.adcvd) {
    return cached.data;
  }

  const [csv, info] = await Promise.all([
    readFile(ADCVD_CSV_PATH, "utf8"),
    stat(ADCVD_CSV_PATH).catch(() => null)
  ]);
  const records = parseCsv(csv);
  const entries = records
    .map(normalizeAdCvdRecord)
    .filter((entry) => entry.htsDigits);
  const data = {
    entries,
    updatedAt: info?.mtime?.toISOString?.() || "",
    fetchedAt: new Date().toISOString()
  };
  cache.set(key, { time: now, data });
  return data;
}

async function loadAdCvdOfficialStatus(force = false) {
  const now = Date.now();
  const key = "adcvd:official-access-status";
  const cached = cache.get(key);
  if (!force && cached && now - cached.time < ttl.adcvd) {
    return cached.data;
  }

  const response = await fetch(ADCVD_OFFICIAL_URL, {
    headers: {
      accept: "text/html,*/*",
      "user-agent": "HTS-Clearance-Assistant/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`ITA ACCESS request failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const title = cleanHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "AD/CVD");
  const data = {
    count: 1,
    title,
    officialUrl: ADCVD_OFFICIAL_URL,
    fetchedAt: new Date().toISOString(),
    mode: "official-site-monitor",
    note: "官方 ACCESS 为 Blazor 应用，当前后台监控站点在线状态；HTS 命中仍使用本地整理库。"
  };
  cache.set(key, { time: now, data });
  return data;
}

function normalizeAdCvdRecord(record) {
  const htsCode = cleanValue(record["HTS CODE"]);
  const reason = cleanValue(record["反倾销缘由描述"]);
  const caseNumbers = extractAdCvdCaseNumbers(reason);
  return {
    htsCode,
    htsDigits: normalizeHtsDigits(htsCode),
    category: cleanValue(record["归属类别"]),
    productZh: cleanValue(record["关联的产品名称中文"]),
    productEn: cleanValue(record["关联的产品名称英文"]),
    material: cleanValue(record["产品材质"]),
    usage: cleanValue(record["产品用途概述"]),
    reason,
    caseNumbers,
    orderTypes: extractAdCvdOrderTypes(caseNumbers, reason)
  };
}

function findAdCvdMatches(hts, data) {
  const normalized = normalizeHtsDigits(hts);
  if (!normalized) {
    return [];
  }

  const matches = [];
  const seen = new Set();
  for (const entry of data.entries || []) {
    if (!entry.htsDigits || !isAdCvdHtsMatch(normalized, entry.htsDigits)) {
      continue;
    }

    const key = [
      entry.htsDigits,
      entry.productZh,
      entry.productEn,
      entry.caseNumbers.join("|")
    ].join("::");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    matches.push({
      ...entry,
      matchType: normalized === entry.htsDigits ? "exact" : normalized.startsWith(entry.htsDigits) ? "prefix" : "broader",
      matchLength: entry.htsDigits.length
    });
  }

  return matches
    .sort((a, b) => b.matchLength - a.matchLength || a.productZh.localeCompare(b.productZh, "zh-CN"))
    .slice(0, 10);
}

function isAdCvdHtsMatch(inputDigits, listDigits) {
  if (listDigits.length < 4) {
    return false;
  }
  return inputDigits === listDigits || inputDigits.startsWith(listDigits) || listDigits.startsWith(inputDigits);
}

function extractAdCvdCaseNumbers(value) {
  const matches = String(value || "").match(/\b[AC]-\d{3}-\d{3}\b/g) || [];
  return [...new Set(matches)];
}

function extractAdCvdOrderTypes(caseNumbers, reason) {
  const types = new Set();
  for (const caseNumber of caseNumbers) {
    if (caseNumber.startsWith("A-")) {
      types.add("AD");
    }
    if (caseNumber.startsWith("C-")) {
      types.add("CVD");
    }
  }
  if (/反倾销|倾销|\bAD\b/i.test(reason)) {
    types.add("AD");
  }
  if (/反补贴|补贴|\bCVD\b/i.test(reason)) {
    types.add("CVD");
  }
  return [...types];
}

function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1)
    .filter((row) => row.some((cell) => cleanValue(cell)))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function extractZipEntry(buffer, targetName) {
  const endSignature = 0x06054b50;
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endSignature) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) {
    throw new Error("无法解析 DOCX ZIP 目录");
  }

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let directoryOffset = buffer.readUInt32LE(endOffset + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(directoryOffset) !== 0x02014b50) {
      throw new Error("DOCX ZIP 中央目录格式异常");
    }
    const compression = buffer.readUInt16LE(directoryOffset + 10);
    const compressedSize = buffer.readUInt32LE(directoryOffset + 20);
    const nameLength = buffer.readUInt16LE(directoryOffset + 28);
    const extraLength = buffer.readUInt16LE(directoryOffset + 30);
    const commentLength = buffer.readUInt16LE(directoryOffset + 32);
    const localOffset = buffer.readUInt32LE(directoryOffset + 42);
    const fileName = buffer.toString("utf8", directoryOffset + 46, directoryOffset + 46 + nameLength);

    if (fileName === targetName) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
      if (compression === 0) {
        return compressed;
      }
      if (compression === 8) {
        return inflateRawSync(compressed);
      }
      throw new Error(`不支持的 DOCX 压缩方式：${compression}`);
    }

    directoryOffset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`DOCX 内未找到 ${targetName}`);
}

function extractDocxParagraphs(xml) {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((match) => decodeDocxText(match[0]))
    .map((text) => text.replace(/[ \u00a0]+/g, " ").replace(/\t+/g, "\t").trim())
    .filter(Boolean);
}

function decodeDocxText(xml) {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\s*\/>/g, "\t")
      .replace(/<w:br\s*\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
  );
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function parseSection232Paragraphs(paragraphs) {
  const entries = [];
  let currentChapter99 = "";
  let currentContext = "";
  let effectiveNote = "";

  for (const paragraph of paragraphs) {
    if (!effectiveNote && /Effective\s+June\s+8,\s+2026/i.test(paragraph)) {
      effectiveNote = paragraph;
    }

    const heading = paragraph.match(/^(9903\.\d{2}\.\d{2})\s*:/);
    if (heading) {
      currentChapter99 = heading[1];
      currentContext = "";
      continue;
    }
    if (!currentChapter99 || !isSection232Chapter99(currentChapter99)) {
      continue;
    }

    const codes = extractChapterOneToNinetySevenCodes(paragraph);
    if (!codes.length) {
      if (paragraph.length < 140 && /articles|classifications|aluminum|steel|copper/i.test(paragraph)) {
        currentContext = paragraph.replace(/:$/, "");
      }
      continue;
    }

    for (const code of codes) {
      entries.push({
        chapter99: currentChapter99,
        hts: normalizeHtsDigits(code),
        displayHts: code,
        context: currentContext || "Section 232 metals list"
      });
    }
  }

  entries.sort((a, b) => b.hts.length - a.hts.length || a.chapter99.localeCompare(b.chapter99));
  return {
    fetchedAt: "",
    effectiveNote: effectiveNote || "CBP Metals HTS List",
    entries
  };
}

function extractChapterOneToNinetySevenCodes(text) {
  const candidates = [...text.matchAll(/\b\d{4}(?:\.\d{2}){0,2}(?:\.\d{2,4})?\b/g)]
    .map((match) => match[0])
    .filter((code) => {
      const digits = normalizeHtsDigits(code);
      if (digits.length < 4 || digits.startsWith("99")) {
        return false;
      }
      const chapter = Number(digits.slice(0, 2));
      return chapter >= 1 && chapter <= 97;
    });

  const looksLikeCodeList = text.includes("\t") || candidates.length > 1 || /^\d{4}(?:\.|\s|$)/.test(text.trim());
  return looksLikeCodeList ? [...new Set(candidates)] : [];
}

function findSection232Matches(hts, mappings, generalRateText = "") {
  const normalized = normalizeHtsDigits(hts);
  if (!normalized) {
    return [];
  }

  const vehicleMatches = buildVehiclePartsSection232Matches(hts, normalized);
  const directMatches = mappings.entries.filter((entry) =>
    normalized.startsWith(entry.hts) || entry.hts.startsWith(normalized)
  );
  if (!directMatches.length) {
    return vehicleMatches;
  }

  const maxLength = Math.max(...directMatches.map((entry) => Math.min(entry.hts.length, normalized.length)));
  const seen = new Set();
  const bestLevelMatches = directMatches
    .filter((entry) => Math.min(entry.hts.length, normalized.length) === maxLength)
    .filter((entry) => {
      const key = `${entry.chapter99}|${entry.hts}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  const baseRate = parseSimplePercent(generalRateText);
  const ranked = bestLevelMatches
    .map((entry) => ({
      entry,
      rank: rankSection232Match(entry, baseRate),
      autoApply: !isCountrySpecificSection232(entry) && rankSection232Match(entry, baseRate) > 0
    }))
    .sort((a, b) => b.rank - a.rank || b.entry.hts.length - a.entry.hts.length || a.entry.chapter99.localeCompare(b.entry.chapter99));

  const preferred = ranked[0];
  if (!preferred) {
    return vehicleMatches;
  }

  return [...vehicleMatches, {
    code: preferred.entry.chapter99,
    htsMatch: preferred.entry.displayHts,
    normalizedMatch: preferred.entry.hts,
    context: preferred.entry.context,
    material: classifySection232Material(preferred.entry),
    label: "232-钢铁铝加征",
    confidence: preferred.entry.hts.length === normalized.length ? "exact" : "prefix",
    autoApply: preferred.autoApply,
    alternatives: ranked.length,
    source: "CBP Metals HTS List"
  }];
}

function buildVehiclePartsSection232Matches(hts, normalized = normalizeHtsDigits(hts)) {
  if (!/^8708/.test(normalized || "")) {
    return [];
  }

  return vehiclePartsSection232Options.map((option) => ({
    code: option.code,
    htsMatch: hts,
    normalizedMatch: normalized,
    context: option.context,
    material: {
      code: option.materialCode,
      label: option.materialLabel,
      shortLabel: option.shortLabel,
      detailLabel: option.materialLabel
    },
    label: option.label,
    confidence: normalized.length >= 6 ? "prefix" : "heading",
    rate: option.rate,
    autoApply: option.autoApply !== false,
    choiceGroup: option.choiceGroup,
    choiceRank: option.choiceRank,
    alternatives: vehiclePartsSection232Options.length,
    source: "USITC Chapter 99",
    summaryZh: `${option.label} ${option.code} 为车辆零配件 232 备选项，税率按 Chapter 99 读取；与 122/其他车辆 232 项多选一。`,
    note: `${option.context} 与 122 临时关税及其他车辆零配件 232 项多选一；${option.autoApply === false ? "按条件候选列示，不默认计入。" : "默认按车辆零配件 232 项计入估算。"}`
  }));
}

function isSection232Chapter99(code) {
  return /^(9903\.(80|81|82|83|84|85)\.\d{2}|9903\.(94\.05|74\.08))$/.test(code);
}

function classifySection232Material(entry) {
  const text = `${entry.context || ""} ${entry.chapter99 || ""}`.toLowerCase();
  const hasDerivative = /derivative/.test(text);
  const hasAluminum = /aluminum|aluminium/.test(text);
  const hasSteel = /steel/.test(text);
  const hasCopper = /copper/.test(text);

  if (hasAluminum && hasSteel && hasCopper) {
    return {
      code: "mixed-metal",
      label: "铝/钢/铜制品",
      shortLabel: "混合金属",
      detailLabel: hasDerivative ? "衍生铝/钢/铜制品" : "铝/钢/铜制品"
    };
  }
  if (hasAluminum && hasSteel) {
    return {
      code: "aluminum-steel",
      label: "铝/钢制品",
      shortLabel: "铝/钢",
      detailLabel: hasDerivative ? "衍生铝/钢制品" : "铝/钢制品"
    };
  }
  if (hasAluminum) {
    return {
      code: hasDerivative ? "derivative-aluminum" : "aluminum",
      label: hasDerivative ? "衍生铝制品" : "铝制品",
      shortLabel: hasDerivative ? "衍生铝" : "铝",
      detailLabel: hasDerivative ? "衍生铝制品" : "铝制品"
    };
  }
  if (hasSteel) {
    return {
      code: hasDerivative ? "derivative-steel" : "steel",
      label: hasDerivative ? "衍生钢铁制品" : "钢铁制品",
      shortLabel: hasDerivative ? "衍生钢铁" : "钢铁",
      detailLabel: hasDerivative ? "衍生钢铁制品" : "钢铁制品"
    };
  }
  if (hasCopper) {
    return {
      code: hasDerivative ? "derivative-copper" : "copper",
      label: hasDerivative ? "衍生铜制品" : "铜制品",
      shortLabel: hasDerivative ? "衍生铜" : "铜",
      detailLabel: hasDerivative ? "衍生铜制品" : "铜制品"
    };
  }
  return {
    code: "metal-unspecified",
    label: "金属制品",
    shortLabel: "金属",
    detailLabel: "金属制品"
  };
}

function rankSection232Match(entry, baseRate) {
  if (isCountrySpecificSection232(entry)) {
    return -100;
  }

  if (entry.chapter99 === "9903.82.08" && (baseRate == null || baseRate < 10)) {
    return -20;
  }
  if (entry.chapter99 === "9903.82.11" && (baseRate == null || baseRate < 15)) {
    return -20;
  }
  if (entry.chapter99 === "9903.82.07" && baseRate != null && baseRate >= 10) {
    return -20;
  }
  if (entry.chapter99 === "9903.82.10" && baseRate != null && baseRate >= 15) {
    return -20;
  }

  const ranks = new Map([
    ["9903.82.02", 100],
    ["9903.82.09", 95],
    ["9903.82.07", 90],
    ["9903.82.10", 85],
    ["9903.82.06", 80],
    ["9903.82.12", 20],
    ["9903.82.13", 5]
  ]);
  return ranks.get(entry.chapter99) ?? 50;
}

function isCountrySpecificSection232(entry) {
  if (["9903.82.04", "9903.82.05", "9903.85.67", "9903.85.68"].includes(entry.chapter99)) {
    return true;
  }
  const text = `${entry.chapter99} ${entry.context}`.toLowerCase();
  return /united kingdom|russia|russian|argentina|australia|brazil|canada|mexico|general note 3\(b\)/i.test(text);
}

function parseSimplePercent(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function normalizeHtsDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function expandQuery(query) {
  const direct = chineseAliases.get(query);
  if (direct) {
    return direct;
  }

  if (!/[\u3400-\u9fff]/.test(query)) {
    return query;
  }

  const matches = [];
  for (const [term, english] of chineseAliases.entries()) {
    if (query.includes(term)) {
      matches.push(english);
    }
  }
  return matches.length ? [...new Set(matches)].join(" ") : query;
}

function buildServerSearchPlan(query) {
  const originalQuery = cleanValue(query);
  const normalizedQuery = normalizeSearchText(originalQuery);
  const digits = normalizeHtsDigits(originalQuery);

  if (digits.length >= 4 || !hasChineseText(originalQuery)) {
    return {
      originalQuery,
      primaryQuery: originalQuery,
      queries: [originalQuery],
      displayQuery: originalQuery,
      aliasMatched: false,
      plan: {
        terms: splitSearchTerms(normalizedQuery),
        chineseTerms: hasChineseText(originalQuery) ? [normalizedQuery] : [],
        chapterBoosts: new Set(),
        prefixBoosts: [],
        requireAllTerms: !digits,
        minimumMatches: 1
      }
    };
  }

  const catalogMatches = chineseSearchCatalog
    .map((entry) => ({
      ...entry,
      matchedTerms: entry.terms.filter((term) => normalizedQuery.includes(normalizeSearchText(term)))
    }))
    .filter((entry) => entry.matchedTerms.length)
    .sort((a, b) => longestTermLength(b.matchedTerms) - longestTermLength(a.matchedTerms));
  const maxMatchedLength = Math.max(0, ...catalogMatches.flatMap((entry) => entry.matchedTerms).map((term) => [...term].length));
  const focusedCatalogMatches = maxMatchedLength > 1
    ? catalogMatches.filter((entry) => longestTermLength(entry.matchedTerms) > 1)
    : catalogMatches;
  const hasProductMatch = focusedCatalogMatches.some((entry) => !isMaterialCatalogEntry(entry));
  const nonMaterialMatches = hasProductMatch
    ? focusedCatalogMatches.filter((entry) => !isMaterialCatalogEntry(entry))
    : focusedCatalogMatches;
  const maxPrimaryLength = Math.max(0, ...nonMaterialMatches.map((entry) => longestTermLength(entry.matchedTerms)));
  const primaryCatalogMatches = maxPrimaryLength > 1
    ? nonMaterialMatches.filter((entry) => longestTermLength(entry.matchedTerms) === maxPrimaryLength)
    : nonMaterialMatches;

  const legacyExpanded = expandQuery(originalQuery);
  const legacyTerms = !primaryCatalogMatches.length && legacyExpanded !== originalQuery ? splitSearchTerms(legacyExpanded) : [];
  const terms = [
    ...new Set([
      ...primaryCatalogMatches.flatMap((entry) => entry.queries).map(normalizeSearchText),
      ...legacyTerms.map(normalizeSearchText)
    ].filter(Boolean))
  ];
  const chineseTerms = [
    ...new Set([
      ...primaryCatalogMatches.flatMap((entry) => entry.matchedTerms).map(normalizeSearchText),
      normalizedQuery
    ].filter(Boolean))
  ];
  const chapterBoosts = new Set(primaryCatalogMatches.flatMap((entry) => entry.chapters || []));
  const prefixBoosts = [
    ...new Set(primaryCatalogMatches.flatMap((entry) => entry.prefixBoosts || []).map(normalizeHtsDigits).filter(Boolean))
  ];

  const queries = buildServerSearchQueries(terms, originalQuery);
  return {
    originalQuery,
    primaryQuery: queries[0] || originalQuery,
    queries,
    displayQuery: terms.length ? terms.slice(0, 6).join(" / ") : originalQuery,
    aliasMatched: primaryCatalogMatches.length > 0 || legacyTerms.length > 0,
    plan: {
      terms,
      chineseTerms,
      chapterBoosts,
      prefixBoosts,
      requireAllTerms: false,
      minimumMatches: 1
    }
  };
}

function buildServerSearchQueries(terms, originalQuery) {
  const queries = [];
  for (const term of terms) {
    if (term && !queries.includes(term)) {
      queries.push(term);
    }
  }
  const compact = terms.slice(0, 4).join(" ").trim();
  if (compact && !queries.includes(compact)) {
    queries.unshift(compact);
  }
  if (!queries.length) {
    queries.push(originalQuery);
  }
  return queries.slice(0, 10);
}

async function searchHtsRowsByPlan(searchPlan, force = false) {
  const rowsByKey = new Map();

  for (const query of searchPlan.queries) {
    const data = await usitcJson(
      `search?keyword=${encodeURIComponent(query)}`,
      `search:${query}`,
      ttl.search,
      force
    );
    const rows = await normalizeSearchRows(getRows(data), query, force);
    for (const row of rows) {
      const key = `${row.htsno}|${row.description}|${row.general}`;
      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, row);
      }
    }
  }

  const rows = [...rowsByKey.values()];
  if (!rows.length) {
    return [];
  }

  return rankRowsBySearchPlan(rows, searchPlan.plan).slice(0, 300);
}

async function searchStaticIndexRowsByPlan(searchPlan) {
  const indexPath = path.join(publicDir, "data", "hts-search-index.json");
  const data = JSON.parse(await readFile(indexPath, "utf8"));
  const rows = buildServerSearchCandidates(data.value || [])
    .map((candidate) => ({ row: candidate.row, score: scoreServerSearchCandidate(candidate, searchPlan.plan) }))
    .filter((item) => item.row.htsno && item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.row.htsno || "").localeCompare(String(b.row.htsno || "")))
    .map((item) => item.row)
    .slice(0, 300);
  return rows;
}

function buildServerSearchCandidates(rows) {
  const stack = [];
  return rows.map((row) => {
    const indent = Number(row.indent || 0);
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const ownText = `${row.description || ""} ${row.descriptionZh || ""}`;
    const parentText = stack.map((item) => item.text).join(" ");

    if (ownText.trim()) {
      stack.push({ indent, text: ownText });
    }

    return { row, ownText, parentText };
  });
}

function rankRowsBySearchPlan(rows, plan) {
  return rows
    .map((row) => ({ row, score: scoreServerSearchRow(row, plan) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.row.htsno || "").localeCompare(String(b.row.htsno || "")))
    .map((item) => item.row);
}

function scoreServerSearchCandidate(candidate, plan) {
  const row = candidate.row;
  const ownHaystack = normalizeSearchText(`${row.htsno || ""} ${candidate.ownText || ""}`);
  const parentHaystack = normalizeSearchText(candidate.parentText || "");
  const descriptionHaystack = normalizeSearchText(candidate.ownText || "");
  let score = 0;
  let matches = 0;

  for (const term of plan.terms || []) {
    let termScore = scoreSearchTerm(ownHaystack, term);
    if (termScore <= 0 && !hasNegativeSearchContext(parentHaystack, term)) {
      termScore = Math.floor(scoreSearchTerm(parentHaystack, term) * 0.35);
    }
    if (termScore > 0) {
      score += staticDescriptionStartsWithTermServer(descriptionHaystack, term) ? termScore + 60 : termScore;
      matches += 1;
    } else if (plan.requireAllTerms) {
      return 0;
    }
  }

  for (const term of plan.chineseTerms || []) {
    const termScore = scoreSearchTerm(ownHaystack, term) || Math.floor(scoreSearchTerm(parentHaystack, term) * 0.35);
    if (termScore > 0) {
      score += termScore + 15;
      matches += 1;
    }
  }

  if (!matches || matches < (plan.minimumMatches || 1)) {
    return 0;
  }

  const ownTermMatches = (plan.terms || []).filter((term) => scoreSearchTerm(ownHaystack, term) > 0).length;
  if (ownTermMatches >= 2) {
    score += 45 + ownTermMatches * 15;
  }

  const htsDigits = normalizeHtsDigits(row.htsno);
  if (htsDigits && plan.chapterBoosts?.has(htsDigits.slice(0, 2))) {
    score += 80;
  }
  for (const prefix of plan.prefixBoosts || []) {
    if (htsDigits.startsWith(prefix)) {
      score += prefix.length >= 6 ? 260 : prefix.length >= 4 ? 170 : 90;
    }
  }

  return score + scoreSearchSpecificity(row) - scoreServerAccessoryPenalty(row, plan);
}

function scoreServerSearchRow(row, plan) {
  const haystack = normalizeSearchText(`${row.htsno || ""} ${row.description || ""} ${row.descriptionZh || ""}`);
  const description = normalizeSearchText(`${row.description || ""} ${row.descriptionZh || ""}`);
  let score = 0;
  let matches = 0;

  for (const term of plan.terms || []) {
    const termScore = scoreSearchTerm(haystack, term);
    if (termScore > 0) {
      score += staticDescriptionStartsWithTermServer(description, term) ? termScore + 60 : termScore;
      matches += 1;
    } else if (plan.requireAllTerms) {
      return 0;
    }
  }

  for (const term of plan.chineseTerms || []) {
    const termScore = scoreSearchTerm(haystack, term);
    if (termScore > 0) {
      score += termScore + 15;
      matches += 1;
    }
  }

  if (!matches || matches < (plan.minimumMatches || 1)) {
    return 0;
  }

  const ownTermMatches = (plan.terms || []).filter((term) => scoreSearchTerm(haystack, term) > 0).length;
  if (ownTermMatches >= 2) {
    score += 45 + ownTermMatches * 15;
  }

  const htsDigits = normalizeHtsDigits(row.htsno);
  if (htsDigits && plan.chapterBoosts?.has(htsDigits.slice(0, 2))) {
    score += 80;
  }
  for (const prefix of plan.prefixBoosts || []) {
    if (htsDigits.startsWith(prefix)) {
      score += prefix.length >= 6 ? 260 : prefix.length >= 4 ? 170 : 90;
    }
  }

  return score + scoreSearchSpecificity(row) - scoreServerAccessoryPenalty(row, plan);
}

function scoreServerAccessoryPenalty(row, plan) {
  const text = normalizeSearchText(`${row.description || ""} ${row.descriptionZh || ""}`);
  const queryTerms = [...(plan.terms || []), ...(plan.chineseTerms || [])].map((term) => normalizeSearchText(term));
  let penalty = 0;

  if (queryTerms.some((term) => term === "mango" || term === "mangoes" || term === "芒果") && /\bmangosteens?\b/.test(text)) {
    penalty += 260;
  }
  if (queryTerms.some((term) => term.includes("christmas tree") || term === "圣诞树") && /\bartificial\b/.test(text)) {
    penalty += 260;
  }

  const watchQuery = (plan.prefixBoosts || []).some((prefix) => ["9101", "9102", "9103", "9105"].includes(prefix));
  if (watchQuery && /^straps,\s*bands\s+or\s+bracelets\s+entered\s+with\s+watches/.test(text)) {
    penalty += 220;
  }
  return penalty;
}

function scoreSearchTerm(haystack, term) {
  const normalized = normalizeSearchText(term);
  if (!normalized) {
    return 0;
  }
  if (hasChineseText(normalized)) {
    return haystack.includes(normalized) ? 40 : 0;
  }
  const pattern = escapeRegExp(normalized).replace(/\s+/g, "\\s+");
  const boundaryPattern = new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, "i");
  if (boundaryPattern.test(haystack)) {
    return 20 + Math.min(35, normalized.length);
  }
  return normalized.length >= 4 && haystack.includes(normalized) ? 8 : 0;
}

function hasNegativeSearchContext(haystack, term) {
  const normalized = normalizeSearchText(term);
  if (!normalized || hasChineseText(normalized)) {
    return false;
  }
  const pattern = escapeRegExp(normalized).replace(/\s+/g, "\\s+");
  return new RegExp(`\\b(?:except|excluding|exclude|other\\s+than|not)\\b[^.;:]{0,90}${pattern}`, "i").test(haystack);
}

function staticDescriptionStartsWithTermServer(description, term) {
  const normalized = normalizeSearchText(term);
  if (!normalized) {
    return false;
  }
  if (hasChineseText(normalized)) {
    return description.startsWith(normalized);
  }
  const pattern = escapeRegExp(normalized).replace(/\s+/g, "\\s+");
  return new RegExp(`^${pattern}([^a-z0-9]|$)`, "i").test(description);
}

function splitSearchTerms(value) {
  return String(value || "")
    .split(/[\s,，;；/、|]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[，。；：、（）【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function longestTermLength(terms) {
  return Math.max(0, ...terms.map((term) => [...String(term || "")].length));
}

function normalizeRows(rows) {
  return applyRowInheritance(rows.map((row) => {
    const description = cleanHtml(row.description);
    const footnotes = normalizeFootnotes(row.footnotes);
    const additionalDuties = cleanHtml(row.additionalDuties || row.addiitionalDuties);
    return {
      htsno: cleanValue(row.htsno),
      statisticalSuffix: cleanValue(row.statisticalSuffix),
      description,
      descriptionEn: description,
      descriptionZh: translateDescription(description),
      indent: Number(row.indent || 0),
      units: normalizeUnits(row.units),
      general: cleanHtml(row.general),
      special: cleanHtml(row.special),
      other: cleanHtml(row.other),
      additionalDuties,
      additionalDutyCodes: extractAdditionalDutyCodes(footnotes, additionalDuties),
      quotaQuantity: cleanHtml(row.quotaQuantity),
      effectivePeriod: cleanHtml(row.effectivePeriod),
      footnotes,
      superior: row.superior === true || row.superior === "true",
      unique: row.unique === true || row.unique === "true",
      status: cleanValue(row.status)
    };
  }));
}

async function normalizeSearchRows(rows, query, force = false) {
  const normalized = normalizeRows(rows);
  const parentContextCache = new Map();

  for (const row of normalized) {
    if (!needsParentContext(row)) {
      continue;
    }

    const parentQueries = getParentContextQueries(row.htsno || query);
    for (const parentQuery of parentQueries) {
      let parentRows = parentContextCache.get(parentQuery);
      if (!parentRows) {
        const parentData = await usitcJson(
          `search?keyword=${encodeURIComponent(parentQuery)}`,
          `search:${parentQuery}`,
          ttl.search,
          force
        );
        parentRows = normalizeRows(getRows(parentData));
        parentContextCache.set(parentQuery, parentRows);
      }

      const parent = findBestParentContext(row, parentRows);
      if (parent) {
        mergeInheritedFields(row, parent);
        break;
      }
    }
  }

  return rankSearchRows(normalized);
}

async function findHtsFallbackRows(query, force = false) {
  const digits = normalizeHtsDigits(query);
  if (digits.length < 4) {
    return [];
  }

  const chapter = digits.slice(0, 2);
  if (!/^(0[1-9]|[1-9][0-9])$/.test(chapter) || Number(chapter) > 99) {
    return [];
  }

  const from = `${chapter}00`;
  const to = chapter === "99" ? "9999" : `${String(Number(chapter) + 1).padStart(2, "0")}00`;
  const data = await usitcJson(
    `exportList?from=${from}&to=${to}&format=JSON&styles=false`,
    `chapter:${chapter}`,
    ttl.chapter,
    force
  );
  const rows = normalizeRows(getRows(data)).filter((row) => row.htsno);

  const exact = rows.filter((row) => normalizeHtsDigits(row.htsno) === digits);
  if (exact.length) {
    return exact;
  }

  const parentMatches = rows.filter((row) => {
    const rowDigits = normalizeHtsDigits(row.htsno);
    return rowDigits && digits.startsWith(rowDigits);
  });
  if (parentMatches.length) {
    const bestLength = Math.max(...parentMatches.map((row) => normalizeHtsDigits(row.htsno).length));
    return parentMatches.filter((row) => normalizeHtsDigits(row.htsno).length === bestLength);
  }

  const childMatches = rows.filter((row) => {
    const rowDigits = normalizeHtsDigits(row.htsno);
    return rowDigits && rowDigits.startsWith(digits);
  });
  if (childMatches.length) {
    const bestLength = Math.min(...childMatches.map((row) => normalizeHtsDigits(row.htsno).length));
    return childMatches
      .filter((row) => normalizeHtsDigits(row.htsno).length === bestLength)
      .slice(0, 50);
  }

  return [];
}

function rankSearchRows(rows) {
  return [...rows].sort((a, b) => scoreSearchSpecificity(b) - scoreSearchSpecificity(a) || String(a.htsno || "").localeCompare(String(b.htsno || "")));
}

function scoreSearchSpecificity(row) {
  const digits = normalizeHtsDigits(row.htsno);
  let score = 0;

  if (digits.length >= 10) {
    score += 120;
  } else if (digits.length >= 8) {
    score += 95;
  } else if (digits.length >= 6) {
    score += 45;
  } else if (digits.length >= 4) {
    score += 5;
  }

  if (String(row.general || "").trim()) {
    score += 30;
  } else {
    score -= 30;
  }

  if (String(row.description || "").trim().endsWith(":")) {
    score -= 20;
  }

  return score;
}

function applyRowInheritance(rows) {
  const stack = [];
  return rows.map((row) => {
    const indent = Number(row.indent || 0);
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = [...stack].reverse().find((candidate) => hasInheritableDutyFields(candidate));
    if (parent && needsInheritedDutyFields(row)) {
      mergeInheritedFields(row, parent);
    }
    stack.push(row);
    return row;
  });
}

function needsParentContext(row) {
  const digits = normalizeHtsDigits(row.htsno);
  return digits.length >= 8 && needsInheritedDutyFields(row);
}

function needsInheritedDutyFields(row) {
  return !row.general || !row.special && !row.other || !(row.additionalDutyCodes || []).length;
}

function hasInheritableDutyFields(row) {
  return Boolean(row.general || row.special || row.other || (row.additionalDutyCodes || []).length);
}

function getParentContextQueries(value) {
  const digits = normalizeHtsDigits(value);
  const lengths = [8, 6, 4].filter((length) => digits.length > length);
  return [...new Set(lengths.map((length) => digits.slice(0, length)))];
}

function findBestParentContext(row, parentRows) {
  const childDigits = normalizeHtsDigits(row.htsno);
  return parentRows
    .filter((candidate) => {
      const parentDigits = normalizeHtsDigits(candidate.htsno);
      return parentDigits && parentDigits.length < childDigits.length && childDigits.startsWith(parentDigits) && hasInheritableDutyFields(candidate);
    })
    .sort((a, b) => normalizeHtsDigits(b.htsno).length - normalizeHtsDigits(a.htsno).length)[0];
}

function mergeInheritedFields(row, parent) {
  const inheritedFields = new Set(row.inheritedFields || []);
  for (const field of ["general", "special", "other", "additionalDuties", "quotaQuantity", "effectivePeriod"]) {
    if (!row[field] && parent[field]) {
      row[field] = parent[field];
      inheritedFields.add(field);
    }
  }

  const inheritedCodes = parent.additionalDutyCodes || [];
  if (inheritedCodes.length) {
    row.additionalDutyCodes = [...new Set([...(row.additionalDutyCodes || []), ...inheritedCodes])];
    inheritedFields.add("additionalDutyCodes");
  }

  if (!(row.footnotes || []).length && (parent.footnotes || []).length) {
    row.footnotes = parent.footnotes.map((note) => ({ ...note, inheritedFrom: parent.htsno }));
    inheritedFields.add("footnotes");
  }

  if (inheritedFields.size) {
    row.inheritedFrom = row.inheritedFrom || parent.htsno;
    row.inheritedFields = [...inheritedFields];
  }
  return row;
}

function normalizeUnits(units) {
  if (Array.isArray(units)) {
    return units.filter(Boolean).map(cleanHtml);
  }
  const unit = cleanHtml(units);
  return unit ? [unit] : [];
}

function extractAdditionalDutyCodes(footnotes, additionalDuties) {
  const source = [
    additionalDuties,
    ...footnotes.map((note) => note.value)
  ].join(" ");
  const matches = source.match(/\b99\d{2}\.\d{2}\.\d{2}\b/g) || [];
  return [...new Set(matches)];
}

function translateDescription(description) {
  const text = cleanValue(description);
  if (!text) {
    return "";
  }

  const shortTranslation = translateShortClassification(text);
  if (shortTranslation) {
    return shortTranslation;
  }

  const exact = exactDescriptionTranslations.get(text.replace(/\s+/g, " "));
  if (exact) {
    return exact;
  }

  let translated = text;
  for (const [english, chinese] of phraseTranslations) {
    translated = translated.replace(new RegExp(escapeRegExp(english), "gi"), chinese);
  }

  translated = translated
    .replace(/;/g, "；")
    .replace(/:/g, "：")
    .replace(/\s*,\s*/g, "，")
    .replace(/\((\d+[A-Z]?)\)/gi, "（$1）")
    .replace(/\s+/g, " ")
    .trim();

  if (translated === text) {
    return text;
  }

  return translated;
}

function translateShortClassification(text) {
  const normalized = text.replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  const shortTerms = new Map([
    ["Men's", "男式"],
    ["Women's", "女式"],
    ["Boys'", "男童"],
    ["Girls'", "女童"],
    ["Children's", "儿童"],
    ["Infants'", "婴幼儿"]
  ]);

  const match = normalized.match(/^(Men's|Women's|Boys'|Girls'|Children's|Infants')(?:\s*\(([^)]+)\))?$/i);
  if (!match) {
    return "";
  }

  const label = [...shortTerms.entries()]
    .find(([english]) => english.toLowerCase() === match[1].toLowerCase())?.[1];
  if (!label) {
    return "";
  }

  return match[2] ? `${label}（${match[2]}）` : label;
}

async function enrichDescriptionTranslations(rows, force = false) {
  const descriptions = [...new Set(rows
    .map((row) => cleanValue(row.description))
    .filter(Boolean))];
  const translated = new Map();
  const pending = [];

  for (const description of descriptions) {
    const exact = translateShortClassification(description) || exactDescriptionTranslations.get(description.replace(/\s+/g, " "));
    if (exact) {
      translated.set(description, exact);
      continue;
    }

    const cached = getCachedTranslation(description, force);
    if (cached) {
      translated.set(description, cached);
      continue;
    }

    pending.push(description);
  }

  const onlineTranslations = await translateBatchOnline(pending, force);
  for (const description of pending) {
    const online = onlineTranslations.get(description);
    if (hasChineseText(online)) {
      translated.set(description, online);
      setCachedTranslation(description, online);
      continue;
    }

    const local = translateDescription(description);
    translated.set(description, hasChineseText(local) ? local : `中文释义待核：${description}`);
  }

  for (const row of rows) {
    const description = cleanValue(row.description);
    if (translated.has(description)) {
      row.descriptionZh = translated.get(description);
    }
  }
  return rows;
}

async function translateBatchOnline(descriptions, force = false) {
  const translated = new Map();
  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const description of descriptions) {
    const nextLength = currentLength + description.length + 32;
    if (current.length && (current.length >= 3 || nextLength > 900)) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(description);
    currentLength += description.length + 32;
  }
  if (current.length) {
    chunks.push(current);
  }

  await mapLimit(chunks, 2, async (chunk) => {
    const chunkTranslations = await translateChunkOnline(chunk, force);
    for (const [description, translation] of chunkTranslations.entries()) {
      translated.set(description, translation);
    }
  });

  return translated;
}

async function translateChunkOnline(descriptions, force = false) {
  const delimiter = "@@HTS_TRANSLATE_SPLIT@@";
  const translated = new Map();
  if (!descriptions.length) {
    return translated;
  }

  try {
    const joined = descriptions.join(`\n${delimiter}\n`);
    const joinedTranslation = await translateOnline(joined, force);
    const parts = joinedTranslation
      .split(new RegExp(`\\s*${escapeRegExp(delimiter)}\\s*`, "g"))
      .map(normalizeChineseTranslation);

    if (parts.length === descriptions.length) {
      descriptions.forEach((description, index) => translated.set(description, parts[index]));
      return translated;
    }
  } catch {
    // Fall back to per-item translation below.
  }

  await mapLimit(descriptions, 2, async (description) => {
    try {
      const single = await translateOnline(description, force);
      if (hasChineseText(single)) {
        translated.set(description, single);
      }
    } catch {
      // Fall back to local phrase translation below.
    }
  });

  if (descriptions.every((description) => translated.has(description))) {
    return translated;
  }

  for (const description of descriptions) {
    if (translated.has(description)) {
      continue;
    }
    const local = translateDescription(description);
    translated.set(description, hasChineseText(local) ? local : "");
  }
  return translated;
}

async function translateDescriptionWithFallback(description, force = false) {
  const text = cleanValue(description);
  if (!text) {
    return "";
  }

  const exact = translateShortClassification(text) || exactDescriptionTranslations.get(text.replace(/\s+/g, " "));
  if (exact) {
    return exact;
  }

  const local = translateDescription(text);
  try {
    const online = await translateOnline(text, force);
    if (hasChineseText(online)) {
      return normalizeChineseTranslation(online);
    }
  } catch {
    // Keep the app usable when the translation helper is unreachable.
  }

  return hasChineseText(local) ? local : `中文释义待核：${text}`;
}

async function translateOnline(text, force = false) {
  const normalized = cleanValue(text);
  const key = `translate:zh-CN:${normalized}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (!force && cached && now - cached.time < ttl.translation) {
    return cached.data;
  }

  const params = new URLSearchParams({
    q: normalized,
    langpair: "en|zh-CN"
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(`${TRANSLATE_API_BASE}?${params}`, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "HTS-Clearance-Assistant/0.1"
    },
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`Translation request failed: ${response.status} ${response.statusText}`);
  }

  const data = JSON.parse(await response.text());
  const translated = data?.responseData?.translatedText || "";
  const cleaned = normalizeChineseTranslation(translated);
  cache.set(key, { time: now, data: cleaned });
  return cleaned;
}

function getCachedTranslation(text, force = false) {
  const normalized = cleanValue(text);
  const cached = cache.get(`translate:zh-CN:${normalized}`);
  if (!force && cached && Date.now() - cached.time < ttl.translation) {
    return cached.data;
  }
  return "";
}

function setCachedTranslation(text, translation) {
  const normalized = cleanValue(text);
  const cleaned = normalizeChineseTranslation(translation);
  if (normalized && cleaned) {
    cache.set(`translate:zh-CN:${normalized}`, { time: Date.now(), data: cleaned });
  }
}

function normalizeChineseTranslation(value) {
  return cleanValue(value)
    .replace(/;/g, "；")
    .replace(/:/g, "：")
    .replace(/\s*,\s*/g, "，")
    .replace(/\((\d+[A-Z]?)\)/gi, "（$1）")
    .replace(/\s+/g, " ")
    .trim();
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

async function mapLimit(items, limit, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRows(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.value)) {
    return data.value;
  }
  return [];
}

function normalizeFootnotes(footnotes) {
  if (!Array.isArray(footnotes)) {
    return [];
  }

  return footnotes
    .filter(Boolean)
    .map((note) => ({
      columns: Array.isArray(note.columns) ? note.columns.join(", ") : cleanValue(note.columns),
      marker: cleanValue(note.marker),
      value: cleanHtml(note.value),
      type: cleanValue(note.type)
    }));
}

function cleanHtml(value) {
  return cleanValue(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/Â¢/g, "¢")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanValue(value) {
  return value == null ? "" : String(value).replace(/Â¢/g, "¢").trim();
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, payload) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(payload);
}
