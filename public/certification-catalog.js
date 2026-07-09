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
    sequence: 12,
    agency: "FDA",
    nameZh: "FDA 其他监管提示",
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
    explanation: "这是 FDA 兜底提示。若已命中 FD4、药品、医疗器械、化妆品、辐射产品等更具体规则，页面会优先展示具体类型；最终仍需结合产品用途、标签、成分、加工方式、预期使用人群等信息确认 FDA Product Code。",
    sourceName: "FDA Product Codes and Product Code Builder",
    sourceUrl: "https://www.fda.gov/industry/import-program-tools/product-codes-and-product-code-builder"
  },
  {
    id: "fda-prior-notice-fd4",
    sequence: 2,
    agency: "FDA / CBP",
    nameZh: "FD4 FDA Prior Notice（食品入关前通知）",
    nameEn: "FDA Prior Notice for Imported Food",
    category: "pga",
    status: "high",
    suppresses: ["fda-food-cosmetic-medical"],
    rule: {
      mode: "any",
      exactCodes: ["1905909090"],
      prefixes: ["19059090"]
    },
    summary: "FD4 表示该 HTS 对应食品产品，入境申报通常需要提交 FDA Prior Notice（PN）和 FDA entry information。",
    explanation: "Prior Notice 不是产品认证证书，而是食品进口入关前通知/申报数据。FDA 说明，人用或动物食品进口或拟进口到美国时通常必须提供 Prior Notice，可通过 CBP ACE/ABI 随报关提交，或通过 FDA PNSI 提交；最终仍需核对用途、成分和豁免情形。",
    sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
    sourceUrl: "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
  },
  {
    id: "ams-organic-am7",
    sequence: 3,
    agency: "USDA / AMS",
    nameZh: "AM7 USDA AMS Organic（有机产品数据）",
    nameEn: "USDA AMS Organic Program Data",
    category: "pga",
    status: "need_input",
    rule: {
      mode: "any",
      exactCodes: ["1905909090"],
      prefixes: ["19059090"],
      keywords: ["organic", "有机"]
    },
    summary: "AM7 表示 USDA/AMS 有机项目数据可能需要。若商品以 USDA Organic/有机产品进口，通常需关联 NOP Import Certificate。",
    explanation: "该提示取决于商品是否作为认证有机产品销售或申报。USDA AMS 说明，进口到美国的有机农产品货件需关联电子 NOP Import Certificate；非有机用途通常需由报关行按实际情况判断是否可 disclaim。",
    sourceName: "USDA AMS Electronic Organic Import Certificates",
    sourceUrl: "https://www.ams.usda.gov/services/organic-certification/international-trade/Electronic-Organic-Import-Certificates"
  },
  {
    id: "aphis-core-aq1",
    sequence: 4,
    agency: "USDA / APHIS",
    nameZh: "AQ1 APHIS Core（动植物卫生检疫数据）",
    nameEn: "APHIS Core Data May Be Required",
    category: "pga",
    status: "need_input",
    rule: {
      mode: "any",
      exactCodes: ["1905909090"],
      prefixes: ["19059090"]
    },
    summary: "AQ1 表示 APHIS data may be required，需要判断是否涉及 APHIS 许可、证书或其他 LPCO 文件。",
    explanation: "APHIS 说明，AQ1 是“数据可能需要”的标志；如果该商品入境适用 permit、certificate 或其他 LPCO，则需提交 APHIS Core Message Set。若不需要 LPCO，通常可按 APHIS 指引由报关行 disclaim，但 CBP Agriculture 仍可要求文件或查验。",
    sourceName: "APHIS Core Message Set Questions and Answers",
    sourceUrl: "https://www.aphis.usda.gov/ace/aphis-core-message-set-questions-answers"
  },
  {
    id: "fda-tobacco",
    sequence: 11,
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
    id: "fda-biologics-fd1-fd2",
    sequence: 5,
    agency: "FDA",
    nameZh: "FDA Biologics（生物制品入境数据 FD1/FD2）",
    nameEn: "FDA Biologics Entry Data",
    category: "pga",
    status: "review",
    suppresses: ["fda-food-cosmetic-medical"],
    rule: {
      mode: "any",
      prefixes: ["3002"],
      keywords: ["biologic", "vaccine", "blood", "serum", "plasma", "生物制品", "疫苗", "血液", "血清", "血浆"]
    },
    summary: "生物制品、疫苗、血液制品等可能触发 FDA BIO 项目入境数据要求，对应 CBP/FDA FD1 或 FD2 的 801(a) 数据逻辑。",
    explanation: "CBP ACE tariff flag 定义中，FD1 表示 FDA data may be required 801(a)，FD2 表示 FDA data required 801(a)，项目代码包含 BIO。该提示为产品类型层面的预警；具体 required/may be required 和 FDA Product Code 需按 HTS flag、产品用途与成分确认。",
    sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
    sourceUrl: "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
  },
  {
    id: "fda-drug-fd1-fd2",
    sequence: 6,
    agency: "FDA",
    nameZh: "FDA Drug（药品入境数据 FD1/FD2）",
    nameEn: "FDA Drug Entry Data",
    category: "pga",
    status: "review",
    suppresses: ["fda-food-cosmetic-medical"],
    rule: {
      mode: "any",
      prefixes: ["3003", "3004", "3005", "3006"],
      keywords: ["drug", "medicine", "medicament", "pharmaceutical", "药品", "药物", "医药", "制剂"]
    },
    summary: "药品、医药制剂、部分医疗敷料等可能触发 FDA DRU 项目入境数据要求，对应 CBP/FDA FD1 或 FD2 的 801(a) 数据逻辑。",
    explanation: "CBP ACE tariff flag 定义中，FD1 表示 FDA data may be required 801(a)，FD2 表示 FDA data required 801(a)，项目代码包含 DRU。实际申报通常需要 FDA Product Code、制造商/发货方等 entry information；是否 required 需以 HTS flag 和产品属性确认。",
    sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
    sourceUrl: "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
  },
  {
    id: "fda-cosmetic-fd1-fd2",
    sequence: 7,
    agency: "FDA",
    nameZh: "FDA Cosmetic（化妆品入境数据 FD1/FD2）",
    nameEn: "FDA Cosmetic Entry Data",
    category: "pga",
    status: "review",
    suppresses: ["fda-food-cosmetic-medical"],
    rule: {
      mode: "any",
      prefixes: ["3303", "3304", "3305", "3306", "3307"],
      keywords: ["cosmetic", "skin care", "makeup", "perfume", "shampoo", "toothpaste", "化妆品", "护肤", "彩妆", "香水", "洗发", "牙膏"]
    },
    summary: "化妆品、护肤品、香水、牙膏等可能触发 FDA COS 项目入境数据要求，对应 CBP/FDA FD1 或 FD2 的 801(a) 数据逻辑。",
    explanation: "CBP ACE tariff flag 定义中，FD1/FD2 项目代码包含 COS。化妆品是否按 FDA 申报，还需结合产品用途、宣称、成分和标签判断；若含药品用途宣称，可能从化妆品转为药品/OTC 药品监管。",
    sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
    sourceUrl: "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
  },
  {
    id: "fda-device-fd1-fd2",
    sequence: 8,
    agency: "FDA",
    nameZh: "FDA Medical Device（医疗器械入境数据 FD1/FD2）",
    nameEn: "FDA Medical Device Entry Data",
    category: "pga",
    status: "review",
    suppresses: ["fda-food-cosmetic-medical"],
    rule: {
      mode: "any",
      prefixes: ["9018", "9019", "9020", "9021", "9022"],
      keywords: ["medical device", "diagnostic", "surgical", "dental", "x-ray", "医疗器械", "诊断", "手术", "牙科", "X射线"]
    },
    summary: "医疗、诊断、牙科、手术器械及相关设备可能触发 FDA DEV 项目入境数据要求，对应 CBP/FDA FD1 或 FD2 的 801(a) 数据逻辑。",
    explanation: "CBP ACE tariff flag 定义中，FD1/FD2 项目代码包含 DEV。实际是否需要 FDA device entry information、注册/列名、510(k) 或其他上市状态信息，需按设备用途、分类和 FDA Product Code 确认。",
    sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
    sourceUrl: "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
  },
  {
    id: "fda-radiation-fd1-fd2",
    sequence: 9,
    agency: "FDA",
    nameZh: "FDA Radiation（辐射产品入境数据 FD1/FD2）",
    nameEn: "FDA Radiation-Emitting Product Entry Data",
    category: "pga",
    status: "review",
    suppresses: ["fda-food-cosmetic-medical"],
    rule: {
      mode: "any",
      prefixes: ["9022"],
      keywords: ["radiation", "radiation-emitting", "x-ray", "laser", "microwave", "ultrasonic", "辐射", "激光", "微波", "超声", "X射线"]
    },
    summary: "X 射线设备、激光、微波、超声等辐射产品可能触发 FDA RAD 项目入境数据要求，对应 CBP/FDA FD1 或 FD2 的 801(a) 数据逻辑。",
    explanation: "CBP ACE tariff flag 定义中，FD1/FD2 项目代码包含 RAD。辐射产品通常需要结合产品类型、用途、性能标准、进口商/制造商信息及 FDA radiation-emitting product 要求确认。",
    sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
    sourceUrl: "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
  },
  {
    id: "fda-veterinary-vme-fd1-fd2",
    sequence: 10,
    agency: "FDA",
    nameZh: "FDA Veterinary / Animal Food（兽药/动物食品入境数据 FD1/FD2）",
    nameEn: "FDA Veterinary Medicine or Animal Food Entry Data",
    category: "pga",
    status: "review",
    suppresses: ["fda-food-cosmetic-medical"],
    rule: {
      mode: "any",
      prefixes: ["2309"],
      keywords: ["animal feed", "pet food", "veterinary", "veterinary medicine", "饲料", "宠物食品", "兽药", "动物食品"]
    },
    summary: "动物食品、宠物食品、兽药等可能触发 FDA FOO/VME 项目入境数据要求，对应 CBP/FDA FD1、FD2 或食品 Prior Notice 逻辑。",
    explanation: "CBP ACE tariff flag 定义中，FDA 项目代码包含 FOO 和 VME。动物食品可能涉及 Prior Notice；兽药/动物用医疗产品可能按 VME 或 DRU 申报。需按用途、标签、成分和 FDA Product Code 确认。",
    sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
    sourceUrl: "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
  },
  {
    id: "cpsc-cpc-toys",
    sequence: 13,
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
    sequence: 14,
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
    sequence: 15,
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
    sequence: 16,
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
    sequence: 17,
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
    sequence: 18,
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
    sequence: 19,
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
    sequence: 20,
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
    sequence: 21,
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
