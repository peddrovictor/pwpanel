import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, onValue } from "firebase/database";

// ╔══════════════════════════════════════════════════════════════╗
// ║  INSTRUÇÕES: Substitua os valores abaixo pelos do seu       ║
// ║  projeto Firebase. Veja o README.md para o passo a passo.   ║
// ╚══════════════════════════════════════════════════════════════╝
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAd7r6JECufoqo5oa7REFq9XuR2QwS-1nA",
  authDomain: "roma-fc6c2.firebaseapp.com",
  databaseURL: "https://roma-fc6c2-default-rtdb.firebaseio.com",
  projectId: "roma-fc6c2",
  storageBucket: "roma-fc6c2.firebasestorage.app",
  messagingSenderId: "523678450138",
  appId: "1:523678450138:web:304276666a90693bb9c0e3",
  measurementId: "G-BQNGRGKBSB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);