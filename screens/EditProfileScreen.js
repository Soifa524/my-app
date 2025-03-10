import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function EditProfileScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const auth = getAuth();
  const db = getFirestore();
  const storage = getStorage();

  // Fetch current user data
  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setFirstName(userData.firstName || '');
          setLastName(userData.lastName || '');
          setStudentId(userData.studentId || '');
          setProfileImage(userData.profileImage || null);
        }
      }
    };

    fetchUserData();
  }, []);

  // Request permission and pick image
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to allow access to your photos to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  // Upload image to Firebase Storage
  const uploadImage = async (uri) => {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storageRef = ref(storage, `profilePictures/${user.uid}`);
      await uploadBytes(storageRef, blob);
      
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image: ", error);
      return null;
    }
  };

  // Save all profile data
  const saveProfile = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");
      
      let imageUrl = profileImage;
      
      // Only upload if it's a local image (starts with file:// or content://)
      if (profileImage && (profileImage.startsWith('file://') || profileImage.startsWith('content://'))) {
        imageUrl = await uploadImage(profileImage);
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        firstName,
        lastName,
        studentId,
        profileImage: imageUrl,
        updatedAt: new Date()
      });
      
      Alert.alert("Success", "Profile updated successfully");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to update profile: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>
      
      <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
        {profileImage ? (
          <Image source={{ uri: profileImage }} style={styles.profileImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Text>Tap to add photo</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <TextInput
        style={styles.input}
        placeholder="First Name"
        value={firstName}
        onChangeText={setFirstName}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={lastName}
        onChangeText={setLastName}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Student ID"
        value={studentId}
        onChangeText={setStudentId}
        keyboardType="numeric"
      />
      
      <View style={styles.buttonContainer}>
        <Button
          title="Save Changes"
          onPress={saveProfile}
          disabled={loading}
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button
          title="Cancel"
          onPress={() => navigation.goBack()}
          color="gray"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 40,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e1e1e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 15,
  },
  buttonContainer: {
    marginVertical: 5,
  }
});