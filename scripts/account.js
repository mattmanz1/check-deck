import {
    EmailAuthProvider,
    deleteUser,
    onAuthStateChanged,
    reauthenticateWithCredential,
    signOut,
    updatePassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase.js";

const accountEmail = document.getElementById("account-email");
const displayNameInput = document.getElementById("display-name");
const signOutButton = document.getElementById("sign-out");

onAuthStateChanged(auth, (user) => {
    if (!user) return;
    accountEmail.textContent = user.email || "";
    displayNameInput.value = user.displayName || "";
});

function showMessage(id, message, isError = false) {
    const element = document.getElementById(id);
    element.textContent = message;
    element.dataset.error = String(isError);
}

function getAuthErrorMessage(error) {
    const messages = {
        "auth/invalid-credential": "The current password is incorrect.",
        "auth/wrong-password": "The current password is incorrect.",
        "auth/email-password-required": "This action requires an email/password account.",
        "auth/weak-password": "Choose a stronger password with at least 6 characters.",
        "auth/requires-recent-login": "Please sign in again, then retry this action.",
        "auth/too-many-requests": "Too many attempts. Please try again later.",
        "auth/network-request-failed": "Network error. Check your connection and try again."
    };
    return messages[error.code] || "The request could not be completed. Please try again.";
}

async function reauthenticate(user, password) {
    if (!user.email) {
        throw Object.assign(new Error("Email/password account required."), {
            code: "auth/email-password-required"
        });
    }
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
}

signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
        await signOut(auth);
        window.location.replace("sign-in.html");
    } catch (error) {
        signOutButton.disabled = false;
        window.alert(getAuthErrorMessage(error));
    }
});

document.getElementById("name-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    const user = auth.currentUser;
    const displayName = displayNameInput.value.trim();
    if (!user || !displayName) return;

    button.disabled = true;
    showMessage("name-message", "");
    try {
        await updateProfile(user, { displayName });
        showMessage("name-message", "Display name updated.");
    } catch (error) {
        showMessage("name-message", getAuthErrorMessage(error), true);
    } finally {
        button.disabled = false;
    }
});

document.getElementById("password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const user = auth.currentUser;
    const currentPassword = form.elements.currentPassword.value;
    const newPassword = form.elements.newPassword.value;
    const confirmation = form.elements.confirmNewPassword.value;
    if (!user) return;

    if (newPassword !== confirmation) {
        showMessage("password-message", "The new passwords do not match.", true);
        form.elements.confirmNewPassword.focus();
        return;
    }

    button.disabled = true;
    showMessage("password-message", "");
    try {
        await reauthenticate(user, currentPassword);
        await updatePassword(user, newPassword);
        form.reset();
        showMessage("password-message", "Password updated.");
    } catch (error) {
        showMessage("password-message", getAuthErrorMessage(error), true);
    } finally {
        button.disabled = false;
    }
});

document.getElementById("delete-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const user = auth.currentUser;
    if (!user) return;

    if (form.elements.confirmation.value.trim() !== "DELETE") {
        showMessage("delete-message", "Type DELETE exactly to confirm account deletion.", true);
        form.elements.confirmation.focus();
        return;
    }

    button.disabled = true;
    showMessage("delete-message", "");
    try {
        await reauthenticate(user, form.elements.deletePassword.value);
        await deleteUser(user);
        window.location.replace("sign-in.html");
    } catch (error) {
        showMessage("delete-message", getAuthErrorMessage(error), true);
        button.disabled = false;
    }
});