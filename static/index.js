const urlParams = new URLSearchParams(window.location.search);
const searchOptions = document.getElementsByClassName("search-option");
var isLoading = false;

$(function() {
  const q = urlParams.get("q"); // Query (search term)
  const l = urlParams.get("l"); // Target language
  const o = urlParams.get("o"); // Search option

  var targetLang = l || $("#target-lang").val();
  var searchOption = o || "exact_match" // default value
  var resultCountGl = parseInt($("#result-count-glossary").val());
  var resultCountTm = parseInt($("#result-count-tm").val());

  // Do not use select2 dropdown on mobile devices
  if (!isTouchDevice()) {
    $("#target-lang").select2();
  }

  $(document).on("select2:open", () => {
    document.querySelector(".select2-search__field").focus();
  });

  // Highlight results with mark.js
  function mark(e) {
    if (e.dataset.active == "inactive") {
      e.dataset.active = "active";
      let keyword = $("#term").val();

      $("td[data-attribute='source']").unmark({
        done: function() {
          $("td[data-attribute='source']").mark(keyword);
        }
      });
    } else {
      $("td[data-attribute='source']").unmark();
      e.dataset.active = "inactive";
    }
  }

  // --- Beginning of Event Listeners ---
  $(".toggle").on("click", function() {
    // Get the name of the associated dropdown to toggle (glossary or TM)
    let resultCountDropdown = "#result-count-" + this.id.split("-")[1]

    if (this.checked) {
      $($(this).data("target")).css("opacity", "1");
      $(resultCountDropdown).prop("disabled", false);
    } else {
      $($(this).data("target")).css("opacity", "0.5"); 
      $(resultCountDropdown).prop("disabled", true);
    }

    if (!$("#toggle-glossary").is(":checked") && !$("#toggle-tm").is(":checked")) {
      $("#search-btn").prop("disabled", true);
    } else {
      $("#search-btn").prop("disabled", false);
    }

  });

  // Search option handling
  Array.from(searchOptions).forEach(option => {
    $(option).on("click", function() {
      Array.from(searchOptions).forEach(option => {
          option.dataset.active = "inactive"
      })
      this.dataset.active = this.dataset.active == "inactive" ? "active" : "inactive"
      searchOption = this.value
    })
  })

  // Result count select handling
  $("select").on("change", function() {
    if ($(this).attr("id") == "result-count-glossary") {
      resultCountGl = parseInt($("#result-count-glossary").val());
    } else if ($(this).attr("id") == "result-count-tm") {
      resultCountTm = parseInt($("#result-count-tm").val());
    }
  });

  $("#highlight").on("click", function() {
    mark(this);
  });

  $("#close-error").on("click", function() {
    $("#error-banner").css("display", "none");
  });
  // --- End of ON Event Listeners ---

  if (q) {
    // Update term input box with the value of the q parameter and launch serch
    $("#term").val(q);
    var term = $("#term").val();
    request(term, targetLang, resultCountGl, resultCountTm, searchOption)
  }

  if (l) {
    // Update target language dropdown with the value of the l parameter
    $("#target-lang").val(l);
  }
  
  // Handling classic search. Doing it otherwise causes a 415 error which I cannot for the life of me fix
  // todo: fix this. 
  $("#search-form").on("submit", function(e) {
    e.preventDefault();
    if (!isLoading) {
      isLoading = true;
      var term = $("#term").val();
      var targetLang = $("#target-lang").val();
      $("#warning-banner").css("display", "none");
      $("#error-banner").css("display", "none");
      request(term, targetLang, resultCountGl, resultCountTm, searchOption)
    }
  });
});

/* Disabled for production
function checkResultCount(resultCountGl, resultCountTm) {
  return new Promise((resolve, reject) => {
    if (resultCountGl > 100 || resultCountTm > 100 && $("#term").val().length > 2) {
      $("#warning-banner").css("display", "flex");

      $("#continue-btn").on("click", () => {
        $("#warning-banner").css("display", "none");
        resolve();
      });

      $("#cancel-btn").on("click", () => {
        $("#warning-banner").css("display", "none");
        reject();
      });
    } else {
      resolve();
    }
  });
}

function checkResultLength(term, resultCountGl, resultCountTm) {
  if ((term.length < 3) && (resultCountGl > 100 || resultCountTm > 100)) {
    $("#error-banner").css("display", "flex");
    $("#error-banner #error-msg").html("Maximum results search is disabled for terms which length is inferior to 3.");
    isLoading = false;
    return false;
  } else {
    return true;
  }
}
*/

function request(term, targetLang, resultCountGl, resultCountTm, searchOption) {
  /* Disabled for production
  if (!checkResultLength(term, resultCountGl, resultCountTm)) {
    return false;
  }
 
  checkResultCount(resultCountGl, resultCountTm).then(() => {*/

  $("#target-lang").prop("disabled", true);
  $("#search-btn").prop("disabled", true);
  $("#loader").css("display", "flex");
  $.ajax({
    headers: { 
      "Accept": "application/json",
      "Content-Type": "application/json" 
    },
    url: "/",
    type: "POST",
    dataType: "json",
    data: JSON.stringify({
      term: term,
      target_lang: targetLang,
      result_count_gl: resultCountGl,
      result_count_tm: resultCountTm,
      search_option: searchOption
    }),
    success: function(response) {
      let length_glossary = Object.values(response)[0].length
      // select last array for length of TM results
      let length_tm = Object.values(response).slice(-1)[0].length
      
      // Update URL
      let params = {q: term, l: targetLang, o: searchOption}; 
      let newParams = new URLSearchParams(params);
      const newUrl = window.location.pathname + "?" + newParams.toString();
      window.history.pushState({ path: newUrl }, "", newUrl);

      // Get results
      //console.log(Object.values(response))

      switch (true) {
        case $("#toggle-glossary").is(":checked") && !$("#toggle-tm").is(":checked"):
          $("#tm-results").css("display", "none");
          getGlossary(response, length_glossary)
          break;
        case !$("#toggle-glossary").is(":checked") && $("#toggle-tm").is(":checked"):
          $("#glossary-results").css("display", "none");
          getExcerpts(response, length_tm)
          break;
        default:
          getGlossary(response, length_glossary)
          getExcerpts(response, length_tm)
      }

      $("#results").css("display", "block");
      $("#error-banner").css("display", "none");
      $("#loader").css("display", "none");
      document.title = `termic :: ${term} (${$("#target-lang option:selected").text()})`
    },
    error: function(jqXHR, textStatus, errorThrown) {
      $("#error-banner").css("display", "flex");
      $("#error-banner #error-msg").html(textStatus+": "+errorThrown);
      $("#loader").css("display", "none");
    },
    complete: function() { // fix bug that prevents new search
      isLoading = false;
      $("#target-lang").prop("disabled", false);
      $("#search-btn").prop("disabled", false);
      return isTouchDevice() ? activateCopyWithTap() : activateCopyWithBtn();
    }
  });
};

function getGlossary(response, length) {
  $("#glossary-results").css("display", "block");
  if (length > 0) {
    console.log("Found " + length + " glossary entries")
    let resultsGl = "";
    for (let i = 0; i < length; i++) {
      resultsGl += `
        <tr>
          <td data-attribute="source">${response.gl_source[i]}<br>
            <i>(${response.gl_source_pos[i]
                .substring(response.gl_source_pos[i].indexOf(":") + 1)
                .trim().toLowerCase()})</i>
          </td>

          <td>${response.gl_translation[i]}<br>
            <i>(${response.gl_target_pos[i]
                .substring(response.gl_target_pos[i].indexOf(":") + 1)
                .trim().toLowerCase()})</i>
          </td>

          <td>${response.gl_source_def[i]
              .substring(response.gl_source_def[i].indexOf(":") + 1).trim()}
          </td>

          <td><i class="fa-solid fa-copy"></i></td>
        </tr>
      `;
  }
    $("#glossary-results-table").html(resultsGl);
    $("#glossary-nb").html(` (${length} results)`);
    $("#search-filters-container").css("display", "flex");
  } else {
    $("#glossary-results-table").html("<p>No results found in the glossary.</p>");
    $("#glossary-nb").html(` (0 results)`);
  }
};

function getExcerpts(response, length) {
  $("#tm-results").css("display", "block");
  if (length > 0) {
    console.log("Found " + length + " entries in the TM")
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
    $("#tm-nb").html(` (${length} results)`);
    $("#search-filters-container").css("display", "flex");
  } else {
    $("#tm-results-table").html("<p>No results found in the translation memory.</p>");
    $("#tm-nb").html(` (0 results)`);
  }
};

function getRowContent(row) {
  const cells = Array.from(row.cells);
  const rowContent = cells.map(cell => cell.textContent.trim())
                         .join(" | ")
                         .replace(/\s*\n\s*/g, " ")
                         .slice(0, -3)
  return rowContent;
}

function activateCopyWithBtn() { 
  Array.from(document.getElementsByClassName("fa-copy")).forEach(copyButton => {
    $(copyButton).on("click", function() {
      const rowContent = getRowContent(copyButton.closest("tr"));
      copyToClipboard(rowContent);
      $(copyButton).addClass("copied");
      setTimeout(() => {
        $(copyButton).removeClass("copied");
      }, 2000);
    });
  });
}

function activateCopyWithTap() { 
  let lastTap = 0;
  $(".fa-copy").css("display", "none");
  $("#tip-tap").css("display", "block");
  Array.from(document.querySelectorAll("tbody")).forEach(tbody => {
    $(tbody).on("touchstart", function() {
      e.preventDefault();
      let time = new Date().getTime();
      const tapInterval = 500; // in ms
      if (time - lastTap < tapInterval) {
        const rowContent = getRowContent(e.target.closest("tr"));
        showToast("<p>Row copied</p>");
        copyToClipboard(rowContent);
      }
      lastTap = time;
    });
  });
}

function copyToClipboard(text) {
  if (!navigator.clipboard) { // handle deprecated execCommand()
    execCommand("copy", false, text)
    .then(() => console.log("Row content copied to clipboard"))
    .catch(error => console.error("Failed to copy row content: ", error)); 
  } else {
    navigator.clipboard.writeText(text)
    .then(() => console.log("Row content copied to clipboard"))
    .catch(error => console.error("Failed to copy row content: ", error));
  }
}

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

// https://stackoverflow.com/questions/4817029/whats-the-best-way-to-detect-a-touch-screen-device-using-javascript
function isTouchDevice() {
  return ((("ontouchstart" in window) ||
    // temp fix for https://stackoverflow.com/questions/69125308/navigator-maxtouchpoints-256-on-desktop
    (navigator.maxTouchPoints > 0) && (navigator.maxTouchPoints != 256) ||
    // if the screen is >480, there's enough space for the copy button; no need to activate touch mode
    (navigator.msMaxTouchPoints > 0)) && window.screen.width <= 480);
}