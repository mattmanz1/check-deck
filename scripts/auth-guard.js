import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase.js";

onAuthStateChanged(
    auth,
    (user) => {
        if (!user) {
            window.location.replace("sign-in.html");
            return;
        }

        const username = document.querySelector(".username");
        if (username) {
            username.textContent = user.displayName || user.email || "there";
        }

        document.documentElement.classList.remove("auth-pending");
    },
    () => window.location.replace("sign-in.html")
);