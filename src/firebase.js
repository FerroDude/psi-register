import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDhxZj7l-lKSPKD82q4l7CIxpgkh8Q8-GY",
  authDomain: "psi-register.firebaseapp.com",
  projectId: "psi-register",
  storageBucket: "psi-register.firebasestorage.app",
  messagingSenderId: "561818740515",
  appId: "1:561818740515:web:948ece5eceffb4c56bce96",
};

// Check if Firebase is properly configured
export const isFirebaseConfigured =
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID";

// Initialize Firebase only if configured
let app = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
}

export { db };
