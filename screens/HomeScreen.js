import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Alert, TouchableOpacity, Image, TextInput, Modal, FlatList, ActivityIndicator } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection,
  getDocs,
  query
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

import { useNavigation, useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [classId, setClassId] = useState('');
  const [userClasses, setUserClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  const auth = getAuth();
  const db = getFirestore();
  const navigation = useNavigation();

  // Function to fetch user data
  const fetchUserData = async () => {
    setLoading(true);
    const user = auth.currentUser;
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        setUserData(userSnap.data());
      } else {
        console.log('No user data found');
      }
    }
    setLoading(false);
  };

// Function to fetch user's registered classes
const fetchUserClasses = async () => {
  setClassesLoading(true);
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not logged in");
    }

    console.log("Current user ID:", user.uid);

    // Get all classrooms the user is registered in
    const userClassesRef = collection(db, `users/${user.uid}/classroom`);
    const userClassesSnapshot = await getDocs(userClassesRef);
    
    console.log("User classes snapshot size:", userClassesSnapshot.size);
    
    const classPromises = [];
    userClassesSnapshot.forEach((document) => {
      // Only include classes with status 2 (registered)
      console.log("User class document data:", document.id, document.data());
      if (document.data().status === 2) {
        const classId = document.id;
        console.log("Fetching classroom with ID:", classId);
        
        const promise = getDoc(doc(db, 'classroom', classId))
          .then((classDoc) => {
            if (classDoc.exists()) {
              const classData = classDoc.data();
              console.log("Class data fetched:", classId, classData);
              return {
                id: classId,
                ...classData
              };
            }
            console.log("Class document doesn't exist:", classId);
            return null;
          });
        classPromises.push(promise);
      }
    });

    const classes = await Promise.all(classPromises);
    const filteredClasses = classes.filter(cls => cls !== null);
    
    console.log("Final classes data:", JSON.stringify(filteredClasses, null, 2));
    
    setUserClasses(filteredClasses);
  } catch (error) {
    console.error("Error fetching user classes:", error);
  } finally {
    setClassesLoading(false);
  }
};

  // Fetch user data and classes whenever HomeScreen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchUserData();
      fetchUserClasses();
    }, [])
  );

  // Default profile picture if the user hasn't uploaded one
  const defaultProfilePic = "https://cdn-icons-png.flaticon.com/512/6596/6596121.png";

  // Check if userData is null or undefined before accessing its properties
  const userImage = userData && userData.profileImage && userData.profileImage.startsWith('http') 
    ? { uri: userData.profileImage } 
    : { uri: defaultProfilePic };

  const requestCameraPermission = async () => {
    console.log("Requesting camera permission...");
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      console.log("Camera permission status:", status);
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        setShowScanner(true);
      } else {
        Alert.alert("Permission Denied", "Camera permission is required to scan QR codes");
      }
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      Alert.alert("Permission Error", `Failed to request camera permission: ${error.message}`);
      setHasPermission(false);
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    
    try {
      // Assuming data contains the class ID
      Alert.alert(
        "Class Registration",
        `Would you like to register for class: ${data}?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setScanned(false)
          },
          { 
            text: "Register", 
            onPress: () => registerForClass(data)
          }
        ]
      );
    } catch (error) {
      Alert.alert("Invalid QR Code", "The scanned QR code is not valid for class registration.");
      setScanned(false);
    }
  };

  const registerForClass = async (cid) => {
    try {
      setLoading(true);
      
      const user = auth.currentUser;
      if (!user) {
        throw new Error("You must be logged in to register for classes");
      }
      
      console.log("Registering for class ID:", cid);
      
      // Check if the classroom exists - using your structure: /classroom/{cid}
      const classDocRef = doc(db, 'classroom', cid);
      const classSnap = await getDoc(classDocRef);
      
      if (!classSnap.exists()) {
        console.log("Class not found:", cid);
        throw new Error("Class not found. Please check the ID and try again.");
      }
      
      console.log("Class data:", classSnap.data());
      
      // Check if user is already registered
      const userClassRef = doc(db, `users/${user.uid}/classroom/${cid}`);
      const userClassSnap = await getDoc(userClassRef);
      
      if (userClassSnap.exists()) {
        throw new Error("You are already registered for this class!");
      }
      
      // Add student to class using your structure
      await setDoc(doc(db, `classroom/${cid}/students/${user.uid}`), {
        stdid: userData.studentId,
        name: `${userData.firstName} ${userData.lastName}`
      });
      
      // Update user's classroom status using your structure
      await setDoc(doc(db, `users/${user.uid}/classroom/${cid}`), {
        status: 2
      });
      
      Alert.alert(
        "Registration Successful", 
        `You have successfully registered for class ID: ${cid}`,
        [{ text: "OK", onPress: () => {
          returnToHome();
          fetchUserClasses(); // Refresh the class list after registration
        }}]
      );
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert("Registration Failed", error.message);
      setScanned(false);
    } finally {
      setLoading(false);
      setShowManualInput(false);
    }
  };

  const handleManualRegister = () => {
    if (!classId.trim()) {
      Alert.alert("Error", "Please enter a valid Class ID");
      return;
    }
    registerForClass(classId);
  };

  const returnToHome = () => {
    setShowScanner(false);
    setScanned(false);
    setShowManualInput(false);
    setClassId('');
  };

  const renderClassItem = ({ item }) => {
    console.log("Rendering class item:", item);
  
    // Extract class details properly from item.info
    const className = item.info?.name || "Unnamed Class";
    const classCode = item.info?.code || item.id || "No Code";
    const classRoom = item.info?.room || "Not specified";
    
    const classImage = item.info?.photo?.startsWith('http') 
      ? { uri: item.info.photo } 
      : { uri: 'https://via.placeholder.com/150' };
  
    return (
      <TouchableOpacity 
        style={styles.classCard}
        onPress={() => navigation.navigate('ClassDetail', { classData: item })}
      >
        <Image source={classImage} style={styles.classImage} />
        <View style={styles.classInfo}>
          <Text style={styles.className}>{className}</Text>
          <Text style={styles.classDetail}>Subject Code: {classCode}</Text>
          <Text style={styles.classDetail}>Room: {classRoom}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Manual class ID input modal
  const renderManualInputModal = () => {
    return (
      <Modal
        visible={showManualInput}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Class by ID</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter Class ID (CID)"
              value={classId}
              onChangeText={setClassId}
              autoCapitalize="none"
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowManualInput(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.registerButton]} 
                onPress={handleManualRegister}
              >
                <Text style={styles.modalButtonText}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Home screen with student profile and buttons
  if (!showScanner) {
    return (
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text>Loading profile...</Text>
          </View>
        ) : (
          userData ? (
            <View style={styles.profileContainer}>
              <Image 
                source={userImage}
                style={styles.profileImage} 
              />
              <Text style={styles.profileText}>Name: {userData.firstName} {userData.lastName}</Text>
              <Text style={styles.profileText}>Student ID: {userData.studentId}</Text>
              <Text style={styles.profileText}>Email: {userData.email}</Text>

              <TouchableOpacity 
                style={styles.editButton} 
                onPress={() => navigation.navigate('EditProfile')}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text>No user data found.</Text>
          )
        )}

        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => setShowManualInput(true)}
          >
            <Text style={styles.buttonText}>Add Class by ID</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.button} 
            onPress={requestCameraPermission}
          >
            <Text style={styles.buttonText}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.classesContainer}>
          <Text style={styles.sectionTitle}>My Classes</Text>
          
          {classesLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : userClasses.length > 0 ? (
            <FlatList
              data={userClasses}
              renderItem={renderClassItem}
              keyExtractor={item => item.id}
              style={styles.classList}
            />
          ) : (
            <Text style={styles.emptyText}>You are not registered for any classes yet.</Text>
          )}
        </View>

        {renderManualInputModal()}
      </View>
    );
  }

  // Permission handling while in scanner mode
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
        <Button title="Go Back" onPress={returnToHome} />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>No access to camera</Text>
        <Button title="Try Again" onPress={requestCameraPermission} />
        <Button title="Go Back" onPress={returnToHome} />
      </View>
    );
  }

  // Scanner view
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <Text style={styles.scanText}>Scan QR Code</Text>
          {scanned && (
            <View style={styles.buttonContainer}>
              <Button title={'Scan Again'} onPress={() => setScanned(false)} />
            </View>
          )}
          <View style={styles.backButtonContainer}>
            <Button title="Back" onPress={returnToHome} />
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    width: '100%',
    elevation: 3,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profileText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    width: 200,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 30,
  },
  scanText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonContainer: {
    marginBottom: 15,
  },
  backButtonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
  },
  editButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  editButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  textInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    width: '45%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  registerButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  classesContainer: {
    flex: 1,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  classList: {
    width: '100%',
  },
  classCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  classImage: {
    width: 80,
    height: 80,
    borderRadius: 5,
  },
  classInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  classDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  }
});