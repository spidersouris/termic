const urlParams = new URLSearchParams(window.location.search);
var isLoading = false;

$(function() {
  const q = urlParams.get("q"); // Query (search term)
  const l = urlParams.get("l"); // Target language

  var targetLang = l || $("#target-lang").val();
  var exactMatchGl = parseInt($("#exact-match-glossary").val());
  var exactMatchTm = parseInt($("#exact-match-tm").val());
  var resultCountGl = parseInt($("#result-count-glossary").val());
  var resultCountTm = parseInt($("#result-count-tm").val());

  // Highlight results with mark.js
  function mark() {
    if ($("#mark-results").is(":checked")) {
      var keyword = $("#term").val();

      $("td[data-attribute='source']").unmark({
        done: function() {
          $("td[data-attribute='source']").mark(keyword);
        }
      });
    } else {
      $("td[data-attribute='source']").unmark();
    }
  }

  // --- Beginning of Event Listeners ---
  // Checkbox handling
  $("input[type='checkbox']").on("click", function() {
    if ($(this).attr("id") == "exact-match-glossary") {
      exactMatchGl = $(this).is(":checked") ? 1 : 0;
    } else if ($(this).attr("id") == "exact-match-tm") {
      exactMatchTm = $(this).is(":checked") ? 1 : 0;
    }
  });

  // Select handling
  $("select").on("change", function() {
    if ($(this).attr("id") == "result-count-glossary") {
      resultCountGl = parseInt($("#result-count-glossary").val());
    } else if ($(this).attr("id") == "result-count-tm") {
      resultCountTm = parseInt($("#result-count-tm").val());
    }
  });

  $("#mark-results").on("click", function() {
    mark();
  });

  $("#close-error").on("click", function() {
    $("#error-banner").css("display", "none");
  });
  // --- End of ON Event Listeners ---
  
  if (q) {
    // Update term input box with the value of the q parameter and launch serch
    $("#term").val(q);
    var term = $("#term").val();
    request(term, targetLang, resultCountGl, resultCountTm, exactMatchGl, exactMatchTm)
  }

  if (l) {
    // Update target language dropdown with the value of the l parameter
    $("#target-lang").val(l);
  }
  
  // Handling classic search. Doing it otherwise causes a 415 error which I cannot for the life of me fix
  $("#search-form").submit(function(event) {
    event.preventDefault();
    if (!isLoading) {
      isLoading = true;
      var term = $("#term").val();
      var targetLang = $("#target-lang").val();
      $("#warning-banner").css("display", "none");
      $("#error-banner").css("display", "none");
      request(term, targetLang, resultCountGl, resultCountTm, exactMatchGl, exactMatchTm);
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

function request(term, targetLang, resultCountGl, resultCountTm, exactMatchGl, exactMatchTm) {
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
      exact_match_gl: exactMatchGl,
      exact_match_tm: exactMatchTm,
      result_count_gl: resultCountGl,
      result_count_tm: resultCountTm
    }),
    success: function(response) {
      // Update URL
      urlParams.set("q", term);
      urlParams.set("l", targetLang);
      const newUrl = window.location.pathname + "?" + urlParams.toString();
      window.history.pushState({ path: newUrl }, "", newUrl);

      // Get results
      console.log(Object.values(response))
      getGlossary(response, Object.values(response)[0].length)
      getExcerpts(response, Object.values(response).slice(-1)[0].length) // select last array for length

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
    }
  });
};

function getGlossary(response, length) {
  if (length > 0) {
    console.log("Found " + length + " glossary entries")
    var resultsGl = "";
    for (var i = 0; i < length; i++) {
      resultsGl += `
        <tr>
          <td data-attribute="source">${response.gl_source[i]}<br><i>(${response.gl_source_pos[i].substring(response.gl_source_pos[i].indexOf(":") + 1).trim().toLowerCase()})</i></td>
          <td>${response.gl_translation[i]}<br><i>(${response.gl_target_pos[i].substring(response.gl_target_pos[i].indexOf(":") + 1).trim().toLowerCase()})</i></td>
          <td>${response.gl_source_def[i].substring(response.gl_source_def[i].indexOf(":") + 1).trim()}</td>
        </tr>
      `;
  }
    $("#glossary-results").html(resultsGl);
    $("#glossary-nb").html(` (${length} results)`);
    $(".mark-results-container").css("display", "inline-block");
  } else {
    $("#glossary-results").html("<p>No results found in the glossary.</p>");
    $("#glossary-nb").html(` (0 results)`);
  }
};

function getExcerpts(response, length) {
  if (length > 0) {
    console.log("Found " + length + " entries in the TM")
    var resultsTm = "";
    for (var i = 0; i < length; i++) {
      resultsTm += `
        <tr>
          <td data-attribute="source">${response.tm_source[i]}</td>
          <td>${response.tm_translation[i]}</td>
          <td>${response.tm_cat[i]}</td>
          <td>${response.tm_platform[i]}</td>
          <td>${response.tm_product[i]}</td>
        </tr>
      `;
  }
    $("#tm-results").html(resultsTm);
    $("#tm-nb").html(` (${length} results)`);
    $(".mark-results-container").css("display", "inline-block");
  } else {
    $("#tm-results").html("<p>No results found in the translation memory.</p>");
    $("#tm-nb").html(` (0 results)`);
  }
};