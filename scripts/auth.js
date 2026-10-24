import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase.js";

const loginButton = document.getElementById("login-tab");
const signupButton = document.getElementById("signup-tab");
const nameField = document.getElementById("name-field");
const confirmField = document.getElementById("confirm-field");
const displayNameInput = document.getElementById("display-name");
const confirmPasswordInput = document.getElementById("confirm-password");
const passwordInput = document.getElementById("password");
const formTitle = document.getElementById("form-title");
const submitButton = document.getElementById("submit-btn");
const authForm = document.getElementById("auth-form");
const authMessage = document.getElementById("auth-message");
let isSignUp = false;

function setAuthMode(signUp) {
    isSignUp = signUp;
    nameField.hidden = !signUp;
    confirmField.hidden = !signUp;
    displayNameInput.required = signUp;
    confirmPasswordInput.required = signUp;
    passwordInput.autocomplete = signUp ? "new-password" : "current-password";

    formTitle.textContent = signUp ? "Create Your Account!" : "Welcome Back!";
    submitButton.textContent = signUp ? "Sign Up" : "Log In";
    loginButton.classList.toggle("active", !signUp);
    signupButton.classList.toggle("active", signUp);
    loginButton.setAttribute("aria-pressed", String(!signUp));
    signupButton.setAttribute("aria-pressed", String(signUp));
    authMessage.textContent = "";
}

signupButton.addEventListener("click", () => setAuthMode(true));
loginButton.addEventListener("click", () => setAuthMode(false));

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    authMessage.textContent = "";

    if (isSignUp && passwordInput.value !== confirmPasswordInput.value) {
        authMessage.textContent = "Your passwords do not match.";
        confirmPasswordInput.focus();
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = isSignUp ? "Creating account..." : "Logging in...";

    try {
        if (isSignUp) {
            const credential = await createUserWithEmailAndPassword(
                auth,
                document.getElementById("email").value.trim(),
                passwordInput.value
            );
            await updateProfile(credential.user, {
                displayName: displayNameInput.value.trim()
            });
        } else {
            await signInWithEmailAndPassword(
                auth,
                document.getElementById("email").value.trim(),
                passwordInput.value
            );
        }

        window.location.assign("main.html");
    } catch (error) {
        const messages = {
            "auth/email-already-in-use": "An account already exists with that email.",
            "auth/invalid-credential": "Email or password is incorrect.",
            "auth/invalid-email": "Enter a valid email address.",
            "auth/too-many-requests": "Too many attempts. Please try again later.",
            "auth/weak-password": "Choose a stronger password with at least 6 characters."
        };
        authMessage.textContent = messages[error.code] || "Authentication failed. Please try again.";
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = isSignUp ? "Sign Up" : "Log In";
    }
});

document.getElementById("show-password").addEventListener("change", (event) => {
    const inputType = event.currentTarget.checked ? "text" : "password";
    passwordInput.type = inputType;
    confirmPasswordInput.type = inputType;
});