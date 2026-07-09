export const certificationCatalog = [
  {
    id: "aluminum-license",
    sequence: 1,
    agency: "ITA",
    nameZh: "Aluminum License（铝制品进口许可证）",
    nameEn: "Aluminum Import License",
    category: "import-license",
    status: "high",
    rule: {
      mode: "any",
      prefixes: ["7601", "7604", "7605", "7606", "7607", "7608", "7609", "7610", "7612", "7616"]
    },
    summary: "铝制品监控与许可。命中 AIM 当前 HTS 范围时，进口申报通常需要按 ITA Aluminum Import Monitoring 系统办理许可证。",
    explanation: "适用于 ITA 公布的铝产品 HTS 清单。仅凭 HTS 可做高概率提示，但仍需核对具体统计后缀、产品形态和当前 AIM 清单。",
    sourceName: "ITA Aluminum Products HTS Codes",
    sourceUrl: "https://www.trade.gov/aluminum-products-hts-codes"
  },
  {
    id: "fda-food-cosmetic-medical",
    sequence: 2,
    agency: "FDA",
    nameZh: "FDA 监管提示",
    nameEn: "FDA Regulated Product",
    category: "pga",
    status: "review",
    rule: {
      mode: "any",
      prefixes: [
        "03", "04", "07", "08", "09", "10", "11", "12", "13", "15", "16", "17", "18", "19", "20", "21", "22",
        "3003", "3004", "3005", "3006", "3303", "3304", "3305", "3306", "3307", "9018", "9019", "9020", "9021", "9022"
      ],
      keywords: [
        "food", "seafood", "supplement", "cosmetic", "drug", "medicine", "medical device", "radiation-emitting",
        "食品", "海鲜", "保健品", "化妆品", "药品", "医疗器械", "辐射产品"
      ]
    },
    summary: "食品、化妆品、药品、医疗器械、辐射产品等可能触发 FDA 监管和 Product Code 要求。",
    explanation: "FDA 监管通常不能只靠 HTS 最终确认，还需要产品用途、标签、成分、加工方式、预期使用人群等信息，并据此选择 FDA Product Code。",
    sourceName: "FDA Product Codes and Product Code Builder",
    sourceUrl: "https://www.fda.gov/industry/import-program-tools/product-codes-and-product-code-builder"
  },
  {
    id: "fda-tobacco",
    sequence: 3,
    agency: "FDA",
    nameZh: "FDA Tobacco（烟草/尼古丁产品）",
    nameEn: "FDA Tobacco Products",
    category: "pga",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["24"],
      keywords: ["tobacco", "nicotine", "vape", "e-cigarette", "烟草", "尼古丁", "电子烟", "烟弹"]
    },
    summary: "烟草、尼古丁、电子烟相关商品可能触发 FDA 烟草产品监管。",
    explanation: "需要结合产品形态、尼古丁来源、用途、标签和 FDA 烟草产品规则确认。HTS 仅提供风险提示。",
    sourceName: "FDA Product Codes and Product Code Builder",
    sourceUrl: "https://www.fda.gov/industry/import-program-tools/product-codes-and-product-code-builder"
  },
  {
    id: "cpsc-cpc-toys",
    sequence: 4,
    agency: "CPSC",
    nameZh: "CPC 儿童产品证书",
    nameEn: "Children's Product Certificate",
    category: "consumer-safety",
    status: "high",
    rule: {
      mode: "any",
      prefixes: ["9503"],
      keywords: ["toy", "toys", "doll", "dolls", "玩具", "娃娃"]
    },
    summary: "儿童玩具和儿童用品通常需要 CPSC 第三方测试与 Children's Product Certificate。",
    explanation: "CPSC 要求儿童产品按适用安全规则进行测试和认证。是否为儿童产品取决于设计意图、年龄标识、营销方式和产品特征。",
    sourceName: "CPSC Children's Product Certificate",
    sourceUrl: "https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Childrens-Product-Certificate"
  },
  {
    id: "cpsc-child-apparel",
    sequence: 5,
    agency: "CPSC",
    nameZh: "CPSC 儿童服装/儿童纺织品",
    nameEn: "CPSC Children's Apparel",
    category: "consumer-safety",
    status: "review",
    rule: {
      mode: "all",
      prefixes: ["61", "62", "63", "64"],
      keywords: ["children", "child", "kids", "baby", "infant", "toddler", "儿童", "婴儿", "童装", "宝宝"]
    },
    summary: "儿童服装、儿童纺织品、儿童鞋类可能触发 CPSC 儿童产品证书及可燃性/小部件等规则。",
    explanation: "服装类需结合年龄段、尺码、用途、材料和是否儿童产品判断。儿童产品通常需 CPC；一般用途产品可能适用 GCC 或其他标签/安全规则。",
    sourceName: "CPSC Children's Product Certificate",
    sourceUrl: "https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Childrens-Product-Certificate"
  },
  {
    id: "fcc-rf-device",
    sequence: 6,
    agency: "FCC",
    nameZh: "FCC 设备授权",
    nameEn: "FCC Equipment Authorization",
    category: "radio-frequency",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["8471", "8517", "8525", "8526", "8527", "8528", "8543", "9503"],
      keywords: [
        "wireless", "wifi", "wi-fi", "bluetooth", "radio", "rf", "transmitter", "router", "antenna", "drone", "smart",
        "无线", "蓝牙", "路由器", "射频", "发射器", "天线", "无人机", "智能"
      ]
    },
    summary: "带无线、蓝牙、WiFi、射频发射/接收功能的电子设备可能需要 FCC 设备授权。",
    explanation: "FCC 规则通常要求射频设备在进口、销售或使用前完成适当的设备授权程序。是否适用取决于 RF 功能、频段、功率和设备类型。",
    sourceName: "FCC Equipment Authorization",
    sourceUrl: "https://www.fcc.gov/engineering-technology/laboratory-division/general/equipment-authorization"
  },
  {
    id: "epa-tsca-chemical",
    sequence: 7,
    agency: "EPA",
    nameZh: "EPA TSCA 化学品进口声明",
    nameEn: "EPA TSCA Import Certification",
    category: "chemical",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["28", "29", "32", "34", "35", "38"],
      keywords: ["chemical", "resin", "polymer", "solvent", "paint", "adhesive", "化学品", "树脂", "聚合物", "溶剂", "涂料", "胶粘剂"]
    },
    summary: "化学物质、混合物或含化学物质商品可能涉及 TSCA 正/负声明。",
    explanation: "EPA 说明进口化学品需符合 TSCA，进口商通常需声明商品受 TSCA 约束并合规，或不受 TSCA 约束。部分成品/其他法规监管商品可能有例外。",
    sourceName: "EPA TSCA Requirements for Importing Chemicals",
    sourceUrl: "https://www.epa.gov/tsca-import-export-requirements/tsca-requirements-importing-chemicals"
  },
  {
    id: "epa-pesticide-noa",
    sequence: 8,
    agency: "EPA",
    nameZh: "EPA 农药/杀虫剂 Notice of Arrival",
    nameEn: "EPA Notice of Arrival for Pesticides",
    category: "pesticide",
    status: "high",
    rule: {
      mode: "any",
      prefixes: ["3808"],
      keywords: ["pesticide", "insecticide", "fungicide", "rodenticide", "disinfectant", "农药", "杀虫剂", "杀菌剂", "灭鼠剂", "消毒剂"]
    },
    summary: "农药和相关设备可能需要 EPA Notice of Arrival。",
    explanation: "EPA/FIFRA 相关进口通常要求按规定提交农药及设备到货通知。具体适用取决于产品标签、有效成分、用途和 EPA 注册状态。",
    sourceName: "EPA Importing and Exporting Pesticides",
    sourceUrl: "https://www.epa.gov/pesticides/importing-and-exporting-pesticides"
  },
  {
    id: "epa-vehicle-engine",
    sequence: 9,
    agency: "EPA",
    nameZh: "EPA 车辆/发动机排放合规",
    nameEn: "EPA Vehicles and Engines Import Requirements",
    category: "vehicle-engine",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["8407", "8408", "8701", "8702", "8703", "8704", "8705", "8711", "8903"],
      keywords: ["engine", "vehicle", "motorcycle", "atv", "generator", "发动机", "车辆", "摩托车", "发电机"]
    },
    summary: "车辆、发动机、非道路发动机设备可能涉及 EPA 排放合规和进口声明。",
    explanation: "EPA 对机动车、发动机、重型道路发动机、娱乐车辆、非道路发动机等进口有排放法规和申报要求。需结合产品类型、用途和制造年份确认。",
    sourceName: "EPA Importing Vehicles and Engines",
    sourceUrl: "https://www.epa.gov/importing-vehicles-and-engines"
  },
  {
    id: "dot-nhtsa-vehicle",
    sequence: 10,
    agency: "DOT / NHTSA",
    nameZh: "DOT/NHTSA 车辆及设备合规",
    nameEn: "DOT / NHTSA Vehicle and Equipment Requirements",
    category: "vehicle-safety",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["4011", "8701", "8702", "8703", "8704", "8705", "8708", "8711", "8512"],
      keywords: ["vehicle", "motor vehicle", "tire", "brake", "lamp", "seat belt", "汽车", "车辆", "轮胎", "刹车", "车灯", "安全带"]
    },
    summary: "车辆、轮胎、车辆安全部件可能涉及 DOT/NHTSA 进口和 FMVSS 合规要求。",
    explanation: "NHTSA 对受联邦安全、保险杠和防盗标准约束的车辆及设备有进口规则。是否适用需看是否为机动车/受监管设备及具体 FMVSS 项目。",
    sourceName: "NHTSA Importing a Vehicle",
    sourceUrl: "https://www.nhtsa.gov/importing-vehicle"
  },
  {
    id: "ftc-textile-labeling",
    sequence: 11,
    agency: "FTC",
    nameZh: "服装/纺织品标签要求",
    nameEn: "Textile and Apparel Labeling",
    category: "labeling",
    status: "high",
    rule: {
      mode: "any",
      prefixes: ["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "63"],
      keywords: ["textile", "apparel", "clothing", "garment", "fabric", "wool", "服装", "纺织", "面料", "羊毛"]
    },
    summary: "多数纺织、羊毛和服装产品需要标注纤维成分、原产国和责任方身份，服装还可能需要护理标签。",
    explanation: "FTC 纺织/羊毛规则通常要求标签披露纤维成分、原产国和制造商/营销商身份。具体要求需结合产品类型、材料和销售形态确认。",
    sourceName: "FTC Clothing and Textiles",
    sourceUrl: "https://www.ftc.gov/business-guidance/industry/clothing-and-textiles"
  },
  {
    id: "aphis-lacey-wood",
    sequence: 12,
    agency: "APHIS",
    nameZh: "Lacey Act 木制品/植物产品申报",
    nameEn: "Lacey Act Declaration",
    category: "wood-plant",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["44", "4601", "4602", "9403", "9701"],
      keywords: ["wood", "bamboo", "rattan", "plant", "timber", "木", "木制", "竹", "藤", "植物"]
    },
    summary: "木制品、竹藤制品、部分植物来源商品可能需要 Lacey Act 植物产品申报。",
    explanation: "APHIS Lacey Act 申报通常需要植物学名、采伐国家、数量、价值等信息。HTS 命中仅提示风险，实际需核对 Lacey Act 阶段清单和商品材质。",
    sourceName: "APHIS Lacey Act Requirements",
    sourceUrl: "https://www.aphis.usda.gov/plant-imports/file-lacey-act-declaration/requirements"
  }
];
