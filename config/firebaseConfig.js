import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDVy16XZdGWZxxOYQQ1TFuIEu22uOhaTc4",
    authDomain: "finalproject-c037e.firebaseapp.com",
    projectId: "finalproject-c037e",
    storageBucket: "finalproject-c037e.firebasestorage.app",
    messagingSenderId: "294930330109",
    appId: "1:294930330109:web:8d06bbecbf790f558b2994"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
