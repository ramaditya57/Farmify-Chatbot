// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

// Dropdown initialization
const dropbtn = document.getElementById("dropbtn") || document.querySelector(".dropbtn") || document.getElementById("user-email");
const dropdownContent = document.getElementById("dropdown-content") || document.querySelector(".dropdown-content") || document.querySelector(".dropdown");

if (dropbtn && dropdownContent) {
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
}

// Fetch Firebase configuration dynamically from the backend
const firebaseConfig = await fetch('/api/firebase-config').then(res => res.json());

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

const userEmailElement = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

if (userEmailElement && logoutBtn) {
    console.log("🔹 Found user elements in DOM");

    // Check if user is logged in and update navbar
    onAuthStateChanged(auth, (user) => {
        console.log("🔍 Checking Auth State...");
        if (user) {
            console.log("✅ User Logged In:", user.email);
            userEmailElement.textContent = user.email;
        } else {
            console.warn("⚠️ No User Logged In. Redirecting to login...");
            window.location.href = firebaseConfig.cropProjectUrl || "/";
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
                window.location.href = firebaseConfig.cropProjectUrl || "/";
    
                // Completely disable back navigation
                setTimeout(() => {
                    history.replaceState(null, null, firebaseConfig.cropProjectUrl || "/"); // Replace history to prevent back
                }, 0);
            })
            .catch((error) => {
                console.error("❌ Logout Error:", error);
                alert("Error logging out: " + error.message);
            });
    });    
} else {
    console.error("❌ user-email or logout-btn not found in DOM!");
}
