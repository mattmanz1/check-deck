console.log("StudyBuddy JavaScript is working!");
// Find the buttons on our HTML page
const loginButton = document.getElementById("login-tab");
const signupButton = document.getElementById("signup-tab");

// Find the sections we want to show or hide
const nameField = document.getElementById("name-field");
const confirmField = document.getElementById("confirm-field");

// Find the heading and submit button
const formTitle = document.getElementById("form-title");
const submitButton = document.getElementById("submit-btn");

// When someone clicks "Sign Up"
signupButton.addEventListener("click", function() {
    nameField.hidden = false;
    confirmField.hidden = false;

    formTitle.textContent = "Create Your Account!";
    submitButton.textContent = "Sign Up";
});

// When someone clicks "Log In"
loginButton.addEventListener("click", function() {
    nameField.hidden = true;
    confirmField.hidden = true;

    formTitle.textContent = "Welcome Back!";
    submitButton.textContent = "Log In";
});

// Prevent the unfinished form from submitting
document.getElementById("auth-form").addEventListener("submit", function(event) {
    event.preventDefault();
});
