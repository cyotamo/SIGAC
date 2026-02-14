import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-z5eNHi-rosi0Ak64bPeQZU-6oJA9DDk",
  authDomain: "sigacur00.firebaseapp.com",
  projectId: "sigacur00",
  storageBucket: "sigacur00.firebasestorage.app",
  messagingSenderId: "224944945440",
  appId: "1:224944945440:web:743589f8f137d25d44ff45"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
