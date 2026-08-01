export const VEHICLE_REMEDY_CHOICE_GROUP = "vehicle-remedy-choice";
export const NON_VEHICLE_DUTY_CHOICE = "not-vehicle";

export function resolveVehiclePartsDutyChoice(matches = [], requestedChoice = "") {
  const vehicleOptions = matches
    .filter((match) => match?.choiceGroup === "vehicle-parts-section232")
    .filter((match) => match.code);

  if (!vehicleOptions.length) {
    return {
      matches,
      selectedChoice: "",
      optionCount: 0,
      hasVehicleChoices: false
    };
  }

  const availableCodes = new Set(vehicleOptions.map((option) => option.code));
  const requestedIsValid = requestedChoice === NON_VEHICLE_DUTY_CHOICE
    || availableCodes.has(requestedChoice);
  const preferred = vehicleOptions.find((option) => option.autoApply !== false) || vehicleOptions[0];
  const selectedChoice = requestedIsValid ? requestedChoice : preferred.code;

  return {
    matches: matches.map((match) => {
      if (match?.choiceGroup !== "vehicle-parts-section232") {
        if (selectedChoice !== NON_VEHICLE_DUTY_CHOICE && isMetalSection232Match(match)) {
          return {
            ...match,
            autoApply: false,
            nonStackedBy: selectedChoice
          };
        }
        return match;
      }
      const choiceSelected = match.code === selectedChoice;
      return {
        ...match,
        autoApply: choiceSelected,
        choiceGroup: VEHICLE_REMEDY_CHOICE_GROUP,
        choiceValue: match.code,
        choiceSelected,
        choiceRank: Number(match.choiceRank || 0) + 1
      };
    }),
    selectedChoice,
    optionCount: vehicleOptions.length + 1,
    hasVehicleChoices: true
  };
}

export function isMetalSection232Match(match = {}) {
  if (match.choiceGroup) {
    return false;
  }
  const sourceText = `${match.source || ""} ${match.context || ""}`.toLowerCase();
  const materialText = [
    match.material?.code,
    match.material?.label,
    match.material?.shortLabel,
    match.material?.detailLabel
  ].filter(Boolean).join(" ").toLowerCase();
  return /metals hts list/.test(sourceText)
    || /steel|iron|aluminum|aluminium|copper|钢|铁|铝|铜/.test(materialText);
}

export function getSelectedVehicleChapter99Rules(resolution = {}) {
  return (resolution.matches || []).filter((match) =>
    match?.choiceGroup === VEHICLE_REMEDY_CHOICE_GROUP
    && match.choiceSelected
    && match.autoApply !== false
  );
}
