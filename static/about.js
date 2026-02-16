$(function () {
  $("#send-btn").on("click", function () {
    hideBanner("error");
    hideBanner("info");
    const form_name = $("#name").val();
    const form_email = $("#email").val();
    const form_message = $("#message").val();
    if (form_name == "" || form_email == "" || form_message == "") {
      showBanner("error", "Please fill in all fields.");
    } else {
      sendMessage(form_name, form_email, form_message);
    }
  });
});

function sendMessage(name, email, message) {
  $("#loader").css("display", "flex");
  const xhr = $.ajax({
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    url: "/about/",
    type: "POST",
    dataType: "json",
    data: JSON.stringify({
      name: name,
      email: email,
      message: message,
    }),
    success: function () {
      showBanner(
        "success",
        "Message sent successfully! We'll get back to you soon.",
      );
    },
    error: function () {
      const errorMessage =
        xhr.responseJSON?.error || "An error occurred. Please try again.";
      showBanner("error", errorMessage);
    },
    complete: function () {
      $("#loader").css("display", "none");
      $("#name").val("");
      $("#email").val("");
      $("#message").val("");
    },
  });
}
