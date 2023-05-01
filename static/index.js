const urlParams = new URLSearchParams(window.location.search);
var isLoading = false;

$(function() {
  const q = urlParams.get("q");
  const l = urlParams.get("l");

  var target_lang = l || $("#target-lang").val();
  var exact_match_gl = parseInt($("#exact-match-glossary").val());
  var exact_match_exc = parseInt($("#exact-match-excerpts").val());

  $("input[type='checkbox']").on("click", function() {
    if ($(this).attr("id") == "exact-match-glossary") {
      exact_match_gl = $(this).is(":checked") ? 1 : 0;
    } else if ($(this).attr("id") == "exact-match-excerpts") {
      exact_match_exc = $(this).is(":checked") ? 1 : 0;
    }
  });

  $("#mark-results").on("click", function() {
    mark();
  });

  $("#close-error").on("click", function() {
    $("#error-banner").css("display", "none");
  });

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
  
  if (q) {
    $("#term").val(q);
    var term = $("#term").val();
    request(term, target_lang, exact_match_gl, exact_match_exc)
  }

  if (l) {
    $("#target-lang").val(l);
  }
  
  $("#search-form").submit(function(event) {
    event.preventDefault();
    if (!isLoading) {
      isLoading = true;
      var term = $("#term").val();
      var target_lang = $("#target-lang").val();
      $("#warning-banner").css("display", "none");
      $("#error-banner").css("display", "none");
      request(term, target_lang, exact_match_gl, exact_match_exc);
    }
  });
});

function checkResultCount() {
  return new Promise((resolve, reject) => {
    if ($("#result-count-glossary").val() > 100 || $("#result-count-excerpts").val() > 100 && $("#term").val().length > 2) {
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

function checkResultLength(term) {
  if ((term.length < 3) && ($("#result-count-glossary").val() > 100 || $("#result-count-excerpts").val() > 100)) {
    $("#error-banner").css("display", "flex");
    $("#error-banner .error-msg").html("Maximum results search is disabled for terms which length is inferior to 3.");
    isLoading = false;
    return false;
  } else {
    return true;
  }
}

function request(term, target_lang, exact_match_gl, exact_match_exc) {
  if (!checkResultLength(term)) {
    return false;
  }

  checkResultCount().then(() => {
    $("#search-btn").prop("disabled", true);
    $("#loader").css("display", "inline-block");
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
        target_lang: target_lang,
        exact_match_gl: exact_match_gl,
        exact_match_exc: exact_match_exc
      }),
      success: function(response) {
        urlParams.set("q", term);
        urlParams.set("l", target_lang);
        const newUrl = window.location.pathname + "?" + urlParams.toString();
        window.history.pushState({ path: newUrl }, "", newUrl);
        get_glossary(response, Object.values(response).slice(-1)[0].length, $("#result-count-glossary").val())
        get_excerpts(response, Object.values(response)[0].length, $("#result-count-excerpts").val())
        $("#results").css("display", "block");
        $("#error-banner").css("display", "none");
        $("#loader").css("display", "none");
        document.title += ` :: ${term}`
      },
      error: function(jqXHR, textStatus, errorThrown) {
        $("#error-banner").css("display", "flex");
        $("#error-banner .error-msg").html(textStatus+": "+errorThrown);
        $("#loader").css("display", "none");
        // fix bug that prevents new search
      },
      complete: function() {
        isLoading = false;
        $("#search-btn").prop("disabled", false);
        $("#mark-results-container").css("display", "block");
      }
    });
  }).catch(() => {
    location.reload(); // not the best way of handling this... but fixes the bug that prevents from doing a new search after clicking on "Cancel"
  });

  return true;
}

function get_glossary(response, length, nb) {
  if (length > 0) {
    console.log("Found " + length + " glossary entries")
    var glossary_results = "";
    if (nb > length) {
      nb = length;
    }
    for (var i = 0; i < nb; i++) {
      glossary_results += `
        <tr>
          <td data-attribute="source">${response.gl_source[i]}<br><i>(${response.gl_source_pos[i]})</i></td>
          <td>${response.gl_translation[i]}<br><i>(${response.gl_target_pos[i]})</i></td>
          <td>${response.gl_source_def[i]}</td>
        </tr>
      `;
  }
    $("#glossary_results").html(glossary_results);
    $("#glossary_nb").html(` (${nb} results)`);
  } else {
    $("#glossary_results").html("<p>No results found in the glossary.</p>");
    $("#glossary_nb").html(` (0 results)`);
  }
};

function get_excerpts(response, length, nb) {
  if (length > 0) {
    console.log("Found " + length + " translations excerpts")
    var excerpts_results = "";
    if (nb > length) {
      nb = length;
    }
    for (var i = 0; i < nb; i++) {
      excerpts_results += `
        <tr>
          <td data-attribute="source">${response.exc_source[i]}</td>
          <td>${response.exc_translation[i]}</td>
          <td>${response.exc_cat[i]}</td>
          <td>${response.exc_platform[i]}</td>
          <td>${response.exc_product[i]}</td>
          <td>${response.exc_version[i]}</td>
        </tr>
      `;
  }
    $("#excerpts_results").html(excerpts_results);
    $("#excerpts_nb").html(` (${nb} results)`);
  } else {
    $("#excerpts_results").html("<p>No results found in the translations excerpts.</p>");
    $("#excerpts_nb").html(` (0 results)`);
  }
};