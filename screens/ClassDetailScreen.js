import React, { useState, useEffect } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal
} from 'react-native';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ClassDetailScreen({ route, navigation }) {
  const { classData } = route.params;
  const [loading, setLoading] = useState(false);
  const [classDetails, setClassDetails] = useState(null);
  const [cno, setCno] = useState('');
  const [code, setCode] = useState('');
  const [remark, setRemark] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [activeCheckins, setActiveCheckins] = useState([]);
  
  // New state for question functionality
  const [questionVisible, setQuestionVisible] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [currentCheckinNo, setCurrentCheckinNo] = useState(null);
  
  const db = getFirestore();
  const auth = getAuth();

  useEffect(() => {
    fetchClassDetails();
    fetchActiveCheckins();
    
    // Attempt to load stored check-in information
    loadStoredCheckinInfo();
    
    // Return cleanup function
    return () => {
      console.log("Component unmounting, cleanup performed");
    };
  }, []);

  // Load stored check-in info
  const loadStoredCheckinInfo = async () => {
    try {
      const storedCheckinNo = await AsyncStorage.getItem('lastCheckinNo');
      if (storedCheckinNo) {
        setCno(storedCheckinNo);
        setCurrentCheckinNo(storedCheckinNo);
        // Set up listener immediately if we have a stored check-in number
        setupQuestionListener(storedCheckinNo);
      }
    } catch (error) {
      console.error("Error loading stored check-in info:", error);
    }
  };

  // Store class info in AsyncStorage
  const storeClassInfo = async () => {
    try {
      await AsyncStorage.setItem('lastClassId', classData.id);
      if (cno) {
        await AsyncStorage.setItem('lastCheckinNo', cno);
      }
    } catch (error) {
      console.error("Error storing class info:", error);
    }
  };

  // Modify your setupQuestionListener function to better handle the question data
const setupQuestionListener = (checkinNumber) => {
  if (!checkinNumber) return null;
  
  console.log(`Setting up question listener for check-in ${checkinNumber}`);
  
  const questionRef = doc(db, `classroom/${classData.id}/checkin/${checkinNumber}`);
  return onSnapshot(questionRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("Question snapshot data:", JSON.stringify(data));
      
      // Make sure we're checking both question_show and that there's a question_no/text
      if (data.question_show === true && data.question_no && data.question_text) {
        console.log("Question is active, showing modal");
        setCurrentQuestion({
          questionNo: data.question_no,
          questionText: data.question_text
        });
        setQuestionVisible(true);
      } else {
        console.log("Question is not active, hiding modal");
        setQuestionVisible(false);
        setCurrentQuestion(null);
      }
    }
  }, (error) => {
    console.error("Error listening for questions:", error);
  });
};

  // Effect to listen for active question when check-in number changes
  useEffect(() => {
    if (!cno) return;
    
    console.log(`Check-in number changed to: ${cno}`);
    setCurrentCheckinNo(cno);
    storeClassInfo();
    
    // Set up real-time listener for question status
    const unsubscribe = setupQuestionListener(cno);
    
    // Clean up listener on unmount or when cno changes
    return () => {
      if (unsubscribe) {
        console.log("Cleaning up question listener");
        unsubscribe();
      }
    };
  }, [cno, classData.id]);

  // Check for active questions in any active check-in
  useEffect(() => {
    if (activeCheckins.length > 0) {
      // Check if any active check-in has an active question
      const checkinWithQuestion = activeCheckins.find(checkin => 
        checkin.question_show === true
      );
      
      if (checkinWithQuestion) {
        console.log("Found active check-in with question:", checkinWithQuestion);
        setCno(checkinWithQuestion.cno.toString());
        setCurrentCheckinNo(checkinWithQuestion.cno.toString());
        setCurrentQuestion({
          questionNo: checkinWithQuestion.question_no,
          questionText: checkinWithQuestion.question_text
        });
        setQuestionVisible(true);
      }
    }
  }, [activeCheckins]);

  // Add this in your component 
useEffect(() => {
  console.log("Question visibility state:", questionVisible);
  console.log("Current question state:", currentQuestion);
}, [questionVisible, currentQuestion]);


  const fetchClassDetails = async () => {
    setLoading(true);
    try {
      // Fetch the latest class data
      const classDocRef = doc(db, 'classroom', classData.id);
      const classSnap = await getDoc(classDocRef);
      
      if (classSnap.exists()) {
        const details = classSnap.data();
        setClassDetails({
          id: classData.id,
          ...details
        });
      } else {
        Alert.alert("Error", "Class information not found");
        navigation.goBack();
      }
    } catch (error) {
      console.error("Error fetching class details:", error);
      Alert.alert("Error", "Failed to load class details");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveCheckins = async () => {
    try {
      const checkinsRef = collection(db, `classroom/${classData.id}/checkin`);
      const checkinsQuery = query(checkinsRef, where("status", "==", 1));
      const checkinsSnapshot = await getDocs(checkinsQuery);
      
      const active = [];
      checkinsSnapshot.forEach((doc) => {
        active.push({
          cno: doc.id,
          ...doc.data()
        });
      });
      
      setActiveCheckins(active);
      console.log("Active checkins:", JSON.stringify(active));
    } catch (error) {
      console.error("Error fetching active checkins:", error);
    }
  };

  const handleCheckIn = async () => {
    if (!cno.trim() || !code.trim()) {
      Alert.alert("Error", "Please enter both CNO and code");
      return;
    }

    setCheckingIn(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("You must be logged in to check in");
      }

      // Verify the checkin exists and is active
      const checkinRef = doc(db, `classroom/${classData.id}/checkin/${cno}`);
      const checkinSnap = await getDoc(checkinRef);
      
      if (!checkinSnap.exists()) {
        throw new Error("Invalid check-in number (CNO)");
      }
      
      const checkinData = checkinSnap.data();
      if (checkinData.status !== 1) {
        throw new Error("This check-in session is closed");
      }
      
      if (checkinData.code !== code) {
        throw new Error("Invalid check-in code");
      }
      
      // Check if student is already checked in
      const studentCheckinRef = doc(db, `classroom/${classData.id}/checkin/${cno}/students/${user.uid}`);
      const studentCheckinSnap = await getDoc(studentCheckinRef);
      
      if (studentCheckinSnap.exists()) {
        throw new Error("You have already checked in for this session");
      }
      
      // Get student data
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        throw new Error("User profile not found");
      }
      
      const userData = userSnap.data();
      
      // Record the check-in
      await setDoc(studentCheckinRef, {
        stdid: userData.studentId,
        name: `${userData.firstName} ${userData.lastName}`,
        date: new Date().toLocaleString('th-TH'),
        timestamp: serverTimestamp(),
        remark: remark.trim()
      });
      
      setCheckedIn(true);
      Alert.alert("Success", "You have successfully checked in!");
      
      // Reset form
      setRemark('');
      
      // Store check-in information in AsyncStorage
      await AsyncStorage.setItem('lastCheckinNo', cno);
      
      // Refresh active checkins
      fetchActiveCheckins();
      
    } catch (error) {
      console.error("Check-in error:", error);
      Alert.alert("Check-in Failed", error.message);
    } finally {
      setCheckingIn(false);
    }
  };

  // New function to handle answering questions
  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !currentQuestion) {
      Alert.alert("Error", "Please enter an answer");
      return;
    }

    setSubmittingAnswer(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("You must be logged in to submit an answer");
      }

      // Get student data
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        throw new Error("User profile not found");
      }
      
      const userData = userSnap.data();
      
      // Save the answer in the correct path
      const answerRef = doc(
        db, 
        `classroom/${classData.id}/checkin/${currentCheckinNo}/answers/${currentQuestion.questionNo}/students/${user.uid}`
      );
      
      await setDoc(answerRef, {
        stdid: userData.studentId,
        name: `${userData.firstName} ${userData.lastName}`,
        text: answer,
        time: new Date().toLocaleString('th-TH'),
        timestamp: serverTimestamp()
      });
      
      Alert.alert("Success", "Your answer has been submitted!");
      setAnswer('');
      
    } catch (error) {
      console.error("Submit answer error:", error);
      Alert.alert("Submit Failed", error.message);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Loading class details...</Text>
      </View>
    );
  }

  // Use classData as fallback if classDetails is not yet loaded
  const displayData = classDetails || classData;
  const classInfo = displayData.info || displayData;
  
  const className = classInfo.name || "Unnamed Class";
  const classCode = classInfo.code || displayData.id || "No Code";
  
  const classImage = classInfo.photo?.startsWith('http') 
    ? { uri: classInfo.photo } 
    : { uri: 'https://via.placeholder.com/300' };

  return (
    <View style={{flex: 1}}>
      <ScrollView style={styles.container}>
        <Image source={classImage} style={styles.headerImage} />
        
        <View style={styles.contentContainer}>
          <Text style={styles.className}>{className}</Text>
          <Text style={styles.classCode}>Class Code: {classCode}</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Check Attendance</Text>
            
            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter CNO (Check-in Number)"
                value={cno}
                onChangeText={setCno}
                keyboardType="numeric"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Enter Code"
                value={code}
                onChangeText={setCode}
              />
              
              <TextInput
                style={[styles.input, styles.remarkInput]}
                placeholder="Remarks (optional)"
                value={remark}
                onChangeText={setRemark}
                multiline
              />
              
              <TouchableOpacity 
                style={styles.checkInButton}
                onPress={handleCheckIn}
                disabled={checkingIn || checkedIn}
              >
                {checkingIn ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.buttonText}>
                    {checkedIn ? "Checked In ✓" : "Check In"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          
          {activeCheckins.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Check-ins</Text>
              {activeCheckins.map((checkin) => (
                <TouchableOpacity 
                  key={checkin.cno} 
                  style={styles.checkinItem}
                  onPress={() => {
                    setCno(checkin.cno.toString());
                    setCurrentCheckinNo(checkin.cno.toString());
                  }}
                >
                  <Text style={styles.checkinNumber}>Session #{checkin.cno}</Text>
                  <Text style={styles.checkinDate}>
                    Opened: {checkin.date}
                  </Text>
                  {checkin.question_show && (
                    <View style={styles.activeQuestionBadge}>
                      <Text style={styles.activeQuestionText}>Active Question</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Question Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={questionVisible}
        onRequestClose={() => {
          console.log("Question modal closed");
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Question {currentQuestion?.questionNo}</Text>
            
            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>{currentQuestion?.questionText}</Text>
            </View>
            
            <TextInput
              style={styles.answerInput}
              placeholder="Type your answer here..."
              value={answer}
              onChangeText={setAnswer}
              multiline
            />
            
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitAnswer}
              disabled={submittingAnswer}
            >
              {submittingAnswer ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.buttonText}>Submit Answer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  contentContainer: {
    padding: 20,
  },
  className: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  classCode: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  formContainer: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  remarkInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  checkInButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkinItem: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  checkinNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  checkinDate: {
    fontSize: 14,
    color: '#666',
  },
  activeQuestionBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  activeQuestionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  questionContainer: {
    backgroundColor: '#f0f8ff',
    borderRadius: 5,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
});