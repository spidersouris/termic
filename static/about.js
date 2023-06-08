$(function() {
    $("#send-btn").on("click", function() {
        hideBanner("error");
        hideBanner("info");
        var form_name = $("#name").val();
        var form_email = $("#email").val();
        var form_message = $("#message").val();
        if (form_name == "" || form_email == "" || form_message == "") {
            showBanner("error", "Please fill in all fields.");
        } else {
            sendMessage(form_name, form_email, form_message);
        }
    });
});

function sendMessage(name, email, message) {
    $("#loader").css("display", "flex");
    $.ajax({
        headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
        },
        url: "/about/",
        type: "POST",
        dataType: "json",
        data: JSON.stringify({
        name: name,
        email: email,
        message: message
        }),
        success: function() {
            showBanner("info", "Message sent successfully! We'll get back to you soon.");
        },
        error: function() {
            showBanner("error", "An error occurred. Please try again.");
        },
        complete: function() {
            $("#loader").css("display", "none");
            $("#name").val("");
            $("#email").val("");
            $("#message").val("");
        }
    });
}