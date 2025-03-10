import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../config/firebaseConfig';
import { signOut } from 'firebase/auth';
export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fix for the image picker
  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to photos in settings.');
        return;
      }
      
      // Launch the image library
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType, // Use the proper import
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      
      console.log("Image picker result:", result);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProfileImage(result.assets[0].uri);
        console.log('Image selected:', result.assets[0].uri);
      } else {
        console.log('User canceled image picker or error occurred.');
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to open the photo picker. Please try again.");
    }
  };
  
  const handleRegister = async () => {
    if (!email || !password || !firstName || !lastName || !studentId) {
      Alert.alert("Missing Information", "Please fill in all required fields.");
      return;
    }
  
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, "users", userCredential.user.uid), {
        firstName, lastName, studentId, email,
        profileImage: "https://www.iconpacks.net/icons/2/free-user-icon-3296-thumb.png",
        timestamp: new Date(),
      });
  
      Alert.alert("Success", "Account created! You will be redirected to Login.", [
        {
          text: "OK",
          onPress: async () => {
            await signOut(auth); // ล็อกเอาต์ออกจาก Firebase
          },
        },
      ]);
    } catch (error) {
      Alert.alert("Registration Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  /*const handleRegister = async () => {
    // Basic validation
    if (!email || !password || !firstName || !lastName || !studentId) {
      Alert.alert("Missing Information", "Please fill in all required fields.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Default profile image - no upload needed
      const defaultImageUrl = "https://www.iconpacks.net/icons/2/free-user-icon-3296-thumb.png";
      
      // Store user data in Firestore
      await setDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        studentId,
        email,
        profileImage: defaultImageUrl, // Use default image for now
        hasSelectedProfileImage: profileImage ? true : false, // Track if user selected an image
        timestamp: new Date(),
      });
      
      Alert.alert(
        "Success", 
        profileImage 
          ? "Account created! You can upload your profile picture from your profile settings later." 
          : "Account created! You can now log in.",
        [{ text: "OK", onPress: () => handleNavigation() }]
      );
    } catch (error) {
      console.error("🚨 Registration Failed:", error);
      Alert.alert("Registration Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };*/
  
  // Fix for navigation issue
  /*const handleNavigation = () => {
    try {
      // Try to navigate to 'Login'
      navigation.navigate('Login');
    } catch (navError) {
      console.log("Direct navigation failed:", navError);
      
      // If that fails, try to go back (if Login is the previous screen)
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        console.log("Navigation failed");
        Alert.alert(
          "Navigation Note", 
          "Your account has been created. Please return to the login screen manually."
        );
      }
    }
  };*/

  /*const handleNavigation = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };*/
  const handleNavigation = () => {
    if (navigation.canGoBack()) {
      navigation.goBack(); // ย้อนกลับไปหน้าก่อนหน้า
    } else {
      console.log("Navigation failed");
      Alert.alert("Navigation Error", "Please return to the login screen manually.");
    }
  };
  
  

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      {/* Profile Image Picker */}
      <TouchableOpacity 
        onPress={pickImage} 
        disabled={isLoading}
        activeOpacity={0.7}
        style={styles.imagePickerContainer}
      >
        <Image 
          source={profileImage ? { uri: profileImage } : require('../assets/default-avatar.png')} 
          style={styles.avatar} 
        />
        <Text style={styles.uploadText}>
          Select Profile Picture
        </Text>
        {profileImage && (
          <Text style={styles.note}>
            Image selected
          </Text>
        )}
      </TouchableOpacity>

      {/* User Input Fields */}
      <TextInput style={styles.input} placeholder="First Name *" value={firstName} onChangeText={setFirstName} editable={!isLoading} />
      <TextInput style={styles.input} placeholder="Last Name *" value={lastName} onChangeText={setLastName} editable={!isLoading} />
      <TextInput style={styles.input} placeholder="Student ID *" value={studentId} onChangeText={setStudentId} editable={!isLoading} />
      <TextInput style={styles.input} placeholder="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!isLoading} />
      <TextInput style={styles.input} placeholder="Password *" value={password} onChangeText={setPassword} secureTextEntry editable={!isLoading} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Creating account...</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            try {
              navigation.navigate('Login');
            } catch (error) {
              console.log("Navigation error:", error);
              Alert.alert("Navigation", "Please return to the login screen manually.");
            }
          }
        }} 
        disabled={isLoading}
        style={styles.loginLinkContainer}
      >
        <Text style={styles.link}>
          Already have an account? Login
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20 
  },
  input: { 
    width: '100%', 
    padding: 10, 
    borderWidth: 1, 
    marginBottom: 10, 
    borderRadius: 5 
  },
  imagePickerContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#ddd'
  },
  uploadText: { 
    color: 'blue', 
    marginBottom: 5,
    fontWeight: '500'
  },
  note: { 
    color: 'green', 
    fontSize: 12, 
    marginBottom: 5 
  },
  button: {
    backgroundColor: '#2196F3',
    width: '100%',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loginLinkContainer: {
    marginTop: 15,
    padding: 10,
  },
  link: { 
    color: 'blue',
    fontSize: 14
  },
  loadingContainer: { 
    alignItems: 'center', 
    marginVertical: 10 
  },
  loadingText: { 
    marginTop: 10, 
    color: '#666' 
  }
});