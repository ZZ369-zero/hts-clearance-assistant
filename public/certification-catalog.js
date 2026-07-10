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
    id: "steel-import-license",
    sequence: 1.1,
    agency: "ITA",
    nameZh: "Steel Import License（钢铁产品进口许可证）",
    nameEn: "Steel Import Monitoring and Analysis License",
    category: "import-license",
    status: "review",
    rule: {
      mode: "any",
      prefixes: [
        "7206", "7207", "7208", "7209", "7210", "7211", "7212", "7213", "7214", "7215", "7216", "7217",
        "7218", "7219", "7220", "7221", "7222", "7223", "7224", "7225", "7226", "7227", "7228", "7229",
        "7301", "7302", "7304", "7305", "7306"
      ],
      keywords: ["steel", "iron", "钢", "铁"]
    },
    summary: "钢铁冶金及部分钢铁制品可能需要 ITA Steel Import Monitoring and Analysis 系统进口许可证。",
    explanation: "钢铁进口许可证通常按 ITA 公布的 HTS 范围判断。HTS 命中时应复核具体统计后缀、材质、产品形态和当前 SIMA 清单；不是所有含钢商品都按钢铁许可证申报。",
    sourceName: "ITA Steel Import Monitoring and Analysis",
    sourceUrl: "https://www.trade.gov/steel-import-monitoring-analysis-system"
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
      prefixes: [
        "02", "03", "04", "07", "08", "09", "10", "11", "12", "13", "15", "16", "17", "18", "19", "20", "21", "22",
        "2309", "2936", "3501", "3502", "3503", "3504"
      ],
      keywords: [
        "food", "seafood", "snack", "candy", "beverage", "drink", "tea", "coffee", "supplement", "ingredient",
        "食品", "海鲜", "零食", "糖果", "饮料", "茶", "咖啡", "保健品", "膳食补充剂", "原料"
      ]
    },
    summary: "食品、饮料、膳食补充剂、动物食品及食品原料进口通常需要 FDA Prior Notice（PN）和 FDA entry information。",
    explanation: "Prior Notice 不是产品认证证书，而是食品进口入关前通知/申报数据。FDA 说明，人用或动物食品进口或拟进口到美国时通常必须提供 Prior Notice，可通过 CBP ACE/ABI 随报关提交，或通过 FDA PNSI 提交；最终仍需核对用途、成分、是否食品接触或非食品用途，以及豁免情形。",
    sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
    sourceUrl: "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
  },
  {
    id: "fda-food-facility-fsvp",
    sequence: 2.1,
    agency: "FDA",
    nameZh: "FDA 食品企业注册/FSVP 供应商验证",
    nameEn: "FDA Food Facility Registration and FSVP",
    category: "pga",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["03", "04", "07", "08", "09", "10", "11", "12", "13", "15", "16", "17", "18", "19", "20", "21", "22", "2309"],
      keywords: ["food", "beverage", "dietary supplement", "ingredient", "食品", "饮料", "膳食补充剂", "食品原料"]
    },
    summary: "食品、饮料、膳食补充剂及动物食品进口通常还需复核 FDA food facility registration、FSVP 和进口商责任。",
    explanation: "该提示不是单一证书，而是食品进口合规组合：海外工厂注册、美国 FSVP importer、标签、成分、过敏原、酸化/低酸罐头等专项要求需按具体产品确认。",
    sourceName: "FDA Foreign Supplier Verification Programs",
    sourceUrl: "https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-foreign-supplier-verification-programs-fsvp-importers-food-humans-and-animals"
  },
  {
    id: "noaa-seafood-simp",
    sequence: 2.2,
    agency: "NOAA / FDA",
    nameZh: "NOAA SIMP 海产品进口追溯",
    nameEn: "NOAA Seafood Import Monitoring Program",
    category: "seafood",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["03", "1604", "1605"],
      keywords: ["seafood", "fish", "shrimp", "tuna", "salmon", "crab", "lobster", "海鲜", "水产", "鱼", "虾", "金枪鱼", "三文鱼", "蟹", "龙虾"]
    },
    summary: "鱼类、虾蟹贝类及加工海产品可能涉及 NOAA SIMP 追溯资料，同时仍需 FDA 食品入关要求。",
    explanation: "SIMP 只覆盖特定海产品物种和形态；是否适用取决于物种、捕捞/养殖、加工状态和申报品名。HTS 命中时应核对物种、收获资料和进口商 IFTP/SIMP 记录。",
    sourceName: "NOAA Seafood Import Monitoring Program",
    sourceUrl: "https://www.fisheries.noaa.gov/international/seafood-import-monitoring-program"
  },
  {
    id: "fda-food-contact-materials",
    sequence: 2.3,
    agency: "FDA",
    nameZh: "FDA 食品接触材料/包装合规",
    nameEn: "FDA Food Contact Substances and Packaging",
    category: "food-contact",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["3923", "3924", "4014", "4419", "4819", "4823", "6911", "6912", "7010", "7013", "7323", "7418", "7615", "8215", "8422"],
      keywords: ["food contact", "kitchenware", "tableware", "cup", "bottle", "container", "packaging", "食品接触", "餐具", "厨具", "杯", "瓶", "容器", "包装"]
    },
    summary: "餐具、厨具、食品包装和食品接触材料可能涉及 FDA food contact substance 合规、材质声明和迁移测试资料。",
    explanation: "食品接触要求通常取决于材质、添加剂、涂层、接触食品类型、温度和使用条件。HTS 或关键词命中时应复核 21 CFR、FCN、GRAS/豁免依据、测试报告和标签用途。",
    sourceName: "FDA Food Contact Substances",
    sourceUrl: "https://www.fda.gov/food/food-ingredients-packaging/food-contact-substances-fcs"
  },
  {
    id: "ams-organic-am7",
    sequence: 3,
    agency: "USDA / AMS",
    nameZh: "AM7 美国农业部农业适销局有机物数据可能需要",
    nameEn: "USDA AMS Organic Program Data",
    category: "pga",
    status: "need_input",
    rule: {
      mode: "any",
      exactCodes: ["1905909090", "3304100000"],
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
    id: "usda-fsis-meat-poultry-egg",
    sequence: 4.1,
    agency: "USDA / FSIS",
    nameZh: "USDA FSIS 肉类/禽类/蛋制品进口监管",
    nameEn: "USDA FSIS Meat, Poultry and Egg Products Import Inspection",
    category: "pga",
    status: "high",
    suppresses: ["fda-food-cosmetic-medical", "fda-prior-notice-fd4", "fda-food-facility-fsvp"],
    rule: {
      mode: "any",
      prefixes: ["0201", "0202", "0203", "0204", "0205", "0206", "0207", "0208", "0209", "0210", "0407", "0408", "1601", "1602"],
      keywords: ["meat", "beef", "pork", "poultry", "chicken", "turkey", "egg product", "肉", "牛肉", "猪肉", "禽肉", "鸡肉", "火鸡", "蛋制品"]
    },
    summary: "肉类、禽类及部分蛋制品进口通常涉及 USDA FSIS eligibility、检验和证书要求。",
    explanation: "FSIS 监管范围取决于动物来源、加工比例、是否即食、是否复合食品等。命中 HTS 或关键词时应核对出口国家/工厂资格、FSIS 进口检验、卫生证书和是否仍有 FDA/APHIS 并行要求。",
    sourceName: "USDA FSIS Importing Meat, Poultry and Egg Products",
    sourceUrl: "https://www.fsis.usda.gov/inspection/import-export/import-guidance"
  },
  {
    id: "usda-aphis-live-animal-animal-products",
    sequence: 4.2,
    agency: "USDA / APHIS",
    nameZh: "APHIS 动物及动物源产品许可/证书",
    nameEn: "APHIS Live Animals and Animal Products Import Requirements",
    category: "pga",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["01", "0208", "0210", "0301", "0306", "0401", "0402", "0403", "0404", "0405", "0406", "0407", "0408", "05", "1501", "1502", "1503", "1504", "1505", "1506", "4101", "4102", "4103", "4301"],
      keywords: ["live animal", "animal product", "hide", "skin", "wool", "feather", "dairy", "milk", "cheese", "butter", "活动物", "动物源", "皮张", "羊毛", "羽毛", "乳制品", "牛奶", "奶酪", "黄油"]
    },
    summary: "活动物、动物源材料、乳制品、皮张、羊毛等可能需要 APHIS 许可、卫生证书或 Core Message Set。",
    explanation: "APHIS 要求取决于动物种类、原产国、加工方式、是否已充分处理及用途。HTS 命中表示应复核 Veterinary Services 进口许可、证书、禁限令和是否可 disclaim。",
    sourceName: "APHIS Animal and Animal Product Import",
    sourceUrl: "https://www.aphis.usda.gov/live-animal-import"
  },
  {
    id: "usda-aphis-plant-plant-products",
    sequence: 4.3,
    agency: "USDA / APHIS",
    nameZh: "APHIS 植物/种子/植物产品检疫",
    nameEn: "APHIS Plants, Seeds and Plant Products Import Requirements",
    category: "pga",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["06", "07", "08", "09", "10", "11", "12", "13", "14", "44", "45", "46"],
      keywords: ["plant", "seed", "flower", "nursery", "grain", "fruit", "vegetable", "wood", "bamboo", "rattan", "植物", "种子", "花卉", "苗木", "谷物", "水果", "蔬菜", "木", "竹", "藤"]
    },
    summary: "植物、种子、农产品、木竹藤等可能触发 APHIS 植检许可、证书、处理或申报要求。",
    explanation: "植物类监管高度依赖品种、原产国、是否鲜活/干制/加工、是否带土和最终用途。HTS 命中时应核对 APHIS ACIR、permit、phytosanitary certificate、treatment 和 Lacey Act 要求。",
    sourceName: "APHIS Agricultural Commodity Import Requirements",
    sourceUrl: "https://acir.aphis.usda.gov/s/"
  },
  {
    id: "ttb-alcohol-import",
    sequence: 4.4,
    agency: "TTB / FDA",
    nameZh: "TTB 酒类进口许可/标签审批",
    nameEn: "TTB Alcohol Importer Permit and Label Approval",
    category: "alcohol",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["2203", "2204", "2205", "2206", "2207", "2208"],
      keywords: ["alcohol", "wine", "beer", "spirits", "liquor", "酒", "葡萄酒", "啤酒", "烈酒", "酒精"]
    },
    summary: "酒类进口通常涉及 TTB Basic Permit、COLA 标签审批、酒税及 FDA/CBP 入关数据。",
    explanation: "酒类是否需要 TTB 许可和 COLA 取决于酒精度、用途、包装和销售方式。非饮用酒精、样品、工业用途和免税情形需单独判断。",
    sourceName: "TTB Importing Alcohol Beverages",
    sourceUrl: "https://www.ttb.gov/importers/importing-alcohol-beverages"
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
    id: "fda-cosmetic-fd2-3304100000",
    sequence: 7,
    agency: "FDA / CBP",
    nameZh: "FD2 美国食品与药物管理局数据要求提供",
    nameEn: "FDA Cosmetic Entry Data Required",
    category: "pga",
    status: "high",
    suppresses: ["fda-food-cosmetic-medical", "fda-cosmetic-fd1-fd2"],
    rule: {
      mode: "any",
      exactCodes: ["3304100000"]
    },
    summary: "FD2 表示该 HTS 对应 FDA 化妆品项目，入境申报通常需要 FDA 801(a) entry data。",
    explanation: "3304.10.00.00 为唇部化妆用品。CBP/FDA FD flags 中，FD2 表示 FDA data required 801(a)；实际申报还需结合产品用途、标签、成分和 FDA Product Code 确认是否按化妆品、药品或组合产品处理。",
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
      keywords: ["medical device", "medical devices", "medical instrument", "medical instruments", "medical appliance", "medical appliances", "diagnostic apparatus", "electro-medical", "x-ray", "x ray", "医疗器械", "医疗设备", "医用器械", "医用设备", "X射线", "X 射线"]
    },
    summary: "医疗、诊断、牙科、手术器械及相关设备可能触发 FDA DEV 项目入境数据要求，对应 CBP/FDA FD1 或 FD2 的 801(a) 数据逻辑。",
    explanation: "CBP ACE tariff flag 定义中，FD1/FD2 项目代码包含 DEV。实际是否需要 FDA device entry information、注册/列名、510(k) 或其他上市状态信息，需按设备用途、分类和 FDA Product Code 确认。",
    sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
    sourceUrl: "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
  },
  {
    id: "fda-niosh-ppe-respirators",
    sequence: 8.1,
    agency: "FDA / NIOSH",
    nameZh: "口罩/呼吸器/医疗 PPE 监管提示",
    nameEn: "Respirators, Masks and Medical PPE",
    category: "medical-ppe",
    status: "review",
    suppresses: ["fda-food-cosmetic-medical"],
    rule: {
      mode: "any",
      prefixes: ["4015", "6116", "6210", "6216", "6307", "6506", "9004", "9020"],
      keywords: ["mask", "respirator", "n95", "kn95", "ppe", "medical glove", "surgical glove", "surgical gown", "face shield", "口罩", "呼吸器", "防护", "医用手套", "外科手套", "手术衣", "面罩"]
    },
    summary: "口罩、呼吸器、医疗手套、防护服、面罩等 PPE 可能涉及 FDA 医疗器械、NIOSH 呼吸器认证或一般劳保用品要求。",
    explanation: "是否按医疗器械、NIOSH 呼吸器或普通防护用品处理，取决于用途、标签宣称、过滤等级、适用标准和销售场景。HTS/关键词命中时应复核 510(k)/EUA 状态、NIOSH approval、标签和进口申报数据。",
    sourceName: "FDA Personal Protective Equipment for Infection Control",
    sourceUrl: "https://www.fda.gov/medical-devices/general-hospital-devices-and-supplies/personal-protective-equipment-infection-control"
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
    suppresses: ["cpsc-child-product-general"],
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
    id: "cpsc-child-product-general",
    sequence: 14.1,
    agency: "CPSC",
    nameZh: "CPSC 儿童产品安全测试/CPC",
    nameEn: "CPSC Children's Product Testing and CPC",
    category: "consumer-safety",
    status: "review",
    rule: {
      mode: "all",
      prefixes: ["39", "40", "42", "48", "49", "61", "62", "63", "64", "65", "66", "67", "82", "83", "84", "85", "87", "90", "91", "94", "95", "96"],
      keywords: ["children", "child", "kids", "baby", "infant", "toddler", "juvenile", "儿童", "婴儿", "宝宝", "童", "幼儿"]
    },
    summary: "面向 12 岁及以下儿童的消费品可能需要 CPSC 第三方测试、追踪标签和 Children's Product Certificate。",
    explanation: "儿童属性不能只靠 HTS 判断，需要结合包装、年龄标识、营销图片、尺寸和预期用途。若商品面向儿童，应核对铅/邻苯、小部件、可燃性、玩具标准或其他适用安全规则。",
    sourceName: "CPSC Children's Product Certificate",
    sourceUrl: "https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Childrens-Product-Certificate"
  },
  {
    id: "cpsc-general-consumer-product",
    sequence: 14.2,
    agency: "CPSC",
    nameZh: "CPSC 一般消费品安全/GCC",
    nameEn: "CPSC General Certificate of Conformity",
    category: "consumer-safety",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["4011", "4202", "6506", "7310", "7321", "7615", "8210", "8211", "8215", "8516", "9401", "9403", "9404", "9504", "9506", "9603"],
      keywords: ["helmet", "bicycle", "mattress", "lighter", "fireworks", "furniture", "appliance", "candle", "头盔", "自行车", "床垫", "打火机", "烟花", "家具", "家电", "蜡烛"]
    },
    summary: "部分一般消费品可能需要 CPSC 适用标准符合性、GCC 或特定安全规则。",
    explanation: "CPSC 要求取决于产品类型和适用法规，例如床垫可燃性、头盔、自行车、打火机、烟花、家用设备等。HTS 命中为风险提示，需按具体商品标准确认。",
    sourceName: "CPSC General Certificate of Conformity",
    sourceUrl: "https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/General-Certificate-of-Conformity-GCC"
  },
  {
    id: "fcc-rf-device",
    sequence: 15,
    agency: "FCC",
    nameZh: "FCC 设备授权",
    nameEn: "FCC Equipment Authorization",
    category: "radio-frequency",
    status: "review",
    suppresses: ["fcc-digital-device-sdoc"],
    rule: {
      mode: "all",
      prefixes: ["8471", "8517", "8525", "8526", "8527", "8528", "8543", "8806", "9503"],
      keywords: [
        "wireless", "wifi", "wi-fi", "bluetooth", "radio", "rf", "transmitter", "router", "antenna", "cellular", "drone", "smart",
        "无线", "蓝牙", "路由器", "射频", "发射器", "天线", "蜂窝", "无人机", "智能"
      ]
    },
    summary: "带无线、蓝牙、WiFi、射频发射/接收功能的电子设备可能需要 FCC 设备授权。",
    explanation: "FCC 规则通常要求射频设备在进口、销售或使用前完成适当的设备授权程序。是否适用取决于 RF 功能、频段、功率和设备类型。",
    sourceName: "FCC Equipment Authorization",
    sourceUrl: "https://www.fcc.gov/engineering-technology/laboratory-division/general/equipment-authorization"
  },
  {
    id: "fcc-digital-device-sdoc",
    sequence: 15.05,
    agency: "FCC",
    nameZh: "FCC Part 15 数字设备/SDoC",
    nameEn: "FCC Part 15 Digital Device Supplier's Declaration of Conformity",
    category: "radio-frequency",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["8471", "8504", "8517", "8525", "8526", "8527", "8528", "8529", "8536", "8537", "8543", "9504"],
      keywords: ["computer", "monitor", "adapter", "charger", "electronics", "digital", "smart", "电脑", "显示器", "适配器", "充电器", "电子", "数码", "智能"]
    },
    summary: "数字电子设备、充电器、适配器、电脑周边等可能涉及 FCC Part 15 SDoC 或设备授权要求。",
    explanation: "是否需要 FCC SDoC、Certification 或豁免，取决于是否为 intentional/unintentional radiator、工作频段、供电方式和销售形态。若同时带无线功能，应优先复核 FCC Equipment Authorization。",
    sourceName: "FCC Equipment Authorization",
    sourceUrl: "https://www.fcc.gov/engineering-technology/laboratory-division/general/equipment-authorization"
  },
  {
    id: "doe-energy-labeling",
    sequence: 15.1,
    agency: "DOE / FTC",
    nameZh: "DOE/FTC 能效标准与 EnergyGuide 标签",
    nameEn: "DOE Energy Conservation Standards and FTC EnergyGuide",
    category: "energy",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["8415", "8418", "8419", "8421", "8450", "8451", "8504", "8509", "8516", "8539", "8541", "9405"],
      keywords: ["refrigerator", "freezer", "air conditioner", "washer", "dryer", "dishwasher", "water heater", "lamp", "led", "power supply", "solar", "冰箱", "冷柜", "空调", "洗衣机", "烘干机", "洗碗机", "热水器", "灯", "LED", "电源", "太阳能"]
    },
    summary: "家电、照明、电源适配器、部分暖通和能源产品可能涉及 DOE 能效标准、FTC EnergyGuide 或 Lighting Facts。",
    explanation: "能效合规通常取决于产品额定参数、用途、型号和销售渠道。HTS 命中时应核对 DOE covered products、认证数据库、测试标准和 FTC 标签规则。",
    sourceName: "DOE Compliance Certification Database",
    sourceUrl: "https://www.regulations.doe.gov/certification-data/"
  },
  {
    id: "phmsa-lithium-battery-hazmat",
    sequence: 15.2,
    agency: "PHMSA / DOT / FAA",
    nameZh: "锂电池/危险品运输合规",
    nameEn: "Lithium Battery and Hazardous Materials Transport",
    category: "hazmat",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["8506", "8507"],
      keywords: ["lithium", "battery", "power bank", "hazmat", "dangerous goods", "锂电", "电池", "移动电源", "危险品"]
    },
    summary: "锂电池、电池组、移动电源及含电池商品可能涉及 UN38.3、危险品运输、标签和航空限制。",
    explanation: "该提示主要面向运输和入关资料准备。实际要求取决于电池类型、瓦时、包装方式、是否随设备/装在设备中、运输方式和承运人规则。",
    sourceName: "PHMSA Lithium Battery Guide",
    sourceUrl: "https://www.phmsa.dot.gov/lithiumbatteries"
  },
  {
    id: "faa-drone-uas",
    sequence: 15.3,
    agency: "FAA / FCC",
    nameZh: "无人机 UAS 监管/FCC 无线设备",
    nameEn: "Unmanned Aircraft Systems and FCC Radio Equipment",
    category: "aviation-radio",
    status: "review",
    suppresses: ["fcc-rf-device"],
    rule: {
      mode: "all",
      prefixes: ["8806", "9503"],
      keywords: ["drone", "uas", "uav", "unmanned aircraft", "remote id", "无人机", "无人飞行器", "航拍"]
    },
    summary: "无人机及带遥控/无线模块的飞行器可能涉及 FAA UAS 规则、Remote ID 和 FCC 设备授权。",
    explanation: "入关时通常先关注 HTS、无线模块和电池运输；在美国销售/使用还需确认 FAA Remote ID、注册/操作规则和 FCC 射频合规。",
    sourceName: "FAA UAS Remote Identification",
    sourceUrl: "https://www.faa.gov/uas/getting_started/remote_id"
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
    id: "epa-fifra-treated-article",
    sequence: 17.1,
    agency: "EPA",
    nameZh: "EPA FIFRA 杀菌/抗菌宣称产品",
    nameEn: "EPA FIFRA Treated Articles and Antimicrobial Claims",
    category: "pesticide",
    status: "review",
    rule: {
      mode: "all",
      prefixes: ["3401", "3402", "3808", "3924", "4015", "4818", "5603", "6116", "6307", "8421", "8509", "9019", "9404"],
      keywords: ["antimicrobial", "antibacterial", "disinfect", "sanitize", "germicidal", "pesticide", "insect repellent", "抗菌", "抑菌", "消毒", "杀菌", "除菌", "驱虫", "农药"]
    },
    summary: "带消毒、杀菌、抗菌、驱虫等宣称的产品可能触发 EPA FIFRA 注册、标签或 treated article 判断。",
    explanation: "FIFRA 适用通常取决于标签宣称、活性成分和产品用途，而不只看 HTS。普通材料若宣称保护使用者免受微生物影响，可能不再适用 treated article exemption。",
    sourceName: "EPA Treated Articles Exemption",
    sourceUrl: "https://www.epa.gov/safepestcontrol/consumer-products-treated-pesticides"
  },
  {
    id: "epa-formaldehyde-composite-wood",
    sequence: 17.2,
    agency: "EPA",
    nameZh: "EPA TSCA Title VI 复合木制品甲醛",
    nameEn: "EPA TSCA Title VI Composite Wood Formaldehyde",
    category: "chemical",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["4410", "4411", "4412", "4418", "4420", "4421", "9403"],
      keywords: ["composite wood", "plywood", "particleboard", "mdf", "fiberboard", "laminate", "复合木", "胶合板", "刨花板", "密度板", "纤维板", "木家具"]
    },
    summary: "复合木板材、木家具和含复合木部件商品可能涉及 TSCA Title VI 甲醛释放合规。",
    explanation: "需要判断是否含 hardwood plywood、particleboard、MDF 或受监管成品，并确认 CARB/EPA TSCA Title VI 标签、认证、进口商记录和豁免。",
    sourceName: "EPA Formaldehyde Emission Standards for Composite Wood Products",
    sourceUrl: "https://www.epa.gov/formaldehyde/formaldehyde-emission-standards-composite-wood-products"
  },
  {
    id: "epa-ods-refrigerants",
    sequence: 17.3,
    agency: "EPA",
    nameZh: "EPA 制冷剂/臭氧消耗物质进口监管",
    nameEn: "EPA Refrigerants and Ozone-Depleting Substances",
    category: "environmental",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["2903", "3827", "8415", "8418"],
      keywords: ["refrigerant", "hfc", "hcfc", "cfc", "air conditioner", "refrigerator", "制冷剂", "氟利昂", "空调", "冰箱"]
    },
    summary: "制冷剂、含制冷剂设备、HFC/HCFC/CFC 相关商品可能涉及 EPA 进口配额、申报或标签要求。",
    explanation: "适用要求取决于具体化学物质、是否新品或回收、设备是否预充制冷剂、原产国和当前 AIM/Clean Air Act 规则。",
    sourceName: "EPA Importing Ozone-Depleting Substances",
    sourceUrl: "https://www.epa.gov/ods-phaseout/importing-and-exporting-ozone-depleting-substances"
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
    id: "nhtsa-equipment-dot-marking",
    sequence: 19.1,
    agency: "DOT / NHTSA",
    nameZh: "DOT/NHTSA 车辆安全部件 DOT 标识",
    nameEn: "DOT/NHTSA Motor Vehicle Equipment Marking",
    category: "vehicle-safety",
    status: "review",
    suppresses: ["dot-nhtsa-vehicle"],
    rule: {
      mode: "any",
      prefixes: ["4011", "7007", "8512", "8708", "8714", "9029"],
      keywords: ["tire", "brake", "lamp", "headlight", "windshield", "glass", "seat belt", "airbag", "轮胎", "刹车", "车灯", "大灯", "挡风玻璃", "安全带", "安全气囊"]
    },
    summary: "轮胎、车灯、制动、安全玻璃、安全带、安全气囊等车辆安全部件可能需要符合 FMVSS 并带 DOT/制造商标识。",
    explanation: "车辆零部件是否受 NHTSA 监管取决于是否为 motor vehicle equipment 及具体 FMVSS 项目。HTS 命中时应核对 DOT 标识、测试资料、制造商注册和进口声明。",
    sourceName: "NHTSA Motor Vehicle Equipment",
    sourceUrl: "https://www.nhtsa.gov/importing-vehicle/importation-and-certification-faqs"
  },
  {
    id: "atf-firearms-ammunition",
    sequence: 19.2,
    agency: "ATF / CBP",
    nameZh: "ATF 枪支/弹药/武器进口许可",
    nameEn: "ATF Firearms, Ammunition and Defense Articles Import Permits",
    category: "controlled-goods",
    status: "high",
    rule: {
      mode: "any",
      prefixes: ["3601", "3602", "3603", "3604", "9301", "9302", "9303", "9304", "9305", "9306", "9307"],
      keywords: ["firearm", "gun", "rifle", "pistol", "ammunition", "munition", "weapon", "knife", "sword", "枪", "步枪", "手枪", "弹药", "武器", "刀", "剑"]
    },
    summary: "枪支、弹药、爆炸物、部分武器及零件通常属于强监管商品，可能需要 ATF 进口许可或其他管制文件。",
    explanation: "适用要求取决于商品类型、用途、口径、是否军品、防卫物项和进口商资质。该类商品应在承运和入关前核对 ATF、CBP、DDTC/BIS 及州法限制。",
    sourceName: "ATF Imports Branch",
    sourceUrl: "https://www.atf.gov/firearms/firearms-guides-importation-verification-firearms-ammunition-and-implements-war"
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
    id: "ftc-wool-fur-labeling",
    sequence: 20.1,
    agency: "FTC / FWS",
    nameZh: "羊毛/毛皮标签与野生动物材料监管",
    nameEn: "Wool, Fur Labeling and Wildlife Material Review",
    category: "labeling-wildlife",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["4101", "4102", "4103", "4301", "4302", "4303", "5101", "5102", "5103", "5105", "5111", "5112", "5113", "6506"],
      keywords: ["wool", "fur", "hide", "skin", "leather", "animal hair", "羊毛", "毛皮", "皮张", "皮革", "动物毛"]
    },
    summary: "羊毛、毛皮、皮革及动物源材料可能涉及 FTC 标签、FWS/CITES 或 APHIS 动物源产品要求。",
    explanation: "羊毛/毛皮标签需按成分和责任方披露；含野生动物、濒危物种、爬行动物皮、羽毛等材料时，还需核对 FWS 进口申报、指定口岸和 CITES 证书。",
    sourceName: "FTC Threading Your Way Through the Labeling Requirements",
    sourceUrl: "https://www.ftc.gov/business-guidance/resources/threading-your-way-through-labeling-requirements-under-textile-wool-acts"
  },
  {
    id: "ftc-jewelry-precious-metals",
    sequence: 20.2,
    agency: "FTC / CBP",
    nameZh: "珠宝/贵金属/宝石标识与合规提示",
    nameEn: "Jewelry, Precious Metals and Gemstone Marketing Guides",
    category: "labeling",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["7101", "7102", "7103", "7104", "7105", "7106", "7107", "7108", "7109", "7110", "7111", "7113", "7114", "7115", "7116", "7117"],
      keywords: ["jewelry", "gold", "silver", "diamond", "gem", "pearl", "precious metal", "首饰", "珠宝", "黄金", "白银", "钻石", "宝石", "珍珠", "贵金属"]
    },
    summary: "珠宝、贵金属、宝石及仿首饰可能涉及 FTC Jewelry Guides、材质/产地标识和特殊来源限制。",
    explanation: "是否需要特定声明取决于材质含量、镀层、宝石处理、原产国、营销宣称和是否涉及受限来源；HTS 命中用于提醒标签和文件复核。",
    sourceName: "FTC Jewelry Guides",
    sourceUrl: "https://www.ftc.gov/business-guidance/resources/jewelry-guides"
  },
  {
    id: "fws-cites-wildlife",
    sequence: 20.3,
    agency: "FWS / CITES",
    nameZh: "FWS/CITES 野生动物及濒危物种材料",
    nameEn: "Fish and Wildlife Service / CITES Wildlife Imports",
    category: "wildlife",
    status: "review",
    rule: {
      mode: "any",
      prefixes: ["01", "03", "05", "4101", "4102", "4103", "4202", "4301", "4302", "4303", "0505", "0506", "0507", "0508", "9601"],
      keywords: ["wildlife", "cites", "ivory", "shell", "coral", "reptile", "snake skin", "feather", "bone", "野生动物", "濒危", "象牙", "贝壳", "珊瑚", "爬行动物", "蛇皮", "羽毛", "骨"]
    },
    summary: "动物、鱼类、珊瑚、贝壳、象牙、爬行动物皮、羽毛等可能涉及 FWS 申报、指定口岸和 CITES 文件。",
    explanation: "FWS/CITES 适用取决于物种、来源、加工状态、商业用途和原产国。HTS 命中不能代替物种鉴定，但会提示入关前核对许可和证书。",
    sourceName: "FWS Importing and Exporting Wildlife",
    sourceUrl: "https://www.fws.gov/program/office-of-law-enforcement/information-importers-exporters"
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
