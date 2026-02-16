// termicDeployedVersion should only be changed on major releases.
// We don't want to annoy users with the info banner on every minor release!
const termicDeployedVersion = 1.5;
const currentYearFooter = new Date().getFullYear();
// Version shown in the footer and the update banner
const currentVersionHTML = "1.5.1";
const urlParams = new URLSearchParams(window.location.search);
const searchOptions = document.getElementsByClassName("search-option");
const periodButtons = document.getElementsByName("period-button");
var termicStoredVersion = localStorage.getItem("termicStoredVersion");
var isLoading = false;
var lengthGlossary = 0;
var lengthTm = 0;
var isTwoColumnLayout = false;

$(function () {
  const q = urlParams.get("q"); // Query (search term)
  const sl = urlParams.get("sl"); // Source language
  const tl = urlParams.get("tl"); // Target language
  const o = urlParams.get("o"); // Search option
  const rc_gl = urlParams.get("rc_gl"); // Glossary result count
  const rc_tm = urlParams.get("rc_tm"); // TM result count
  const cs = urlParams.get("cs"); // Case sensitive?
  const p = urlParams.get("p"); // Data period

  var sourceLang = sl || $("#source-lang").val();
  var targetLang = tl || $("#target-lang").val();
  var searchOption = o || "unexact_match"; // default value
  var resultCountGl = rc_gl || parseInt($("#result-count-glossary").val());
  var resultCountTm = rc_tm || parseInt($("#result-count-tm").val());
  var caseSensitive = cs || 0; // default value
  var modes = ["glossary", "tm"]; // default values
  var dataPeriod =
    p || $("button[name='period-button'][data-active='active']").val();

  // Focus search input on page load
  $("#term").focus();

  if (!isTouchDevice()) {
    // Do not use select2 dropdown on mobile devices
    $("#source-lang, #target-lang").select2({
      templateResult: appendIcons,
      templateSelection: appendIcons,
    });
  }

  // --- Begining of Local Storage ---

  // Show update banner if termic version is different from stored version
  if (termicStoredVersion != termicDeployedVersion) {
    $("#info-banner").css("display", "flex");
  }

  if (localStorage.getItem("source-lang") && !sl) {
    $("#source-lang")
      .val(localStorage.getItem("source-lang"))
      .trigger("change.select2");
  }

  if (localStorage.getItem("target-lang") && !tl) {
    $("#target-lang")
      .val(localStorage.getItem("target-lang"))
      .trigger("change.select2");
  }

  if (localStorage.getItem("result-count-glossary") && !rc_gl) {
    $("#result-count-glossary")
      .val(localStorage.getItem("result-count-glossary"))
      .trigger("change.select2");
  }

  if (localStorage.getItem("result-count-tm") && !rc_tm) {
    $("#result-count-tm")
      .val(localStorage.getItem("result-count-tm"))
      .trigger("change.select2");
  }
  // --- End of Local Storage ---

  // --- Beginning of Event Listeners ---
  $("#hamburger-btn").on("click", function () {
    if ($("#hamburger").hasClass("inactive")) {
      $("#hamburger").addClass("active").removeClass("inactive");
    } else {
      $("#hamburger").addClass("inactive").removeClass("active");
    }
  });

  $(document).on("select2:open", () => {
    document.querySelector(".select2-search__field").focus();
  });

  $(".toggle").on("click", function () {
    // Get the name of the associated dropdown to toggle
    // and item to add/remove from modes list (glossary or TM)
    const mode = this.id.split("-")[1];
    const resultCountDropdown = "#result-count-" + mode;
    const periodButton = "button[name='period-button']";

    if (this.checked) {
      $($(this).data("target")).css("opacity", "1");
      $(resultCountDropdown).prop("disabled", false);
      if (mode == "tm") $(periodButton).prop("disabled", false);
      if (modes.indexOf(mode) === -1) modes.push(mode);
    } else {
      $($(this).data("target")).css("opacity", "0.5");
      $(resultCountDropdown).prop("disabled", true);
      if (mode == "tm") $(periodButton).prop("disabled", true);
      modes.splice(modes.indexOf(mode), 1);
    }

    if (
      !$("#toggle-glossary").is(":checked") &&
      !$("#toggle-tm").is(":checked")
    ) {
      $("#search-btn").prop("disabled", true);
    } else {
      $("#search-btn").prop("disabled", false);
    }
  });

  // Search options handling
  handleButtonsState(searchOptions, (option) => {
    searchOption = option.value;
  });

  // Period buttons handling
  handleButtonsState(periodButtons, (button) => {
    dataPeriod = button.value;
    periodDesc = $(".period-description");
    dataPeriod == "2020+"
      ? periodDesc.text(periodDesc.attr("desc-2020"))
      : periodDesc.text(periodDesc.attr("desc-2017"));
  });

  $("#target-lang, #source-lang").on("change", function () {
    checkDataPeriodCompatibility();
    enableSwapBtn();
  });

  // Result count select handling
  $("select#result-count-glossary, select#result-count-tm").on(
    "change",
    function () {
      if ($(this).is("#result-count-glossary")) {
        resultCountGl = parseInt($("#result-count-glossary").val());
      } else if ($(this).is("#result-count-tm")) {
        resultCountTm = parseInt($("#result-count-tm").val());
      }
    },
  );

  $("#highlight-btn").on("click", function () {
    highlightResults(this);
  });

  $("#two-col-btn").on("click", function () {
    if (!isTouchDevice()) {
      switchResultsLayout();
    } else {
      showToast("Two-column layout not available on mobile devices");
    }
  });

  $("#close-error").on("click", function () {
    $("#error-banner").css("display", "none");
  });

  $("#close-info, #changelog-link").on("click", function () {
    localStorage.setItem("termicStoredVersion", termicDeployedVersion);
    $("#info-banner").css("display", "none");
  });

  $(".additional-match-option").on("click", function () {
    if (this.dataset.active == "inactive" && this.value == "case_sensitivity") {
      this.dataset.active = "active";
      caseSensitive = 1;
    } else {
      this.dataset.active = "inactive";
      caseSensitive = 0;
    }
  });

  $(".search-option[value='regex']").on("click", function () {
    $(".additional-match-option[value='case_sensitivity']").prop(
      "disabled",
      true,
    );
    $(".additional-match-option[value='case_sensitivity']").prop(
      "title",
      "Case Sensitivity is not available for RegExp searches",
    );
  });

  $(".search-option:not([value='regex'])").on("click", function () {
    $(".additional-match-option[value='case_sensitivity']").prop(
      "disabled",
      false,
    );
    $(".additional-match-option[value='case_sensitivity']").prop(
      "title",
      "Case Sensitivity",
    );
  });

  $("#swap-btn").on("click", function () {
    swapLanguages();
  });
  // --- End of Event Listeners ---

  if (q) {
    // Update term input box with the value of the q parameter and launch search
    $("#term").val(q);
    var term = $("#term").val();
    if (!modes || modes.length <= 0) {
      showBanner("error", "Please select at least one search mode.");
    } else if (sourceLang == undefined || targetLang == undefined) {
      showBanner("error", "Please select a source and target language.");
    } else if (sourceLang == targetLang) {
      showBanner("error", "Source and target languages cannot be identical.");
    } else {
      request(
        term,
        sourceLang,
        targetLang,
        resultCountGl,
        resultCountTm,
        searchOption,
        caseSensitive,
        modes,
        dataPeriod,
      );
    }
  }

  if (sl) {
    // Update target language dropdown with the value of the sl parameter
    $("#source-lang").val(sl).trigger("change.select2");
  }

  if (tl) {
    // Update target language dropdown with the value of the tl parameter
    $("#target-lang").val(tl).trigger("change.select2");
  }

  if (rc_gl) {
    // Update glossary result count dropdown with the value of the rc_gl parameter
    $("#result-count-glossary").val(rc_gl).trigger("change.select2");
  }

  if (rc_tm) {
    // Update TM result count dropdown with the value of the rc_tm parameter
    $("#result-count-tm").val(rc_tm).trigger("change.select2");
  }

  if (o && o != "unexact_match") {
    // Update match type buttons to active
    $("button[value='unexact_match']").attr("data-active", "inactive");
    $(`button[value='${o}']`).attr("data-active", "active");
  }

  if (cs == 1) {
    // Update case sensitivity button to active
    $("button[value='case_sensitivity']").attr("data-active", "active");
  }

  if (p) {
    // Update period buttons to active
    periodButtons.forEach((b) => $(b).attr("data-active", "inactive"));
    $(`button[value='${p}']`).attr("data-active", "active");
  }

  $("#search-form").on("submit", function (e) {
    e.preventDefault();
    var term = $("#term").val();
    var sourceLang = $("#source-lang").val();
    var targetLang = $("#target-lang").val();
    if (!modes || modes.length <= 0) {
      showBanner("error", "Please select at least one search mode.");
    } else if (sourceLang == undefined || targetLang == undefined) {
      showBanner("error", "Please select a source and target language.");
    } else if (sourceLang == targetLang) {
      showBanner("error", "Source and target languages cannot be identical.");
    } else {
      if (!isLoading) {
        isLoading = true;
        $("#warning-banner").css("display", "none");
        $("#error-banner").css("display", "none");
        request(
          term,
          sourceLang,
          targetLang,
          resultCountGl,
          resultCountTm,
          searchOption,
          caseSensitive,
          modes,
          dataPeriod,
        );
      }
    }
  });
});

/**
 * Request search results from the server
 * @param {string} term - Term to search for
 * @param {string} sourceLang - Source language
 * @param {string} targetLang - Target language
 * @param {number} resultCountGl - Number of glossary results to return
 * @param {number} resultCountTm - Number of TM results to return
 * @param {string} searchOption - Search option (exact_match, unexact_match, regex)
 * @param {number} caseSensitive - Case sensitivity (0 or 1)
 * @param {Array} modes - Array of modes to search (glossary, tm)
 * @param {string} dataPeriod - Data period (2017, 2020+)
 */
function request(
  term,
  sourceLang,
  targetLang,
  resultCountGl,
  resultCountTm,
  searchOption,
  caseSensitive,
  modes,
  dataPeriod,
) {
  $("#target-lang").prop("disabled", true);
  $("#search-btn").prop("disabled", true);
  $("#no-results").css("display", "none");
  $("#loader").css("display", "flex");
  $.ajax({
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    url: "/",
    type: "POST",
    dataType: "json",
    data: JSON.stringify({
      term: term,
      source_lang: sourceLang,
      target_lang: targetLang,
      result_count_gl: resultCountGl,
      result_count_tm: resultCountTm,
      search_option: searchOption,
      case_sensitive: caseSensitive,
      modes: modes,
      data_period: dataPeriod,
    }),
    success: function (response) {
      lengthGlossary = Object.values(response)[0].length;
      // select last array for length of TM results
      lengthTm = Object.values(response).slice(-1)[0].length;

      // Update URL
      let params = {
        q: term,
        sl: sourceLang,
        tl: targetLang,
        o: searchOption,
        rc_gl: resultCountGl,
        rc_tm: resultCountTm,
        cs: caseSensitive,
        p: dataPeriod,
      };
      let newParams = new URLSearchParams(params);
      const newUrl = window.location.pathname + "?" + newParams.toString();
      window.history.pushState({ path: newUrl }, "", newUrl);

      // Get results
      console.log(Object.values(response));

      switch (true) {
        case $("#toggle-glossary").is(":checked") &&
          !$("#toggle-tm").is(":checked"):
          $("#tm-results").css("display", "none");
          getGlossary(response, lengthGlossary);
          break;
        case !$("#toggle-glossary").is(":checked") &&
          $("#toggle-tm").is(":checked"):
          $("#glossary-results").css("display", "none");
          getExcerpts(response, lengthTm, dataPeriod);
          break;
        default:
          getGlossary(response, lengthGlossary);
          getExcerpts(response, lengthTm, dataPeriod);
      }

      let sourceLangText = $("#source-lang option:selected").text();
      let targetLangText = $("#target-lang option:selected").text();

      // Update table headers with source and target languages
      $(".source-lang-label").html("[" + sourceLangText + "]");
      $(".target-lang-label").html("[" + targetLangText + "]");

      $("#results").removeClass("hidden");
      $("#results").addClass("block");

      $("#error-banner").css("display", "none");
      $("#loader").css("display", "none");

      document.title = `termic :: ${term} (${sourceLangText} → ${targetLangText})`;

      // Local storage set
      localStorage.setItem("source-lang", sourceLang);
      localStorage.setItem("target-lang", targetLang);
      localStorage.setItem("result-count-glossary", resultCountGl);
      localStorage.setItem("result-count-tm", resultCountTm);
    },
    error: function (jqXHR, textStatus, errorThrown) {
      let errMsg = JSON.parse(jqXHR.responseText).msg;

      $("#error-banner").css("display", "flex");
      $("#error-banner #error-msg").html(
        textStatus + ": " + errorThrown + " — " + errMsg,
      );
      $("#loader").css("display", "none");
    },
    complete: function () {
      // fix bug that prevents new search
      isLoading = false;
      $("#target-lang").prop("disabled", false);
      $("#search-btn").prop("disabled", false);
      $("#highlight-btn").prop("disabled", false);
      $("#two-col-btn").prop("disabled", false);
      if (lengthGlossary > 0 || lengthTm > 0) {
        activateSortRows();

        // On mobile devices, activate copy button
        // and disable two-column display button
        //
        // We're fake-disabling the button by adding some "disabled" style
        // instead of using prop because we still want the button to be clickable
        // for the toast to appear
        return isTouchDevice()
          ? (activateCopyWithTap(), $("#two-col-btn").addClass("disabled"))
          : activateCopyWithBtn();
      } else if (lengthGlossary == 0 && lengthTm == 0) {
        $("#no-results").css("display", "flex");
        $("#glossary-results").css("display", "none");
        $("#tm-results").css("display", "none");
      }
    },
  });
}

/**
 * Get glossary results and display them
 * @param {Response} response - Response from server
 * @param {number} length - Number of glossary results
 */
function getGlossary(response, length) {
  if (length > 0) {
    //console.log("Found " + length + " glossary entries");
    $("#glossary-results").css("display", "block");
    let resultsGl = "";
    for (let i = 0; i < length; i++) {
      resultsGl += `
        <tr>
          <td data-attribute="source">${response.gl_source[i]}<br>
            <i>(${response.gl_source_pos[i]
              .substring(response.gl_source_pos[i].indexOf(":") + 1)
              .trim()
              .toLowerCase()})</i>
          </td>

          <td>${response.gl_translation[i]}<br>
            <i>(${response.gl_target_pos[i]
              .substring(response.gl_target_pos[i].indexOf(":") + 1)
              .trim()
              .toLowerCase()})</i>
          </td>

          <td>${response.gl_source_def[i]
            .substring(response.gl_source_def[i].indexOf(":") + 1)
            .trim()}
          </td>

          <td><i class="fa-solid fa-copy"></i></td>
        </tr>
      `;
    }
    $("#glossary-results-table").html(resultsGl);
    $("#glossary-nb").html(` (${length} results)`);
    $("#search-filters-container").css("display", "flex");
  } else {
    $("#glossary-results").css("display", "none");
  }
}

/**
 * Get TM results and display them
 * @param {Response} response - Response from server
 * @param {number} length - Number of TM results
 */
function getExcerpts(response, length, dataPeriod) {
  if (length > 0) {
    //console.log("Found " + length + " TM entries");
    $("#tm-results").css("display", "block");
    let resultsTm = "";
    for (let i = 0; i < length; i++) {
      resultsTm += `
        <tr>
          <td data-attribute="source">${response.tm_source[i]}</td>
          <td>${response.tm_translation[i]}</td>
          <td>${response.tm_cat[i]}</td>
          <td>${response.tm_platform[i]}</td>
          <td>${response.tm_product[i]}</td>
          <td><i class="fa-solid fa-copy"></i></td>
        </tr>
      `;
    }
    $("#tm-results-table").html(resultsTm);
    $("#tm-nb").html(` (${dataPeriod} | ${length} results)`);
    $("#search-filters-container").css("display", "flex");
    highlightVSCodeStrings();
  } else {
    $("#tm-results").css("display", "none");
  }
}

/**
 * Highlight results with mark.js
 * @param {HTMLButtonElement} e - Highlight button
 */
function highlightResults(e) {
  if (e.dataset.active == "inactive") {
    e.dataset.active = "active";
    const keyword = $("#term").val();

    // unmark previous highlighted term
    $("td[data-attribute='source']").unmark({
      done: function () {
        $("td[data-attribute='source']").mark(keyword);
      },
    });
  } else {
    $("td[data-attribute='source']").unmark();
    e.dataset.active = "inactive";
  }
}

/**
 * Get row content
 * @param {HTMLTableCellElement} row - Row to get content from
 * @returns {string} - Row content
 */
function getRowContent(row) {
  const cells = Array.from(row.cells);
  const rowContent = cells
    .map((cell) => cell.textContent.trim())
    .join(" | ")
    .replace(/\s*\n\s*/g, " ")
    .slice(0, -3);
  return rowContent;
}

/**
 * Activate copy fezture with button on non-touch devices
 * and devices whose width > 480
 */
function activateCopyWithBtn() {
  Array.from(document.getElementsByClassName("fa-copy")).forEach(
    (copyButton) => {
      $(copyButton).on("click", function () {
        const rowContent = getRowContent(copyButton.closest("tr"));
        copyToClipboard(rowContent);
        $(copyButton).addClass("copied");
        setTimeout(() => {
          $(copyButton).removeClass("copied");
        }, 2000);
      });
    },
  );
}

/**
 * Activate copy feature with two-finger tap on touch devices
 * and devices whose width <= 480
 */
function activateCopyWithTap() {
  $(".fa-copy").css("display", "none");
  $("#tip-tap").css("display", "block");
  Array.from(document.querySelectorAll("tbody")).forEach((tbody) => {
    $(tbody).on("touchstart", function (e) {
      e.stopPropagation();
      if (e.touches.length === 2) {
        const rowContent = getRowContent(e.target.closest("tr"));
        showToast("<p>Row copied</p>");
        copyToClipboard(rowContent);
      }
    });
  });
}

/**
 * Copy row content to clipboard
 * @param {string} text - Row content to copy
 */
function copyToClipboard(text) {
  // Reminder: navigator.clipboard requires secure origin!
  navigator.clipboard
    .writeText(text)
    .then(() => console.log("Row content copied to clipboard"))
    .catch((error) => console.error("Failed to copy row content: ", error));
}

/**
 * Show toast to mobile users
 * @param {string} text - Text to display in toast
 */
function showToast(text) {
  let toastTimeout = 0;
  $("#toast").html(text);
  $("#toast-container").css("display", "block");
  $("#toast-container").animate({ opacity: 1 }, 500);
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    $("#toast-container").animate({ opacity: 0 }, 500, () => {
      $("#toast-container").css("display", "none");
    });
  }, 2000);
}

/**
 * Activate sort rows feature
 * Modified from https://stackoverflow.com/questions/3160277/jquery-table-sort
 */
function activateSortRows() {
  $("th").click(function () {
    var table = $(this).parents("table").eq(0);
    var ths = table.find("th");
    var rows = table
      .find("tr:gt(0)")
      .toArray()
      .sort(comparer($(this).index()));
    this.asc = !this.asc;

    // Clear existing carets
    Array.from(ths).forEach((th) => {
      $(th).find(".fa-caret-down").removeClass("caret-force-visible");
      $(th).find(".fa-caret-up").removeClass("caret-force-visible");
    });

    if (!this.asc) {
      rows = rows.reverse();
      $(this).find(".fa-caret-down").addClass("caret-force-visible");
    } else {
      $(this).find(".fa-caret-up").addClass("caret-force-visible");
    }
    for (var i = 0; i < rows.length; i++) {
      {
        table.append(rows[i]);
      }
    }
  });

  /**
   * Compare rows
   * @param {number} index - Index of the column to sort by
   * @returns {function} - Comparator function to sort rows by index column
   */
  function comparer(index) {
    return function (a, b) {
      var valA = getCellValue(a, index);
      var valB = getCellValue(b, index);
      return $.isNumeric(valA) && $.isNumeric(valB)
        ? valA - valB
        : valA.toString().localeCompare(valB);
    };
  }

  /**
   * Get cell value
   * @param {HTMLTableCellElement} row - Row to get value from
   * @param {number} index - Index of the column to get value from
   * @returns {string}
   */
  function getCellValue(row, index) {
    return $(row).children("td").eq(index).text();
  }
}

/**
 * Check if device is touch-enabled
 * https://stackoverflow.com/questions/4817029/whats-the-best-way-to-detect-a-touch-screen-device-using-javascript
 * @returns {boolean} - true if the device is touch, false otherwise
 */
function isTouchDevice() {
  return (
    ("ontouchstart" in window ||
      // temp fix for https://stackoverflow.com/questions/69125308/navigator-maxtouchpoints-256-on-desktop
      (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints != 256) ||
      // if the screen is >480, there's enough space for the copy button; no need to activate touch mode
      navigator.msMaxTouchPoints > 0) &&
    window.screen.width <= 480
  );
}

/**
 * Show banner with text
 * @param {string} type - Type of banner to show (error, info)
 * @param {string} text - Text to display in error banner
 */
function showBanner(type, text) {
  $(`#${type}-banner`).css("display", "flex");
  $(`#${type}-banner #${type}-msg`).html(text);
}

/**
 * Hide banner
 * @param {string} type - Type of banner to hide (error, info)
 */
function hideBanner(type) {
  $(`#${type}-banner`).css("display", "none");
}

/**
 * Handle collection of buttons so that only one button can be active at a time
 * @param {HTMLCollectionOf<Element>} buttonsCollection - Collection of buttons to handle
 * @param {function} callback - Callback function to execute on button click
 */
function handleButtonsState(buttonsCollection, callback) {
  Array.from(buttonsCollection).forEach((button) => {
    $(button).on("click", function () {
      Array.from(buttonsCollection).forEach((otherButton) => {
        otherButton.dataset.active = "inactive";
      });
      this.dataset.active =
        this.dataset.active == "inactive" ? "active" : "inactive";

      callback(this);
    });
  });
}

/**
 * Swap source and target language dropdown selections.
 */
function swapLanguages() {
  let oldSourceLang = $("#source-lang").val();
  $("#source-lang").val($("#target-lang").val()).trigger("change.select2");
  $("#target-lang").val(oldSourceLang).trigger("change.select2");
}

/**
 * Switch between horizontal and vertical (two-column) layout
 */
function switchResultsLayout() {
  if (!isTwoColumnLayout) {
    isTwoColumnLayout = true;
    $("#results").removeClass("block");
    $(
      "#results, #glossary-results, #tm-results, #tm-title, #glossary-title, #tm, #glossary, #glossary thead, #tm thead",
    ).addClass("two-col");
    $("button[value='two-col']").attr("data-active", "active");
  } else {
    isTwoColumnLayout = false;
    $("#results").addClass("block");
    $(
      "#results, #glossary-results, #tm-results, #tm-title, #glossary-title, #tm, #glossary, #glossary thead, #tm thead",
    ).removeClass("two-col");
    $("button[value='two-col']").attr("data-active", "inactive");
  }
}

/**
 * Append VSCode icon to VSCode strings in search results
 */
function highlightVSCodeStrings() {
  if ($("#tm-results-table").find("td:contains('VSCode')")) {
    $("td:contains('VSCode')").html(
      "<img src='static/images/svgs/vscode-icon.svg' class='vscode-icon'><td>VSCode</td>",
    );
  }
}

/**
 * Check if the selected languages support the selected data period
 */
function checkDataPeriodCompatibility() {
  let compatibleLangs = $(
    "#source-lang option[data-2017='true'], #target-lang option[data-2017='true']",
  )
    .map(function () {
      return $(this).val();
    })
    .get();

  if (
    !compatibleLangs.includes($("#source-lang").val()) ||
    !compatibleLangs.includes($("#target-lang").val())
  ) {
    $("button.period-2017").prop("disabled", true);
    $("button.period-2017").prop(
      "title",
      "One of the languages does not support this data period",
    );
    $("button.period-2017").attr("data-active", "inactive");
    $("button.period-2020").attr("data-active", "active");
    $(".period-description").text($(".period-description").attr("desc-2020"));
  } else {
    $("button.period-2017").prop("disabled", false);
  }
}

/**
 * Enable swap language button only when both languages have been selected
 */
function enableSwapBtn() {
  const [sourceLang, targetLang] = [
    $("#source-lang").val(),
    $("#target-lang").val(),
  ];
  if (sourceLang == undefined || targetLang == undefined) return;
  $("#swap-btn").prop("disabled", false);
}

/**
 * Append icons to select2.js dropdown options
 * @param {Object} e - select2.js event data object (https://select2.org/programmatic-control/events#event-data)
 * @returns {string}
 */
function appendIcons(e) {
  let polygonAndVSCodeIcons = `<img src="static/images/svgs/vscode-icon.svg" height="15" width="15" class="polygon" style="position: relative; bottom: 2px;"><img src="static/images/svgs/polygon.svg" height="15" width="15" class="polygon" style="position: relative; bottom: 2px;"><span>${e.text}</span>`;
  let polygonIcon = `<img src="static/images/svgs/polygon.svg" height="15" width="15" class="polygon" style="position: relative; bottom: 2px;"><span>${e.text}</span>`;
  let VSCodeIcon = `<img src="static/images/svgs/vscode-icon.svg" height="15" width="15" class="polygon" style="position: relative; bottom: 2px;"><span>${e.text}</span>`;

  if ($(e.element).attr("data-2017") && $(e.element).attr("vscode")) {
    return $(polygonAndVSCodeIcons);
  } else if ($(e.element).attr("data-2017")) {
    return $(polygonIcon);
  } else if ($(e.element).attr("vscode")) {
    return $(VSCodeIcon);
  }

  return e.text;
}
