document.addEventListener("DOMContentLoaded", () => {
    const dropbtn = document.getElementById("dropbtn");
    const dropdownContent = document.getElementById("dropdown-content");

    const toggleDropdown = () => {
        dropdownContent.classList.toggle("show");
    };

    // Toggle dropdown when clicking the dropdown button
    dropbtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (event) => {
        if (!dropbtn.contains(event.target) && !dropdownContent.contains(event.target)) {
            dropdownContent.classList.remove("show");
        }
    });
});


// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyARwsPQOMNbrGVlIM6AJKHmg0mWDl445gU",
    authDomain: "farmify-d901b.firebaseapp.com",
    projectId: "farmify-d901b",
    storageBucket: "farmify-d901b.firebasestorage.app",
    messagingSenderId: "782437842701",
    appId: "1:782437842701:web:af941448a8ad8ecb4aba44",
    measurementId: "G-F2S0ZV5KGD"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Ensure session persistence
setPersistence(auth, browserSessionPersistence)
    .then(() => {
        console.log("✅ Session persistence enabled.");
    })
    .catch((error) => {
        console.error("⚠️ Error enabling session persistence:", error);
    });

// Ensure DOM is fully loaded before attaching event listeners
document.addEventListener("DOMContentLoaded", () => {
    console.log("🔹 DOM Loaded");

    const userEmailElement = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");

    if (!userEmailElement || !logoutBtn) {
        console.error("❌ Elements not found in DOM!");
        return;
    }

    // Check if user is logged in and update navbar
    onAuthStateChanged(auth, (user) => {
        console.log("🔍 Checking Auth State...");
        if (user) {
            console.log("✅ User Logged In:", user.email);
            userEmailElement.textContent = user.email;
        } else {
            console.warn("⚠️ No User Logged In. Redirecting to login...");
            window.location.href = "/";
        }
    });

    // Handle logout
    logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();
        signOut(auth)
            .then(() => {
                console.log("✅ Logout successful!");
    
                // Clear session and local storage
                sessionStorage.clear();
                localStorage.clear();
    
                // Redirect to login page
                window.location.href = "/";
    
                // Completely disable back navigation
                setTimeout(() => {
                    history.replaceState(null, null, "/"); // Replace history to prevent back
                }, 0);
            })
            .catch((error) => {
                console.error("❌ Logout Error:", error);
                alert("Error logging out: " + error.message);
            });
    });    
});
