import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBidnXU_NCRQ30PMRp6v_Inab5AZbZ4Bp8",
    authDomain: "check-deck.firebaseapp.com",
    projectId: "check-deck",
    storageBucket: "check-deck.firebasestorage.app",
    messagingSenderId: "929654818978",
    appId: "1:929654818978:web:3066b20b7cbb605a5c2ffb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);