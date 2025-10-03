$(function () {
  // ---------- STATE ----------
  let modules = [];
  let absences = [];
  let nextModuleId = 0;
  let nextAbsenceId = 0;
  const DAY_CONFIG = {
    segunda: { name: "Segunda", dateJsId: 1 },
    terca: { name: "Terça", dateJsId: 2 },
    quarta: { name: "Quarta", dateJsId: 3 },
    quinta: { name: "Quinta", dateJsId: 4 },
    sexta: { name: "Sexta", dateJsId: 5 },
    sabado: { name: "Sábado", dateJsId: 6 },
  };

  // ---------- CACHED DOM ----------
  const $ = window.jQuery;
  const $DOM = {
    monthYear: $("#monthYear"),
    moduleForm: $("#moduleForm"),
    absenceForm: $("#absenceForm"),
    modulesList: $("#modulesList"),
    absencesList: $("#absencesList"),
    scheduleGrid: $("#scheduleGrid"),
    timesheetContainer: $("#timesheetContainer"),
    timesheetBody: $("#timesheetBody"),
    toast: $("#toast"),
    daysOfWeekContainer: $("#daysOfWeekContainer"),
    daySchedules: $("#daySchedules"),
    modulePartialPeriodContainer: $("#modulePartialPeriodContainer"),
    absenceNameContainer: $("#absenceNameContainer"),
  };

  // ---------- UTILITIES ----------
  const showToast = (msg, isError = false) => {
    $DOM.toast
      .text(msg)
      .removeClass("bg-red-600 bg-green-600")
      .addClass(isError ? "bg-red-600" : "bg-green-600")
      .addClass("show");
    setTimeout(() => $DOM.toast.removeClass("show"), 3000);
  };

  const monthName = (m) =>
    [
      "JANEIRO",
      "FEVEREIRO",
      "MARÇO",
      "ABRIL",
      "MAIO",
      "JUNHO",
      "JULHO",
      "AGOSTO",
      "SETEMBRO",
      "OUTUBRO",
      "NOVEMBRO",
      "DEZEMBRO",
    ][m - 1];

  const pad2 = (n) => String(n).padStart(2, "0");

  const timeToMinutes = (hhmm) => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (mins) => {
    if (mins == null) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${pad2(h)}:${pad2(m)}`;
  };

  const generateTimeOptions = (startHour, endHour, optional = false) => {
    let out = optional ? '<option value="">--:--</option>' : "";
    for (let h = startHour; h <= endHour; h++) {
      const hour = pad2(h);
      out += `<option value="${hour}:00">${hour}:00</option>`;
    }
    return out;
  };

  // randomize +/- up to 3 minutes (keeps within same day)
  const randomizeTime = (timeStr) => {
    if (!timeStr) return "";
    const mins = timeToMinutes(timeStr);
    if (mins == null) return "";
    const delta = Math.floor(Math.random() * 7) - 3;
    const newMins = Math.max(0, Math.min(23 * 60 + 59, mins + delta));
    return minutesToTime(newMins);
  };

  const durationMinutes = (startStr, endStr) => {
    const s = timeToMinutes(startStr);
    const e = timeToMinutes(endStr);
    if (s == null || e == null) return 0;
    return Math.max(0, e - s);
  };

  // ---------- DATE RANGE ----------
  const updateDateRangeConstraints = () => {
    const val = $DOM.monthYear.val();
    if (!val || !val.includes("-")) return;
    const [year, month] = val.split("-");
    const firstDay = `${year}-${month}-01`;
    const lastDate = new Date(year, month, 0).getDate();
    const lastDay = `${year}-${month}-${pad2(lastDate)}`;
    const $dateInputs = $(
      "#moduleStartDate, #moduleEndDate, #absenceStartDate, #absenceEndDate"
    );
    $dateInputs.attr({ min: firstDay, max: lastDay }).each(function () {
      const $i = $(this);
      const v = $i.val();
      if (!v || v < firstDay || v > lastDay) $i.val(firstDay);
    });
  };

  // ---------- HOLIDAYS ----------
  const fetchAndAddHolidays = () => {
    const val = $DOM.monthYear.val();
    if (!val || !val.includes("-")) return;
    const [year, month] = val.split("-");
    // keep only manual absences, then add fetched as non-manual
    absences = absences.filter((a) => a.isManual);
    showToast("Buscando feriados do mês...");
    $.ajax({
      url: `https://brasilapi.com.br/api/feriados/v1/${year}`,
      method: "GET",
      timeout: 5000,
    })
      .done((data) => {
        const selectedMonth = parseInt(month, 10);
        data.forEach((holiday) => {
          const holidayMonth =
            new Date(holiday.date + "T12:00:00Z").getUTCMonth() + 1;
          if (holidayMonth !== selectedMonth) return;
          const exists = absences.some(
            (a) => a.startDate === holiday.date && !a.isManual
          );
          if (!exists) {
            absences.push({
              id: nextAbsenceId++,
              type: "feriado",
              name: holiday.name,
              startDate: holiday.date,
              endDate: holiday.date,
              isManual: false,
            });
          }
        });
        renderAbsences();
        showToast("Feriados carregados!");
      })
      .fail(() => showToast("Não foi possível buscar feriados.", true));
  };

  // ---------- RENDERERS ----------
  const renderModules = () => {
    if (!modules.length) {
      $DOM.modulesList.html(
        '<p class="text-gray-500 italic">Nenhum módulo cadastrado ainda.</p>'
      );
      return;
    }
    const html = modules
      .map((m) => {
        const periodText =
          m.periodType === "partial"
            ? `${new Date(m.startDate + "T00:00:00").toLocaleDateString(
                "pt-BR"
              )} a ${new Date(m.endDate + "T00:00:00").toLocaleDateString(
                "pt-BR"
              )}`
            : "Mês Inteiro";
        const scheduleText = Object.entries(m.schedule)
          .map(
            ([day, slots]) =>
              `${DAY_CONFIG[day].name}: ${slots
                .map((s) => `${s.start}-${s.end}`)
                .join(", ")}`
          )
          .join(" | ");
        return `<div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <div>
                        <div class="font-medium">${m.name} <span class="text-xs font-normal text-gray-500">(${periodText})</span></div>
                        <div class="text-sm text-gray-500 capitalize mb-1">${m.type}</div>
                        <div class="text-xs text-gray-400">${scheduleText}</div>
                    </div>
                    <button data-action="removeModule" data-id="${m.id}" class="text-red-500 hover:text-red-700 flex items-center justify-center w-10 h-10 rounded-full hover:bg-red-100 transition">
                        <span class="material-icons">delete</span>
                    </button>
                </div>`;
      })
      .join("");
    $DOM.modulesList.html(html);
  };

  const renderAbsences = () => {
    const colorMap = {
      falta: { text: "text-red-700", border: "border-red-500" },
      atestado: { text: "text-yellow-700", border: "border-yellow-500" },
      feriado: { text: "text-blue-700", border: "border-blue-500" },
    };
    if (!absences.length) {
      $DOM.absencesList.html(
        '<p class="text-gray-500 italic">Nenhuma ausência cadastrada.</p>'
      );
      return;
    }
    const html = absences
      .map((a) => {
        const start = new Date(a.startDate + "T00:00:00").toLocaleDateString(
          "pt-BR"
        );
        const end =
          a.endDate !== a.startDate
            ? ` a ${new Date(a.endDate + "T00:00:00").toLocaleDateString(
                "pt-BR"
              )}`
            : "";
        let typeText = {
          falta: "Falta",
          atestado: "Atestado",
          feriado: "Feriado",
        }[a.type];
        const colors = colorMap[a.type] || colorMap.falta;

        if (a.type === "feriado" && a.name) typeText += `: ${start} - ${a.name}`;
        else typeText += `: ${start}${end}`;

        return `<div class="flex items-center justify-between p-3 border-l-4 ${colors.border} rounded-lg bg-white shadow-sm">
                    <div><div class="font-medium ${colors.text} capitalize">${typeText}</div></div>
                    <button data-action="removeAbsence" data-id="${a.id}" class="text-red-500 hover:text-red-700 flex items-center justify-center w-10 h-10 rounded-full hover:bg-red-100 transition">
                        <span class="material-icons">delete</span>
                    </button>
                </div>`;
      })
      .join("");
    $DOM.absencesList.html(html);
  };

  const renderScheduleGrid = () => {
    const allTimes = new Set();
    modules.forEach((m) =>
      Object.values(m.schedule)
        .flat()
        .forEach((s) => {
          allTimes.add(s.start);
          allTimes.add(s.end);
        })
    );
    const sorted = Array.from(allTimes).sort();

    if (!sorted.length) {
      $DOM.scheduleGrid.html(
        `<tr><td colspan="7" class="text-center p-4 text-gray-500">Adicione módulos para ver a grade de horários.</td></tr>`
      );
      return;
    }

    const rows = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const time = sorted[i];
      const next = sorted[i + 1];
      const dayCells = Object.keys(DAY_CONFIG)
        .map((dayKey) => {
          const found = modules.find((m) =>
            m.schedule[dayKey]?.some(
              (slot) => time >= slot.start && next <= slot.end
            )
          );
          return found
            ? `<td class="border border-gray-300 p-1 text-center text-xs font-medium text-blue-800 bg-blue-100">${found.name}</td>`
            : `<td class="border border-gray-300 p-1"></td>`;
        })
        .join("");
      rows.push(
        `<tr><td class="border border-gray-300 p-1 font-medium bg-gray-50 text-xs text-center">${time} - ${next}</td>${dayCells}</tr>`
      );
    }
    $DOM.scheduleGrid.html(rows.join(""));
  };

  // ---------- FORM HELPERS ----------
  const clearModuleForm = () => {
    $DOM.moduleForm[0].reset();
    $('input[name="module-days"]').prop("checked", false).trigger("change");
    $DOM.modulePartialPeriodContainer.slideUp();
  };

  const addTimeSlotTo = (container) => {
    const $div = $("<div>", { class: "flex gap-2 items-center" }).html(
      `<select data-role="start-time" class="time-select border border-gray-300 rounded px-2 py-1 text-sm w-28 cursor-pointer" required>
                ${generateTimeOptions(7, 21)}
            </select>
            <span class="text-gray-500 text-sm">às</span>
            <select data-role="end-time" class="time-select border border-gray-300 rounded px-2 py-1 text-sm w-28 cursor-pointer" required>
                ${generateTimeOptions(8, 22)}
            </select>
            <button type="button" data-action="removeTimeSlot" class="text-red-500 hover:text-red-700 flex items-center justify-center w-8 h-8 rounded-full hover:bg-red-100">
                <span class="material-icons text-base">delete_outline</span>
            </button>`
    );
    $(container).append($div);
    updateEndTimeOptions($div.find('[data-role="start-time"]'));
  };

  // Ensures end-time options are strictly after start-time
  const updateEndTimeOptions = ($start) => {
    const $end = $start.closest(".grid, .flex").find('[data-role="end-time"]');
    const startVal = $start.val();
    if (!startVal) {
      $end.children("option").prop("disabled", false).prop("hidden", false);
      return;
    }
    let firstValid = null;
    $end.children("option").each(function () {
      const v = $(this).val();
      if (v === "") return;
      const invalid = v <= startVal; // string compare ok for HH:MM
      $(this).prop("disabled", invalid).prop("hidden", invalid);
      if (!invalid && !firstValid) firstValid = v;
    });
    if ($end.val() <= startVal) $end.val(firstValid);
  };

  // ---------- TIMESHEET ----------
  const generateTimesheet = () => {
    const val = $DOM.monthYear.val();
    if (!val || !val.includes("-")) {
      showToast("Por favor, selecione o Mês/Ano.", true);
      return;
    }
    const [year, month] = val.split("-");

    $("#displayMonth").text(monthName(parseInt(month, 10)));
    $("#displayYear").text(year);
    $("#displayProfessor").text($("#professorName").val());
    $("#displaySchool").text($("#schoolName").val());
    $("#displayChapa").text($("#chapa").val());
    $("#displayFunction").text($("#function").val());
    const admission = $("#admissionDate").val();
    if (admission)
      $("#displayAdmissionDate").text(
        new Date(admission + "T00:00:00").toLocaleDateString("pt-BR")
      );
    const contractType = $("#contractType").val();
    $("#displayContratoCltPercent").text(contractType === "CLT" ? "X" : " ");
    $("#displayContratoRpaPercent").text(contractType === "RPA" ? "X" : " ");

    let table = "";
    const endDay = new Date(year, month, 0).getDate();
    let totalMinutesWorked = 0;

    for (let d = 1; d <= endDay; d++) {
      const current = new Date(year, month - 1, d);
      const currentStr = current.toISOString().split("T")[0];
      const dayOfWeek = current.getDay();
      const dayCell = `<td class="border border-gray-400 p-1 text-center font-medium text-xs">${pad2(
        d
      )}/${month}</td>`;

      const todaysAbs = absences.find(
        (a) => currentStr >= a.startDate && currentStr <= a.endDate
      );

      if (dayOfWeek === 0) {
        table += `<tr>${dayCell}<td colspan="11" class="border border-gray-400 p-1 text-center bg-gray-200 text-xs font-medium">DOMINGO</td></tr>`;
        continue;
      }

      if (
        todaysAbs &&
        (todaysAbs.type === "falta" || todaysAbs.type === "feriado")
      ) {
        const justification =
          todaysAbs.type === "feriado"
            ? todaysAbs.name.toUpperCase()
            : "FALTA";
        table += `<tr>${dayCell}<td colspan="11" class="border border-gray-400 p-1 text-center bg-gray-100 text-xs font-medium">${justification}</td></tr>`;
        continue;
      }

      // ----------------- CORREÇÃO APLICADA AQUI -----------------
      if (todaysAbs && todaysAbs.type === "atestado") {
        const s = todaysAbs.startTime || "";
        const e = todaysAbs.endTime || "";

        // Calcula a duração do atestado
        let dayMinutes = 0;
        if (s && e) {
          dayMinutes = durationMinutes(s, e);
        }

        // Cria a label para a coluna ATESTADO
        const hoursLabel =
          dayMinutes > 0 ? `${Math.round(dayMinutes / 60)}h` : "";

        // Monta a linha da tabela com os horários de entrada/saída vazios
        // e o total de horas na coluna correta (ATESTADO)
        const cells = [
          "", // Entrada Matutino
          "", // Saída Matutino
          "", // Entrada Vespertino
          "", // Saída Vespertino
          "", // Entrada Noturno
          "", // Saída Noturno
          "", // Coluna PRESENCIAL
          "", // Coluna ONLINE
          "", // Coluna EAD / P
          hoursLabel, // Coluna ATESTADO
          "", // Coluna Assinatura
        ];

        const timeCells = cells
          .map(
            (c) =>
              `<td class="border border-gray-400 p-1 text-center text-xs">${c}</td>`
          )
          .join("");
        table += `<tr>${dayCell}${timeCells}</tr>`;
        continue; // Pula para o próximo dia
      }
      // ----------------- FIM DA CORREÇÃO -----------------

      const dayKey = Object.keys(DAY_CONFIG).find(
        (k) => DAY_CONFIG[k].dateJsId === dayOfWeek
      );

      const activeModules = modules.filter(
        (m) =>
          m.schedule[dayKey] &&
          (m.periodType === "full" ||
            (currentStr >= m.startDate && currentStr <= m.endDate))
      );

      const allSlots = activeModules.flatMap((m) =>
        m.schedule[dayKey].map((s) => ({ ...s, type: m.type }))
      );

      const morning = allSlots
        .filter((s) => s.start < "12:00")
        .sort((a, b) => a.start.localeCompare(b.start));
      const afternoon = allSlots
        .filter((s) => s.start >= "12:00" && s.start < "18:00")
        .sort((a, b) => a.start.localeCompare(b.start));
      const evening = allSlots
        .filter((s) => s.start >= "18:00")
        .sort((a, b) => a.start.localeCompare(b.start));

      let dayMinutes = 0;
      if (morning.length)
        dayMinutes += durationMinutes(
          morning[0].start,
          morning[morning.length - 1].end
        );
      if (afternoon.length)
        dayMinutes += durationMinutes(
          afternoon[0].start,
          afternoon[afternoon.length - 1].end
        );
      if (evening.length)
        dayMinutes += durationMinutes(
          evening[0].start,
          evening[evening.length - 1].end
        );

      totalMinutesWorked += dayMinutes;

      const hoursLabel = dayMinutes ? `${Math.round(dayMinutes / 60)}h` : "";

      const cells = [
        morning.length ? randomizeTime(morning[0].start) : "",
        morning.length
          ? randomizeTime(morning[morning.length - 1].end)
          : "",
        afternoon.length ? randomizeTime(afternoon[0].start) : "",
        afternoon.length
          ? randomizeTime(afternoon[afternoon.length - 1].end)
          : "", // Bug corrigido aqui também
        evening.length ? randomizeTime(evening[0].start) : "",
        evening.length
          ? randomizeTime(evening[evening.length - 1].end)
          : "",
        hoursLabel,
        "",
        "",
        "",
        "",
      ];

      const timeCells = cells
        .map(
          (c) =>
            `<td class="border border-gray-400 p-1 text-center text-xs">${c}</td>`
        )
        .join("");
      table += `<tr>${dayCell}${timeCells}</tr>`;
    }

    $DOM.timesheetBody.html(table);
    const totalH = Math.floor(totalMinutesWorked / 60);
    const totalM = totalMinutesWorked % 60;
    $("#displayTotalHours").text(`${pad2(totalH)}:${pad2(totalM)}`);
    $DOM.timesheetContainer.slideDown();
    $("html, body").animate(
      { scrollTop: $DOM.timesheetContainer.offset().top },
      "slow"
    );
  };

  // ---------- EVENT HANDLERS ----------
  $DOM.moduleForm.on("submit", function (e) {
    e.preventDefault();
    const name = $("#moduleName").val().trim();
    const type = $("#moduleType").val();
    const $selectedDays = $('input[name="module-days"]:checked');
    const periodType = $('input[name="modulePeriodType"]:checked').val();

    if (!name || !$selectedDays.length) {
      showToast("Preencha o nome e selecione pelo menos um dia.", true);
      return;
    }

    let start = null,
      end = null;
    if (periodType === "partial") {
      start = $("#moduleStartDate").val();
      end = $("#moduleEndDate").val();
      if (!start || !end || end < start) {
        showToast(
          "Selecione um período de datas válido para o módulo.",
          true
        );
        return;
      }
    }

    const schedule = {};
    let hasValidTime = false;
    $selectedDays.each(function () {
      const day = $(this).val();
      const slots = $(`#timeSlots-${day} .flex`)
        .map(function () {
          const $s = $(this).find("select.time-select");
          return { start: $s.eq(0).val(), end: $s.eq(1).val() };
        })
        .get()
        .filter((s) => s.start && s.end);
      if (slots.length) hasValidTime = true;
      schedule[day] = slots;
    });

    if (!hasValidTime) {
      showToast("Adicione pelo menos um horário válido.", true);
      return;
    }

    modules.push({
      id: nextModuleId++,
      name,
      type,
      schedule,
      periodType,
      startDate: start,
      endDate: end,
    });

    renderModules();
    renderScheduleGrid();
    clearModuleForm();
    showToast("Módulo adicionado com sucesso!");
  });

  $DOM.absenceForm.on("submit", function (e) {
    e.preventDefault();
    const type = $('input[name="absenceType"]:checked').val();
    const name = $("#absenceName").val();
    const startDate = $("#absenceStartDate").val();
    const endDate = $("#absenceEndDate").val();
    const startTime = $("#absenceStartTime").val();
    const endTime = $("#absenceEndTime").val();

    if (type === "feriado" && !name.trim()) {
      showToast("Por favor, preencha o nome do feriado.", true);
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      showToast("Selecione um período de datas válido para a ausência.", true);
      return;
    }

    absences.push({
      id: nextAbsenceId++,
      type,
      name,
      startDate,
      endDate,
      startTime,
      endTime,
      isManual: true,
    });

    renderAbsences();
    this.reset();
    $('input[name="absenceType"][value="feriado"]')
      .prop("checked", true)
      .trigger("change");
    showToast("Ausência adicionada com sucesso!");
  });

  $DOM.daysOfWeekContainer.on(
    "change",
    'input[name="module-days"]',
    function () {
      const $c = $(this);
      const day = $c.val();
      const $container = $(`#schedule-${day}`);
      $container[$c.is(":checked") ? "slideDown" : "slideUp"]();
      if ($c.is(":checked") && $(`#timeSlots-${day}`).is(":empty")) {
        addTimeSlotTo($(`#timeSlots-${day}`));
      }
    }
  );

  $DOM.daySchedules.on("click", '[data-action="removeTimeSlot"]', function () {
    $(this).closest(".flex").remove();
  });

  $DOM.daySchedules.on("click", '[data-action="addTimeSlot"]', function () {
    addTimeSlotTo($(`#timeSlots-${$(this).data("day")}`));
  });

  $("body").on("click", "[data-action]", function () {
    const $btn = $(this);
    const action = $btn.data("action");
    const id = $btn.data("id");

    if (action === "removeModule") {
      modules = modules.filter((m) => m.id !== id);
      renderModules();
      renderScheduleGrid();
      showToast("Módulo removido.");
    } else if (action === "removeAbsence") {
      absences = absences.filter((a) => a.id !== id);
      renderAbsences();
      showToast("Ausência removida.");
    }
  });

  $DOM.daySchedules.on("change", '[data-role="start-time"]', function () {
    updateEndTimeOptions($(this));
  });
  $("#absenceStartTime").on("change", function () {
    updateEndTimeOptions($(this));
  });

  $('input[name="modulePeriodType"]').on("change", function () {
    $DOM.modulePartialPeriodContainer.slideToggle(
      $(this).val() === "partial"
    );
  });

  // absence type button color changes
  (function bindAbsenceTypeButtons() {
    const map = {
      falta: { bg: "bg-red-600", hover: "hover:bg-red-700" },
      atestado: { bg: "bg-yellow-500", hover: "hover:bg-yellow-600" },
      feriado: { bg: "bg-blue-600", hover: "hover:bg-blue-700" },
    };
    const classes = Object.values(map)
      .flatMap((c) => [c.bg, c.hover])
      .join(" ");

    $('input[name="absenceType"]').on("change", function () {
      const type = $(this).val();
      const colors = map[type];
      const $btn = $('#absenceForm button[type="submit"]');
      $btn.removeClass(classes).addClass(`${colors.bg} ${colors.hover}`);
      if (type === "feriado") $DOM.absenceNameContainer.slideDown();
      else $DOM.absenceNameContainer.slideUp();
    });
  })();

  $DOM.monthYear.on("change", function () {
    updateDateRangeConstraints();
    fetchAndAddHolidays();
  });

  $("#generateBtn").on("click", generateTimesheet);

  $("#printBtn").on("click", () => {
    $DOM.toast.removeClass("show");
    document.body.classList.add("printing");
    const removePrintingClass = () => {
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", removePrintingClass);
    };
    window.addEventListener("afterprint", removePrintingClass);
    window.print();
    setTimeout(removePrintingClass, 1000);
  });

  // ---------- SAVE / LOAD ----------
  $("#saveBtn").on("click", function () {
    const data = {
      professorName: $("#professorName").val(),
      schoolName: $("#schoolName").val(),
      monthYear: $("#monthYear").val(),
      chapa: $("#chapa").val(),
      contractType: $("#contractType").val(),
      admissionDate: $("#admissionDate").val(),
      function: $("#function").val(),
      modules,
      absences: absences.filter((a) => a.isManual),
      nextModuleId,
      nextAbsenceId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `dados_folha_ponto_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Dados salvos com sucesso!");
  });

  $("#loadBtn").on("click", () => $("#loadFile").click());

  $("#loadFile").on("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const data = JSON.parse(ev.target.result);
        $("#professorName").val(data.professorName || "");
        $("#schoolName").val(
          data.schoolName || "ESCOLA DO FUTURO JOSÉ LUIZ BITTENCOURT"
        );
        $("#monthYear").val(
          data.monthYear || new Date().toISOString().slice(0, 7)
        );
        $("#chapa").val(data.chapa || "009268");
        $("#contractType").val(data.contractType || "CLT");
        $("#admissionDate").val(data.admissionDate || "2025-08-25");
        $("#function").val(
          data.function || "Professor para Educação Profissional e Tecnológica X"
        );

        modules = data.modules || [];
        absences = data.absences || [];
        nextModuleId =
          data.nextModuleId ||
          (modules.length ? Math.max(...modules.map((m) => m.id)) + 1 : 0);
        nextAbsenceId =
          data.nextAbsenceId ||
          (absences.length ? Math.max(...absences.map((a) => a.id)) + 1 : 0);

        renderModules();
        renderAbsences();
        renderScheduleGrid();
        updateDateRangeConstraints();
        fetchAndAddHolidays();
        showToast("Dados carregados com sucesso!");
      } catch (err) {
        showToast(
          "Erro ao carregar o arquivo. Verifique se é um JSON válido.",
          true
        );
      }
    };
    reader.readAsText(file);
    $(this).val("");
  });

  // ---------- INIT ----------
  const initialize = () => {
    $DOM.monthYear.val(new Date().toISOString().slice(0, 7));
    $("#professorName").val("GABRIEL SOARES UZEDA");
    $DOM.modulePartialPeriodContainer.hide();
    $DOM.absenceNameContainer.hide();
    $("#absenceStartTime").html(generateTimeOptions(7, 21, true));
    $("#absenceEndTime").html(generateTimeOptions(8, 22, true));
    updateDateRangeConstraints();

    // build day controls
    $.each(DAY_CONFIG, (dayKey, cfg) => {
      $DOM.daysOfWeekContainer.append(
        `<div class="relative">
                    <input type="checkbox" id="day-${dayKey}" value="${dayKey}" name="module-days" class="peer absolute h-full w-full opacity-0 cursor-pointer">
                    <label for="day-${dayKey}" class="block cursor-pointer select-none rounded-lg border-2 border-gray-300 p-2 text-center font-medium text-gray-600 transition-colors duration-200 ease-in-out hover:bg-gray-100 peer-checked:border-blue-500 peer-checked:bg-blue-500 peer-checked:text-white">${cfg.name}</label>
                </div>`
      );

      $DOM.daySchedules.append(
        `<div id="schedule-${dayKey}" class="border border-gray-200 p-3 rounded-lg space-y-2 hidden" data-day="${dayKey}">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-medium text-gray-800">${cfg.name}</h4>
                        <button type="button" data-action="addTimeSlot" data-day="${dayKey}" class="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded flex items-center">
                            <span class="material-icons text-sm mr-1">add</span> Horário
                        </button>
                    </div>
                    <div id="timeSlots-${dayKey}"></div>
                </div>`
      );
    });

    $('input[name="absenceType"]:checked').trigger("change");
    fetchAndAddHolidays();
  };

  initialize();
});