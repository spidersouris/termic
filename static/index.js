const urlParams = new URLSearchParams(window.location.search);

$(function() {
  const q = urlParams.get("q");
  
  if (q) {
    // perform search using the value of the "q" parameter
    $("#term").val(q);
    var term = $("#term").val();
    var target_lang = $("#target-lang").val();
    request(term, target_lang)
  }
});

function search() {
  $("#search-form").submit(function(event) {
    event.preventDefault();
    var term = $("#term").val();
    var target_lang = $("#target-lang").val();
    request(term, target_lang)
  })
};

function request(term, target_lang) {
  $.ajax({
    url: "/",
    type: "POST",
    data: JSON.stringify({
      term: term,
      target_lang: target_lang
    }),
    contentType: "application/json;charset=UTF-8",
    success: function(response) {
      urlParams.set("q", term);
      const newUrl = window.location.pathname + "?" + urlParams.toString();
      window.history.pushState({ path: newUrl }, "", newUrl);
      get_glossary(response, Object.values(response).slice(-1)[0].length, $("#result-count-glossary").val())
      get_excerpts(response, Object.values(response)[0].length, $("#result-count-excerpts").val())
      $("#results").css("display", "block");
     },
    error: function(errorThrown) {
      alert("Error: " + errorThrown);
    }
  });
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
          <td>${response.gl_source[i]}<br>(${response.gl_source_pos[i]})</td>
          <td>${response.gl_translation[i]}<br>(${response.gl_target_pos[i]})</td>
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
          <td>${response.exc_source[i]}</td>
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