import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAd7r6JECufoqo5oa7REFq9XuR2QwS-1nA",
  authDomain: "roma-fc6c2.firebaseapp.com",
  databaseURL: "https://roma-fc6c2-default-rtdb.firebaseio.com",
  projectId: "roma-fc6c2",
  storageBucket: "roma-fc6c2.firebasestorage.app",
  messagingSenderId: "523678450138",
  appId: "1:523678450138:web:304276666a90693bb9c0e3"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const storage = {
  async get(key) {
    try {
      const snapshot = await get(ref(db, key));
      if (snapshot.exists()) {
        return { value: JSON.stringify(snapshot.val()) };
      }
      return null;
    } catch (e) {
      console.error("Firebase get error:", e);
      return null;
    }
  },

  async save(key, data) {
    try {
      await set(ref(db, key), data);
    } catch (e) {
      console.error("Firebase set error:", e);
    }
  },

  subscribe(key, callback) {
    const unsubscribe = onValue(ref(db, key), (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    });
    return unsubscribe;
  }
};
