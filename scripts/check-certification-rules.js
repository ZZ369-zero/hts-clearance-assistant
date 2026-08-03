import { matchCertificationRules } from "../public/certification-rule-engine.js";

const passiveConnector = match({
  htsno: "8536.69.40.51",
  description: "Ribbon or flat cable connectors",
  descriptionZh: "带状或扁平电缆连接器"
});
assertNoFcc(passiveConnector, "8536694051 普通无源连接器");

const passiveTransformer = match({
  htsno: "8504.31.40.35",
  description: "Electrical transformers, other",
  descriptionZh: "其他电力变压器"
});
assertMissing(passiveTransformer, "fcc-active-component-sdoc", "普通变压器不应仅凭 8504 前缀触发 FCC SDoC");

const switchingSupply = match({
  htsno: "8504.40.95.80",
  description: "External switching power supply adapter",
  descriptionZh: "外置开关电源适配器"
});
assertHas(switchingSupply, "fcc-active-component-sdoc", "开关电源应保留 FCC Part 15 条件提示");

const smartSwitch = match({
  htsno: "8536.50.90.65",
  description: "Smart digital switch with programmable controller",
  descriptionZh: "带可编程数字控制器的智能开关"
});
assertHas(smartSwitch, "fcc-active-component-sdoc", "主动数字开关应保留 FCC Part 15 条件提示");

const wirelessSwitch = match({
  htsno: "8536.50.90.65",
  description: "Bluetooth wireless smart switch with digital controller",
  descriptionZh: "带蓝牙无线功能的智能开关"
});
assertHas(wirelessSwitch, "fcc-rf-device", "无线智能开关应提示 FCC 设备授权");
assertMissing(wirelessSwitch, "fcc-active-component-sdoc", "无线设备授权提示应避免重复显示 SDoC 条目");

console.log("Certification rule sentinels passed: passive 8536 exclusions and active/RF conditions verified.");

function match(row) {
  return matchCertificationRules(row, {});
}

function assertNoFcc(matches, label) {
  const fccMatches = matches.filter((item) => item.agency === "FCC");
  assert(fccMatches.length === 0, `${label} 不应触发 FCC 提示，实际命中：${fccMatches.map((item) => item.id).join(", ")}`);
}

function assertHas(matches, id, message) {
  assert(matches.some((item) => item.id === id), message);
}

function assertMissing(matches, id, message) {
  assert(!matches.some((item) => item.id === id), message);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Certification sentinel failed: ${message}`);
  }
}
